/**
 * Item system — berries, seeds, orbs that can be found and used in dungeons.
 */

export enum ItemCategory {
  Berry = "berry",
  Seed = "seed",
  Orb = "orb",
  TM = "tm",
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
  /** For TM items — the skill ID this TM teaches */
  tmSkillId?: string;
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
  grimyFood: {
    id: "grimyFood",
    name: "Grimy Food",
    category: ItemCategory.Berry,
    target: ItemTarget.Self,
    description: "Restores 30 Belly, but may cause sickness.",
    stackable: true,
  },
  // ── Additional items ──
  warpOrb: {
    id: "warpOrb",
    name: "Warp Orb",
    category: ItemCategory.Orb,
    target: ItemTarget.Room,
    description: "Warps all enemies in the room to random tiles.",
    stackable: false,
  },
  foeHoldOrb: {
    id: "foeHoldOrb",
    name: "Foe-Hold Orb",
    category: ItemCategory.Orb,
    target: ItemTarget.Room,
    description: "Paralyzes all enemies in the room.",
    stackable: false,
  },
  maxElixir: {
    id: "maxElixir",
    name: "Max Elixir",
    category: ItemCategory.Berry,
    target: ItemTarget.Self,
    description: "Restores all skill PP to max.",
    stackable: true,
  },
  // Phase 116-117: New items
  warpSeed: {
    id: "warpSeed",
    name: "Warp Seed",
    category: ItemCategory.Seed,
    target: ItemTarget.Self,
    description: "Warps user to a random spot on the floor.",
    stackable: true,
  },
  stunSeed: {
    id: "stunSeed",
    name: "Stun Seed",
    category: ItemCategory.Seed,
    target: ItemTarget.Front,
    description: "Throw to stun an enemy, skipping its next 3 turns.",
    stackable: true,
  },
  healSeed: {
    id: "healSeed",
    name: "Heal Seed",
    category: ItemCategory.Seed,
    target: ItemTarget.Self,
    description: "Cures all status and restores 20 HP.",
    stackable: true,
  },
  vanishOrb: {
    id: "vanishOrb",
    name: "Vanish Orb",
    category: ItemCategory.Orb,
    target: ItemTarget.Self,
    description: "Makes user invisible for 10 turns.",
    stackable: false,
  },
  // ── Throwable Items ──
  pebble: {
    id: "pebble",
    name: "Pebble",
    category: ItemCategory.Seed,
    target: ItemTarget.Front,
    description: "Throw at enemy for 15 fixed damage.",
    stackable: true,
  },
  gravelrock: {
    id: "gravelrock",
    name: "Gravelrock",
    category: ItemCategory.Seed,
    target: ItemTarget.Front,
    description: "Throw at enemy for 25 fixed damage.",
    stackable: true,
  },
  // ── Stat Boost Items ──
  xAttack: {
    id: "xAttack",
    name: "X-Attack",
    category: ItemCategory.Berry,
    target: ItemTarget.Self,
    description: "Boosts ATK by +3 stages for 10 turns.",
    stackable: true,
  },
  xDefend: {
    id: "xDefend",
    name: "X-Defend",
    category: ItemCategory.Berry,
    target: ItemTarget.Self,
    description: "Boosts DEF by +3 stages for 10 turns.",
    stackable: true,
  },
  // ── Upgraded (Synthesized) Items ──
  megaOranBerry: {
    id: "megaOranBerry",
    name: "★ Mega Oran Berry",
    category: ItemCategory.Berry,
    target: ItemTarget.Self,
    description: "Restores 80 HP.",
    stackable: true,
  },
  megaSitrusBerry: {
    id: "megaSitrusBerry",
    name: "★ Mega Sitrus Berry",
    category: ItemCategory.Berry,
    target: ItemTarget.Self,
    description: "Restores 150 HP.",
    stackable: true,
  },
  goldenApple: {
    id: "goldenApple",
    name: "★ Golden Apple",
    category: ItemCategory.Berry,
    target: ItemTarget.Self,
    description: "Restores 200 Belly.",
    stackable: true,
  },
  crystalPebble: {
    id: "crystalPebble",
    name: "★ Crystal Pebble",
    category: ItemCategory.Seed,
    target: ItemTarget.Front,
    description: "Throw at enemy for 30 fixed damage.",
    stackable: true,
  },
  meteorRock: {
    id: "meteorRock",
    name: "★ Meteor Rock",
    category: ItemCategory.Seed,
    target: ItemTarget.Front,
    description: "Throw at enemy for 50 fixed damage.",
    stackable: true,
  },
  autoReviver: {
    id: "autoReviver",
    name: "★ Auto Reviver",
    category: ItemCategory.Seed,
    target: ItemTarget.Self,
    description: "Auto-revive with 75% HP when fainted, no turn cost.",
    stackable: true,
  },
  megaElixir: {
    id: "megaElixir",
    name: "★ Mega Elixir",
    category: ItemCategory.Berry,
    target: ItemTarget.Self,
    description: "Restores all PP to max + 10 extra PP each.",
    stackable: true,
  },
  megaBlastSeed: {
    id: "megaBlastSeed",
    name: "★ Mega Blast Seed",
    category: ItemCategory.Seed,
    target: ItemTarget.Front,
    description: "Throw at enemy for 80 fixed damage.",
    stackable: true,
  },
  deepSleepSeed: {
    id: "deepSleepSeed",
    name: "★ Deep Sleep Seed",
    category: ItemCategory.Seed,
    target: ItemTarget.Front,
    description: "Throw to paralyze an enemy for 8 turns.",
    stackable: true,
  },
  megaXAttack: {
    id: "megaXAttack",
    name: "★ Mega X-Attack",
    category: ItemCategory.Berry,
    target: ItemTarget.Self,
    description: "Boosts ATK by +6 stages for 15 turns.",
    stackable: true,
  },
  megaXDefend: {
    id: "megaXDefend",
    name: "★ Mega X-Defend",
    category: ItemCategory.Berry,
    target: ItemTarget.Self,
    description: "Boosts DEF by +6 stages for 15 turns.",
    stackable: true,
  },
  // ── TMs ──
  tmFlamethrower: {
    id: "tmFlamethrower",
    name: "TM Flamethrower",
    category: ItemCategory.TM,
    target: ItemTarget.Self,
    description: "Teaches Flamethrower to replace a skill.",
    stackable: false,
    tmSkillId: "flamethrower",
  },
  tmThunderbolt: {
    id: "tmThunderbolt",
    name: "TM Thunderbolt",
    category: ItemCategory.TM,
    target: ItemTarget.Self,
    description: "Teaches Thunderbolt to replace a skill.",
    stackable: false,
    tmSkillId: "thunderbolt",
  },
  tmIceBeam: {
    id: "tmIceBeam",
    name: "TM Ice Beam",
    category: ItemCategory.TM,
    target: ItemTarget.Self,
    description: "Teaches Ice Beam to replace a skill.",
    stackable: false,
    tmSkillId: "iceBeam",
  },
  tmShadowBall: {
    id: "tmShadowBall",
    name: "TM Shadow Ball",
    category: ItemCategory.TM,
    target: ItemTarget.Self,
    description: "Teaches Shadow Ball to replace a skill.",
    stackable: false,
    tmSkillId: "shadowBall",
  },
  tmDragonPulse: {
    id: "tmDragonPulse",
    name: "TM Dragon Pulse",
    category: ItemCategory.TM,
    target: ItemTarget.Self,
    description: "Teaches Dragon Pulse to replace a skill.",
    stackable: false,
    tmSkillId: "dragonPulse",
  },
  tmEarthquake: {
    id: "tmEarthquake",
    name: "TM Earthquake",
    category: ItemCategory.TM,
    target: ItemTarget.Self,
    description: "Teaches Earthquake to replace a skill.",
    stackable: false,
    tmSkillId: "earthPower",
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
  { itemId: "grimyFood", weight: 8 },
  { itemId: "escapeOrb", weight: 3 },
  { itemId: "luminousOrb", weight: 5 },
  { itemId: "allPowerOrb", weight: 4 },
  { itemId: "warpOrb", weight: 3 },
  { itemId: "foeHoldOrb", weight: 3 },
  { itemId: "maxElixir", weight: 6 },
  { itemId: "warpSeed", weight: 6 },
  { itemId: "stunSeed", weight: 8 },
  { itemId: "healSeed", weight: 10 },
  { itemId: "vanishOrb", weight: 2 },
  { itemId: "reviveSeed", weight: 4 },
  { itemId: "allPowerOrb", weight: 2 },
  { itemId: "escapeOrb", weight: 1 },
  { itemId: "tmFlamethrower", weight: 1 },
  { itemId: "tmThunderbolt", weight: 1 },
  { itemId: "tmIceBeam", weight: 1 },
  { itemId: "tmShadowBall", weight: 1 },
  { itemId: "tmDragonPulse", weight: 1 },
  { itemId: "tmEarthquake", weight: 1 },
  { itemId: "pebble", weight: 12 },
  { itemId: "gravelrock", weight: 8 },
  { itemId: "xAttack", weight: 5 },
  { itemId: "xDefend", weight: 5 },
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
