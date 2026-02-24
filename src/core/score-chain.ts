/**
 * Score Multiplier / Combo Chain System
 *
 * Rewards consecutive "good actions" in combat with an escalating score multiplier.
 * Multiplier resets when the player takes damage, uses a healing item,
 * or goes 5 turns without a scoring action.
 *
 * Chain tiers: C → B → A → S → SS → SSS
 */

export interface ScoreChain {
  currentMultiplier: number;   // starts at 1.0
  chainCount: number;          // consecutive scoring actions
  maxChainReached: number;     // best multiplier this run
  totalBonusScore: number;     // accumulated bonus score from chain multiplier
  turnsSinceLastAction: number; // idle turn counter, resets on scoring action
}

/** Types of actions that contribute to the chain */
export type ChainAction =
  | "kill"             // +0.1x
  | "effective"        // +0.05x  (type-effective skill hit)
  | "monsterHouseClear" // +0.5x
  | "itemPickup"       // +0.02x
  | "quickFloor";      // +0.2x  (reached stairs in under 20 turns)

const ACTION_MULTIPLIER: Record<ChainAction, number> = {
  kill: 0.1,
  effective: 0.05,
  monsterHouseClear: 0.5,
  itemPickup: 0.02,
  quickFloor: 0.2,
};

/** Base points awarded per action type (before multiplier) */
const ACTION_BASE_POINTS: Record<ChainAction, number> = {
  kill: 50,
  effective: 20,
  monsterHouseClear: 200,
  itemPickup: 10,
  quickFloor: 100,
};

const MAX_MULTIPLIER = 5.0;
const IDLE_RESET_TURNS = 5;

/** Create a fresh ScoreChain for a new run */
export function createScoreChain(): ScoreChain {
  return {
    currentMultiplier: 1.0,
    chainCount: 0,
    maxChainReached: 1.0,
    totalBonusScore: 0,
    turnsSinceLastAction: 0,
  };
}

/**
 * Add a chain action. Increases multiplier and returns bonus points earned.
 * @returns bonus points earned from this action (points * (multiplier - 1.0))
 */
export function addChainAction(chain: ScoreChain, action: ChainAction): number {
  // Increase multiplier
  const increase = ACTION_MULTIPLIER[action];
  chain.currentMultiplier = Math.min(MAX_MULTIPLIER,
    Math.round((chain.currentMultiplier + increase) * 100) / 100);

  chain.chainCount++;
  chain.turnsSinceLastAction = 0;

  // Track best chain
  if (chain.currentMultiplier > chain.maxChainReached) {
    chain.maxChainReached = chain.currentMultiplier;
  }

  // Calculate bonus points: base points * (multiplier - 1.0)
  // Only the bonus portion (above 1.0x) counts as chain bonus
  const basePoints = ACTION_BASE_POINTS[action];
  const bonusPoints = Math.floor(basePoints * (chain.currentMultiplier - 1.0));
  chain.totalBonusScore += bonusPoints;

  return bonusPoints;
}

/** Reset the chain (player took damage, used healing item, or idled too long) */
export function resetChain(chain: ScoreChain): void {
  chain.currentMultiplier = 1.0;
  chain.chainCount = 0;
  chain.turnsSinceLastAction = 0;
}

/**
 * Tick idle turns. Call this after each turn where no scoring action occurred.
 * Automatically resets chain after IDLE_RESET_TURNS turns of inactivity.
 * @returns true if chain was reset due to idle
 */
export function tickChainIdle(chain: ScoreChain): boolean {
  if (chain.currentMultiplier <= 1.0) return false;

  chain.turnsSinceLastAction++;
  if (chain.turnsSinceLastAction >= IDLE_RESET_TURNS) {
    resetChain(chain);
    return true;
  }
  return false;
}

/** Get the chain tier label based on current multiplier */
export function getChainTier(multiplier: number): string {
  if (multiplier >= 4.0) return "SSS";
  if (multiplier >= 3.0) return "SS";
  if (multiplier >= 2.5) return "S";
  if (multiplier >= 2.0) return "A";
  if (multiplier >= 1.5) return "B";
  if (multiplier > 1.0) return "C";
  return "";  // no tier at 1.0x
}

/** Get the display color for a chain tier */
export function getChainColor(tier: string): string {
  switch (tier) {
    case "C":   return "#999999"; // gray
    case "B":   return "#ffffff"; // white
    case "A":   return "#4ade80"; // green
    case "S":   return "#60a5fa"; // blue
    case "SS":  return "#a855f7"; // purple
    case "SSS": return "#fbbf24"; // gold
    default:    return "#999999";
  }
}

/** Get hex color for a chain tier (for tint effects) */
export function getChainHexColor(tier: string): number {
  switch (tier) {
    case "C":   return 0x999999;
    case "B":   return 0xffffff;
    case "A":   return 0x4ade80;
    case "S":   return 0x60a5fa;
    case "SS":  return 0xa855f7;
    case "SSS": return 0xfbbf24;
    default:    return 0x999999;
  }
}
