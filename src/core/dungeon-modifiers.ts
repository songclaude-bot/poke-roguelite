/**
 * Dungeon Modifier system — random modifiers that appear on regular dungeons to add variety.
 * When entering any regular dungeon (not endless/daily/challenge), there's a 30% chance
 * that 1-2 random modifiers are applied for that specific run.
 */

export interface DungeonModifier {
  id: string;
  name: string;
  description: string;
  color: string;
  // Applied effects
  difficultyMult?: number;     // multiply dungeon difficulty
  goldMult?: number;            // multiply gold earned
  itemsPerFloorMod?: number;   // add/subtract items per floor
  playerAtkMult?: number;      // multiply player ATK
  playerDefMult?: number;      // multiply player DEF
  enemyHpMult?: number;        // multiply enemy HP
  expMult?: number;            // multiply EXP earned
  healOnFloor?: boolean;       // heal to full on each floor
  noRecruits?: boolean;        // cannot recruit allies
  doubleEnemies?: boolean;     // double enemy count
}

export const MODIFIERS: DungeonModifier[] = [
  // Positive
  { id: "goldRush", name: "Gold Rush", description: "+50% gold earned", color: "#fbbf24", goldMult: 1.5 },
  { id: "powerSurge", name: "Power Surge", description: "+20% ATK", color: "#ef4444", playerAtkMult: 1.2 },
  { id: "ironWill", name: "Iron Will", description: "+20% DEF", color: "#60a5fa", playerDefMult: 1.2 },
  { id: "expBoost", name: "EXP Boost", description: "+50% experience", color: "#a855f7", expMult: 1.5 },
  { id: "restoration", name: "Restoration", description: "Full heal on each floor", color: "#4ade80", healOnFloor: true },
  { id: "bounty", name: "Bounty", description: "+3 items per floor", color: "#fde68a", itemsPerFloorMod: 3 },

  // Negative (give gold compensation)
  { id: "hardMode", name: "Hard Mode", description: "+40% enemy difficulty, +30% gold", color: "#dc2626", difficultyMult: 1.4, goldMult: 1.3 },
  { id: "famine", name: "Famine", description: "-2 items per floor, +20% gold", color: "#92400e", itemsPerFloorMod: -2, goldMult: 1.2 },
  { id: "swarm", name: "Swarm", description: "Double enemies, +40% gold", color: "#b91c1c", doubleEnemies: true, goldMult: 1.4 },
  { id: "loneWolf", name: "Lone Wolf", description: "No allies, +25% ATK", color: "#7c3aed", noRecruits: true, playerAtkMult: 1.25 },
  { id: "fragile", name: "Fragile", description: "-20% DEF, +50% EXP", color: "#f97316", playerDefMult: 0.8, expMult: 1.5 },
  { id: "tankEnemies", name: "Tank Enemies", description: "+30% enemy HP, +25% gold", color: "#991b1b", enemyHpMult: 1.3, goldMult: 1.25 },
];

/** Roll modifiers for a dungeon run (30% chance, 1-2 modifiers) */
export function rollModifiers(): DungeonModifier[] {
  if (Math.random() > 0.30) return []; // 70% no modifiers

  const count = Math.random() < 0.7 ? 1 : 2; // 70% one, 30% two
  const available = [...MODIFIERS];
  const selected: DungeonModifier[] = [];

  for (let i = 0; i < count && available.length > 0; i++) {
    const idx = Math.floor(Math.random() * available.length);
    selected.push(available[idx]);
    available.splice(idx, 1);
  }

  return selected;
}

/** Look up modifier by ID */
export function getModifierById(id: string): DungeonModifier | undefined {
  return MODIFIERS.find(m => m.id === id);
}

/** Reconstruct DungeonModifier[] from an array of modifier IDs */
export function modifiersFromIds(ids: string[]): DungeonModifier[] {
  return ids.map(getModifierById).filter((m): m is DungeonModifier => m !== undefined);
}

/** Combined effects from multiple modifiers (all multipliers merged) */
export interface ModifierEffects {
  difficultyMult: number;
  goldMult: number;
  itemsPerFloorMod: number;
  playerAtkMult: number;
  playerDefMult: number;
  enemyHpMult: number;
  expMult: number;
  healOnFloor: boolean;
  noRecruits: boolean;
  doubleEnemies: boolean;
}

/** Combine multipliers from multiple modifiers */
export function getModifierEffects(mods: DungeonModifier[]): ModifierEffects {
  const result: ModifierEffects = {
    difficultyMult: 1,
    goldMult: 1,
    itemsPerFloorMod: 0,
    playerAtkMult: 1,
    playerDefMult: 1,
    enemyHpMult: 1,
    expMult: 1,
    healOnFloor: false,
    noRecruits: false,
    doubleEnemies: false,
  };

  for (const m of mods) {
    if (m.difficultyMult) result.difficultyMult *= m.difficultyMult;
    if (m.goldMult) result.goldMult *= m.goldMult;
    if (m.itemsPerFloorMod) result.itemsPerFloorMod += m.itemsPerFloorMod;
    if (m.playerAtkMult) result.playerAtkMult *= m.playerAtkMult;
    if (m.playerDefMult) result.playerDefMult *= m.playerDefMult;
    if (m.enemyHpMult) result.enemyHpMult *= m.enemyHpMult;
    if (m.expMult) result.expMult *= m.expMult;
    if (m.healOnFloor) result.healOnFloor = true;
    if (m.noRecruits) result.noRecruits = true;
    if (m.doubleEnemies) result.doubleEnemies = true;
  }

  return result;
}
