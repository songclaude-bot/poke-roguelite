/**
 * Blessing & Curse System — temporary run buffs/debuffs lasting multiple floors.
 */

export enum BlessingType {
  // Blessings (positive)
  WarriorsSpirit = "warriorsSpirit",
  GuardiansShield = "guardiansShield",
  FortuneFavor = "fortuneFavor",
  SwiftStep = "swiftStep",
  NaturesGrace = "naturesGrace",
  // Curses (negative)
  FrailBody = "frailBody",
  HeavyBurden = "heavyBurden",
  Blindness = "blindness",
  Unlucky = "unlucky",
  ManaLeak = "manaLeak",
}

export interface Blessing {
  id: string;
  name: string;
  description: string;
  isCurse: boolean;
  duration: number; // floors
  effect: Record<string, number>;
  color: number;
}

export interface ActiveBlessing {
  blessing: Blessing;
  remainingFloors: number;
}

// ── Blessing Definitions ──

const BLESSINGS: Record<string, Blessing> = {
  [BlessingType.WarriorsSpirit]: {
    id: BlessingType.WarriorsSpirit,
    name: "Warrior's Spirit",
    description: "ATK +20% for 15 floors",
    isCurse: false,
    duration: 15,
    effect: { atkMult: 0.2 },
    color: 0x4ade80,
  },
  [BlessingType.GuardiansShield]: {
    id: BlessingType.GuardiansShield,
    name: "Guardian's Shield",
    description: "DEF +20% for 15 floors",
    isCurse: false,
    duration: 15,
    effect: { defMult: 0.2 },
    color: 0x60a5fa,
  },
  [BlessingType.FortuneFavor]: {
    id: BlessingType.FortuneFavor,
    name: "Fortune's Favor",
    description: "Gold +30% for 10 floors",
    isCurse: false,
    duration: 10,
    effect: { goldMult: 0.3 },
    color: 0xfbbf24,
  },
  [BlessingType.SwiftStep]: {
    id: BlessingType.SwiftStep,
    name: "Swift Step",
    description: "15% dodge chance for 10 floors",
    isCurse: false,
    duration: 10,
    effect: { dodgeChance: 0.15 },
    color: 0x38bdf8,
  },
  [BlessingType.NaturesGrace]: {
    id: BlessingType.NaturesGrace,
    name: "Nature's Grace",
    description: "Regen 3 HP every 5 turns for 20 floors",
    isCurse: false,
    duration: 20,
    effect: { regenAmount: 3, regenInterval: 5 },
    color: 0x22c55e,
  },
  // ── Curses ──
  [BlessingType.FrailBody]: {
    id: BlessingType.FrailBody,
    name: "Frail Body",
    description: "Max HP -15% for 10 floors",
    isCurse: true,
    duration: 10,
    effect: { hpMult: -0.15 },
    color: 0xef4444,
  },
  [BlessingType.HeavyBurden]: {
    id: BlessingType.HeavyBurden,
    name: "Heavy Burden",
    description: "Belly drains 20% faster for 10 floors",
    isCurse: true,
    duration: 10,
    effect: { bellyDrainMult: 0.2 },
    color: 0xf97316,
  },
  [BlessingType.Blindness]: {
    id: BlessingType.Blindness,
    name: "Blindness",
    description: "Sight range -2 for 5 floors",
    isCurse: true,
    duration: 5,
    effect: { sightReduction: 2 },
    color: 0x6b7280,
  },
  [BlessingType.Unlucky]: {
    id: BlessingType.Unlucky,
    name: "Unlucky",
    description: "Gold and items -20% for 10 floors",
    isCurse: true,
    duration: 10,
    effect: { goldMult: -0.2, itemMult: -0.2 },
    color: 0xa855f7,
  },
  [BlessingType.ManaLeak]: {
    id: BlessingType.ManaLeak,
    name: "Mana Leak",
    description: "Skills cost +1 PP for 8 floors",
    isCurse: true,
    duration: 8,
    effect: { extraPpCost: 1 },
    color: 0x8b5cf6,
  },
};

// ── Public API ──

const blessingList = Object.values(BLESSINGS).filter(b => !b.isCurse);
const curseList = Object.values(BLESSINGS).filter(b => b.isCurse);

export function getRandomBlessing(): Blessing {
  return blessingList[Math.floor(Math.random() * blessingList.length)];
}

export function getRandomCurse(): Blessing {
  return curseList[Math.floor(Math.random() * curseList.length)];
}

/** 50/50 chance of blessing or curse */
export function rollBlessingOrCurse(): Blessing {
  return Math.random() < 0.5 ? getRandomBlessing() : getRandomCurse();
}

/** Get the aggregate value for a specific effect key across all active blessings */
export function getBlessingEffect(actives: ActiveBlessing[], key: string): number {
  let total = 0;
  for (const a of actives) {
    total += a.blessing.effect[key] ?? 0;
  }
  return total;
}

/** Tick durations down by 1 floor and remove expired ones. Returns remaining. */
export function tickBlessingDurations(actives: ActiveBlessing[]): ActiveBlessing[] {
  return actives
    .map(a => ({ ...a, remainingFloors: a.remainingFloors - 1 }))
    .filter(a => a.remainingFloors > 0);
}

/** Create an ActiveBlessing from a Blessing definition */
export function activateBlessing(b: Blessing): ActiveBlessing {
  return { blessing: b, remainingFloors: b.duration };
}

/** Check if a specific blessing type is active */
export function hasActiveBlessing(actives: ActiveBlessing[], type: BlessingType): boolean {
  return actives.some(a => a.blessing.id === type);
}

/** Serialize for floor transitions */
export function serializeBlessings(actives: ActiveBlessing[]): { id: string; remaining: number }[] {
  return actives.map(a => ({ id: a.blessing.id, remaining: a.remainingFloors }));
}

/** Deserialize from floor transition data */
export function deserializeBlessings(data: { id: string; remaining: number }[]): ActiveBlessing[] {
  return data
    .map(d => {
      const b = BLESSINGS[d.id];
      if (!b) return null;
      return { blessing: b, remainingFloors: d.remaining } as ActiveBlessing;
    })
    .filter((a): a is ActiveBlessing => a !== null);
}
