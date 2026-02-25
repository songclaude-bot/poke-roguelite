/**
 * Item Affinity System — species-specific item effectiveness bonuses.
 * Certain Pokemon types gain bonus effects from matching item categories.
 * When a Pokemon uses an item they have affinity for, the effect is boosted.
 */

import { PokemonType } from "./type-chart";
import { ItemCategory } from "./item";

export interface AffinityBonus {
  /** Item category (from ItemCategory enum) or specific item ID */
  itemCategory: string;
  /** Pokemon types that benefit from this affinity */
  typeMatch: PokemonType[];
  /** Bonus percent: e.g. 50 = +50% effectiveness */
  bonusPercent: number;
  /** Human-readable description */
  description: string;
}

/**
 * Food item IDs — these are berries by category but are food/belly items.
 * Fighting types get affinity for these specifically.
 */
const FOOD_ITEM_IDS = new Set([
  "apple", "bigApple", "grimyFood", "goldenApple",
]);

/**
 * Healing berry IDs — Grass types get affinity for HP-healing berries.
 */
const HEALING_BERRY_IDS = new Set([
  "oranBerry", "sitrusBerry", "megaOranBerry", "megaSitrusBerry",
]);

export const ITEM_AFFINITIES: AffinityBonus[] = [
  // Berry affinity: Grass types get +50% from healing berries
  {
    itemCategory: ItemCategory.Berry,
    typeMatch: [PokemonType.Grass],
    bonusPercent: 50,
    description: "Grass types get 50% more from berries",
  },
  // Seed affinity: Grass and Bug types get +50% from seeds
  {
    itemCategory: ItemCategory.Seed,
    typeMatch: [PokemonType.Grass, PokemonType.Bug],
    bonusPercent: 50,
    description: "Grass/Bug types get 50% more from seeds",
  },
  // Orb affinity: Psychic and Ghost types get +50% from orbs
  {
    itemCategory: ItemCategory.Orb,
    typeMatch: [PokemonType.Psychic, PokemonType.Ghost],
    bonusPercent: 50,
    description: "Psychic/Ghost types get 50% more from orbs",
  },
  // TM affinity: Normal types get bonus from TMs
  {
    itemCategory: ItemCategory.TM,
    typeMatch: [PokemonType.Normal],
    bonusPercent: 50,
    description: "Normal types get PP bonus from TMs",
  },
  // Gem affinity: Dragon types get double gem duration
  {
    itemCategory: ItemCategory.Gem,
    typeMatch: [PokemonType.Dragon],
    bonusPercent: 100,
    description: "Dragon types get double effect from gems",
  },
  // Food affinity: Fighting types get +50% belly restoration
  {
    itemCategory: "food",
    typeMatch: [PokemonType.Fighting],
    bonusPercent: 50,
    description: "Fighting types get 50% more from food",
  },
];

/** Check if a Pokemon type has affinity for an item (by category or specific ID) */
export function getItemAffinity(pokemonTypes: PokemonType[], itemCategory: string, itemId?: string): AffinityBonus | null {
  for (const aff of ITEM_AFFINITIES) {
    // Special case: "food" affinity matches specific food item IDs
    if (aff.itemCategory === "food" && itemId && FOOD_ITEM_IDS.has(itemId)) {
      for (const t of pokemonTypes) {
        if (aff.typeMatch.includes(t)) return aff;
      }
      continue;
    }
    // Standard category match
    if (aff.itemCategory === itemCategory) {
      for (const t of pokemonTypes) {
        if (aff.typeMatch.includes(t)) return aff;
      }
    }
  }
  return null;
}

/** Get the bonus multiplier (1.0 = no bonus, 1.5 = +50%, 2.0 = +100%) */
export function getAffinityMultiplier(pokemonTypes: PokemonType[], itemCategory: string, itemId?: string): number {
  const aff = getItemAffinity(pokemonTypes, itemCategory, itemId);
  return aff ? 1 + aff.bonusPercent / 100 : 1.0;
}

/** Check if a specific item ID is a food item (for Fighting type affinity) */
export function isFoodItem(itemId: string): boolean {
  return FOOD_ITEM_IDS.has(itemId);
}

/** Check if a specific item ID is a healing berry (for Grass type affinity) */
export function isHealingBerry(itemId: string): boolean {
  return HEALING_BERRY_IDS.has(itemId);
}
