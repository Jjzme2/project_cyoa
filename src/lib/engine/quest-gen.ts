import { ProcGenQuest } from '@/types/procgen';
import { SeededRNG } from './seed-rng';
import { NameGenerator } from './name-gen';

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
}
