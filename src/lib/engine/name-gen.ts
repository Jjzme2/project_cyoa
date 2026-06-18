import { SeededRNG } from './seed-rng';

/**
 * A simple Markov-chain inspired name generator, seeded for determinism.
 */
export class NameGenerator {
  private rng: SeededRNG;

  // Simple hardcoded syllables for now. 
  // In a full implementation, these could be extracted from World lore.
  private prefixes = ['Aero', 'Bal', 'Cor', 'Drav', 'El', 'Fae', 'Garn', 'Hal', 'Ith', 'Jor', 'Kal', 'Lor', 'Mor', 'Nyx', 'Or', 'Py', 'Quin', 'Rha', 'Syl', 'Tho', 'Ur', 'Val', 'Wra', 'Xy', 'Yv', 'Zar'];
  private middles = ['a', 'e', 'i', 'o', 'u', 'ae', 'io', 'en', 'ar', 'ul', 'in', 'os'];
  private suffixes = ['dor', 'gard', 'heim', 'ith', 'jus', 'kin', 'lan', 'mir', 'nor', 'os', 'pyr', 'qir', 'run', 'sil', 'thor', 'us', 'var', 'wyn', 'x', 'ya', 'zor', 'ville', 'town', 'burg', 'stead'];

  constructor(seed: number) {
    this.rng = new SeededRNG(seed);
  }

  /**
   * Generates a random, pronounceable name.
   */
  public generateName(length: 'short' | 'medium' | 'long' = 'medium'): string {
    let name = this.rng.pick(this.prefixes);
    
    if (length === 'medium' || length === 'long') {
      name += this.rng.pick(this.middles);
    }
    
    if (length === 'long' || this.rng.nextFloat() > 0.5) {
      name += this.rng.pick(this.suffixes);
    } else {
      // Sometimes use a different suffix list for variety
      name += this.rng.pick(['ton', 'ley', 'ford', 'bridge', 'gate', 'wood']);
    }

    return name;
  }
}
