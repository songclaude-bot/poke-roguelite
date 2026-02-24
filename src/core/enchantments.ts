/**
 * Enchantment system — bonus effects applied to held items.
 * Each held item can have one enchantment that persists across runs.
 */

import { MetaSaveData } from "./save-system";

export interface Enchantment {
  id: string;
  name: string;
  description: string;
  tier: number;        // 1-3
  goldCost: number;
  requiredClears: number;
}

export const ENCHANTMENTS: Enchantment[] = [
  // ── Tier 1 (100-200G, 0-5 clears) ──
  { id: "sharpness",  name: "Sharpness",  description: "+3 ATK",                tier: 1, goldCost: 100, requiredClears: 0 },
  { id: "resilience", name: "Resilience", description: "+3 DEF",                tier: 1, goldCost: 120, requiredClears: 0 },
  { id: "vitality",   name: "Vitality",   description: "+10 HP",                tier: 1, goldCost: 150, requiredClears: 3 },
  { id: "lucky",      name: "Lucky",      description: "+5% item find chance",  tier: 1, goldCost: 200, requiredClears: 5 },

  // ── Tier 2 (300-500G, 10-20 clears) ──
  { id: "vampiric",   name: "Vampiric",   description: "Heal 1 HP per enemy defeated",     tier: 2, goldCost: 300, requiredClears: 10 },
  { id: "thorns",     name: "Thorns",     description: "Reflect 10% damage back",          tier: 2, goldCost: 350, requiredClears: 12 },
  { id: "haste",      name: "Haste",      description: "15% chance to act twice",           tier: 2, goldCost: 400, requiredClears: 15 },
  { id: "abundance",  name: "Abundance",  description: "+15% gold earned",                  tier: 2, goldCost: 500, requiredClears: 20 },

  // ── Tier 3 (800-1200G, 30-50 clears) ──
  { id: "phoenix",    name: "Phoenix",    description: "Auto-revive once per run (25% HP)", tier: 3, goldCost: 800,  requiredClears: 30 },
  { id: "overlord",   name: "Overlord",   description: "+5% to all stats",                  tier: 3, goldCost: 1200, requiredClears: 50 },
];

/** Get all enchantments */
export function getEnchantments(): Enchantment[] {
  return ENCHANTMENTS;
}

/** Get enchantments available based on total dungeon clears */
export function getAvailableEnchantments(totalClears: number): Enchantment[] {
  return ENCHANTMENTS.filter(e => totalClears >= e.requiredClears);
}

/** Get the currently equipped enchantment from meta save data */
export function getEquippedEnchantment(meta: MetaSaveData): Enchantment | null {
  if (!meta.enchantmentId) return null;
  return ENCHANTMENTS.find(e => e.id === meta.enchantmentId) ?? null;
}

/** Get an enchantment by ID */
export function getEnchantment(id: string): Enchantment | undefined {
  return ENCHANTMENTS.find(e => e.id === id);
}

/** Tier color for UI display */
export function enchantmentTierColor(tier: number): string {
  switch (tier) {
    case 1: return "#4ade80";  // green
    case 2: return "#60a5fa";  // blue
    case 3: return "#f59e0b";  // gold
    default: return "#e0e0e0";
  }
}

/** Tier label for UI display */
export function enchantmentTierLabel(tier: number): string {
  switch (tier) {
    case 1: return "★";
    case 2: return "★★";
    case 3: return "★★★";
    default: return "";
  }
}
