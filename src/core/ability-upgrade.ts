/**
 * Ability Upgrade System — meta-progression that enhances passive abilities.
 * Each ability can be upgraded from level 1 (base) to level 5 (maximum).
 */

import { AbilityId, ABILITIES } from "./ability";

export interface AbilityUpgrade {
  level: number;         // 1-5
  name: string;          // e.g., "Torrent II", "Torrent III"
  description: string;
  cost: number;          // gold cost (0 for level 1)
  requiredClears: number;
}

/** Per-ability upgrade tier definitions: indices 0-4 map to levels 1-5 */
export const ABILITY_UPGRADES: Record<AbilityId, AbilityUpgrade[]> = {
  // ── Torrent ──
  // HP threshold: 33% → 38% → 43% → 48% → 55%
  // Damage bonus: 1.5x → 1.6x → 1.7x → 1.8x → 2.0x
  [AbilityId.Torrent]: [
    { level: 1, name: "Torrent",     description: "+50% damage when HP < 33%",  cost: 0,    requiredClears: 0 },
    { level: 2, name: "Torrent II",  description: "+60% damage when HP < 38%",  cost: 300,  requiredClears: 5 },
    { level: 3, name: "Torrent III", description: "+70% damage when HP < 43%",  cost: 600,  requiredClears: 15 },
    { level: 4, name: "Torrent IV",  description: "+80% damage when HP < 48%",  cost: 1000, requiredClears: 30 },
    { level: 5, name: "Torrent V",   description: "+100% damage when HP < 55%", cost: 2000, requiredClears: 50 },
  ],

  // ── Sturdy ──
  // Survive HP: 1 → 2 → 3 → 4 → 5
  [AbilityId.Sturdy]: [
    { level: 1, name: "Sturdy",     description: "Survive lethal hit with 1 HP",  cost: 0,    requiredClears: 0 },
    { level: 2, name: "Sturdy II",  description: "Survive lethal hit with 2 HP",  cost: 300,  requiredClears: 5 },
    { level: 3, name: "Sturdy III", description: "Survive lethal hit with 3 HP",  cost: 600,  requiredClears: 15 },
    { level: 4, name: "Sturdy IV",  description: "Survive lethal hit with 4 HP",  cost: 1000, requiredClears: 30 },
    { level: 5, name: "Sturdy V",   description: "Survive lethal hit with 5 HP",  cost: 2000, requiredClears: 50 },
  ],

  // ── Rock Head ──
  // Trap damage reduction: immune → immune + 5% DEF → +10% DEF → +15% DEF → +20% DEF
  [AbilityId.RockHead]: [
    { level: 1, name: "Rock Head",     description: "Immune to trap damage",               cost: 0,    requiredClears: 0 },
    { level: 2, name: "Rock Head II",  description: "Trap immune + 5% DEF bonus",          cost: 300,  requiredClears: 5 },
    { level: 3, name: "Rock Head III", description: "Trap immune + 10% DEF bonus",         cost: 600,  requiredClears: 15 },
    { level: 4, name: "Rock Head IV",  description: "Trap immune + 15% DEF bonus",         cost: 1000, requiredClears: 30 },
    { level: 5, name: "Rock Head V",   description: "Trap immune + 20% DEF bonus",         cost: 2000, requiredClears: 50 },
  ],

  // ── Guts ──
  // ATK bonus when statused: 50% → 60% → 70% → 80% → 100%
  [AbilityId.Guts]: [
    { level: 1, name: "Guts",     description: "+50% ATK when afflicted with status",  cost: 0,    requiredClears: 0 },
    { level: 2, name: "Guts II",  description: "+60% ATK when afflicted with status",  cost: 300,  requiredClears: 5 },
    { level: 3, name: "Guts III", description: "+70% ATK when afflicted with status",  cost: 600,  requiredClears: 15 },
    { level: 4, name: "Guts IV",  description: "+80% ATK when afflicted with status",  cost: 1000, requiredClears: 30 },
    { level: 5, name: "Guts V",   description: "+100% ATK when afflicted with status", cost: 2000, requiredClears: 50 },
  ],

  // ── Pure Power ──
  // ATK bonus: 30% → 35% → 40% → 45% → 50%
  [AbilityId.PurePower]: [
    { level: 1, name: "Pure Power",     description: "+30% ATK always",  cost: 0,    requiredClears: 0 },
    { level: 2, name: "Pure Power II",  description: "+35% ATK always",  cost: 300,  requiredClears: 5 },
    { level: 3, name: "Pure Power III", description: "+40% ATK always",  cost: 600,  requiredClears: 15 },
    { level: 4, name: "Pure Power IV",  description: "+45% ATK always",  cost: 1000, requiredClears: 30 },
    { level: 5, name: "Pure Power V",   description: "+50% ATK always",  cost: 2000, requiredClears: 50 },
  ],

  // ── No Guard ──
  // Base: all moves hit. Upgrades: +5%/+10%/+15%/+20% ATK bonus
  [AbilityId.NoGuard]: [
    { level: 1, name: "No Guard",     description: "All moves always hit",                   cost: 0,    requiredClears: 0 },
    { level: 2, name: "No Guard II",  description: "All moves hit + 5% ATK bonus",           cost: 300,  requiredClears: 5 },
    { level: 3, name: "No Guard III", description: "All moves hit + 10% ATK bonus",          cost: 600,  requiredClears: 15 },
    { level: 4, name: "No Guard IV",  description: "All moves hit + 15% ATK bonus",          cost: 1000, requiredClears: 30 },
    { level: 5, name: "No Guard V",   description: "All moves hit + 20% ATK bonus",          cost: 2000, requiredClears: 50 },
  ],

  // ── Run Away ──
  // Base: warp near stairs. Upgrades: +5%/+10%/+15%/+20% speed (dodge chance)
  [AbilityId.RunAway]: [
    { level: 1, name: "Run Away",     description: "Warp Traps teleport near stairs",                cost: 0,    requiredClears: 0 },
    { level: 2, name: "Run Away II",  description: "Warp near stairs + 5% dodge chance",             cost: 300,  requiredClears: 5 },
    { level: 3, name: "Run Away III", description: "Warp near stairs + 10% dodge chance",            cost: 600,  requiredClears: 15 },
    { level: 4, name: "Run Away IV",  description: "Warp near stairs + 15% dodge chance",            cost: 1000, requiredClears: 30 },
    { level: 5, name: "Run Away V",   description: "Warp near stairs + 20% dodge chance",            cost: 2000, requiredClears: 50 },
  ],

  // ── Shield Dust ──
  // Base: immune to secondary effects. Upgrades: +3%/+6%/+9%/+12% DEF bonus
  [AbilityId.ShieldDust]: [
    { level: 1, name: "Shield Dust",     description: "Immune to secondary effects",               cost: 0,    requiredClears: 0 },
    { level: 2, name: "Shield Dust II",  description: "Effect immune + 3% DEF bonus",              cost: 300,  requiredClears: 5 },
    { level: 3, name: "Shield Dust III", description: "Effect immune + 6% DEF bonus",              cost: 600,  requiredClears: 15 },
    { level: 4, name: "Shield Dust IV",  description: "Effect immune + 9% DEF bonus",              cost: 1000, requiredClears: 30 },
    { level: 5, name: "Shield Dust V",   description: "Effect immune + 12% DEF bonus",             cost: 2000, requiredClears: 50 },
  ],

  // ── Static ──
  // Paralyze chance: 30% → 35% → 40% → 50% → 60%
  [AbilityId.Static]: [
    { level: 1, name: "Static",     description: "30% chance to paralyze attacker",  cost: 0,    requiredClears: 0 },
    { level: 2, name: "Static II",  description: "35% chance to paralyze attacker",  cost: 300,  requiredClears: 5 },
    { level: 3, name: "Static III", description: "40% chance to paralyze attacker",  cost: 600,  requiredClears: 15 },
    { level: 4, name: "Static IV",  description: "50% chance to paralyze attacker",  cost: 1000, requiredClears: 30 },
    { level: 5, name: "Static V",   description: "60% chance to paralyze attacker",  cost: 2000, requiredClears: 50 },
  ],

  // ── Pickup ──
  // Item find chance: 10% → 13% → 16% → 20% → 25%
  [AbilityId.Pickup]: [
    { level: 1, name: "Pickup",     description: "10% chance to find item on KO",  cost: 0,    requiredClears: 0 },
    { level: 2, name: "Pickup II",  description: "13% chance to find item on KO",  cost: 300,  requiredClears: 5 },
    { level: 3, name: "Pickup III", description: "16% chance to find item on KO",  cost: 600,  requiredClears: 15 },
    { level: 4, name: "Pickup IV",  description: "20% chance to find item on KO",  cost: 1000, requiredClears: 30 },
    { level: 5, name: "Pickup V",   description: "25% chance to find item on KO",  cost: 2000, requiredClears: 50 },
  ],

  // ── Swift Swim ──
  // Speed in rain: faster → faster + 5% ATK → +10% ATK → +15% ATK → +20% ATK in rain
  [AbilityId.SwiftSwim]: [
    { level: 1, name: "Swift Swim",     description: "Faster in rain weather",                  cost: 0,    requiredClears: 0 },
    { level: 2, name: "Swift Swim II",  description: "Rain speed + 5% ATK in rain",             cost: 300,  requiredClears: 5 },
    { level: 3, name: "Swift Swim III", description: "Rain speed + 10% ATK in rain",            cost: 600,  requiredClears: 15 },
    { level: 4, name: "Swift Swim IV",  description: "Rain speed + 15% ATK in rain",            cost: 1000, requiredClears: 30 },
    { level: 5, name: "Swift Swim V",   description: "Rain speed + 20% ATK in rain",            cost: 2000, requiredClears: 50 },
  ],

  // ── Levitate ──
  // Base: immune to ground traps. Upgrades: +5%/+10%/+15%/+20% dodge chance
  [AbilityId.Levitate]: [
    { level: 1, name: "Levitate",     description: "Immune to ground traps",                cost: 0,    requiredClears: 0 },
    { level: 2, name: "Levitate II",  description: "Trap immune + 5% dodge chance",         cost: 300,  requiredClears: 5 },
    { level: 3, name: "Levitate III", description: "Trap immune + 10% dodge chance",        cost: 600,  requiredClears: 15 },
    { level: 4, name: "Levitate IV",  description: "Trap immune + 15% dodge chance",        cost: 1000, requiredClears: 30 },
    { level: 5, name: "Levitate V",   description: "Trap immune + 20% dodge chance",        cost: 2000, requiredClears: 50 },
  ],

  // ── Flame Body ──
  // Burn chance: 30% → 35% → 40% → 50% → 60%
  [AbilityId.FlameBody]: [
    { level: 1, name: "Flame Body",     description: "30% chance to burn attacker",  cost: 0,    requiredClears: 0 },
    { level: 2, name: "Flame Body II",  description: "35% chance to burn attacker",  cost: 300,  requiredClears: 5 },
    { level: 3, name: "Flame Body III", description: "40% chance to burn attacker",  cost: 600,  requiredClears: 15 },
    { level: 4, name: "Flame Body IV",  description: "50% chance to burn attacker",  cost: 1000, requiredClears: 30 },
    { level: 5, name: "Flame Body V",   description: "60% chance to burn attacker",  cost: 2000, requiredClears: 50 },
  ],
};

// ── Helper functions ──

/** Get the current ability upgrade level for a given ability from meta save */
export function getAbilityLevel(abilityLevels: Record<string, number> | undefined, abilityId: AbilityId): number {
  if (!abilityLevels) return 1;
  return abilityLevels[abilityId] ?? 1;
}

/** Get the upgrade data for a given ability at a given level (1-indexed) */
export function getAbilityUpgrade(abilityId: AbilityId, level: number): AbilityUpgrade | undefined {
  const tiers = ABILITY_UPGRADES[abilityId];
  if (!tiers) return undefined;
  const idx = Math.max(0, Math.min(level - 1, tiers.length - 1));
  return tiers[idx];
}

/** Get the next upgrade tier for a given ability (returns undefined if maxed) */
export function getNextAbilityUpgrade(abilityId: AbilityId, currentLevel: number): AbilityUpgrade | undefined {
  const tiers = ABILITY_UPGRADES[abilityId];
  if (!tiers) return undefined;
  if (currentLevel >= tiers.length) return undefined;
  return tiers[currentLevel]; // currentLevel is 1-indexed, so tiers[1] = level 2
}

// ── Scaled effect values per ability + level ──

/** Torrent: returns { threshold, multiplier } */
export function getTorrentValues(level: number): { threshold: number; multiplier: number } {
  switch (level) {
    case 1: return { threshold: 1 / 3,  multiplier: 1.5 };
    case 2: return { threshold: 0.38,   multiplier: 1.6 };
    case 3: return { threshold: 0.43,   multiplier: 1.7 };
    case 4: return { threshold: 0.48,   multiplier: 1.8 };
    case 5: return { threshold: 0.55,   multiplier: 2.0 };
    default: return { threshold: 1 / 3, multiplier: 1.5 };
  }
}

/** Sturdy: returns survive HP */
export function getSturdyHp(level: number): number {
  return Math.min(level, 5);
}

/** Guts: returns ATK multiplier when statused */
export function getGutsMultiplier(level: number): number {
  switch (level) {
    case 1: return 1.5;
    case 2: return 1.6;
    case 3: return 1.7;
    case 4: return 1.8;
    case 5: return 2.0;
    default: return 1.5;
  }
}

/** Pure Power: returns ATK multiplier */
export function getPurePowerMultiplier(level: number): number {
  switch (level) {
    case 1: return 1.3;
    case 2: return 1.35;
    case 3: return 1.4;
    case 4: return 1.45;
    case 5: return 1.5;
    default: return 1.3;
  }
}

/** Static: returns paralyze chance (0-1) */
export function getStaticChance(level: number): number {
  switch (level) {
    case 1: return 0.30;
    case 2: return 0.35;
    case 3: return 0.40;
    case 4: return 0.50;
    case 5: return 0.60;
    default: return 0.30;
  }
}

/** Flame Body: returns burn chance (0-1) */
export function getFlameBodyChance(level: number): number {
  switch (level) {
    case 1: return 0.30;
    case 2: return 0.35;
    case 3: return 0.40;
    case 4: return 0.50;
    case 5: return 0.60;
    default: return 0.30;
  }
}

/** Pickup: returns item find chance (0-1) */
export function getPickupChance(level: number): number {
  switch (level) {
    case 1: return 0.10;
    case 2: return 0.13;
    case 3: return 0.16;
    case 4: return 0.20;
    case 5: return 0.25;
    default: return 0.10;
  }
}

/** Rock Head: returns DEF bonus multiplier (1.0 = no bonus) */
export function getRockHeadDefBonus(level: number): number {
  switch (level) {
    case 1: return 1.0;
    case 2: return 1.05;
    case 3: return 1.10;
    case 4: return 1.15;
    case 5: return 1.20;
    default: return 1.0;
  }
}

/** No Guard: returns ATK bonus multiplier (1.0 = no bonus) */
export function getNoGuardAtkBonus(level: number): number {
  switch (level) {
    case 1: return 1.0;
    case 2: return 1.05;
    case 3: return 1.10;
    case 4: return 1.15;
    case 5: return 1.20;
    default: return 1.0;
  }
}

/** Run Away: returns dodge chance bonus (0 = no bonus) */
export function getRunAwayDodgeBonus(level: number): number {
  switch (level) {
    case 1: return 0;
    case 2: return 0.05;
    case 3: return 0.10;
    case 4: return 0.15;
    case 5: return 0.20;
    default: return 0;
  }
}

/** Shield Dust: returns DEF bonus multiplier (1.0 = no bonus) */
export function getShieldDustDefBonus(level: number): number {
  switch (level) {
    case 1: return 1.0;
    case 2: return 1.03;
    case 3: return 1.06;
    case 4: return 1.09;
    case 5: return 1.12;
    default: return 1.0;
  }
}

/** Levitate: returns dodge chance bonus (0 = no bonus) */
export function getLevitateDodgeBonus(level: number): number {
  switch (level) {
    case 1: return 0;
    case 2: return 0.05;
    case 3: return 0.10;
    case 4: return 0.15;
    case 5: return 0.20;
    default: return 0;
  }
}

/** Swift Swim: returns ATK bonus multiplier in rain (1.0 = no bonus) */
export function getSwiftSwimAtkBonus(level: number): number {
  switch (level) {
    case 1: return 1.0;
    case 2: return 1.05;
    case 3: return 1.10;
    case 4: return 1.15;
    case 5: return 1.20;
    default: return 1.0;
  }
}
