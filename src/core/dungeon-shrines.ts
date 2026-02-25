/**
 * Dungeon Shrine System — interactive altars found on dungeon floors.
 * Players step on a shrine tile and choose from 2-3 options.
 */

import { Blessing, getRandomBlessing, getRandomCurse, rollBlessingOrCurse } from "./blessings";

// ── Enums & Interfaces ──

export enum ShrineType {
  Blessing = "blessing",      // Offers a choice of 2 blessings
  Sacrifice = "sacrifice",    // Trade HP/belly for gold/items/blessing
  Gamble = "gamble",          // Random positive or negative outcome
  Healing = "healing",        // Full HP restore (one-time)
  SkillShrine = "skillShrine", // Restore all PP or gain EXP
  Mystery = "mystery",        // Random effect (good or bad)
}

export interface ShrineEffect {
  type: "heal" | "hpSacrifice" | "bellySacrifice" | "gold" | "blessing" | "curse" | "restorePP" | "learnSkill" | "exp" | "item" | "random";
  value?: number;             // amount (e.g., heal 50, gold 200)
  itemId?: string;
  blessingType?: string;      // specific or "random"
  blessing?: Blessing;        // pre-rolled blessing for display
}

export interface ShrineChoice {
  label: string;
  description: string;
  effect: ShrineEffect;
  color: string;
}

export interface Shrine {
  type: ShrineType;
  name: string;
  description: string;
  choices: ShrineChoice[];
  color: number;              // tint color for shrine visual
  icon: string;               // emoji icon
}

// ── Shrine Generation ──

const SHRINE_TYPES = Object.values(ShrineType);

/** Generate 2-3 choices based on shrine type and floor */
export function generateShrine(floor: number, difficulty: number): Shrine {
  const type = SHRINE_TYPES[Math.floor(Math.random() * SHRINE_TYPES.length)];

  switch (type) {
    case ShrineType.Blessing:
      return generateBlessingShrine();
    case ShrineType.Sacrifice:
      return generateSacrificeShrine(floor, difficulty);
    case ShrineType.Gamble:
      return generateGambleShrine();
    case ShrineType.Healing:
      return generateHealingShrine();
    case ShrineType.SkillShrine:
      return generateSkillShrine(floor);
    case ShrineType.Mystery:
      return generateMysteryShrine(floor);
    default:
      return generateHealingShrine();
  }
}

function generateBlessingShrine(): Shrine {
  const b1 = getRandomBlessing();
  let b2 = getRandomBlessing();
  // Avoid duplicate blessings
  let attempts = 0;
  while (b2.id === b1.id && attempts < 5) {
    b2 = getRandomBlessing();
    attempts++;
  }

  return {
    type: ShrineType.Blessing,
    name: "Blessing Shrine",
    description: "A radiant shrine hums with divine energy. Choose one blessing.",
    color: 0x4ade80,
    icon: "\u2728",
    choices: [
      {
        label: b1.name,
        description: b1.description,
        effect: { type: "blessing", blessingType: b1.id, blessing: b1 },
        color: "#4ade80",
      },
      {
        label: b2.name,
        description: b2.description,
        effect: { type: "blessing", blessingType: b2.id, blessing: b2 },
        color: "#60a5fa",
      },
    ],
  };
}

function generateSacrificeShrine(floor: number, difficulty: number): Shrine {
  const goldReward = Math.floor(100 + floor * 15 + difficulty * 20);
  const b = getRandomBlessing();

  return {
    type: ShrineType.Sacrifice,
    name: "Sacrifice Shrine",
    description: "A dark altar demands an offering. Give something to receive.",
    color: 0xf97316,
    icon: "\uD83D\uDD25",
    choices: [
      {
        label: "Offer Vitality",
        description: `Lose 25% HP \u2192 Gain ${b.name}`,
        effect: { type: "hpSacrifice", value: 25, blessing: b },
        color: "#ef4444",
      },
      {
        label: "Offer Hunger",
        description: `Lose 30 belly \u2192 Gain ${goldReward}G`,
        effect: { type: "bellySacrifice", value: 30, blessing: undefined },
        color: "#fbbf24",
      },
      {
        label: "Leave",
        description: "Walk away safely.",
        effect: { type: "heal", value: 0 },
        color: "#888888",
      },
    ],
  };
}

function generateGambleShrine(): Shrine {
  const rolled = rollBlessingOrCurse();

  return {
    type: ShrineType.Gamble,
    name: "Gamble Shrine",
    description: "A mysterious shrine crackles with unstable energy. Dare to touch it?",
    color: 0xa855f7,
    icon: "\uD83C\uDFB2",
    choices: [
      {
        label: "Touch the Shrine",
        description: "50/50: random blessing or curse",
        effect: { type: "random", blessing: rolled },
        color: "#a855f7",
      },
      {
        label: "Walk Away",
        description: "Leave the shrine alone.",
        effect: { type: "heal", value: 0 },
        color: "#888888",
      },
    ],
  };
}

function generateHealingShrine(): Shrine {
  return {
    type: ShrineType.Healing,
    name: "Healing Shrine",
    description: "A gentle light radiates from this sacred font. Pray to be healed.",
    color: 0x22c55e,
    icon: "\uD83D\uDC9A",
    choices: [
      {
        label: "Pray",
        description: "Fully restore HP.",
        effect: { type: "heal", value: -1 },  // -1 = full heal
        color: "#22c55e",
      },
    ],
  };
}

function generateSkillShrine(floor: number): Shrine {
  const expReward = Math.floor(30 + floor * 8);

  return {
    type: ShrineType.SkillShrine,
    name: "Skill Shrine",
    description: "Ancient knowledge flows from this carved stone pillar.",
    color: 0x38bdf8,
    icon: "\uD83D\uDCD6",
    choices: [
      {
        label: "Meditate",
        description: "Restore all PP for every skill.",
        effect: { type: "restorePP" },
        color: "#38bdf8",
      },
      {
        label: "Study",
        description: `Gain ${expReward} EXP.`,
        effect: { type: "exp", value: expReward },
        color: "#fbbf24",
      },
    ],
  };
}

function generateMysteryShrine(floor: number): Shrine {
  // Roll a random mystery effect
  const roll = Math.random();
  let effect: ShrineEffect;
  let desc: string;
  let label: string;
  let color: string;

  if (roll < 0.20) {
    const goldAmt = 80 + Math.floor(floor * 12);
    effect = { type: "gold", value: goldAmt };
    desc = `Gained ${goldAmt} gold!`;
    label = "Fortune Found";
    color = "#fbbf24";
  } else if (roll < 0.40) {
    const curse = getRandomCurse();
    effect = { type: "curse", blessing: curse };
    desc = `Cursed: ${curse.name}`;
    label = "Dark Omen";
    color = "#ef4444";
  } else if (roll < 0.60) {
    effect = { type: "heal", value: 50 };
    desc = "Restored 50% HP.";
    label = "Gentle Light";
    color = "#22c55e";
  } else if (roll < 0.80) {
    const expAmt = 40 + Math.floor(floor * 6);
    effect = { type: "exp", value: expAmt };
    desc = `Gained ${expAmt} EXP.`;
    label = "Ancient Wisdom";
    color = "#c084fc";
  } else {
    const blessing = getRandomBlessing();
    effect = { type: "blessing", blessing };
    desc = `Blessed: ${blessing.name}`;
    label = "Divine Gift";
    color = "#4ade80";
  }

  return {
    type: ShrineType.Mystery,
    name: "Mystery Shrine",
    description: "An enigmatic shrine pulses with unknown power. Touch it to reveal its nature.",
    color: 0xc084fc,
    icon: "\u2753",
    choices: [
      {
        label: "Touch",
        description: "Reveal the mystery.",
        effect,
        color: "#c084fc",
      },
      {
        label: "Ignore",
        description: "Leave it alone.",
        effect: { type: "heal", value: 0 },
        color: "#888888",
      },
    ],
  };
}

// ── Spawn Check ──

/** Should a shrine spawn on this floor? ~15% chance, not on boss floors */
export function shouldSpawnShrine(floor: number, totalFloors: number, isBossFloor: boolean): boolean {
  if (isBossFloor) return false;
  if (floor <= 1) return false;
  if (floor >= totalFloors) return false;
  return Math.random() < 0.15;
}
