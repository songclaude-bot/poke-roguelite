/**
 * Exploration Reward System — bonus rewards for floor coverage.
 * Players earn bonuses at 50%, 75%, and 100% floor exploration.
 */

export interface ExplorationTier {
  threshold: number;    // e.g. 0.50 for 50%
  label: string;        // "Explorer", "Cartographer", "Trailblazer"
  goldBonus: number;    // flat gold bonus
  expBonus: number;     // flat EXP bonus
  color: string;
  icon: string;
}

export const EXPLORATION_TIERS: ExplorationTier[] = [
  { threshold: 0.50, label: "Explorer",       goldBonus: 25,  expBonus: 15, color: "#60a5fa", icon: "\u25CE" },
  { threshold: 0.75, label: "Cartographer",    goldBonus: 75,  expBonus: 40, color: "#fbbf24", icon: "\u25C9" },
  { threshold: 1.00, label: "Trailblazer",     goldBonus: 200, expBonus: 100, color: "#4ade80", icon: "\u2605" },
];

/** Check which tiers have been reached */
export function getExplorationTier(explorationPercent: number): ExplorationTier | null {
  let best: ExplorationTier | null = null;
  for (const tier of EXPLORATION_TIERS) {
    if (explorationPercent >= tier.threshold) best = tier;
  }
  return best;
}

/** Get all newly reached tiers (for triggering rewards) */
export function getNewTiers(oldPercent: number, newPercent: number): ExplorationTier[] {
  return EXPLORATION_TIERS.filter(t => oldPercent < t.threshold && newPercent >= t.threshold);
}
