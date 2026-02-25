/**
 * Legendary Encounter System — Phase 278
 * Rare mini-boss encounters with powerful legendary Pokemon and unique rewards.
 * Legendaries appear on deep floors with a low chance, making them feel special.
 */

import { MetaSaveData } from "./save-system";

// ── Interfaces ──

export interface LegendaryReward {
  gold: number;
  exp: number;
  uniqueItem?: string;
  skillId?: string;
}

export interface LegendaryEncounter {
  speciesId: string;
  name: string;
  type: string;
  level: number;
  hpMultiplier: number;
  atkMultiplier: number;
  defMultiplier: number;
  specialMove: string;
  reward: LegendaryReward;
  flavorText: string;
}

// ── Legendary Encounter Definitions ──

export const LEGENDARY_ENCOUNTERS: LegendaryEncounter[] = [
  {
    speciesId: "mewtwo",
    name: "Mewtwo",
    type: "Psychic",
    level: 50,
    hpMultiplier: 3.0,
    atkMultiplier: 2.5,
    defMultiplier: 1.5,
    specialMove: "psychicBlast",
    reward: { gold: 500, exp: 800, skillId: "psychicBlast" },
    flavorText: "The air warps with immense psychic energy...",
  },
  {
    speciesId: "rayquaza",
    name: "Rayquaza",
    type: "Dragon",
    level: 55,
    hpMultiplier: 4.0,
    atkMultiplier: 3.0,
    defMultiplier: 1.5,
    specialMove: "dragonAscent",
    reward: { gold: 800, exp: 1200, uniqueItem: "autoReviver" },
    flavorText: "A deafening roar echoes from above...",
  },
  {
    speciesId: "lugia",
    name: "Lugia",
    type: "Flying",
    level: 50,
    hpMultiplier: 3.5,
    atkMultiplier: 2.0,
    defMultiplier: 2.0,
    specialMove: "aeroblast",
    reward: { gold: 600, exp: 900 },
    flavorText: "A gust of oceanic wind sweeps through the dungeon...",
  },
  {
    speciesId: "hooh",
    name: "Ho-Oh",
    type: "Fire",
    level: 50,
    hpMultiplier: 3.0,
    atkMultiplier: 2.5,
    defMultiplier: 1.5,
    specialMove: "sacredFire",
    reward: { gold: 600, exp: 900, skillId: "sacredFire" },
    flavorText: "Radiant flames illuminate the darkness...",
  },
  {
    speciesId: "groudon",
    name: "Groudon",
    type: "Ground",
    level: 55,
    hpMultiplier: 4.0,
    atkMultiplier: 2.0,
    defMultiplier: 2.0,
    specialMove: "precipiceBlades",
    reward: { gold: 700, exp: 1000 },
    flavorText: "The ground trembles violently...",
  },
  {
    speciesId: "kyogre",
    name: "Kyogre",
    type: "Water",
    level: 55,
    hpMultiplier: 4.0,
    atkMultiplier: 2.0,
    defMultiplier: 2.0,
    specialMove: "originPulse",
    reward: { gold: 700, exp: 1000 },
    flavorText: "Water seeps from every crack in the walls...",
  },
  {
    speciesId: "dialga",
    name: "Dialga",
    type: "Steel",
    level: 60,
    hpMultiplier: 4.0,
    atkMultiplier: 3.0,
    defMultiplier: 2.0,
    specialMove: "roarOfTime",
    reward: { gold: 1000, exp: 1500 },
    flavorText: "Time itself seems to slow and distort...",
  },
  {
    speciesId: "palkia",
    name: "Palkia",
    type: "Dragon",
    level: 60,
    hpMultiplier: 4.0,
    atkMultiplier: 3.0,
    defMultiplier: 2.0,
    specialMove: "spacialRend",
    reward: { gold: 1000, exp: 1500 },
    flavorText: "Cracks appear in the fabric of space...",
  },
  {
    speciesId: "arceus",
    name: "Arceus",
    type: "Normal",
    level: 70,
    hpMultiplier: 5.0,
    atkMultiplier: 4.0,
    defMultiplier: 3.0,
    specialMove: "judgment",
    reward: { gold: 2000, exp: 3000, uniqueItem: "goldenApple" },
    flavorText: "A blinding divine light fills the floor...",
  },
  {
    speciesId: "giratina",
    name: "Giratina",
    type: "Ghost",
    level: 60,
    hpMultiplier: 4.5,
    atkMultiplier: 3.0,
    defMultiplier: 2.0,
    specialMove: "shadowForce",
    reward: { gold: 1000, exp: 1500, skillId: "shadowForce" },
    flavorText: "Shadows writhe and twist unnaturally...",
  },
];

// ── Encounter Logic ──

/**
 * Determine if a legendary encounter should trigger on this floor.
 * - Only on floors 70%+ deep in the dungeon.
 * - 3% base chance, +1% per NG+ level.
 * - Never in dungeons with < 8 floors.
 * - Max 1 legendary per run (tracked by `legendaryEncountered` flag passed in).
 */
export function shouldEncounterLegendary(
  floor: number,
  totalFloors: number,
  meta: MetaSaveData,
  legendaryAlreadyEncountered = false,
): boolean {
  // Max 1 legendary per run
  if (legendaryAlreadyEncountered) return false;

  // Never in short dungeons
  if (totalFloors < 8) return false;

  // Only on floors 70%+ deep
  const depthRatio = floor / totalFloors;
  if (depthRatio < 0.7) return false;

  // 3% base + 1% per NG+ level
  const ngPlusLevel = meta.ngPlusLevel ?? 0;
  const chance = 0.03 + ngPlusLevel * 0.01;

  return Math.random() < chance;
}

/**
 * Roll which legendary encounter to spawn based on floor and difficulty.
 * Higher-level legendaries are more likely on deeper floors / higher difficulty.
 */
export function rollLegendaryEncounter(
  floor: number,
  difficulty: number,
): LegendaryEncounter {
  const eligible = getEncountersByDifficulty(difficulty);
  // Weight toward harder legendaries on deeper floors
  const weighted = eligible.map((enc, _i) => {
    // Encounters with higher levels are weighted higher on deeper floors
    const levelWeight = Math.max(0.1, 1 - Math.abs(enc.level - floor) / 50);
    return { enc, weight: levelWeight };
  });

  const totalWeight = weighted.reduce((sum, w) => sum + w.weight, 0);
  let roll = Math.random() * totalWeight;

  for (const w of weighted) {
    roll -= w.weight;
    if (roll <= 0) return w.enc;
  }

  // Fallback: return a random eligible encounter
  return eligible[Math.floor(Math.random() * eligible.length)];
}

/**
 * Get encounters appropriate for a given difficulty level.
 * - difficulty < 2: only lv50 legendaries
 * - difficulty < 5: lv50-55 legendaries
 * - difficulty < 8: lv50-60 legendaries
 * - difficulty >= 8: all legendaries including Arceus
 */
export function getEncountersByDifficulty(
  difficulty: number,
): LegendaryEncounter[] {
  let maxLevel: number;
  if (difficulty < 2) maxLevel = 50;
  else if (difficulty < 5) maxLevel = 55;
  else if (difficulty < 8) maxLevel = 60;
  else maxLevel = 70;

  const eligible = LEGENDARY_ENCOUNTERS.filter((e) => e.level <= maxLevel);
  // Always return at least the base-tier legendaries
  return eligible.length > 0 ? eligible : LEGENDARY_ENCOUNTERS.filter((e) => e.level <= 50);
}
