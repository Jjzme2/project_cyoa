import { SeededRNG } from './seed-rng';
import { NameGenerator } from './name-gen';
import type { WorldBible, GenesisRegion, GenesisFaction, GenesisCharacter, GenesisEvent } from '@/types';

/**
 * Procedural world genesis — the STRUCTURE half of the hybrid.
 *
 * From a world's seed it builds a cross-referenced skeleton: regions, then
 * factions seated in those regions with a logical rivalry/alliance web, then
 * characters belonging to factions with grudges/bonds that reference each other,
 * then a history that ties it all together. Everything cross-references, so even
 * before an LLM elaborates the prose the world is internally coherent (and the
 * templated prose here is the fail-open fallback if elaboration is unavailable).
 */

const BIOMES = ['forest', 'desert', 'mountains', 'swamp', 'tundra', 'coast', 'caverns', 'plains', 'volcanic', 'ruins'];

const ARCHETYPES = [
  { label: 'martial order', nouns: ['Vanguard', 'Legion', 'Wardens', 'Bulwark'], roles: ['Lord-Commander', 'Knight-Captain', 'Banner-Sergeant'] },
  { label: 'arcane circle', nouns: ['Conclave', 'Circle', 'Covenant', 'Synod'], roles: ['Archmagus', 'Cipher', 'Adept'] },
  { label: 'merchant power', nouns: ['Guild', 'League', 'Syndicate', 'Concord'], roles: ['Guildmaster', 'Factor', 'Coinwarden'] },
  { label: 'outlaw band', nouns: ['Brotherhood', 'Free Company', 'Reavers', 'Wolves'], roles: ['Chieftain', 'Outrider', 'Fence'] },
  { label: 'zealous faith', nouns: ['Faithful', 'Choir', 'Communion', 'Flame'], roles: ['High Prophet', 'Inquisitor', 'Acolyte'] },
];

function shuffle<T>(arr: T[], rng: SeededRNG): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng.nextInt(0, i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function buildGenesisSkeleton(worldSeed: number, tone = 'Epic Fantasy'): WorldBible {
  const rng = new SeededRNG(worldSeed);
  const nameGen = new NameGenerator(SeededRNG.deriveSeed(worldSeed, 'genesis'));

  // 1. Regions
  const regionCount = rng.nextInt(3, 4);
  const biomes = shuffle(BIOMES, rng).slice(0, regionCount);
  const regions: GenesisRegion[] = biomes.map((biome) => {
    const name = nameGen.generateName('medium');
    return { name, biome, description: `${name}, a land of ${biome}.` };
  });

  // 2. Factions — each seated in a region, with a logical rivalry/alliance web.
  const archs = shuffle(ARCHETYPES, rng).slice(0, Math.min(rng.nextInt(3, 4), regions.length + 1));
  const factions: GenesisFaction[] = archs.map((arch, i) => {
    const proper = nameGen.generateName('short');
    const noun = rng.pick(arch.nouns);
    const name = rng.nextFloat() < 0.5 ? `The ${proper} ${noun}` : `${noun} of ${proper}`;
    const seat = regions[i % regions.length].name;
    return {
      name,
      archetype: arch.label,
      seat,
      founding: `Founded in ${seat} as ${withArticle(arch.label)}.`,
      rivalOf: null as string | null,
      allyOf: null as string | null,
    };
  });
  // Pair a rivalry and an alliance among them.
  if (factions.length >= 2) {
    factions[0].rivalOf = factions[1].name;
    factions[1].rivalOf = factions[0].name;
  }
  if (factions.length >= 4) {
    factions[2].allyOf = factions[3].name;
    factions[3].allyOf = factions[2].name;
  } else if (factions.length === 3) {
    factions[2].allyOf = factions[0].name;
  }

  // 3. Characters — belong to factions, with cross-referenced ties.
  const charCount = rng.nextInt(4, 6);
  const characters: GenesisCharacter[] = [];
  for (let i = 0; i < charCount; i++) {
    const faction = factions[i % factions.length];
    const arch = archs[i % archs.length];
    const role = rng.pick(arch.roles);
    const name = nameGen.generateName('long');
    // Tie: to the rival faction (grudge) or ally (bond) where one exists.
    let tie: string | null = null;
    if (faction.rivalOf) tie = `Bears a grudge against ${faction.rivalOf}.`;
    else if (faction.allyOf) tie = `Sworn ally to the cause of ${faction.allyOf}.`;
    characters.push({ name, role, faction: faction.name, bio: `${role} of ${faction.name}, seated in ${faction.seat}.`, tie });
  }

  // 4. History — references the factions/regions/characters above.
  const history: GenesisEvent[] = [];
  if (factions.length >= 2) {
    history.push({ era: 'Ages past', title: 'The Sundering', account: `${factions[0].name} and ${factions[1].name} first drew blood over ${factions[0].seat}.` });
  }
  if (regions.length >= 2) {
    history.push({ era: 'The old wars', title: `The Fall of ${regions[1].name}`, account: `${regions[1].name} was laid waste, its people scattered.` });
  }
  if (characters.length >= 1) {
    history.push({ era: 'A generation ago', title: 'The Betrayal', account: `${characters[0].name} turned against their own, and nothing was the same.` });
  }
  if (factions.length >= 3) {
    history.push({ era: 'Recent years', title: 'An Uneasy Peace', account: `${factions[2].name} brokered a fragile accord that still holds — barely.` });
  }
  void tone;

  return { regions, factions, characters, history, generatedAt: new Date().toISOString() };
}

function withArticle(s: string): string {
  return /^[aeiou]/i.test(s) ? `an ${s}` : `a ${s}`;
}
