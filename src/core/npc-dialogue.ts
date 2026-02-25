/**
 * NPC Dialogue System — Town NPCs that give tips, flavor text,
 * and react to player progression.
 */

import type { MetaSaveData } from "./save-system";

// ── Types ──

export interface NPC {
  id: string;
  name: string;
  species: string;
  role: string;
  /** Hex color string for the NPC avatar circle */
  color: string;
}

export interface DialogueLine {
  text: string;
  /** If provided, the line only appears when this returns true */
  condition?: (meta: MetaSaveData) => boolean;
}

// ── NPC Definitions ──

const CHANSEY_DIALOGUE: DialogueLine[] = [
  { text: "Rest well before your next adventure!" },
  { text: "Make sure to stock up on Oran Berries!" },
  {
    text: "You're quite the veteran! Your team looks stronger.",
    condition: (m) => m.totalClears >= 10,
  },
  {
    text: "Even legends need rest sometimes.",
    condition: (m) => (m.ngPlusLevel ?? 0) > 0,
  },
  {
    text: "I've treated many adventurers, but you're truly special.",
    condition: (m) => m.totalClears >= 50,
  },
];

const KANGASKHAN_DIALOGUE: DialogueLine[] = [
  { text: "I'll keep your items safe and sound!" },
  { text: "Come back anytime to check your storage." },
  {
    text: "Your storage is getting quite full!",
    condition: (m) => {
      const count = m.storage.reduce((s, i) => s + i.count, 0);
      return count > 20;
    },
  },
  {
    text: "Those upgraded items look powerful!",
    condition: (m) => {
      const count = m.storage.reduce((s, i) => s + i.count, 0);
      return count > 5;
    },
  },
  {
    text: "Managing items wisely is the key to deep dives!",
    condition: (m) => m.totalClears >= 5,
  },
];

const KECLEON_DIALOGUE: DialogueLine[] = [
  { text: "Look for my shop in the dungeons! Great deals await." },
  { text: "I have branches in many dungeons. Keep an eye out!" },
  {
    text: "Business has been good lately, thanks to you!",
    condition: (m) => m.totalRuns >= 20,
  },
  {
    text: "I stock better items in deeper dungeons.",
    condition: (m) => m.totalClears >= 5,
  },
  {
    text: "A savvy explorer always checks my shop first!",
    condition: (m) => m.totalClears >= 15,
  },
];

const ABSOL_DIALOGUE: DialogueLine[] = [
  { text: "I sense danger in the deeper dungeons..." },
  { text: "Trust your instincts. They will guide you." },
  {
    text: "The deeper tiers hold fearsome foes. Be prepared.",
    condition: (m) => m.totalClears >= 10,
  },
  {
    text: "Boss Rush is not for the faint-hearted...",
    condition: (m) => m.totalClears >= 30,
  },
  {
    text: "So you've conquered the abyss... impressive.",
    condition: (m) => m.endlessBestFloor >= 20,
  },
  {
    text: "Even I cannot foresee what lies beyond NG+.",
    condition: (m) => (m.ngPlusLevel ?? 0) > 0,
  },
];

const PELIPPER_DIALOGUE: DialogueLine[] = [
  { text: "Check the Quest Board for today's missions!" },
  { text: "Completing quests earns you extra rewards." },
  {
    text: "You have unclaimed quest rewards!",
    condition: (m) => {
      const all = [...(m.activeQuests ?? []), ...(m.challengeQuests ?? [])];
      return all.some((q) => q.completed && !q.claimed);
    },
  },
  {
    text: "New challenge quests unlock as you progress!",
    condition: (m) => m.totalClears >= 10,
  },
  {
    text: "Daily quests reset every day. Don't miss them!",
    condition: (m) => m.totalClears >= 5,
  },
];

const LUCARIO_DIALOGUE: DialogueLine[] = [
  { text: "Type advantages are key to victory!" },
  { text: "A well-timed skill can turn the tide of battle." },
  {
    text: "Try using skills in specific combinations...",
    condition: (m) => m.totalClears >= 3,
  },
  {
    text: "Your combat instincts are razor sharp.",
    condition: (m) => m.totalClears >= 50,
  },
  {
    text: "The Ability Dojo can sharpen your innate powers.",
    condition: (m) => m.totalClears >= 5,
  },
  {
    text: "A true warrior explores many fighting styles.",
    condition: (m) => m.startersUsed.length >= 5,
  },
];

// ── NPC List ──

export const NPC_LIST: NPC[] = [
  {
    id: "chansey",
    name: "Chansey",
    species: "chansey",
    role: "Nurse",
    color: "#f9a8d4",
  },
  {
    id: "kangaskhan",
    name: "Kangaskhan",
    species: "kangaskhan",
    role: "Storage",
    color: "#c4a882",
  },
  {
    id: "kecleon",
    name: "Kecleon",
    species: "kecleon",
    role: "Shop",
    color: "#86efac",
  },
  {
    id: "absol",
    name: "Absol",
    species: "absol",
    role: "Seer",
    color: "#a5b4fc",
  },
  {
    id: "pelipper",
    name: "Pelipper",
    species: "pelipper",
    role: "Postmaster",
    color: "#93c5fd",
  },
  {
    id: "lucario",
    name: "Lucario",
    species: "lucario",
    role: "Trainer",
    color: "#818cf8",
  },
];

/** Map NPC id to its dialogue pool */
const NPC_DIALOGUES: Record<string, DialogueLine[]> = {
  chansey: CHANSEY_DIALOGUE,
  kangaskhan: KANGASKHAN_DIALOGUE,
  kecleon: KECLEON_DIALOGUE,
  absol: ABSOL_DIALOGUE,
  pelipper: PELIPPER_DIALOGUE,
  lucario: LUCARIO_DIALOGUE,
};

/**
 * Returns 1-3 dialogue lines for the given NPC, filtered by
 * progression conditions. Always includes at least one generic line,
 * plus any progression-aware lines that match.
 */
export function getNpcDialogue(npc: NPC, meta: MetaSaveData): string[] {
  const pool = NPC_DIALOGUES[npc.id] ?? [];
  if (pool.length === 0) return ["..."];

  // Split into generic (no condition) and conditional
  const generic: string[] = [];
  const conditional: string[] = [];

  for (const line of pool) {
    if (!line.condition) {
      generic.push(line.text);
    } else if (line.condition(meta)) {
      conditional.push(line.text);
    }
  }

  // Always pick one random generic line
  const result: string[] = [];
  if (generic.length > 0) {
    result.push(generic[Math.floor(Math.random() * generic.length)]);
  }

  // Add up to 2 conditional lines (shuffled, pick first 2)
  if (conditional.length > 0) {
    const shuffled = [...conditional].sort(() => Math.random() - 0.5);
    const pick = Math.min(2, shuffled.length);
    for (let i = 0; i < pick; i++) {
      result.push(shuffled[i]);
    }
  }

  // Cap at 3 lines total
  return result.slice(0, 3);
}
