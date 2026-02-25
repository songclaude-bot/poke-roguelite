/**
 * Mini-Boss System — powerful single enemies on regular floors.
 * Spawn on ~10% of non-boss floors after floor 3.
 * Stronger than normal enemies but weaker than floor bosses.
 * Drop guaranteed rewards (gold, blessings, relics, or items).
 */

import { SPECIES } from "./pokemon-data";

// ── Interfaces ──

export interface MiniBoss {
  speciesId: string;
  name: string;
  level: number;
  hpMult: number;      // multiplier on base HP (2.0-3.0)
  atkMult: number;      // multiplier on base ATK (1.5-2.0)
  defMult: number;      // multiplier on base DEF (1.3-1.5)
  rewardType: "relic" | "blessing" | "gold" | "item";
  rewardValue?: number; // gold amount for gold rewards
  color: number;        // tint color for visual distinction
}

// ── Mini-Boss Pool (strong/iconic Pokemon that exist in SPECIES) ──

interface MiniBossTemplate {
  speciesId: string;
  name: string;
  color: number;
}

const MINI_BOSS_POOL: MiniBossTemplate[] = [
  { speciesId: "scyther", name: "Elite Scyther", color: 0x44cc44 },
  { speciesId: "gengar", name: "Shadow Gengar", color: 0x6644aa },
  { speciesId: "machamp", name: "Champion Machamp", color: 0xcc8844 },
  { speciesId: "alakazam", name: "Sage Alakazam", color: 0xccaa44 },
  { speciesId: "gyarados", name: "Raging Gyarados", color: 0x4466cc },
  { speciesId: "charizard", name: "Blazing Charizard", color: 0xff6622 },
  { speciesId: "lapras", name: "Frozen Lapras", color: 0x66bbee },
  { speciesId: "dragonite", name: "Ancient Dragonite", color: 0xff8844 },
];

// Filter to only include species that actually exist in the game data
function getValidPool(): MiniBossTemplate[] {
  return MINI_BOSS_POOL.filter(mb => SPECIES[mb.speciesId] != null);
}

// ── Public API ──

/**
 * Determine whether a mini-boss should spawn on this floor.
 * ~10% chance on non-boss floors after floor 3. Higher difficulty increases chance slightly.
 */
export function shouldSpawnMiniBoss(
  floor: number,
  isBossFloor: boolean,
  difficulty: number
): boolean {
  // Never spawn on boss floors or early floors
  if (isBossFloor || floor < 3) return false;
  // Base 10% chance, +1% per difficulty point above 1, capped at 18%
  const chance = Math.min(0.18, 0.10 + Math.max(0, (difficulty - 1) * 0.01));
  return Math.random() < chance;
}

/**
 * Roll a random mini-boss for the given floor and difficulty.
 * Stat multipliers scale slightly with floor depth.
 */
export function rollMiniBoss(floor: number, difficulty: number): MiniBoss | null {
  const pool = getValidPool();
  if (pool.length === 0) return null;

  const template = pool[Math.floor(Math.random() * pool.length)];

  // Scale multipliers with floor depth (gradual increase)
  const depthFactor = Math.min(1.0, (floor - 3) / 20); // 0.0 at floor 3, 1.0 at floor 23+

  const hpMult = 2.0 + depthFactor * 1.0;    // 2.0 - 3.0
  const atkMult = 1.5 + depthFactor * 0.5;    // 1.5 - 2.0
  const defMult = 1.3 + depthFactor * 0.2;    // 1.3 - 1.5

  // Level is floor-based + small bonus
  const level = Math.floor((2 + floor) + depthFactor * 3);

  // Roll reward type: 40% gold, 30% blessing, 20% relic, 10% item
  const roll = Math.random();
  let rewardType: "gold" | "blessing" | "relic" | "item";
  if (roll < 0.40) {
    rewardType = "gold";
  } else if (roll < 0.70) {
    rewardType = "blessing";
  } else if (roll < 0.90) {
    rewardType = "relic";
  } else {
    rewardType = "item";
  }

  // Gold reward scales with floor (100-500)
  const rewardValue = rewardType === "gold"
    ? Math.floor(100 + (floor / 30) * 400 * difficulty)
    : undefined;

  return {
    speciesId: template.speciesId,
    name: template.name,
    level,
    hpMult,
    atkMult,
    defMult,
    rewardType,
    rewardValue,
    color: template.color,
  };
}

/**
 * Get the concrete reward from a defeated mini-boss.
 * Returns a structured reward object that the DungeonScene can interpret.
 */
export function getMiniBossReward(miniBoss: MiniBoss): { type: string; value: number } {
  switch (miniBoss.rewardType) {
    case "gold":
      return { type: "gold", value: miniBoss.rewardValue ?? 200 };
    case "blessing":
      return { type: "blessing", value: 1 };
    case "relic":
      return { type: "relic", value: 1 };
    case "item":
      return { type: "item", value: 1 };
    default:
      return { type: "gold", value: 200 };
  }
}
