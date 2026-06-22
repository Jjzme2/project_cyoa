import { Story, World } from '@/types/index';
import { WorldState, GOAPAgent } from '@/types/goap';
import { EngineState } from '@/types/engine';
import { EnvironmentGenerator } from './environment-gen';
import { EncounterGenerator } from './encounter-gen';
import { QuestGenerator } from './quest-gen';
import { AgentManager, defaultGoapConfig } from './agent-manager';
import { FactionManager } from './faction-manager';
import { EconomyManager, createDefaultEconomy } from './economy-manager';
import { SeededRNG } from './seed-rng';
import { DramaManager } from './drama-manager';
import { RelationshipGraph } from './relationship-graph';
import { AgentAffect } from './agent-affect';
import { BeliefModel } from './belief';

export interface NarrativeContext {
  environmentalContext: string;
  activeEncounters: string[];
  npcActions: string[];
  activeQuests: string[];
  factionStatus: string;   // standing power summary (dominant faction, rivalries)
  factionEvents: string[]; // per-turn action outcomes
  economySummary: string;
  pacingDirective: string; // AI Director instruction for this turn's tension
  relationshipSummary: string; // who stands warm/cold toward the protagonist
  demeanour: string; // per-character mood/emotional tone
}

/** How much a character's own action shifts their standing with the protagonist. */
const RELATIONSHIP_DELTA: Record<string, number> = {
  social_betray: -0.35,
  combat_attack_player: -0.4,
  social_intimidate: -0.25,
  social_offer_aid: 0.3,
  social_persuade: 0.15,
};

export interface NarrativeBuildResult {
  context: NarrativeContext;
  updatedEngineState: EngineState;
}

/**
 * Orchestrates GOAP, ProcGen, Factions, and Economy into a single AI prompt block.
 * Accepts an optional prior EngineState to restore from persistence; otherwise initialises fresh.
 */
export class NarrativeBuilder {
  private story: Story;
  private world: World;
  private envGen: EnvironmentGenerator;
  private encounterGen: EncounterGenerator;
  private questGen: QuestGenerator;
  private agentManager: AgentManager;
  private factionManager: FactionManager;
  private economyManager: EconomyManager;

  constructor(story: Story, world: World, priorState?: EngineState) {
    this.story = story;
    this.world = world;

    const baseSeed = world.seed ?? SeededRNG.hashString(story.title);
    const storySeed = SeededRNG.deriveSeed(baseSeed, story.id);

    this.envGen = new EnvironmentGenerator(storySeed);
    this.encounterGen = new EncounterGenerator(storySeed);
    this.questGen = new QuestGenerator(storySeed);
    this.agentManager = new AgentManager();
    this.factionManager = new FactionManager(storySeed);
    this.economyManager = new EconomyManager();

    // Register a GOAP agent for every living character. Authored goapConfigs
    // are used as-is; everyone else (including emergent characters) gets a
    // synthesised default so enabling GOAP actually produces living behaviour.
    if (this.story.goapEnabled && this.story.characters) {
      for (const char of this.story.characters) {
        if (char.status && char.status.toLowerCase() === 'deceased') continue;
        const config = char.goapConfig ?? defaultGoapConfig(char.name);
        const agent: GOAPAgent = {
          characterId: char.name,
          goals: config.goals,
          availableActions: config.availableActions,
          personality: config.personality,
          currentPlan: null,
          memory: [],
        };
        this.agentManager.registerAgent(agent);
      }
      if (priorState?.agentMemories) {
        this.agentManager.restoreMemories(priorState.agentMemories);
      }
    }
  }

  /**
   * Runs one simulation tick (GOAP, factions, economy, procgen) and
   * returns both the AI-ready narrative context and the updated EngineState.
   */
  public buildContext(nodePath: string, depth: number, currentState: WorldState, priorState?: EngineState): NarrativeBuildResult {
    const context: NarrativeContext = {
      environmentalContext: '',
      activeEncounters: [],
      npcActions: [],
      activeQuests: [],
      factionStatus: '',
      factionEvents: [],
      economySummary: '',
      pacingDirective: '',
      relationshipSummary: '',
      demeanour: '',
    };

    // AI Director: decide this turn's pacing beat from carried-over tension.
    const dm = new DramaManager();
    const priorDirector = priorState?.director ?? DramaManager.INITIAL;
    const beat = dm.decideBeat(priorDirector);

    // 1. ProcGen: environment
    const env = this.envGen.generateEnvironment(nodePath, depth);
    context.environmentalContext = env.ambientDescription;

    // 2. ProcGen: encounters — the Director suppresses them during respite and
    // forces a complication when escalating out of a lull.
    if (beat !== 'respite') {
      const encounter = this.encounterGen.generateEncounter(nodePath, env.biome, currentState);
      if (encounter) context.activeEncounters.push(encounter.narrativeHook);
      else if (beat === 'escalate') context.activeEncounters.push('A sudden complication forces itself upon the scene.');
    }

    // 3. ProcGen: quests (if toggled). Quests now run as a multi-beat arc
    // (call → journey → struggle → resolution) persisted across nodes, so they
    // read as a coherent mini-story. A new quest only starts once the last one
    // resolves.
    let questState = priorState?.quest;
    if (this.story.implementQuests) {
      let active = questState && questState.stage !== 'done' ? questState : undefined;
      if (!active) {
        const fresh = this.questGen.generateQuest(nodePath);
        if (fresh) active = { ...fresh, stage: 'call', turnsOnStage: 0 };
      }
      if (active) {
        const { prompt, next } = this.questGen.beat(active);
        if (prompt) context.activeQuests.push(prompt);
        questState = next;
      } else {
        questState = undefined;
      }
    }

    // 4. Factions
    const baseSeed = this.world.seed ?? SeededRNG.hashString(this.story.title);
    const factions = priorState?.factions ?? FactionManager.generateDefaultFactions(baseSeed);
    const economy  = priorState?.economy  ?? createDefaultEconomy();

    const { narrativeEvents: factionEvents, updatedFactions } = this.factionManager.tick(factions, economy);
    context.factionEvents = factionEvents.slice(0, 2); // cap to 2 per turn to avoid prompt bloat
    const factionStatus = FactionManager.getSummary(updatedFactions);
    if (factionStatus) context.factionStatus = factionStatus;

    // 5. Economy
    this.economyManager.tick(economy);
    const economySummary = EconomyManager.getSummary(economy);
    if (economySummary) context.economySummary = economySummary;

    // 6. GOAP agents + relationship graph. Seed baseline scene facts so action
    // preconditions are satisfiable (negative preconditions like
    // `player.underAttack: false` can't match an absent key); explicit/
    // carried-forward state still wins.
    let hostileNpc = false;
    let relationships = priorState?.relationships;
    let affect = priorState?.affect;
    let belief = priorState?.belief;
    if (this.story.goapEnabled) {
      const baseline: WorldState = { 'player.inSight': true, 'player.underAttack': false };
      for (const k in baseline) {
        if (currentState[k] === undefined) currentState[k] = baseline[k];
      }

      const living = (this.story.characters ?? [])
        .filter((c) => !(c.status && c.status.toLowerCase() === 'deceased'))
        .map((c) => c.name);
      relationships = RelationshipGraph.init(living, priorState?.relationships);
      // Characters act on PERCEIVED standing, which lags the truth — so gossip
      // changes behaviour gradually and the naive can be briefly deceived.
      belief = BeliefModel.update(living, relationships.affinity, priorState?.belief);
      this.agentManager.setAffinities(belief.perceived);

      const outcomes = this.agentManager.updateTurn(currentState);
      context.npcActions = outcomes.map((o) => o.prose);

      // Each action shifts the actor's standing and ripples to kindred characters.
      for (const o of outcomes) {
        const delta = RELATIONSHIP_DELTA[o.actionId];
        if (delta) RelationshipGraph.applyEvent(relationships, o.actorId, delta, living);
      }
      hostileNpc = outcomes.some(
        (o) => o.category === 'combat' || o.actionId === 'social_betray' || o.actionId === 'social_intimidate',
      );
      context.relationshipSummary = RelationshipGraph.summary(relationships);

      // Affective layer: mood reflects each character's PERCEIVED standing.
      affect = AgentAffect.compute(
        living,
        belief.perceived,
        currentState['player.underAttack'] === true,
        priorState?.affect,
      );
      context.demeanour = AgentAffect.summary(affect);
    }

    // 7. AI Director: fold this turn's events into the next tension level and
    // hand the AI an explicit pacing instruction.
    const director = dm.update(priorDirector, beat, {
      encounter: context.activeEncounters.length > 0,
      factionConflict: context.factionEvents.length > 0,
      hostileNpc,
      combat: currentState['player.underAttack'] === true,
    });
    context.pacingDirective = dm.directive(beat);

    // 8. Build updated EngineState for persistence
    const turnCount = (priorState?.turnCount ?? 0) + 1;
    const updatedEngineState: EngineState = {
      worldState: currentState,
      agentMemories: this.agentManager.serializeMemories(),
      factions: updatedFactions,
      economy,
      turnCount,
      director,
      ...(relationships ? { relationships } : {}),
      ...(questState ? { quest: questState } : {}),
      ...(affect ? { affect } : {}),
      ...(belief ? { belief } : {}),
    };

    return { context, updatedEngineState };
  }

  /** Formats a NarrativeContext into the markdown block injected into the AI prompt. */
  public formatForPrompt(context: NarrativeContext): string {
    const lines: string[] = [];

    if (context.environmentalContext) lines.push(`**Environment:** ${context.environmentalContext}`);
    if (context.activeEncounters.length > 0) lines.push(`**Encounters:** ${context.activeEncounters.join(' ')}`);
    if (context.activeQuests.length > 0) lines.push(`**Events:** ${context.activeQuests.join(' ')}`);
    if (context.factionStatus) lines.push(`**World Politics:** ${context.factionStatus}`);
    if (context.factionEvents.length > 0) lines.push(`**Faction Activity:** ${context.factionEvents.join(' ')}`);
    if (context.economySummary) lines.push(`**Economy:** ${context.economySummary}`);
    if (context.npcActions.length > 0) lines.push(`**Character Actions:** ${context.npcActions.join(' ')}`);
    if (context.relationshipSummary) lines.push(`**Standing:** ${context.relationshipSummary}`);
    if (context.demeanour) lines.push(`**Demeanour:** ${context.demeanour}`);
    if (context.pacingDirective) lines.push(`**Pacing (director):** ${context.pacingDirective}`);

    if (lines.length === 0) return '';

    return [
      '\n### SYSTEM-DRIVEN NARRATIVE EVENTS',
      'The following events are occurring right now. Weave them naturally into the narrative prose — do not list them verbatim.\n',
      ...lines,
    ].join('\n');
  }
}
