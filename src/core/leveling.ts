/**
 * Experience and leveling system.
 * EXP required per level grows linearly. Stats grow on level up.
 */

import { EntityStats } from "./entity";

/** EXP required to reach a given level from the previous level */
export function expForLevel(level: number): number {
  return 10 + (level - 1) * 5; // Lv2=10, Lv3=15, Lv4=20, ...
}

/** Total EXP required from level 1 to reach a target level */
export function totalExpForLevel(level: number): number {
  let total = 0;
  for (let l = 2; l <= level; l++) {
    total += expForLevel(l);
  }
  return total;
}

/** EXP gained from defeating an enemy */
export function expFromEnemy(enemyLevel: number, floor: number): number {
  return 10 + enemyLevel * 3 + floor * 5;
}

export interface LevelUpResult {
  newLevel: number;
  hpGain: number;
  atkGain: number;
  defGain: number;
}

/** Check if entity should level up and apply stat changes.
 *  Returns array of level-up results (can level up multiple times at once).
 */
export function processLevelUp(
  stats: EntityStats,
  currentExp: number,
  totalExp: number
): { results: LevelUpResult[]; remainingExp: number; totalExp: number } {
  const results: LevelUpResult[] = [];
  let exp = totalExp;
  let level = stats.level;

  while (true) {
    const needed = expForLevel(level + 1);
    if (exp < needed) break;

    exp -= needed;
    level++;

    // Stat gains per level (slight randomness)
    const hpGain = 3 + Math.floor(Math.random() * 3); // 3-5 HP
    const atkGain = Math.random() < 0.6 ? 1 : 0;       // 60% chance +1 ATK
    const defGain = Math.random() < 0.4 ? 1 : 0;       // 40% chance +1 DEF

    stats.level = level;
    stats.maxHp += hpGain;
    stats.hp += hpGain; // Heal on level up
    stats.atk += atkGain;
    stats.def += defGain;

    results.push({ newLevel: level, hpGain, atkGain, defGain });
  }

  return { results, remainingExp: exp, totalExp: exp };
}
