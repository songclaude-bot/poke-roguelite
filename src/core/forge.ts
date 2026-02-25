/**
 * Forge System — upgrade held items at the hub to increase their stats.
 * Each item can be upgraded up to +5, with increasing costs.
 */

import type { MetaSaveData } from "./save-system";

export interface ForgeUpgrade {
  level: number;       // current level 0-5
  bonusPercent: number; // total bonus percentage from upgrades
}

// Gold costs per upgrade level
export const FORGE_COSTS: number[] = [100, 250, 500, 1000, 2000]; // level 0→1, 1→2, ..., 4→5

// Bonus percentage per level (cumulative)
export const FORGE_BONUSES: number[] = [0, 10, 22, 36, 52, 70]; // level 0=0%, 1=10%, 2=22%, etc.

export const MAX_FORGE_LEVEL = 5;

export function getForgeLevel(meta: MetaSaveData): number {
  return meta.forgeLevel ?? 0;
}

export function getForgeCost(currentLevel: number): number {
  if (currentLevel >= MAX_FORGE_LEVEL) return -1; // maxed
  return FORGE_COSTS[currentLevel];
}

export function getForgeBonus(level: number): number {
  return FORGE_BONUSES[Math.min(level, MAX_FORGE_LEVEL)];
}

export function canForge(meta: MetaSaveData): boolean {
  const level = getForgeLevel(meta);
  if (level >= MAX_FORGE_LEVEL) return false;
  if (!meta.equippedHeldItem) return false;
  const cost = getForgeCost(level);
  return (meta.gold ?? 0) >= cost;
}

export function applyForge(meta: MetaSaveData): { newLevel: number; cost: number; bonusPercent: number } {
  const level = getForgeLevel(meta);
  const cost = getForgeCost(level);
  meta.gold = (meta.gold ?? 0) - cost;
  meta.forgeLevel = level + 1;
  return { newLevel: level + 1, cost, bonusPercent: getForgeBonus(level + 1) };
}
