/**
 * Item system — berries, seeds, orbs that can be found and used in dungeons.
 */

export enum ItemCategory {
  Berry = "berry",
  Seed = "seed",
  Orb = "orb",
}

export enum ItemTarget {
  Self = "self",           // Use on self
  Front = "front",         // Throw at enemy in facing direction
  Room = "room",           // Affects entire room
}

export interface ItemDef {
  id: string;
  name: string;
  category: ItemCategory;
  target: ItemTarget;
  description: string;
  /** Applied by the scene when used */
  stackable: boolean;
}

export interface ItemStack {
  item: ItemDef;
  count: number;
}

// ── Item Database ──

export const ITEM_DB: Record<string, ItemDef> = {
  oranBerry: {
    id: "oranBerry",
    name: "Oran Berry",
    category: ItemCategory.Berry,
    target: ItemTarget.Self,
    description: "Restores 30 HP.",
    stackable: true,
  },
  sitrusBerry: {
    id: "sitrusBerry",
    name: "Sitrus Berry",
    category: ItemCategory.Berry,
    target: ItemTarget.Self,
    description: "Restores 50% of max HP.",
    stackable: true,
  },
  pechaberry: {
    id: "pechaberry",
    name: "Pecha Berry",
    category: ItemCategory.Berry,
    target: ItemTarget.Self,
    description: "Cures all status conditions.",
    stackable: true,
  },
  reviveSeed: {
    id: "reviveSeed",
    name: "Revive Seed",
    category: ItemCategory.Seed,
    target: ItemTarget.Self,
    description: "Auto-revive with 50% HP when fainted.",
    stackable: true,
  },
  blastSeed: {
    id: "blastSeed",
    name: "Blast Seed",
    category: ItemCategory.Seed,
    target: ItemTarget.Front,
    description: "Throw at enemy for 40 fixed damage.",
    stackable: true,
  },
  sleepSeed: {
    id: "sleepSeed",
    name: "Sleep Seed",
    category: ItemCategory.Seed,
    target: ItemTarget.Front,
    description: "Throw to paralyze an enemy for 5 turns.",
    stackable: true,
  },
  escapeOrb: {
    id: "escapeOrb",
    name: "Escape Orb",
    category: ItemCategory.Orb,
    target: ItemTarget.Self,
    description: "Immediately escape the dungeon.",
    stackable: false,
  },
  luminousOrb: {
    id: "luminousOrb",
    name: "Luminous Orb",
    category: ItemCategory.Orb,
    target: ItemTarget.Room,
    description: "Reveals the entire floor map.",
    stackable: false,
  },
  allPowerOrb: {
    id: "allPowerOrb",
    name: "All-Power Orb",
    category: ItemCategory.Orb,
    target: ItemTarget.Self,
    description: "Boosts ATK and DEF for 10 turns.",
    stackable: false,
  },
  apple: {
    id: "apple",
    name: "Apple",
    category: ItemCategory.Berry,
    target: ItemTarget.Self,
    description: "Restores 50 Belly.",
    stackable: true,
  },
  bigApple: {
    id: "bigApple",
    name: "Big Apple",
    category: ItemCategory.Berry,
    target: ItemTarget.Self,
    description: "Fully restores Belly.",
    stackable: true,
  },
};

/** Items that can spawn on dungeon floors, with relative weights */
export const FLOOR_ITEM_TABLE: { itemId: string; weight: number }[] = [
  { itemId: "oranBerry", weight: 30 },
  { itemId: "pechaberry", weight: 15 },
  { itemId: "blastSeed", weight: 15 },
  { itemId: "sleepSeed", weight: 10 },
  { itemId: "sitrusBerry", weight: 8 },
  { itemId: "reviveSeed", weight: 5 },
  { itemId: "apple", weight: 20 },
  { itemId: "bigApple", weight: 5 },
  { itemId: "escapeOrb", weight: 3 },
  { itemId: "luminousOrb", weight: 5 },
  { itemId: "allPowerOrb", weight: 4 },
];

/** Pick a random item from the floor table */
export function rollFloorItem(): ItemDef {
  const totalWeight = FLOOR_ITEM_TABLE.reduce((sum, e) => sum + e.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const entry of FLOOR_ITEM_TABLE) {
    roll -= entry.weight;
    if (roll <= 0) return ITEM_DB[entry.itemId];
  }
  return ITEM_DB.oranBerry; // fallback
}

/** Max inventory size */
export const MAX_INVENTORY = 16;
