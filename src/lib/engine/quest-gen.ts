import { ProcGenQuest, ActiveQuest, QuestStage } from '@/types/procgen';
import { SeededRNG } from './seed-rng';
import { NameGenerator } from './name-gen';

const STAGE_ORDER: QuestStage[] = ['call', 'journey', 'struggle', 'resolution', 'done'];

const STRUGGLE_VERB: Record<ProcGenQuest['type'], string> = {
  kill: 'confront',
  fetch: 'claim',
  escort: 'see safely through with',
  explore: 'brave',
  deliver: 'complete the delivery of',
};

const JOURNEY_OBSTACLES = [
  'an unexpected obstacle blocks the way',
  'old enemies take notice of the effort',
  'the path exacts a price before it yields',
  'a rival is pursuing the same end',
  'the way forward demands a hard choice',
];

export class QuestGenerator {
  private rng: SeededRNG;
  private nameGen: NameGenerator;

  constructor(seed: number) {
    this.rng = new SeededRNG(seed);
    this.nameGen = new NameGenerator(seed);
  }

  /**
   * Generates a procedural quest if requested and if random roll passes.
   */
  public generateQuest(nodePath: string): ProcGenQuest | null {
    const questRng = new SeededRNG(SeededRNG.deriveSeed(this.rng['state'], nodePath + '_quest'));
    
    // Only 20% chance to generate a quest at a given node to avoid spam
    if (questRng.nextFloat() > 0.2) {
      return null;
    }

    const types: ('fetch' | 'kill' | 'escort' | 'explore' | 'deliver')[] = ['fetch', 'kill', 'escort', 'explore', 'deliver'];
    const type = questRng.pick(types);
    const id = `quest_${questRng.nextInt(1000, 9999)}`;
    const giverId = this.nameGen.generateName('short'); // A minor NPC name

    let target = '';
    let rewardText = '';
    let narrativePrompt = '';

    switch (type) {
      case 'fetch':
        target = questRng.pick(['a rare herb', 'an ancient heirloom', 'stolen supplies']);
        rewardText = 'a handful of coins';
        narrativePrompt = `${giverId} begs you to find ${target} and promises ${rewardText} in return.`;
        break;
      case 'kill':
        target = questRng.pick(['a local bandit leader', 'a roaming beast', 'a corrupt guard']);
        rewardText = 'a valuable weapon';
        narrativePrompt = `${giverId} asks for your help to eliminate ${target}, offering ${rewardText} as a bounty.`;
        break;
      case 'escort':
        target = this.nameGen.generateName();
        rewardText = 'their eternal gratitude and some supplies';
        narrativePrompt = `${giverId} needs someone to safely escort ${target} through dangerous territory for ${rewardText}.`;
        break;
      case 'explore':
        target = 'the ' + this.nameGen.generateName() + ' ' + questRng.pick(['Ruins', 'Caves', 'Forest']);
        rewardText = 'a share of any treasure found';
        narrativePrompt = `${giverId} shares a rumor about ${target} and suggests investigating it together for ${rewardText}.`;
        break;
      case 'deliver':
        target = 'a sealed letter';
        const destination = this.nameGen.generateName() + ' ' + questRng.pick(['Town', 'Keep', 'Outpost']);
        rewardText = 'safe passage';
        narrativePrompt = `${giverId} hurriedly hands you ${target}, pleading for you to deliver it to ${destination} in exchange for ${rewardText}.`;
        break;
    }

    return {
      id,
      giverId,
      type,
      target,
      rewardText,
      narrativePrompt
    };
  }

  /**
   * Emit the prompt for the quest's current beat and return the quest advanced
   * to the next beat. The arc runs call → journey → struggle → resolution →
   * done, one beat per chapter, so a quest reads as a coherent mini-story rather
   * than an isolated prompt.
   */
  public beat(active: ActiveQuest): { prompt: string; next: ActiveQuest } {
    const prompt = this.stagePrompt(active);
    const idx = STAGE_ORDER.indexOf(active.stage);
    const nextStage = STAGE_ORDER[Math.min(idx + 1, STAGE_ORDER.length - 1)];
    return { prompt, next: { ...active, stage: nextStage, turnsOnStage: 0 } };
  }

  private stagePrompt(q: ActiveQuest): string {
    switch (q.stage) {
      case 'call':
        return q.narrativePrompt;
      case 'journey': {
        const r = new SeededRNG(SeededRNG.hashString(`${q.id}_journey`));
        return `The pursuit of ${q.target} grows complicated — ${r.pick(JOURNEY_OBSTACLES)}.`;
      }
      case 'struggle':
        return `The moment comes to ${STRUGGLE_VERB[q.type]} ${q.target}; ${q.giverId}'s hopes turn on what happens next.`;
      case 'resolution':
        return `The matter of ${q.target} reaches its end — ${q.giverId}'s promise of ${q.rewardText} now comes due, for better or worse.`;
      default:
        return '';
    }
  }
}
