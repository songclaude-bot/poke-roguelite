/**
 * Skill Combo System — Using certain skills in sequence triggers bonus effects.
 * Combos can match by exact skill ID, by type, or by effect category.
 */

import { SKILL_DB } from "./skill";
import { SkillEffect } from "./skill";
import { PokemonType } from "./type-chart";

// ─── Types ──────────────────────────────────────────────────────────────────

export enum ComboEffect {
  DoubleDamage = "doubleDamage",     // next skill does 2x damage
  AreaBlast = "areaBlast",           // deals damage to all enemies in room
  HealBurst = "healBurst",          // heal 30% HP
  SpeedBoost = "speedBoost",        // get 2 actions next turn
  CritGuarantee = "critGuarantee",  // next attack is guaranteed crit
  ElementalStorm = "elementalStorm",       // AoE 200% ATK damage to all visible enemies
  NaturesWrath = "naturesWrath",           // Heal 30% HP + ATK boost 3 turns
  ShadowDance = "shadowDance",             // 100% dodge for next 2 turns
  IronWallCombo = "ironWallCombo",         // DEF +50% for 5 turns
  FairyRing = "fairyRing",                 // Remove negative status + heal 20% HP
  DragonsRage = "dragonsRage",             // Next attack deals 3x damage
  BlizzardRush = "blizzardRush",           // Freeze all adjacent enemies
  ToxicChain = "toxicChain",               // Badly Poison all enemies in room
}

/** How a combo slot matches a skill */
export enum MatchMode {
  /** Exact skill ID must match */
  ExactId = "exactId",
  /** Any skill of this PokemonType */
  ByType = "byType",
  /** Any skill with this SkillEffect */
  ByEffect = "byEffect",
  /** Any damaging skill (power > 0) */
  AnyAttack = "anyAttack",
  /** Any skill that is a buff (AtkUp or DefUp) */
  AnyBuff = "anyBuff",
  /** Any skill with Heal effect */
  AnyHeal = "anyHeal",
}

export interface ComboSlot {
  mode: MatchMode;
  /** For ExactId: the skill ID. For ByType: the PokemonType. For ByEffect: the SkillEffect. */
  value?: string;
}

export interface SkillCombo {
  id: string;
  name: string;
  slots: ComboSlot[];      // 2-3 slots in required order
  effect: ComboEffect;
  description: string;
}

// ─── Combo Definitions ──────────────────────────────────────────────────────

const SKILL_COMBOS: SkillCombo[] = [
  // 1. Fire Chain: Ember → Fire Blast = DoubleDamage
  {
    id: "fireChain",
    name: "Fire Chain",
    slots: [
      { mode: MatchMode.ExactId, value: "ember" },
      { mode: MatchMode.ExactId, value: "fireBlast" },
    ],
    effect: ComboEffect.DoubleDamage,
    description: "Ember then Fire Blast: next skill deals 2x damage!",
  },
  // 2. Quick Strike: Quick Attack → any attack = CritGuarantee
  {
    id: "quickStrike",
    name: "Quick Strike",
    slots: [
      { mode: MatchMode.ExactId, value: "quickAttack" },
      { mode: MatchMode.AnyAttack },
    ],
    effect: ComboEffect.CritGuarantee,
    description: "Quick Attack then any attack: guaranteed critical hit!",
  },
  // 3. Power Surge: any buff → any attack = DoubleDamage
  {
    id: "powerSurge",
    name: "Power Surge",
    slots: [
      { mode: MatchMode.AnyBuff },
      { mode: MatchMode.AnyAttack },
    ],
    effect: ComboEffect.DoubleDamage,
    description: "Use a buff then attack: next skill deals 2x damage!",
  },
  // 4. Double Heal: any heal → any heal = HealBurst
  {
    id: "doubleHeal",
    name: "Double Heal",
    slots: [
      { mode: MatchMode.AnyHeal },
      { mode: MatchMode.AnyHeal },
    ],
    effect: ComboEffect.HealBurst,
    description: "Two heals in a row: burst heal 30% max HP!",
  },
  // 5. Type Barrage: two same-type attacks in a row = AreaBlast
  //    (handled specially in matching logic — see checkSameTypeBarrage)
  {
    id: "typeBarrage",
    name: "Type Barrage",
    slots: [
      { mode: MatchMode.AnyAttack },
      { mode: MatchMode.AnyAttack },
    ],
    effect: ComboEffect.AreaBlast,
    description: "Two same-type attacks in a row: blast all enemies in room!",
  },
  // 6. Thunder Surge: Thunder Wave / ThunderShock → Thunderbolt = SpeedBoost
  {
    id: "thunderSurge",
    name: "Thunder Surge",
    slots: [
      { mode: MatchMode.ByType, value: PokemonType.Electric },
      { mode: MatchMode.ByType, value: PokemonType.Electric },
    ],
    effect: ComboEffect.SpeedBoost,
    description: "Two Electric moves in a row: gain 2 actions next turn!",
  },
  // 7. Frost Bite: Ice Shard → Ice Beam = CritGuarantee
  {
    id: "frostBite",
    name: "Frost Bite",
    slots: [
      { mode: MatchMode.ExactId, value: "iceShard" },
      { mode: MatchMode.ExactId, value: "iceBeam" },
    ],
    effect: ComboEffect.CritGuarantee,
    description: "Ice Shard then Ice Beam: guaranteed critical hit!",
  },
  // 8. Iron Wall: Iron Defense → any attack = DoubleDamage
  {
    id: "ironWall",
    name: "Iron Wall",
    slots: [
      { mode: MatchMode.ExactId, value: "ironDefense" },
      { mode: MatchMode.AnyAttack },
    ],
    effect: ComboEffect.DoubleDamage,
    description: "Iron Defense then attack: next skill deals 2x damage!",
  },
  // 9. Water Torrent: Water Gun → Surf = AreaBlast
  {
    id: "waterTorrent",
    name: "Water Torrent",
    slots: [
      { mode: MatchMode.ExactId, value: "waterGun" },
      { mode: MatchMode.ExactId, value: "surf" },
    ],
    effect: ComboEffect.AreaBlast,
    description: "Water Gun then Surf: blast all enemies in the room!",
  },
  // 10. Dragon Fury: Dragon Breath → Dragon Claw → Dragon Pulse = DoubleDamage + AreaBlast-level power
  {
    id: "dragonFury",
    name: "Dragon Fury",
    slots: [
      { mode: MatchMode.ByType, value: PokemonType.Dragon },
      { mode: MatchMode.ByType, value: PokemonType.Dragon },
      { mode: MatchMode.ByType, value: PokemonType.Dragon },
    ],
    effect: ComboEffect.DoubleDamage,
    description: "Three Dragon moves in a row: next skill deals 2x damage!",
  },
  // 11. Elemental Storm: Fire + Water + Electric in any order → AoE 200% ATK to all visible enemies
  //     All 6 permutations so the combo triggers regardless of order
  ...[
    [PokemonType.Fire, PokemonType.Water, PokemonType.Electric],
    [PokemonType.Fire, PokemonType.Electric, PokemonType.Water],
    [PokemonType.Water, PokemonType.Fire, PokemonType.Electric],
    [PokemonType.Water, PokemonType.Electric, PokemonType.Fire],
    [PokemonType.Electric, PokemonType.Fire, PokemonType.Water],
    [PokemonType.Electric, PokemonType.Water, PokemonType.Fire],
  ].map((types): SkillCombo => ({
    id: "elementalStorm",
    name: "Elemental Storm",
    slots: types.map(t => ({ mode: MatchMode.ByType, value: t })),
    effect: ComboEffect.ElementalStorm,
    description: "Fire + Water + Electric: devastating storm hits all enemies for 200% ATK!",
  })),
  // 12. Nature's Wrath: Grass + Ground + Rock → Heal 30% HP + ATK boost 3 turns
  {
    id: "naturesWrath",
    name: "Nature's Wrath",
    slots: [
      { mode: MatchMode.ByType, value: PokemonType.Grass },
      { mode: MatchMode.ByType, value: PokemonType.Ground },
      { mode: MatchMode.ByType, value: PokemonType.Rock },
    ],
    effect: ComboEffect.NaturesWrath,
    description: "Grass + Ground + Rock: heal 30% HP and boost ATK for 3 turns!",
  },
  // 13. Shadow Dance: Dark + Ghost + Dark → 100% dodge for next 2 turns
  {
    id: "shadowDance",
    name: "Shadow Dance",
    slots: [
      { mode: MatchMode.ByType, value: PokemonType.Dark },
      { mode: MatchMode.ByType, value: PokemonType.Ghost },
      { mode: MatchMode.ByType, value: PokemonType.Dark },
    ],
    effect: ComboEffect.ShadowDance,
    description: "Dark + Ghost + Dark: become untouchable! 100% dodge for 2 turns!",
  },
  // 14. Iron Wall Combo: Steel + Rock + Fighting → DEF +50% for 5 turns
  {
    id: "ironWallCombo",
    name: "Iron Wall",
    slots: [
      { mode: MatchMode.ByType, value: PokemonType.Steel },
      { mode: MatchMode.ByType, value: PokemonType.Rock },
      { mode: MatchMode.ByType, value: PokemonType.Fighting },
    ],
    effect: ComboEffect.IronWallCombo,
    description: "Steel + Rock + Fighting: DEF +50% for 5 turns!",
  },
  // 15. Fairy Ring: Fairy + Psychic + Normal → Remove negative status + heal 20% HP
  {
    id: "fairyRing",
    name: "Fairy Ring",
    slots: [
      { mode: MatchMode.ByType, value: PokemonType.Fairy },
      { mode: MatchMode.ByType, value: PokemonType.Psychic },
      { mode: MatchMode.ByType, value: PokemonType.Normal },
    ],
    effect: ComboEffect.FairyRing,
    description: "Fairy + Psychic + Normal: cleanse all ailments and heal 20% HP!",
  },
  // 16. Dragon's Rage: Dragon + Fire + Dragon → Next attack deals 3x damage
  {
    id: "dragonsRage",
    name: "Dragon's Rage",
    slots: [
      { mode: MatchMode.ByType, value: PokemonType.Dragon },
      { mode: MatchMode.ByType, value: PokemonType.Fire },
      { mode: MatchMode.ByType, value: PokemonType.Dragon },
    ],
    effect: ComboEffect.DragonsRage,
    description: "Dragon + Fire + Dragon: next attack deals 3x damage!",
  },
  // 17. Blizzard Rush: Ice + Ice + Water → Freeze all adjacent enemies
  {
    id: "blizzardRush",
    name: "Blizzard Rush",
    slots: [
      { mode: MatchMode.ByType, value: PokemonType.Ice },
      { mode: MatchMode.ByType, value: PokemonType.Ice },
      { mode: MatchMode.ByType, value: PokemonType.Water },
    ],
    effect: ComboEffect.BlizzardRush,
    description: "Ice + Ice + Water: freeze all adjacent enemies solid!",
  },
  // 18. Toxic Chain: Poison + Poison + Dark → Badly Poison all enemies in room
  {
    id: "toxicChain",
    name: "Toxic Chain",
    slots: [
      { mode: MatchMode.ByType, value: PokemonType.Poison },
      { mode: MatchMode.ByType, value: PokemonType.Poison },
      { mode: MatchMode.ByType, value: PokemonType.Dark },
    ],
    effect: ComboEffect.ToxicChain,
    description: "Poison + Poison + Dark: badly poison all enemies in the room!",
  },
];

// ─── Matching Logic ─────────────────────────────────────────────────────────

/** Check if a single skill (by ID) matches a ComboSlot */
function slotMatchesSkill(slot: ComboSlot, skillId: string): boolean {
  const template = SKILL_DB[skillId];
  if (!template) return false;

  switch (slot.mode) {
    case MatchMode.ExactId:
      return skillId === slot.value;

    case MatchMode.ByType:
      return template.type === slot.value;

    case MatchMode.ByEffect:
      return template.effect === slot.value;

    case MatchMode.AnyAttack:
      return template.power > 0;

    case MatchMode.AnyBuff:
      return template.effect === SkillEffect.AtkUp || template.effect === SkillEffect.DefUp;

    case MatchMode.AnyHeal:
      return template.effect === SkillEffect.Heal;

    default:
      return false;
  }
}

/**
 * Check if the recent skill history triggers a combo.
 * `recentSkills` should be the last N skill IDs used (most recent at the end).
 * Returns the first matching combo, or null.
 *
 * Priority: longer combos (3-slot) are checked before shorter ones (2-slot).
 * Also: more specific combos (ExactId) are checked before generic ones.
 */
export function checkCombo(recentSkills: string[]): SkillCombo | null {
  if (recentSkills.length < 2) return null;

  // Sort combos: longer first, then by specificity (more ExactId slots = more specific)
  const sorted = [...SKILL_COMBOS].sort((a, b) => {
    // Longer combos first
    if (b.slots.length !== a.slots.length) return b.slots.length - a.slots.length;
    // More specific first (count ExactId slots)
    const specA = a.slots.filter(s => s.mode === MatchMode.ExactId).length;
    const specB = b.slots.filter(s => s.mode === MatchMode.ExactId).length;
    return specB - specA;
  });

  for (const combo of sorted) {
    const comboLen = combo.slots.length;
    if (recentSkills.length < comboLen) continue;

    // Check the last N skills against this combo's slots
    const tail = recentSkills.slice(-comboLen);
    let matches = true;
    for (let i = 0; i < comboLen; i++) {
      if (!slotMatchesSkill(combo.slots[i], tail[i])) {
        matches = false;
        break;
      }
    }

    if (!matches) continue;

    // Special case for "typeBarrage": the two attacks must share the same type
    if (combo.id === "typeBarrage") {
      const t1 = SKILL_DB[tail[0]];
      const t2 = SKILL_DB[tail[1]];
      if (!t1 || !t2 || t1.type !== t2.type) continue;
      // Avoid overlapping with thunderSurge (Electric + Electric already has a combo)
      if (t1.type === PokemonType.Electric) continue;
      // Avoid overlapping with dragonFury
      if (t1.type === PokemonType.Dragon) continue;
      // Avoid overlapping with blizzardRush (Ice + Ice + Water)
      if (t1.type === PokemonType.Ice) continue;
      // Avoid overlapping with toxicChain (Poison + Poison + Dark)
      if (t1.type === PokemonType.Poison) continue;
    }

    // Special case for "thunderSurge": don't trigger if both are exact-ID combos
    // that already matched (frostBite etc.) — handled by priority ordering

    return combo;
  }

  return null;
}

/** Get all available combos for display in help (deduplicated by id) */
export function getAvailableCombos(): SkillCombo[] {
  const seen = new Set<string>();
  return SKILL_COMBOS.filter(c => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });
}
