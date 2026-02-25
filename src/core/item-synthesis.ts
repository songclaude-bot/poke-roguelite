/**
 * Item Synthesis / Upgrade System — Phase 276
 *
 * Combine duplicate items to create stronger upgraded versions.
 * Works alongside the existing crafting system (different recipes).
 */

import { ITEM_DB } from "./item";

// ── Enums ──

export enum ItemTier {
  Basic = "basic",
  Enhanced = "enhanced",
  Superior = "superior",
  Legendary = "legendary",
}

// ── Interfaces ──

export interface SynthesisRecipe {
  id: string;
  inputId: string;
  inputCount: number;
  outputId: string;
  goldCost: number;
  tier: ItemTier;
}

// ── Recipes ──

const SYNTHESIS_RECIPES: SynthesisRecipe[] = [
  // Berry upgrades (50G)
  {
    id: "synth_megaOran",
    inputId: "oranBerry",
    inputCount: 3,
    outputId: "megaOranBerry",
    goldCost: 50,
    tier: ItemTier.Enhanced,
  },
  {
    id: "synth_megaSitrus",
    inputId: "sitrusBerry",
    inputCount: 3,
    outputId: "megaSitrusBerry",
    goldCost: 50,
    tier: ItemTier.Enhanced,
  },
  {
    id: "synth_goldenApple",
    inputId: "apple",
    inputCount: 3,
    outputId: "goldenApple",
    goldCost: 50,
    tier: ItemTier.Enhanced,
  },

  // Throwable upgrades (50G)
  {
    id: "synth_crystalPebble",
    inputId: "pebble",
    inputCount: 3,
    outputId: "crystalPebble",
    goldCost: 50,
    tier: ItemTier.Enhanced,
  },
  {
    id: "synth_meteorRock",
    inputId: "gravelrock",
    inputCount: 3,
    outputId: "meteorRock",
    goldCost: 50,
    tier: ItemTier.Enhanced,
  },

  // Seed upgrades (100G)
  {
    id: "synth_megaBlast",
    inputId: "blastSeed",
    inputCount: 3,
    outputId: "megaBlastSeed",
    goldCost: 100,
    tier: ItemTier.Enhanced,
  },
  {
    id: "synth_deepSleep",
    inputId: "sleepSeed",
    inputCount: 3,
    outputId: "deepSleepSeed",
    goldCost: 100,
    tier: ItemTier.Enhanced,
  },

  // Stat boost upgrades (100G)
  {
    id: "synth_megaXAttack",
    inputId: "xAttack",
    inputCount: 3,
    outputId: "megaXAttack",
    goldCost: 100,
    tier: ItemTier.Enhanced,
  },
  {
    id: "synth_megaXDefend",
    inputId: "xDefend",
    inputCount: 3,
    outputId: "megaXDefend",
    goldCost: 100,
    tier: ItemTier.Enhanced,
  },

  // Rare upgrades (200G)
  {
    id: "synth_autoReviver",
    inputId: "reviveSeed",
    inputCount: 2,
    outputId: "autoReviver",
    goldCost: 200,
    tier: ItemTier.Superior,
  },
  {
    id: "synth_megaElixir",
    inputId: "maxElixir",
    inputCount: 3,
    outputId: "megaElixir",
    goldCost: 200,
    tier: ItemTier.Superior,
  },
];

// ── Public API ──

/** Get all synthesis recipes */
export function getSynthesisRecipes(): SynthesisRecipe[] {
  return SYNTHESIS_RECIPES;
}

/** Get the display name for an item by ID */
export function getSynthesisItemName(itemId: string): string {
  const item = ITEM_DB[itemId];
  return item ? item.name : itemId;
}

/** Check if a synthesis can be performed given storage and gold */
export function canSynthesize(
  recipe: SynthesisRecipe,
  storage: { itemId: string; count: number }[],
  gold: number,
): boolean {
  if (gold < recipe.goldCost) return false;
  const stored = storage.find(s => s.itemId === recipe.inputId);
  if (!stored || stored.count < recipe.inputCount) return false;
  return true;
}

/**
 * Perform a synthesis: consume inputs, produce output, deduct gold.
 * Returns the updated storage and gold spent.
 * Mutates the storage array in place.
 */
export function performSynthesis(
  recipe: SynthesisRecipe,
  storage: { itemId: string; count: number }[],
  gold: number,
): { storage: { itemId: string; count: number }[]; goldSpent: number } {
  // Validate
  if (!canSynthesize(recipe, storage, gold)) {
    return { storage, goldSpent: 0 };
  }

  // Deduct input items
  const inputSlot = storage.find(s => s.itemId === recipe.inputId);
  if (inputSlot) {
    inputSlot.count -= recipe.inputCount;
  }

  // Add output item
  const outputSlot = storage.find(s => s.itemId === recipe.outputId);
  if (outputSlot) {
    outputSlot.count += 1;
  } else {
    storage.push({ itemId: recipe.outputId, count: 1 });
  }

  // Clean up zero-count entries
  const cleaned = storage.filter(s => s.count > 0);

  return { storage: cleaned, goldSpent: recipe.goldCost };
}

/** Get the tier color for display */
export function getTierColor(tier: ItemTier): string {
  switch (tier) {
    case ItemTier.Basic: return "#b0b0c0";
    case ItemTier.Enhanced: return "#4ade80";
    case ItemTier.Superior: return "#60a5fa";
    case ItemTier.Legendary: return "#fbbf24";
  }
}

/** Get a tier label for display */
export function getTierLabel(tier: ItemTier): string {
  switch (tier) {
    case ItemTier.Basic: return "Basic";
    case ItemTier.Enhanced: return "Enhanced";
    case ItemTier.Superior: return "Superior";
    case ItemTier.Legendary: return "Legendary";
  }
}
