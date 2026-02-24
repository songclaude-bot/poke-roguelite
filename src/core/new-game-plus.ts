/**
 * New Game Plus (NG+) prestige system.
 * After reaching certain milestone total-clears, players can activate NG+ levels
 * to earn permanent, cumulative bonuses. NG+ is purely additive — nothing is reset.
 */

import { MetaSaveData, saveMeta } from "./save-system";

// ── Interfaces ──

export interface NGPlusBonus {
  id: string;
  name: string;
  description: string;
  effect: string;      // identifier for the effect type
  value: number;       // effect magnitude
}

export interface NGPlusData {
  level: number;       // NG+ level (0 = normal, 1 = NG+1, 2 = NG+2, etc.)
  bonuses: NGPlusBonus[];
}

// ── NG+ Level Definitions ──

interface NGPlusLevelDef {
  level: number;
  requiredClears: number;
  bonuses: NGPlusBonus[];
}

const NG_PLUS_LEVELS: NGPlusLevelDef[] = [
  {
    level: 1,
    requiredClears: 30,
    bonuses: [
      { id: "ng1_gold",  name: "Gold Start",    description: "+10% starting gold each run",  effect: "startingGold",  value: 10 },
      { id: "ng1_hp",    name: "Vitality I",    description: "+5% base HP",                   effect: "hpPercent",     value: 5 },
    ],
  },
  {
    level: 2,
    requiredClears: 50,
    bonuses: [
      { id: "ng2_exp",   name: "Wisdom I",      description: "+15% EXP gain",                 effect: "expPercent",    value: 15 },
      { id: "ng2_item",  name: "Lucky Start",   description: "Start with a random item",      effect: "startItem",     value: 1 },
    ],
  },
  {
    level: 3,
    requiredClears: 80,
    bonuses: [
      { id: "ng3_atk",   name: "Power I",       description: "+10% ATK",                      effect: "atkPercent",    value: 10 },
      { id: "ng3_pp",    name: "Deep Reserves", description: "+3 PP to all skills",            effect: "bonusPP",       value: 3 },
    ],
  },
  {
    level: 4,
    requiredClears: 120,
    bonuses: [
      { id: "ng4_gold",  name: "Bounty Hunter", description: "+20% gold from enemies",        effect: "goldPercent",   value: 20 },
      { id: "ng4_belly", name: "Iron Stomach",  description: "Belly drains 10% slower",       effect: "bellyDrain",    value: 10 },
    ],
  },
  {
    level: 5,
    requiredClears: 200,
    bonuses: [
      { id: "ng5_stats", name: "Ascendant",     description: "+15% all stats",                effect: "allStats",      value: 15 },
      { id: "ng5_drops", name: "Fortune",        description: "Enemies drop items 20% more",  effect: "itemDrop",      value: 20 },
    ],
  },
];

// ── Public API ──

/**
 * Calculate the highest NG+ level the player can activate based on total clears.
 * This returns the maximum level available, not what they've activated.
 */
export function getAvailableNGPlusLevel(meta: MetaSaveData): number {
  let maxLevel = 0;
  for (const def of NG_PLUS_LEVELS) {
    if (meta.totalClears >= def.requiredClears) {
      maxLevel = def.level;
    }
  }
  return maxLevel;
}

/**
 * Get the player's current activated NG+ level from meta save data.
 */
export function getNGPlusLevel(meta: MetaSaveData): number {
  return meta.ngPlusLevel ?? 0;
}

/**
 * Get all cumulative bonuses for a given NG+ level.
 * Returns bonuses from level 1 through the given level.
 */
export function getCurrentBonuses(level: number): NGPlusBonus[] {
  const bonuses: NGPlusBonus[] = [];
  for (const def of NG_PLUS_LEVELS) {
    if (def.level <= level) {
      bonuses.push(...def.bonuses);
    }
  }
  return bonuses;
}

/**
 * Get the requirement and bonuses for the next NG+ level.
 * Returns null if player is at max NG+ level.
 */
export function getNextNGPlusRequirement(level: number): { clears: number; bonuses: NGPlusBonus[] } | null {
  const nextDef = NG_PLUS_LEVELS.find(d => d.level === level + 1);
  if (!nextDef) return null;
  return { clears: nextDef.requiredClears, bonuses: nextDef.bonuses };
}

/**
 * Activate the next NG+ level. Returns the updated meta data.
 * Does nothing if already at max level or requirements not met.
 */
export function activateNGPlus(meta: MetaSaveData): MetaSaveData {
  const currentLevel = getNGPlusLevel(meta);
  const available = getAvailableNGPlusLevel(meta);
  if (available <= currentLevel) return meta; // nothing to activate

  meta.ngPlusLevel = currentLevel + 1; // activate one level at a time
  saveMeta(meta);
  return meta;
}

/**
 * Check if the player can activate the next NG+ level.
 */
export function canActivateNGPlus(meta: MetaSaveData): boolean {
  const currentLevel = getNGPlusLevel(meta);
  const available = getAvailableNGPlusLevel(meta);
  return available > currentLevel;
}

// ── Aggregated Bonus Helpers (for DungeonScene integration) ──

export interface NGPlusBonusEffects {
  startingGoldPercent: number;   // % bonus to starting gold
  hpPercent: number;             // % bonus to base HP
  expPercent: number;            // % bonus to EXP gain
  startWithItem: boolean;        // whether to give a random starting item
  atkPercent: number;            // % bonus to ATK
  bonusPP: number;               // extra PP per skill
  goldPercent: number;           // % bonus to gold from enemies
  bellyDrainReduction: number;   // % reduction in belly drain
  allStatsPercent: number;       // % bonus to all stats (HP, ATK, DEF)
  itemDropPercent: number;       // % bonus to enemy item drop rate
}

/**
 * Compute aggregated bonus effects from all active NG+ bonuses.
 */
export function getNGPlusBonusEffects(level: number): NGPlusBonusEffects {
  const effects: NGPlusBonusEffects = {
    startingGoldPercent: 0,
    hpPercent: 0,
    expPercent: 0,
    startWithItem: false,
    atkPercent: 0,
    bonusPP: 0,
    goldPercent: 0,
    bellyDrainReduction: 0,
    allStatsPercent: 0,
    itemDropPercent: 0,
  };

  const bonuses = getCurrentBonuses(level);
  for (const b of bonuses) {
    switch (b.effect) {
      case "startingGold":
        effects.startingGoldPercent += b.value;
        break;
      case "hpPercent":
        effects.hpPercent += b.value;
        break;
      case "expPercent":
        effects.expPercent += b.value;
        break;
      case "startItem":
        effects.startWithItem = true;
        break;
      case "atkPercent":
        effects.atkPercent += b.value;
        break;
      case "bonusPP":
        effects.bonusPP += b.value;
        break;
      case "goldPercent":
        effects.goldPercent += b.value;
        break;
      case "bellyDrain":
        effects.bellyDrainReduction += b.value;
        break;
      case "allStats":
        effects.allStatsPercent += b.value;
        break;
      case "itemDrop":
        effects.itemDropPercent += b.value;
        break;
    }
  }

  return effects;
}

/**
 * Get the NG+ level definitions for display purposes.
 */
export function getNGPlusLevelDefs(): readonly NGPlusLevelDef[] {
  return NG_PLUS_LEVELS;
}

/** Maximum NG+ level */
export const MAX_NG_PLUS_LEVEL = NG_PLUS_LEVELS.length;

