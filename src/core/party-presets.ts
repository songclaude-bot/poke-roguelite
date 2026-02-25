/**
 * Party Preset System — save and load preferred party configurations.
 * Presets store starter choice + ally tactic preferences.
 */

import type { MetaSaveData } from "./save-system";

export interface PartyPreset {
  id: string;
  name: string;          // user-assigned name
  starterId: string;     // species ID of starter
  allyTactics: Record<string, string>;  // speciesId -> AllyTactic preference
  equippedHeldItem?: string;
  createdAt: number;     // timestamp
}

export const MAX_PRESETS = 5;

const PRESETS_KEY = "poke-roguelite-partyPresets";

export function createPreset(
  name: string,
  starterId: string,
  tactics: Record<string, string>,
  heldItem?: string,
): PartyPreset {
  return {
    id: `preset_${Date.now()}`,
    name,
    starterId,
    allyTactics: tactics,
    equippedHeldItem: heldItem,
    createdAt: Date.now(),
  };
}

export function savePresets(presets: PartyPreset[]): void {
  try {
    localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
  } catch { /* ignore quota errors */ }
}

export function loadPresets(): PartyPreset[] {
  try {
    const raw = localStorage.getItem(PRESETS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function deletePreset(presets: PartyPreset[], presetId: string): PartyPreset[] {
  const filtered = presets.filter(p => p.id !== presetId);
  savePresets(filtered);
  return filtered;
}

export function applyPreset(preset: PartyPreset, meta: MetaSaveData): void {
  meta.starter = preset.starterId;
  if (preset.equippedHeldItem) {
    meta.equippedHeldItem = preset.equippedHeldItem;
  }
}
