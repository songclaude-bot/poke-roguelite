/**
 * Crafting / Fusion system — combine items in hub town to create better ones.
 */

import { ITEM_DB, ItemDef } from "./item";

export interface CraftingRecipe {
  id: string;
  name: string;
  ingredients: { itemId: string; count: number }[];
  result: { itemId: string; count: number };
  goldCost: number;
  requiredClears: number; // unlock condition
}

/**
 * All crafting recipes available at the Item Forge.
 */
export const CRAFTING_RECIPES: CraftingRecipe[] = [
  // ── Basic Berry Recipes ──
  {
    id: "oranToSitrus",
    name: "Oran Fusion",
    ingredients: [{ itemId: "oranBerry", count: 2 }],
    result: { itemId: "sitrusBerry", count: 1 },
    goldCost: 50,
    requiredClears: 0,
  },
  {
    id: "appleTooBig",
    name: "Apple Merge",
    ingredients: [{ itemId: "apple", count: 2 }],
    result: { itemId: "bigApple", count: 1 },
    goldCost: 40,
    requiredClears: 0,
  },
  {
    id: "grimyPurify",
    name: "Purify Food",
    ingredients: [
      { itemId: "grimyFood", count: 2 },
      { itemId: "pechaberry", count: 1 },
    ],
    result: { itemId: "apple", count: 2 },
    goldCost: 30,
    requiredClears: 1,
  },

  // ── Seed Recipes ──
  {
    id: "reviveDuplicate",
    name: "Revive Synthesis",
    ingredients: [
      { itemId: "reviveSeed", count: 1 },
      { itemId: "oranBerry", count: 2 },
    ],
    result: { itemId: "reviveSeed", count: 2 },
    goldCost: 200,
    requiredClears: 3,
  },
  {
    id: "sleepToStun",
    name: "Seed Blend",
    ingredients: [
      { itemId: "sleepSeed", count: 1 },
      { itemId: "stunSeed", count: 1 },
    ],
    result: { itemId: "stunSeed", count: 3 },
    goldCost: 100,
    requiredClears: 2,
  },
  {
    id: "blastMultiply",
    name: "Blast Refinery",
    ingredients: [{ itemId: "blastSeed", count: 3 }],
    result: { itemId: "blastSeed", count: 5 },
    goldCost: 150,
    requiredClears: 2,
  },
  {
    id: "healSeedBrew",
    name: "Heal Brew",
    ingredients: [
      { itemId: "oranBerry", count: 1 },
      { itemId: "pechaberry", count: 1 },
    ],
    result: { itemId: "healSeed", count: 2 },
    goldCost: 60,
    requiredClears: 1,
  },

  // ── Orb Recipes ──
  {
    id: "warpOrbForge",
    name: "Warp Orb Forge",
    ingredients: [
      { itemId: "warpSeed", count: 3 },
    ],
    result: { itemId: "warpOrb", count: 1 },
    goldCost: 120,
    requiredClears: 4,
  },
  {
    id: "foeHoldCraft",
    name: "Foe-Hold Craft",
    ingredients: [
      { itemId: "stunSeed", count: 2 },
      { itemId: "sleepSeed", count: 2 },
    ],
    result: { itemId: "foeHoldOrb", count: 1 },
    goldCost: 180,
    requiredClears: 5,
  },
  {
    id: "vanishOrbSynth",
    name: "Vanish Synthesis",
    ingredients: [
      { itemId: "warpSeed", count: 2 },
      { itemId: "escapeOrb", count: 1 },
    ],
    result: { itemId: "vanishOrb", count: 1 },
    goldCost: 250,
    requiredClears: 6,
  },

  // ── Utility Recipes ──
  {
    id: "elixirBrew",
    name: "Elixir Brew",
    ingredients: [
      { itemId: "sitrusBerry", count: 2 },
      { itemId: "healSeed", count: 1 },
    ],
    result: { itemId: "maxElixir", count: 2 },
    goldCost: 160,
    requiredClears: 4,
  },
  {
    id: "allPowerForge",
    name: "Power Forge",
    ingredients: [
      { itemId: "allPowerOrb", count: 1 },
      { itemId: "blastSeed", count: 2 },
      { itemId: "reviveSeed", count: 1 },
    ],
    result: { itemId: "allPowerOrb", count: 2 },
    goldCost: 300,
    requiredClears: 8,
  },
];

/**
 * Check if the player can craft a recipe given their storage and gold.
 */
export function canCraft(
  recipe: CraftingRecipe,
  storage: { itemId: string; count: number }[],
  gold: number,
  totalClears: number,
): boolean {
  if (totalClears < recipe.requiredClears) return false;
  if (gold < recipe.goldCost) return false;

  for (const ing of recipe.ingredients) {
    const stored = storage.find(s => s.itemId === ing.itemId);
    if (!stored || stored.count < ing.count) return false;
  }
  return true;
}

/**
 * Check if the recipe is unlocked (visible) for the player.
 */
export function isRecipeUnlocked(recipe: CraftingRecipe, totalClears: number): boolean {
  return totalClears >= recipe.requiredClears;
}

/**
 * Get the display name of an item by ID, with fallback.
 */
export function getItemName(itemId: string): string {
  const item = ITEM_DB[itemId];
  return item ? item.name : itemId;
}

/**
 * Get total stored item count from storage array.
 */
export function getStorageItemCount(storage: { itemId: string; count: number }[]): number {
  return storage.reduce((sum, s) => sum + s.count, 0);
}

/**
 * Add items to storage (mutates the array).
 */
export function addToStorage(
  storage: { itemId: string; count: number }[],
  itemId: string,
  count: number,
): void {
  const existing = storage.find(s => s.itemId === itemId);
  if (existing) {
    existing.count += count;
  } else {
    storage.push({ itemId, count });
  }
}

/**
 * Remove items from storage (mutates the array). Returns true if successful.
 */
export function removeFromStorage(
  storage: { itemId: string; count: number }[],
  itemId: string,
  count: number,
): boolean {
  const existing = storage.find(s => s.itemId === itemId);
  if (!existing || existing.count < count) return false;
  existing.count -= count;
  return true;
}

/**
 * Clean up storage by removing zero-count entries.
 */
export function cleanStorage(storage: { itemId: string; count: number }[]): { itemId: string; count: number }[] {
  return storage.filter(s => s.count > 0);
}
