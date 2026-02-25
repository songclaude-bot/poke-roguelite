/**
 * Relic Artifact System — rare run-specific artifacts found in dungeons
 * that provide powerful bonuses for the current run only.
 * Max 3 relics per run. Dropped from boss kills, gauntlet clears, and legendary defeats.
 */

export enum RelicRarity {
  Common = "Common",
  Rare = "Rare",
  Epic = "Epic",
  Legendary = "Legendary",
}

export interface Relic {
  id: string;
  name: string;
  description: string;
  rarity: RelicRarity;
  effect: Record<string, number>;
  icon: string;   // single character icon
  color: number;  // tint color for HUD/effects
}

/** Maximum relics a player can carry in a single run */
export const MAX_RELICS = 3;

// ── Relic Database ──

export const RELIC_DB: Record<string, Relic> = {
  // ── Common (green, 0x4ade80) ──
  ironShield: {
    id: "ironShield",
    name: "Iron Shield",
    description: "+10% DEF for this run",
    rarity: RelicRarity.Common,
    effect: { defMult: 0.10 },
    icon: "S",
    color: 0x4ade80,
  },
  powerBand: {
    id: "powerBand",
    name: "Power Band",
    description: "+10% ATK for this run",
    rarity: RelicRarity.Common,
    effect: { atkMult: 0.10 },
    icon: "P",
    color: 0x4ade80,
  },
  luckyCharm: {
    id: "luckyCharm",
    name: "Lucky Charm",
    description: "+15% gold from this run",
    rarity: RelicRarity.Common,
    effect: { goldMult: 0.15 },
    icon: "L",
    color: 0x4ade80,
  },
  vitalityCrystal: {
    id: "vitalityCrystal",
    name: "Vitality Crystal",
    description: "+15% max HP for this run",
    rarity: RelicRarity.Common,
    effect: { hpMult: 0.15 },
    icon: "V",
    color: 0x4ade80,
  },
  swiftFeather: {
    id: "swiftFeather",
    name: "Swift Feather",
    description: "10% chance of extra turn",
    rarity: RelicRarity.Common,
    effect: { extraTurnChance: 0.10 },
    icon: "F",
    color: 0x4ade80,
  },

  // ── Rare (blue, 0x60a5fa) ──
  dragonScale: {
    id: "dragonScale",
    name: "Dragon Scale",
    description: "+20% ATK and DEF",
    rarity: RelicRarity.Rare,
    effect: { atkMult: 0.20, defMult: 0.20 },
    icon: "D",
    color: 0x60a5fa,
  },
  lifeDew: {
    id: "lifeDew",
    name: "Life Dew",
    description: "Regenerate 2 HP every 5 turns",
    rarity: RelicRarity.Rare,
    effect: { regenAmount: 2, regenInterval: 5 },
    icon: "W",
    color: 0x60a5fa,
  },
  scopeLens: {
    id: "scopeLens",
    name: "Scope Lens",
    description: "+15% crit chance",
    rarity: RelicRarity.Rare,
    effect: { critBonus: 15 },
    icon: "C",
    color: 0x60a5fa,
  },
  shellBell: {
    id: "shellBell",
    name: "Shell Bell",
    description: "Heal 10% of damage dealt",
    rarity: RelicRarity.Rare,
    effect: { lifeStealPercent: 10 },
    icon: "B",
    color: 0x60a5fa,
  },
  wideGlass: {
    id: "wideGlass",
    name: "Wide Glass",
    description: "+25% type advantage damage",
    rarity: RelicRarity.Rare,
    effect: { typeAdvantageBonus: 0.25 },
    icon: "G",
    color: 0x60a5fa,
  },

  // ── Epic (purple, 0xa855f7) ──
  choiceBand: {
    id: "choiceBand",
    name: "Choice Band",
    description: "+40% ATK, but can only use 1 skill",
    rarity: RelicRarity.Epic,
    effect: { atkMult: 0.40, skillLimit: 1 },
    icon: "X",
    color: 0xa855f7,
  },
  leftovers: {
    id: "leftovers",
    name: "Leftovers",
    description: "Regenerate 5 HP every 3 turns",
    rarity: RelicRarity.Epic,
    effect: { regenAmount: 5, regenInterval: 3 },
    icon: "R",
    color: 0xa855f7,
  },
  focusSash: {
    id: "focusSash",
    name: "Focus Sash",
    description: "Survive lethal hit once at 1 HP",
    rarity: RelicRarity.Epic,
    effect: { focusSash: 1 },
    icon: "!",
    color: 0xa855f7,
  },

  // ── Legendary (gold, 0xfbbf24) ──
  soulDew: {
    id: "soulDew",
    name: "Soul Dew",
    description: "+30% all stats",
    rarity: RelicRarity.Legendary,
    effect: { atkMult: 0.30, defMult: 0.30, hpMult: 0.30 },
    icon: "O",
    color: 0xfbbf24,
  },
  griseousOrb: {
    id: "griseousOrb",
    name: "Griseous Orb",
    description: "+50% ATK, -20% DEF (glass cannon)",
    rarity: RelicRarity.Legendary,
    effect: { atkMult: 0.50, defMult: -0.20 },
    icon: "Z",
    color: 0xfbbf24,
  },
};

// ── Utility Functions ──

/** Get all relics of a given rarity */
export function getRelicsByRarity(rarity: RelicRarity): Relic[] {
  return Object.values(RELIC_DB).filter(r => r.rarity === rarity);
}

/** Rarity weights for the weighted relic pool selection */
const RARITY_WEIGHTS: Record<RelicRarity, number> = {
  [RelicRarity.Common]: 50,
  [RelicRarity.Rare]: 30,
  [RelicRarity.Epic]: 15,
  [RelicRarity.Legendary]: 5,
};

/** Pick a random relic, weighted by rarity */
function pickRandomRelic(): Relic {
  const rarities = [RelicRarity.Common, RelicRarity.Rare, RelicRarity.Epic, RelicRarity.Legendary];
  const totalWeight = rarities.reduce((sum, r) => sum + RARITY_WEIGHTS[r], 0);
  let roll = Math.random() * totalWeight;

  let chosenRarity = RelicRarity.Common;
  for (const r of rarities) {
    roll -= RARITY_WEIGHTS[r];
    if (roll <= 0) {
      chosenRarity = r;
      break;
    }
  }

  const pool = getRelicsByRarity(chosenRarity);
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Roll for a relic drop after a significant event.
 * @param floor Current dungeon floor (higher floors = slightly better odds)
 * @param difficulty Dungeon difficulty multiplier
 * @param dropType Type of event that triggered the roll:
 *   - "boss": 5% base chance (floor boss kill)
 *   - "gauntlet": 10% base chance (gauntlet clear)
 *   - "legendary": 15% base chance (legendary defeat)
 * @returns A Relic if the drop triggers, or null if not
 */
export function rollRelicDrop(
  floor: number,
  difficulty: number,
  dropType: "boss" | "gauntlet" | "legendary" = "boss"
): Relic | null {
  const baseChances: Record<string, number> = {
    boss: 0.05,
    gauntlet: 0.10,
    legendary: 0.15,
  };

  const baseChance = baseChances[dropType] ?? 0.05;
  // Floor bonus: +0.5% per floor, capped at +10%
  const floorBonus = Math.min(0.10, floor * 0.005);
  // Difficulty bonus: higher difficulty slightly increases relic chance
  const diffBonus = Math.max(0, (difficulty - 1) * 0.02);

  const finalChance = baseChance + floorBonus + diffBonus;

  if (Math.random() < finalChance) {
    return pickRandomRelic();
  }
  return null;
}

/** Get the hex color string for a relic's rarity (for HUD display) */
export function getRelicRarityColor(rarity: RelicRarity): string {
  switch (rarity) {
    case RelicRarity.Common: return "#4ade80";
    case RelicRarity.Rare: return "#60a5fa";
    case RelicRarity.Epic: return "#a855f7";
    case RelicRarity.Legendary: return "#fbbf24";
  }
}

// ── Aggregated Relic Effects ──

/** Compute aggregated effects from a list of active relics */
export function getAggregatedRelicEffects(relics: Relic[]): Record<string, number> {
  const effects: Record<string, number> = {};
  for (const relic of relics) {
    for (const [key, value] of Object.entries(relic.effect)) {
      effects[key] = (effects[key] ?? 0) + value;
    }
  }
  return effects;
}

/** Check if a relic with a specific effect key is active */
export function hasRelicEffect(relics: Relic[], effectKey: string): boolean {
  return relics.some(r => r.effect[effectKey] !== undefined && r.effect[effectKey] !== 0);
}
