/**
 * Difficulty Settings — allows players to choose preferred challenge level.
 * Normal difficulty (all 1.0) preserves existing behavior exactly.
 */

export enum DifficultyLevel {
  Easy = "easy",
  Normal = "normal",
  Hard = "hard",
  Nightmare = "nightmare",
}

export interface DifficultyModifiers {
  enemyHpMult: number;      // multiplier on enemy HP
  enemyAtkMult: number;     // multiplier on enemy ATK
  playerDamageMult: number; // multiplier on damage player takes
  goldMult: number;         // multiplier on gold earned
  expMult: number;          // multiplier on EXP earned
  itemDropMult: number;     // multiplier on item drop chance (affects floor items count)
  bellyDrainMult: number;   // multiplier on belly drain rate
  trapFreqMult: number;     // multiplier on trap frequency
}

const DIFFICULTY_PRESETS: Record<DifficultyLevel, DifficultyModifiers> = {
  [DifficultyLevel.Easy]: {
    enemyHpMult: 0.7,
    enemyAtkMult: 0.8,
    playerDamageMult: 0.8,
    goldMult: 1.5,
    expMult: 1.3,
    itemDropMult: 1.5,
    bellyDrainMult: 0.7,
    trapFreqMult: 0.5,
  },
  [DifficultyLevel.Normal]: {
    enemyHpMult: 1.0,
    enemyAtkMult: 1.0,
    playerDamageMult: 1.0,
    goldMult: 1.0,
    expMult: 1.0,
    itemDropMult: 1.0,
    bellyDrainMult: 1.0,
    trapFreqMult: 1.0,
  },
  [DifficultyLevel.Hard]: {
    enemyHpMult: 1.3,
    enemyAtkMult: 1.2,
    playerDamageMult: 1.2,
    goldMult: 0.8,
    expMult: 0.8,
    itemDropMult: 0.7,
    bellyDrainMult: 1.3,
    trapFreqMult: 1.5,
  },
  [DifficultyLevel.Nightmare]: {
    enemyHpMult: 1.6,
    enemyAtkMult: 1.5,
    playerDamageMult: 1.5,
    goldMult: 0.5,
    expMult: 0.6,
    itemDropMult: 0.5,
    bellyDrainMult: 1.5,
    trapFreqMult: 2.0,
  },
};

const STORAGE_KEY = "poke-roguelite-difficulty";

/** Get the difficulty modifiers for a given difficulty level */
export function getDifficultyModifiers(level: DifficultyLevel): DifficultyModifiers {
  return { ...DIFFICULTY_PRESETS[level] };
}

/** Save difficulty level to localStorage */
export function saveDifficulty(level: DifficultyLevel): void {
  try {
    localStorage.setItem(STORAGE_KEY, level);
  } catch {
    // silently fail if localStorage is unavailable
  }
}

/** Load difficulty level from localStorage (default: Normal) */
export function loadDifficulty(): DifficultyLevel {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw && Object.values(DifficultyLevel).includes(raw as DifficultyLevel)) {
      return raw as DifficultyLevel;
    }
  } catch {
    // silently fail
  }
  return DifficultyLevel.Normal;
}

/** Human-readable descriptions for each difficulty level */
export const DIFFICULTY_DESCRIPTIONS: Record<DifficultyLevel, string> = {
  [DifficultyLevel.Easy]: "Weaker foes, more loot, slower hunger",
  [DifficultyLevel.Normal]: "The standard experience",
  [DifficultyLevel.Hard]: "Tougher foes, scarce loot, faster hunger",
  [DifficultyLevel.Nightmare]: "Extreme challenge. Good luck.",
};

/** Whether the difficulty is non-normal (affects leaderboard tagging) */
export function isNonNormalDifficulty(level: DifficultyLevel): boolean {
  return level !== DifficultyLevel.Normal;
}
