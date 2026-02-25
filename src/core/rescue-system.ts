/**
 * Rescue System — second-chance mechanic when player faints in dungeon.
 * Players can spend gold to continue from the same floor with penalties.
 */

export interface RescueOption {
  label: string;
  description: string;
  goldCost: number;
  hpPercent: number;      // % of max HP restored (e.g. 50 = restore to 50% HP)
  keepItems: boolean;     // keep inventory?
  keepGold: boolean;      // keep run gold?
}

// Cost scales with floor depth and dungeon difficulty
export function getRescueCost(floor: number, difficulty: number): number {
  return Math.floor(50 + floor * 20 * difficulty);
}

// Max 2 rescues per run
export const MAX_RESCUES_PER_RUN = 2;

// Generate rescue options based on available gold
export function getRescueOptions(floor: number, difficulty: number, availableGold: number): RescueOption[] {
  const baseCost = getRescueCost(floor, difficulty);

  const options: RescueOption[] = [];

  // Option 1: Basic rescue (50% HP, lose half items)
  if (availableGold >= baseCost) {
    options.push({
      label: "Basic Rescue",
      description: `Revive with 50% HP. Lose half your items. Cost: ${baseCost}G`,
      goldCost: baseCost,
      hpPercent: 50,
      keepItems: false,  // loses half items
      keepGold: true,
    });
  }

  // Option 2: Premium rescue (full HP, keep all items) — costs 3x
  const premiumCost = baseCost * 3;
  if (availableGold >= premiumCost) {
    options.push({
      label: "Premium Rescue",
      description: `Revive with full HP. Keep all items. Cost: ${premiumCost}G`,
      goldCost: premiumCost,
      hpPercent: 100,
      keepItems: true,
      keepGold: true,
    });
  }

  return options;
}
