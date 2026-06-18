import { Story, World } from '@/types/index';
import { WorldState, GOAPAgent } from '@/types/goap';
import { EngineState } from '@/types/engine';
import { EnvironmentGenerator } from './environment-gen';
import { EncounterGenerator } from './encounter-gen';
import { QuestGenerator } from './quest-gen';
import { AgentManager } from './agent-manager';
import { FactionManager } from './faction-manager';
import { EconomyManager, createDefaultEconomy } from './economy-manager';
import { SeededRNG } from './seed-rng';

export interface NarrativeContext {
  environmentalContext: string;
  activeEncounters: string[];
  npcActions: string[];
  activeQuests: string[];
  factionStatus: string;   // standing power summary (dominant faction, rivalries)
  factionEvents: string[]; // per-turn action outcomes
  economySummary: string;
}

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

    // Restore or initialise GOAP agents
    if (this.story.goapEnabled && this.story.characters) {
      for (const char of this.story.characters) {
        if (char.goapConfig) {
          const agent: GOAPAgent = {
            characterId: char.name,
            goals: char.goapConfig.goals,
            availableActions: char.goapConfig.availableActions,
            personality: char.goapConfig.personality,
            currentPlan: null,
            memory: [],
          };
          this.agentManager.registerAgent(agent);
        }
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
    };

    // 1. ProcGen: environment
    const env = this.envGen.generateEnvironment(nodePath, depth);
    context.environmentalContext = env.ambientDescription;

    // 2. ProcGen: encounters
    const encounter = this.encounterGen.generateEncounter(nodePath, env.biome, currentState);
    if (encounter) context.activeEncounters.push(encounter.narrativeHook);

    // 3. ProcGen: quests (if toggled)
    if (this.story.implementQuests) {
      const quest = this.questGen.generateQuest(nodePath);
      if (quest) context.activeQuests.push(quest.narrativePrompt);
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

    // 6. GOAP agents
    if (this.story.goapEnabled) {
      context.npcActions = this.agentManager.updateTurn(currentState);
    }

    // 7. Build updated EngineState for persistence
    const turnCount = (priorState?.turnCount ?? 0) + 1;
    const updatedEngineState: EngineState = {
      worldState: currentState,
      agentMemories: this.agentManager.serializeMemories(),
      factions: updatedFactions,
      economy,
      turnCount,
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

    if (lines.length === 0) return '';

    return [
      '\n### SYSTEM-DRIVEN NARRATIVE EVENTS',
      'The following events are occurring right now. Weave them naturally into the narrative prose — do not list them verbatim.\n',
      ...lines,
    ].join('\n');
  }
}
