import { Biome, Weather, TimeOfDay, GeneratedEnvironment, Landmark } from '@/types/procgen';
import { SeededRNG } from './seed-rng';
import { NameGenerator } from './name-gen';

export class EnvironmentGenerator {
  private rng: SeededRNG;
  private nameGen: NameGenerator;

  constructor(seed: number) {
    this.rng = new SeededRNG(seed);
    this.nameGen = new NameGenerator(seed);
  }

  /**
   * Generates a deterministic environment for a specific node in the story.
   * Node depth is used to progress time and weather naturally.
   */
  public generateEnvironment(nodePath: string, depth: number): GeneratedEnvironment {
    // We derive a specific seed for this exact node path to ensure revisiting
    // the same node always yields the same environment.
    const nodeRng = new SeededRNG(SeededRNG.deriveSeed(this.rng['state'], nodePath));

    const biome = this.selectBiome(nodeRng);
    const timeOfDay = this.calculateTimeOfDay(depth);
    const weather = this.calculateWeather(depth, biome, nodeRng);
    
    // Generate 0-2 landmarks
    const landmarks: Landmark[] = [];
    const numLandmarks = nodeRng.nextInt(0, 2);
    for (let i = 0; i < numLandmarks; i++) {
      landmarks.push(this.generateLandmark(biome, nodeRng));
    }

    const ambientDescription = this.composeDescription(biome, weather, timeOfDay, landmarks);

    return {
      biome,
      weather,
      timeOfDay,
      landmarks,
      ambientDescription
    };
  }

  private selectBiome(rng: SeededRNG): Biome {
    const biomes: Biome[] = ['forest', 'desert', 'mountains', 'swamp', 'tundra', 'coast', 'caverns', 'plains', 'volcanic', 'ruins'];
    return rng.pick(biomes);
  }

  private calculateTimeOfDay(depth: number): TimeOfDay {
    const times: TimeOfDay[] = ['dawn', 'morning', 'midday', 'afternoon', 'dusk', 'evening', 'midnight', 'deepnight'];
    // Time progresses 1 step per node depth. We use modulo to cycle through days.
    // Assuming story starts at morning (index 1)
    const startIndex = 1;
    return times[(startIndex + depth) % times.length];
  }

  private calculateWeather(depth: number, biome: Biome, rng: SeededRNG): Weather {
    // Weather shifts slowly. We use depth to determine if weather changes.
    // E.g., weather changes every 3-5 nodes.
    const weatherEpoch = Math.floor(depth / 4);
    
    // Derive a weather-specific seed for this epoch
    const weatherRng = new SeededRNG(SeededRNG.deriveSeed(rng['state'], `weather_${weatherEpoch}`));
    
    const baseWeather: Weather[] = ['clear', 'clear', 'rain', 'fog', 'storm'];
    
    // Biome overrides
    if (biome === 'desert' || biome === 'volcanic') return weatherRng.pick(['clear', 'clear', 'heatwave']);
    if (biome === 'tundra') return weatherRng.pick(['clear', 'snow', 'snow', 'aurora']);
    
    return weatherRng.pick(baseWeather);
  }

  private generateLandmark(biome: Biome, rng: SeededRNG): Landmark {
    const type = rng.pick(['ancient ruin', 'strange rock formation', 'abandoned camp', 'lone tree', 'crystal outcropping']);
    return {
      name: this.nameGen.generateName(),
      type: type,
      description: `A ${type} that catches the eye.`
    };
  }

  private composeDescription(biome: Biome, weather: Weather, timeOfDay: TimeOfDay, landmarks: Landmark[]): string {
    let desc = `The environment is a ${biome}. It is currently ${timeOfDay} with ${weather} weather. `;
    if (landmarks.length > 0) {
      desc += `Notable sights include: ${landmarks.map(l => l.name + ' (' + l.type + ')').join(', ')}.`;
    }
    return desc;
  }
}
