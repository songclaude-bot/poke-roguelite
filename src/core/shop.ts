/**
 * Kecleon Shop — appears in dungeons as a room with items for sale.
 * Player can browse and buy items with gold.
 */

import { ItemDef, ITEM_DB, rollFloorItem } from "./item";

export interface ShopItem {
  item: ItemDef;
  price: number;
}

/** Generate shop inventory (3-5 items) */
export function generateShopItems(floor: number): ShopItem[] {
  const count = 3 + Math.floor(Math.random() * 3); // 3-5 items
  const items: ShopItem[] = [];

  for (let i = 0; i < count; i++) {
    const item = rollFloorItem();
    // Price based on item rarity
    let basePrice = 50;
    switch (item.id) {
      case "oranBerry": basePrice = 30; break;
      case "apple": basePrice = 25; break;
      case "bigApple": basePrice = 60; break;
      case "pechaberry": basePrice = 35; break;
      case "sitrusBerry": basePrice = 80; break;
      case "blastSeed": basePrice = 50; break;
      case "sleepSeed": basePrice = 45; break;
      case "reviveSeed": basePrice = 150; break;
      case "escapeOrb": basePrice = 120; break;
      case "luminousOrb": basePrice = 60; break;
      case "allPowerOrb": basePrice = 100; break;
    }
    // Scale price with floor
    const price = Math.floor(basePrice * (1 + floor * 0.1));
    items.push({ item, price });
  }

  return items;
}

/** Chance for a shop to appear on a floor (20%) */
export function shouldSpawnShop(): boolean {
  return Math.random() < 0.2;
}
