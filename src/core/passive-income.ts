/**
 * Passive Income System — idle gold accumulation while the player is away.
 * Calculates gold earned based on time since last visit, scaled by progression.
 */

import { MetaSaveData, saveMeta } from "./save-system";

// ── Configuration ──

export interface PassiveIncomeConfig {
  baseRate: number;         // gold per hour
  maxAccumulation: number;  // max hours of accumulation (cap)
}

const CONFIG: PassiveIncomeConfig = {
  baseRate: 10,
  maxAccumulation: 24,
};

// Per-clear bonus: +2 gold/hour per totalClears, capped at 50 clears
const PER_CLEAR_BONUS = 2;
const MAX_CLEAR_BONUS_CLEARS = 50;

// NG+ bonus: +5 gold/hour per NG+ level
const NG_PLUS_BONUS_PER_LEVEL = 5;

// ── Public API ──

/**
 * Calculate the current passive income rate in gold per hour.
 */
export function getIncomeRate(meta: MetaSaveData): number {
  const clearBonus = Math.min(meta.totalClears, MAX_CLEAR_BONUS_CLEARS) * PER_CLEAR_BONUS;
  const ngBonus = (meta.ngPlusLevel ?? 0) * NG_PLUS_BONUS_PER_LEVEL;
  return CONFIG.baseRate + clearBonus + ngBonus;
}

/**
 * Calculate passive income earned since the last visit.
 * Returns the gold earned and the number of hours elapsed (capped).
 * Returns 0 gold if there is no previous visit timestamp.
 */
export function calculatePassiveIncome(meta: MetaSaveData): { gold: number; hours: number } {
  if (!meta.lastVisitTimestamp) {
    return { gold: 0, hours: 0 };
  }

  const now = Date.now();
  const elapsed = now - meta.lastVisitTimestamp;

  // Require at least 1 minute away to count
  if (elapsed < 60_000) {
    return { gold: 0, hours: 0 };
  }

  const elapsedHours = elapsed / (1000 * 60 * 60);
  const cappedHours = Math.min(elapsedHours, CONFIG.maxAccumulation);
  const rate = getIncomeRate(meta);
  const gold = Math.floor(rate * cappedHours);

  return { gold, hours: Math.round(cappedHours * 10) / 10 };
}

/**
 * Update the last visit timestamp to the current time and save.
 */
export function updateLastVisit(meta: MetaSaveData): void {
  meta.lastVisitTimestamp = Date.now();
  saveMeta(meta);
}
