/**
 * Seeded Pseudo-Random Number Generator using Mulberry32 algorithm.
 * Fast, small, and deterministic.
 */
export class SeededRNG {
  private state: number;

  constructor(seed: number) {
    this.state = seed;
  }

  /**
   * Returns a pseudo-random float between 0 (inclusive) and 1 (exclusive).
   */
  public nextFloat(): number {
    this.state |= 0;
    this.state = this.state + 0x6D2B79F5 | 0;
    let t = Math.imul(this.state ^ this.state >>> 15, 1 | this.state);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }

  /**
   * Returns a pseudo-random integer between min and max (inclusive).
   */
  public nextInt(min: number, max: number): number {
    return Math.floor(this.nextFloat() * (max - min + 1)) + min;
  }

  /**
   * Picks a random element from an array.
   */
  public pick<T>(array: T[]): T {
    return array[this.nextInt(0, array.length - 1)];
  }

  /**
   * Helper to hash a string into a 32-bit integer.
   * Useful for converting string paths/salts into seeds.
   */
  public static hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Derives a deterministic sub-seed combining a base seed and a string salt.
   */
  public static deriveSeed(baseSeed: number, salt: string): number {
    return baseSeed ^ SeededRNG.hashString(salt);
  }
}
