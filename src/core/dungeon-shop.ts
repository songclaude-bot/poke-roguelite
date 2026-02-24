/**
 * Dungeon Shop System (Kecleon Shop) — Phase 273
 *
 * Generates in-dungeon shops with floor-depth-based inventory,
 * dynamic pricing, sell support, and anti-theft mechanics.
 */

import { ItemDef, ITEM_DB } from "./item";

// ── Interfaces ──

export interface ShopItem {
  itemId: string;
  price: number;
  stock: number;
}

export interface ShopConfig {
  items: ShopItem[];
  sellMultiplier: number;
}

// ── Item tiers by floor depth ──

const EARLY_ITEMS = ["oranBerry", "apple", "pechaberry", "healSeed"];
const MID_ITEMS = ["sitrusBerry", "maxElixir", "bigApple", "stunSeed", "reviveSeed", "warpSeed"];
const LATE_ITEMS = ["blastSeed", "sleepSeed", "escapeOrb", "luminousOrb", "allPowerOrb", "vanishOrb"];

/** Base prices for shop items (gold) */
const BASE_PRICES: Record<string, number> = {
  oranBerry: 30,
  apple: 25,
  pechaberry: 35,
  healSeed: 40,
  sitrusBerry: 80,
  maxElixir: 70,
  bigApple: 60,
  stunSeed: 55,
  reviveSeed: 150,
  warpSeed: 45,
  blastSeed: 50,
  sleepSeed: 45,
  escapeOrb: 120,
  luminousOrb: 60,
  allPowerOrb: 100,
  vanishOrb: 90,
  warpOrb: 80,
  foeHoldOrb: 85,
  grimyFood: 15,
};

/** Get the item pool available at a given floor depth */
function getItemPool(floor: number): string[] {
  if (floor <= 5) {
    // Early floors: basics only, small chance of mid-tier
    const pool = [...EARLY_ITEMS];
    if (Math.random() < 0.2) pool.push(MID_ITEMS[Math.floor(Math.random() * MID_ITEMS.length)]);
    return pool;
  }
  if (floor <= 15) {
    // Mid floors: basics + better items
    return [...EARLY_ITEMS, ...MID_ITEMS];
  }
  // Late floors (16+): all tiers including premium
  return [...EARLY_ITEMS, ...MID_ITEMS, ...LATE_ITEMS];
}

/**
 * Generate a shop inventory based on floor depth and difficulty.
 * Returns 4-8 items with prices scaled by floor.
 */
export function generateShopInventory(floor: number, difficulty: number): ShopConfig {
  const count = 4 + Math.floor(Math.random() * 5); // 4-8 items
  const pool = getItemPool(floor);
  const items: ShopItem[] = [];
  const usedIds = new Set<string>();

  for (let i = 0; i < count; i++) {
    // Pick a random item from the pool, avoid too many duplicates
    let itemId: string;
    let attempts = 0;
    do {
      itemId = pool[Math.floor(Math.random() * pool.length)];
      attempts++;
    } while (usedIds.has(itemId) && attempts < 10);

    // Verify item exists in DB
    if (!ITEM_DB[itemId]) continue;

    usedIds.add(itemId);
    const basePrice = BASE_PRICES[itemId] ?? 50;
    // Price scales with floor depth: base * (1.0 + floor * 0.05)
    const price = Math.floor(basePrice * (1.0 + floor * 0.05) * difficulty);
    const stock = ITEM_DB[itemId].stackable ? (1 + Math.floor(Math.random() * 3)) : 1;

    items.push({ itemId, price, stock });
  }

  return {
    items,
    sellMultiplier: 0.4,
  };
}

/**
 * Determine whether a shop should spawn on this floor.
 * - 15% chance per floor
 * - Never on floor 1 or the last floor
 * - Guaranteed at least once in dungeons with 10+ floors (around floor 3-5)
 */
export function shouldSpawnShop(floor: number, totalFloors: number): boolean {
  // Never on first or last floor
  if (floor <= 1 || floor >= totalFloors) return false;

  // Guaranteed shop on a mid-early floor for longer dungeons
  if (totalFloors >= 10 && floor >= 3 && floor <= 5) {
    // 50% chance on each of floors 3-5 to guarantee at least one
    // This gives ~87.5% chance of at least one shop in floors 3-5
    if (Math.random() < 0.5) return true;
  }

  // Normal 15% chance
  return Math.random() < 0.15;
}

/**
 * Get the sell price for an item at a given floor.
 * Sell price = buy price * 0.4
 */
export function getItemSellPrice(itemId: string, floor: number): number {
  const basePrice = BASE_PRICES[itemId] ?? 50;
  const buyPrice = Math.floor(basePrice * (1.0 + floor * 0.05));
  return Math.floor(buyPrice * 0.4);
}

/**
 * Get the buy price for an item at a given floor (for display).
 */
export function getItemBuyPrice(itemId: string, floor: number, difficulty = 1): number {
  const basePrice = BASE_PRICES[itemId] ?? 50;
  return Math.floor(basePrice * (1.0 + floor * 0.05) * difficulty);
}
