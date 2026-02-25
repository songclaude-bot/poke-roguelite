/**
 * Talent Tree — persistent stat/ability bonuses purchased with gold.
 * 20 talents across 4 categories, each with multiple levels.
 */

import type { MetaSaveData } from "./save-system";

// ── Category Enum ──

export enum TalentCategory {
  Offense = "Offense",
  Defense = "Defense",
  Utility = "Utility",
  Exploration = "Exploration",
}

// ── Category Colors ──

export const TALENT_CATEGORY_COLORS: Record<TalentCategory, string> = {
  [TalentCategory.Offense]: "#ef4444",      // red
  [TalentCategory.Defense]: "#60a5fa",       // blue
  [TalentCategory.Utility]: "#4ade80",       // green
  [TalentCategory.Exploration]: "#a855f7",   // purple
};

export const TALENT_CATEGORY_BG: Record<TalentCategory, number> = {
  [TalentCategory.Offense]: 0x3a1a1a,
  [TalentCategory.Defense]: 0x1a2a3a,
  [TalentCategory.Utility]: 0x1a3a1a,
  [TalentCategory.Exploration]: 0x2a1a3a,
};

// ── TalentNode Interface ──

export interface TalentNode {
  id: string;
  name: string;
  description: string;
  maxLevel: number;
  costPerLevel: number;
  requires?: string[];
  category: TalentCategory;
  effect: (level: number) => Record<string, number>;
}

// ── Talent Definitions ──

const TALENT_NODES: TalentNode[] = [
  // ── Offense (Red) ──
  {
    id: "powerStrike",
    name: "Power Strike",
    description: "+2% ATK per level",
    maxLevel: 10,
    costPerLevel: 100,
    category: TalentCategory.Offense,
    effect: (level) => ({ atkPercent: level * 2 }),
  },
  {
    id: "critMastery",
    name: "Crit Mastery",
    description: "+3% crit chance per level",
    maxLevel: 5,
    costPerLevel: 200,
    category: TalentCategory.Offense,
    effect: (level) => ({ critChance: level * 3 }),
  },
  {
    id: "typeExpert",
    name: "Type Expert",
    description: "+5% type advantage damage per level",
    maxLevel: 5,
    costPerLevel: 150,
    category: TalentCategory.Offense,
    effect: (level) => ({ typeAdvantageBonus: level * 5 }),
  },
  {
    id: "comboMaster",
    name: "Combo Master",
    description: "+0.02x chain multiplier gain per level",
    maxLevel: 5,
    costPerLevel: 250,
    category: TalentCategory.Offense,
    effect: (level) => ({ chainMultiplierGain: level * 0.02 }),
  },
  {
    id: "bossSlayer",
    name: "Boss Slayer",
    description: "+5% damage to bosses per level",
    maxLevel: 5,
    costPerLevel: 200,
    category: TalentCategory.Offense,
    effect: (level) => ({ bossDamagePercent: level * 5 }),
  },

  // ── Defense (Blue) ──
  {
    id: "ironWill",
    name: "Iron Will",
    description: "+2% DEF per level",
    maxLevel: 10,
    costPerLevel: 100,
    category: TalentCategory.Defense,
    effect: (level) => ({ defPercent: level * 2 }),
  },
  {
    id: "vitalBoost",
    name: "Vital Boost",
    description: "+5% max HP per level",
    maxLevel: 10,
    costPerLevel: 100,
    category: TalentCategory.Defense,
    effect: (level) => ({ hpPercent: level * 5 }),
  },
  {
    id: "statusResist",
    name: "Status Resist",
    description: "+5% status resistance per level",
    maxLevel: 5,
    costPerLevel: 150,
    category: TalentCategory.Defense,
    effect: (level) => ({ statusResistPercent: level * 5 }),
  },
  {
    id: "hazardProof",
    name: "Hazard Proof",
    description: "-10% hazard damage per level",
    maxLevel: 5,
    costPerLevel: 150,
    category: TalentCategory.Defense,
    effect: (level) => ({ hazardDamageReduction: level * 10 }),
  },
  {
    id: "lastStand",
    name: "Last Stand",
    description: "+2% damage when below 25% HP per level",
    maxLevel: 5,
    costPerLevel: 200,
    category: TalentCategory.Defense,
    effect: (level) => ({ lastStandDamagePercent: level * 2 }),
  },

  // ── Utility (Green) ──
  {
    id: "goldFinder",
    name: "Gold Finder",
    description: "+5% gold per level",
    maxLevel: 10,
    costPerLevel: 80,
    category: TalentCategory.Utility,
    effect: (level) => ({ goldPercent: level * 5 }),
  },
  {
    id: "itemScout",
    name: "Item Scout",
    description: "+5% item spawn per level",
    maxLevel: 5,
    costPerLevel: 120,
    category: TalentCategory.Utility,
    effect: (level) => ({ itemSpawnPercent: level * 5 }),
  },
  {
    id: "quickLearner",
    name: "Quick Learner",
    description: "+5% EXP per level",
    maxLevel: 10,
    costPerLevel: 100,
    category: TalentCategory.Utility,
    effect: (level) => ({ expPercent: level * 5 }),
  },
  {
    id: "bellyConserve",
    name: "Belly Conserve",
    description: "-3% belly consumption per level",
    maxLevel: 5,
    costPerLevel: 150,
    category: TalentCategory.Utility,
    effect: (level) => ({ bellyDrainReduction: level * 3 }),
  },
  {
    id: "passiveBoost",
    name: "Passive Boost",
    description: "+10% passive income per level",
    maxLevel: 5,
    costPerLevel: 200,
    category: TalentCategory.Utility,
    effect: (level) => ({ passiveIncomePercent: level * 10 }),
  },

  // ── Exploration (Purple) ──
  {
    id: "mapSight",
    name: "Map Sight",
    description: "+1 sight range per level",
    maxLevel: 3,
    costPerLevel: 300,
    category: TalentCategory.Exploration,
    effect: (level) => ({ sightRangeBonus: level }),
  },
  {
    id: "trapDetect",
    name: "Trap Detect",
    description: "+10% trap visibility per level",
    maxLevel: 5,
    costPerLevel: 150,
    category: TalentCategory.Exploration,
    effect: (level) => ({ trapVisibilityPercent: level * 10 }),
  },
  {
    id: "secretSense",
    name: "Secret Sense",
    description: "+2% secret room chance per level",
    maxLevel: 5,
    costPerLevel: 200,
    category: TalentCategory.Exploration,
    effect: (level) => ({ secretRoomChance: level * 2 }),
  },
  {
    id: "speedExplore",
    name: "Speed Explore",
    description: "+10% auto-explore speed per level",
    maxLevel: 3,
    costPerLevel: 250,
    category: TalentCategory.Exploration,
    effect: (level) => ({ autoExploreSpeedPercent: level * 10 }),
  },
  {
    id: "floorMastery",
    name: "Floor Mastery",
    description: "+5% floor clear speed bonus per level",
    maxLevel: 5,
    costPerLevel: 150,
    category: TalentCategory.Exploration,
    effect: (level) => ({ floorClearSpeedPercent: level * 5 }),
  },
];

// ── Lookup map for fast access ──

const TALENT_MAP = new Map<string, TalentNode>();
for (const node of TALENT_NODES) {
  TALENT_MAP.set(node.id, node);
}

// ── Exports ──

/** Get all talent node definitions */
export function getAllTalents(): TalentNode[] {
  return TALENT_NODES;
}

/** Get a specific talent node by ID */
export function getTalent(talentId: string): TalentNode | undefined {
  return TALENT_MAP.get(talentId);
}

/** Get the computed effect values for a talent at a given level */
export function getTalentEffect(talentId: string, level: number): Record<string, number> {
  const node = TALENT_MAP.get(talentId);
  if (!node || level <= 0) return {};
  return node.effect(Math.min(level, node.maxLevel));
}

/** Check if a talent can be upgraded (gold + level + prerequisites) */
export function canUpgradeTalent(
  talentId: string,
  currentLevel: number,
  meta: MetaSaveData,
): boolean {
  const node = TALENT_MAP.get(talentId);
  if (!node) return false;
  if (currentLevel >= node.maxLevel) return false;

  // Cost check
  const cost = getUpgradeCost(talentId, currentLevel);
  if (meta.gold < cost) return false;

  // Prerequisites check
  if (node.requires && node.requires.length > 0) {
    const levels = meta.talentLevels ?? {};
    for (const reqId of node.requires) {
      if ((levels[reqId] ?? 0) <= 0) return false;
    }
  }

  return true;
}

/** Get the gold cost to upgrade a talent from the current level to the next */
export function getUpgradeCost(talentId: string, currentLevel: number): number {
  const node = TALENT_MAP.get(talentId);
  if (!node) return Infinity;
  if (currentLevel >= node.maxLevel) return Infinity;
  return node.costPerLevel;
}

/** Get the total talent points invested (sum of all talent levels) */
export function getTotalTalentPoints(talents: Record<string, number>): number {
  let total = 0;
  for (const level of Object.values(talents)) {
    total += level;
  }
  return total;
}

/**
 * Aggregate all talent effects from the player's talent levels into a single map.
 * Useful at dungeon start to precompute all bonuses.
 */
export function getAggregatedTalentEffects(
  talentLevels: Record<string, number>,
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [id, level] of Object.entries(talentLevels)) {
    if (level <= 0) continue;
    const effects = getTalentEffect(id, level);
    for (const [key, value] of Object.entries(effects)) {
      result[key] = (result[key] ?? 0) + value;
    }
  }
  return result;
}

/** Get total gold invested across all talents */
export function getTotalGoldInvested(talentLevels: Record<string, number>): number {
  let total = 0;
  for (const [id, level] of Object.entries(talentLevels)) {
    const node = TALENT_MAP.get(id);
    if (!node || level <= 0) continue;
    total += node.costPerLevel * level;
  }
  return total;
}
