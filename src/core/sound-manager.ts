/**
 * Sound manager — synthesized 8-bit style sound effects + dungeon-specific BGM
 * Uses Web Audio API oscillators (no external audio files needed)
 */

let ctx: AudioContext | null = null;
let bgmPlaying = false;
let masterVolume = 0.3;
let sfxVolume = 0.4;
let bgmTimer: ReturnType<typeof setInterval> | null = null;
let bgmNoteIdx = 0;
let currentBgmId = "";

function getCtx(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();
  }
  if (ctx.state === "suspended") {
    ctx.resume();
  }
  return ctx;
}

/** Play a short tone */
function playTone(freq: number, duration: number, type: OscillatorType = "square", vol = sfxVolume) {
  try {
    const c = getCtx();
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, c.currentTime);
    gain.gain.setValueAtTime(vol, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(c.currentTime);
    osc.stop(c.currentTime + duration);
  } catch { /* ignore audio errors */ }
}

/** Play a sequence of tones */
function playSequence(notes: { freq: number; dur: number; delay: number }[], type: OscillatorType = "square", vol = sfxVolume) {
  for (const n of notes) {
    setTimeout(() => playTone(n.freq, n.dur, type, vol), n.delay * 1000);
  }
}

// ── Sound Effects ──

export function sfxHit() {
  playTone(200, 0.08, "square", sfxVolume * 0.6);
  setTimeout(() => playTone(150, 0.06, "sawtooth", sfxVolume * 0.4), 30);
}

export function sfxSuperEffective() {
  playSequence([
    { freq: 400, dur: 0.08, delay: 0 },
    { freq: 600, dur: 0.08, delay: 0.06 },
    { freq: 800, dur: 0.12, delay: 0.12 },
  ], "square", sfxVolume * 0.5);
}

export function sfxNotEffective() {
  playTone(120, 0.15, "triangle", sfxVolume * 0.3);
}

export function sfxMove() {
  playTone(300, 0.04, "triangle", sfxVolume * 0.15);
}

export function sfxPickup() {
  playSequence([
    { freq: 500, dur: 0.06, delay: 0 },
    { freq: 700, dur: 0.08, delay: 0.05 },
  ], "square", sfxVolume * 0.3);
}

export function sfxLevelUp() {
  playSequence([
    { freq: 523, dur: 0.1, delay: 0 },
    { freq: 659, dur: 0.1, delay: 0.1 },
    { freq: 784, dur: 0.1, delay: 0.2 },
    { freq: 1047, dur: 0.2, delay: 0.3 },
  ], "square", sfxVolume * 0.4);
}

export function sfxRecruit() {
  playSequence([
    { freq: 440, dur: 0.12, delay: 0 },
    { freq: 554, dur: 0.12, delay: 0.12 },
    { freq: 659, dur: 0.12, delay: 0.24 },
    { freq: 880, dur: 0.25, delay: 0.36 },
  ], "triangle", sfxVolume * 0.4);
}

export function sfxStairs() {
  playSequence([
    { freq: 300, dur: 0.15, delay: 0 },
    { freq: 400, dur: 0.15, delay: 0.12 },
    { freq: 500, dur: 0.15, delay: 0.24 },
    { freq: 600, dur: 0.2, delay: 0.36 },
  ], "triangle", sfxVolume * 0.35);
}

export function sfxDeath() {
  playSequence([
    { freq: 400, dur: 0.15, delay: 0 },
    { freq: 300, dur: 0.15, delay: 0.12 },
    { freq: 200, dur: 0.2, delay: 0.24 },
    { freq: 100, dur: 0.3, delay: 0.36 },
  ], "sawtooth", sfxVolume * 0.4);
}

export function sfxBossDefeat() {
  playSequence([
    { freq: 523, dur: 0.12, delay: 0 },
    { freq: 659, dur: 0.12, delay: 0.1 },
    { freq: 784, dur: 0.12, delay: 0.2 },
    { freq: 1047, dur: 0.15, delay: 0.3 },
    { freq: 1319, dur: 0.2, delay: 0.45 },
    { freq: 1568, dur: 0.3, delay: 0.6 },
  ], "square", sfxVolume * 0.5);
}

export function sfxHeal() {
  playSequence([
    { freq: 600, dur: 0.08, delay: 0 },
    { freq: 800, dur: 0.1, delay: 0.06 },
  ], "triangle", sfxVolume * 0.3);
}

export function sfxSkill() {
  playSequence([
    { freq: 500, dur: 0.06, delay: 0 },
    { freq: 700, dur: 0.06, delay: 0.04 },
    { freq: 400, dur: 0.08, delay: 0.08 },
  ], "sawtooth", sfxVolume * 0.35);
}

export function sfxMenuOpen() {
  playTone(600, 0.06, "square", sfxVolume * 0.2);
}

export function sfxMenuClose() {
  playTone(400, 0.06, "square", sfxVolume * 0.2);
}

export function sfxEvolution() {
  playSequence([
    { freq: 523, dur: 0.15, delay: 0 },
    { freq: 659, dur: 0.15, delay: 0.15 },
    { freq: 784, dur: 0.15, delay: 0.30 },
    { freq: 1047, dur: 0.15, delay: 0.45 },
    { freq: 1319, dur: 0.15, delay: 0.60 },
    { freq: 1568, dur: 0.25, delay: 0.75 },
    { freq: 2093, dur: 0.4, delay: 0.95 },
  ], "triangle", sfxVolume * 0.5);
}

export function sfxTrap() {
  playSequence([
    { freq: 800, dur: 0.05, delay: 0 },
    { freq: 200, dur: 0.15, delay: 0.05 },
  ], "sawtooth", sfxVolume * 0.5);
}

export function sfxVictory() {
  playSequence([
    { freq: 523, dur: 0.15, delay: 0 },
    { freq: 659, dur: 0.15, delay: 0.15 },
    { freq: 784, dur: 0.2, delay: 0.30 },
    { freq: 1047, dur: 0.3, delay: 0.50 },
    { freq: 784, dur: 0.1, delay: 0.85 },
    { freq: 1047, dur: 0.15, delay: 0.95 },
    { freq: 1319, dur: 0.4, delay: 1.10 },
  ], "square", sfxVolume * 0.45);
}

export function sfxGameOver() {
  playSequence([
    { freq: 440, dur: 0.2, delay: 0 },
    { freq: 349, dur: 0.2, delay: 0.25 },
    { freq: 294, dur: 0.2, delay: 0.50 },
    { freq: 220, dur: 0.4, delay: 0.75 },
    { freq: 165, dur: 0.5, delay: 1.20 },
  ], "triangle", sfxVolume * 0.4);
}

export function sfxShop() {
  playSequence([
    { freq: 700, dur: 0.06, delay: 0 },
    { freq: 900, dur: 0.06, delay: 0.06 },
    { freq: 700, dur: 0.08, delay: 0.12 },
  ], "square", sfxVolume * 0.3);
}

// ── Dungeon-specific BGM melodies ──

interface BgmPattern {
  melody: number[];
  bass: number[];
  tempo: number; // note duration in seconds
  melodyType: OscillatorType;
  bassType: OscillatorType;
}

const BGM_PATTERNS: Record<string, BgmPattern> = {
  // Beach Cave — calm, watery C major
  beachCave: {
    melody: [262, 294, 330, 262, 294, 349, 330, 294, 262, 294, 330, 392, 349, 330, 294, 262],
    bass: [131, 131, 165, 165, 147, 147, 131, 131, 131, 131, 165, 165, 175, 165, 147, 131],
    tempo: 0.28, melodyType: "triangle", bassType: "sine",
  },
  // Thunderwave Cave — energetic, electric
  thunderwaveCave: {
    melody: [330, 392, 440, 392, 494, 440, 392, 330, 440, 494, 523, 494, 440, 392, 349, 330],
    bass: [165, 165, 196, 196, 220, 220, 196, 165, 220, 220, 262, 262, 220, 196, 175, 165],
    tempo: 0.22, melodyType: "square", bassType: "sine",
  },
  // Tiny Woods — gentle, pastoral
  tinyWoods: {
    melody: [392, 440, 494, 523, 494, 440, 392, 349, 330, 349, 392, 440, 392, 349, 330, 294],
    bass: [196, 196, 220, 220, 247, 247, 196, 196, 165, 165, 196, 196, 175, 175, 165, 147],
    tempo: 0.30, melodyType: "triangle", bassType: "sine",
  },
  // Mt. Steel — intense, heavy
  mtSteel: {
    melody: [262, 311, 330, 262, 330, 349, 311, 262, 349, 330, 311, 262, 247, 262, 311, 262],
    bass: [131, 131, 156, 156, 165, 165, 131, 131, 175, 175, 156, 156, 131, 131, 123, 131],
    tempo: 0.25, melodyType: "sawtooth", bassType: "sine",
  },
  // Sky Tower — ethereal, mysterious
  skyTower: {
    melody: [523, 494, 440, 392, 440, 494, 523, 587, 523, 494, 440, 392, 349, 392, 440, 392],
    bass: [262, 262, 220, 220, 196, 196, 262, 262, 247, 247, 220, 220, 175, 175, 196, 196],
    tempo: 0.32, melodyType: "triangle", bassType: "triangle",
  },
  // Frosty Forest — cold, sparse
  frostyForest: {
    melody: [494, 440, 392, 330, 349, 392, 440, 494, 523, 494, 440, 349, 330, 294, 330, 349],
    bass: [247, 247, 196, 196, 175, 175, 220, 220, 262, 262, 220, 220, 165, 165, 175, 175],
    tempo: 0.35, melodyType: "sine", bassType: "sine",
  },
  // Magma Cavern — aggressive, fiery
  magmaCavern: {
    melody: [330, 349, 392, 440, 392, 349, 330, 294, 330, 392, 440, 494, 440, 392, 349, 330],
    bass: [165, 165, 196, 196, 220, 220, 175, 175, 165, 165, 220, 220, 247, 247, 196, 165],
    tempo: 0.20, melodyType: "sawtooth", bassType: "square",
  },
  // Sinister Woods — dark, ominous
  sinisterWoods: {
    melody: [262, 247, 220, 196, 220, 247, 262, 294, 262, 247, 220, 175, 196, 220, 247, 220],
    bass: [131, 131, 110, 110, 98, 98, 131, 131, 147, 147, 110, 110, 98, 98, 110, 110],
    tempo: 0.30, melodyType: "sawtooth", bassType: "triangle",
  },
  // Overgrown Forest — lush, verdant
  overgrownForest: {
    melody: [330, 392, 440, 523, 494, 440, 392, 349, 330, 294, 330, 392, 440, 494, 440, 392],
    bass: [165, 165, 220, 220, 247, 247, 196, 196, 165, 165, 175, 175, 220, 220, 196, 196],
    tempo: 0.28, melodyType: "triangle", bassType: "sine",
  },
  // Toxic Swamp — murky, unsettling
  toxicSwamp: {
    melody: [220, 247, 262, 220, 196, 220, 247, 294, 262, 220, 196, 175, 196, 220, 247, 220],
    bass: [110, 110, 131, 131, 98, 98, 123, 123, 131, 131, 110, 110, 98, 98, 110, 110],
    tempo: 0.28, melodyType: "sawtooth", bassType: "triangle",
  },
  // Moonlit Cave — magical, twinkling
  moonlitCave: {
    melody: [523, 587, 659, 784, 659, 587, 523, 494, 523, 587, 659, 784, 880, 784, 659, 523],
    bass: [262, 262, 294, 294, 330, 330, 262, 262, 247, 247, 294, 294, 330, 330, 262, 262],
    tempo: 0.32, melodyType: "sine", bassType: "triangle",
  },
  // Dragon's Lair — epic, intense
  dragonsLair: {
    melody: [196, 220, 262, 330, 262, 220, 196, 175, 196, 262, 330, 392, 330, 262, 196, 175],
    bass: [98, 98, 131, 131, 165, 165, 98, 98, 110, 110, 165, 165, 196, 196, 131, 98],
    tempo: 0.22, melodyType: "sawtooth", bassType: "square",
  },
  // Steel Fortress — mechanical, rhythmic
  steelFortress: {
    melody: [330, 392, 330, 262, 330, 392, 523, 392, 330, 262, 196, 262, 330, 392, 330, 262],
    bass: [165, 165, 131, 131, 165, 165, 196, 196, 165, 165, 131, 131, 98, 98, 131, 131],
    tempo: 0.24, melodyType: "square", bassType: "triangle",
  },
  // Buried Ruins — sandy, mysterious
  buriedRuins: {
    melody: [262, 294, 330, 262, 294, 262, 220, 196, 262, 294, 330, 392, 330, 294, 262, 220],
    bass: [131, 131, 147, 147, 131, 131, 110, 110, 131, 131, 165, 165, 131, 131, 110, 110],
    tempo: 0.30, melodyType: "triangle", bassType: "sine",
  },
  // Stormy Sea — oceanic, turbulent
  stormySea: {
    melody: [196, 262, 330, 392, 330, 262, 196, 165, 196, 262, 330, 262, 220, 196, 165, 196],
    bass: [98, 98, 131, 131, 165, 165, 131, 131, 98, 98, 131, 131, 110, 110, 82, 82],
    tempo: 0.26, melodyType: "sine", bassType: "triangle",
  },
  // Amp Plains — energetic, sparky
  ampPlains: {
    melody: [392, 494, 523, 392, 494, 587, 523, 494, 392, 330, 392, 494, 523, 587, 659, 523],
    bass: [196, 196, 262, 262, 196, 196, 262, 262, 196, 196, 165, 165, 262, 262, 330, 262],
    tempo: 0.22, melodyType: "sawtooth", bassType: "square",
  },
  // Verdant Forest — light, buzzy
  verdantForest: {
    melody: [330, 392, 440, 494, 440, 392, 330, 294, 330, 392, 440, 392, 330, 294, 262, 294],
    bass: [165, 165, 196, 196, 220, 220, 196, 196, 165, 165, 147, 147, 165, 165, 131, 131],
    tempo: 0.30, melodyType: "triangle", bassType: "sine",
  },
  // Mystic Sanctum — ethereal, psychic
  mysticSanctum: {
    melody: [523, 494, 440, 523, 587, 523, 494, 440, 392, 440, 494, 523, 587, 659, 587, 523],
    bass: [262, 262, 220, 220, 294, 294, 247, 247, 196, 196, 220, 220, 294, 294, 262, 262],
    tempo: 0.32, melodyType: "sine", bassType: "triangle",
  },
  // Shadow Forest — dark, menacing
  shadowForest: {
    melody: [196, 185, 175, 196, 220, 196, 175, 165, 196, 220, 262, 220, 196, 175, 165, 175],
    bass: [98, 98, 88, 88, 110, 110, 98, 98, 82, 82, 98, 98, 110, 110, 88, 88],
    tempo: 0.28, melodyType: "sawtooth", bassType: "triangle",
  },
  // Windy Summit — breezy, uplifting
  windySummit: {
    melody: [392, 440, 523, 587, 523, 440, 392, 349, 392, 523, 587, 659, 587, 523, 440, 392],
    bass: [196, 196, 262, 262, 294, 294, 196, 196, 175, 175, 262, 262, 330, 330, 220, 196],
    tempo: 0.26, melodyType: "triangle", bassType: "sine",
  },
  // Battle Arena — intense, rhythmic
  battleArena: {
    melody: [262, 330, 392, 330, 262, 330, 392, 440, 392, 330, 262, 220, 262, 330, 392, 330],
    bass: [131, 131, 196, 196, 131, 131, 196, 196, 220, 220, 131, 131, 110, 110, 196, 196],
    tempo: 0.22, melodyType: "sawtooth", bassType: "square",
  },
  // Rocky Cavern — deep, heavy
  rockyCavern: {
    melody: [196, 220, 196, 165, 196, 220, 262, 220, 196, 165, 147, 165, 196, 220, 196, 165],
    bass: [98, 98, 82, 82, 98, 98, 131, 131, 98, 98, 73, 73, 82, 82, 98, 98],
    tempo: 0.26, melodyType: "sawtooth", bassType: "sine",
  },
  // Frozen Tundra — icy, sparse
  frozenTundra: {
    melody: [523, 494, 440, 392, 349, 392, 440, 494, 523, 587, 523, 494, 440, 392, 349, 330],
    bass: [262, 262, 220, 220, 175, 175, 196, 196, 262, 262, 294, 294, 220, 220, 175, 175],
    tempo: 0.34, melodyType: "sine", bassType: "triangle",
  },
  // Destiny Tower — grand, final
  destinyTower: {
    melody: [262, 330, 392, 523, 392, 330, 262, 196, 262, 392, 523, 659, 523, 392, 330, 262],
    bass: [131, 131, 196, 196, 262, 262, 131, 131, 98, 98, 196, 196, 262, 262, 165, 131],
    tempo: 0.25, melodyType: "square", bassType: "sawtooth",
  },
  // Petal Garden — floral, gentle waltz
  petalGarden: {
    melody: [392, 494, 587, 523, 494, 440, 392, 349, 392, 440, 494, 587, 659, 587, 523, 494],
    bass: [196, 196, 294, 294, 247, 247, 220, 220, 196, 196, 247, 247, 330, 330, 262, 262],
    tempo: 0.32, melodyType: "sine", bassType: "triangle",
  },
  // Ember Grotto — fiery, intense
  emberGrotto: {
    melody: [330, 392, 440, 523, 440, 392, 330, 294, 330, 440, 523, 587, 523, 440, 392, 330],
    bass: [165, 165, 220, 220, 262, 262, 196, 196, 165, 165, 220, 220, 294, 294, 220, 220],
    tempo: 0.24, melodyType: "sawtooth", bassType: "square",
  },
  // Coral Reef — flowing, oceanic
  coralReef: {
    melody: [349, 440, 523, 587, 523, 440, 349, 330, 349, 392, 440, 523, 587, 523, 440, 392],
    bass: [175, 175, 220, 220, 262, 262, 220, 220, 175, 175, 196, 196, 294, 294, 220, 220],
    tempo: 0.30, melodyType: "sine", bassType: "triangle",
  },
  // Meadow Path — cheerful, light
  meadowPath: {
    melody: [392, 440, 494, 523, 494, 440, 392, 349, 330, 349, 392, 440, 494, 523, 587, 523],
    bass: [196, 196, 247, 247, 262, 262, 196, 196, 165, 165, 196, 196, 247, 247, 294, 294],
    tempo: 0.28, melodyType: "triangle", bassType: "sine",
  },
  // Voltage Lab — electronic, pulsing
  voltageLab: {
    melody: [523, 587, 659, 784, 659, 587, 523, 494, 440, 494, 523, 587, 659, 784, 880, 784],
    bass: [262, 262, 330, 330, 392, 392, 262, 262, 220, 220, 262, 262, 330, 330, 440, 440],
    tempo: 0.22, melodyType: "square", bassType: "sawtooth",
  },
  // Venom Depths — ominous, dripping
  venomDepths: {
    melody: [262, 294, 262, 247, 220, 247, 262, 294, 330, 294, 262, 247, 220, 196, 220, 247],
    bass: [131, 131, 147, 147, 110, 110, 131, 131, 165, 165, 131, 131, 110, 110, 98, 98],
    tempo: 0.34, melodyType: "sawtooth", bassType: "triangle",
  },
  // Quake Tunnel — rumbling, deep
  quakeTunnel: {
    melody: [196, 220, 262, 294, 262, 220, 196, 175, 196, 262, 294, 330, 294, 262, 220, 196],
    bass: [98, 98, 131, 131, 147, 147, 98, 98, 98, 98, 147, 147, 165, 165, 131, 131],
    tempo: 0.30, melodyType: "sawtooth", bassType: "square",
  },
  // Moss Burrow — earthy, buzzing
  mossBurrow: {
    melody: [330, 349, 392, 440, 392, 349, 330, 294, 330, 392, 440, 494, 440, 392, 349, 330],
    bass: [165, 165, 196, 196, 220, 220, 165, 165, 147, 147, 196, 196, 247, 247, 196, 196],
    tempo: 0.28, melodyType: "triangle", bassType: "sine",
  },
  // Iron Works — mechanical, rhythmic
  ironWorks: {
    melody: [262, 330, 392, 330, 262, 330, 392, 440, 392, 330, 262, 330, 392, 440, 523, 440],
    bass: [131, 131, 196, 196, 131, 131, 196, 196, 220, 220, 165, 165, 196, 196, 262, 262],
    tempo: 0.22, melodyType: "square", bassType: "sawtooth",
  },
  // Phantom Crypt — eerie, haunting
  phantomCrypt: {
    melody: [220, 262, 247, 220, 196, 220, 262, 294, 262, 220, 196, 175, 196, 220, 262, 247],
    bass: [110, 110, 131, 131, 98, 98, 110, 110, 131, 131, 98, 98, 88, 88, 110, 110],
    tempo: 0.36, melodyType: "sine", bassType: "triangle",
  },
  wyrmAbyss: {
    melody: [196, 220, 262, 294, 330, 294, 262, 220, 196, 175, 165, 175, 196, 262, 294, 330],
    bass: [98, 98, 131, 131, 165, 165, 131, 131, 98, 98, 88, 88, 98, 98, 131, 131],
    tempo: 0.32, melodyType: "sawtooth", bassType: "triangle",
  },
  enchantedGlade: {
    melody: [523, 587, 659, 587, 523, 494, 440, 494, 523, 587, 659, 698, 659, 587, 523, 494],
    bass: [262, 262, 330, 330, 262, 262, 220, 220, 262, 262, 330, 330, 349, 349, 262, 262],
    tempo: 0.34, melodyType: "sine", bassType: "triangle",
  },
  glacialCavern: {
    melody: [330, 294, 262, 247, 220, 247, 262, 294, 330, 349, 330, 294, 262, 247, 220, 196],
    bass: [165, 165, 131, 131, 110, 110, 131, 131, 165, 165, 175, 175, 131, 131, 110, 110],
    tempo: 0.38, melodyType: "sine", bassType: "triangle",
  },
  astralSpire: {
    melody: [440, 494, 523, 587, 659, 587, 523, 494, 440, 392, 349, 392, 440, 523, 587, 659],
    bass: [220, 220, 262, 262, 330, 330, 262, 262, 220, 220, 175, 175, 220, 220, 262, 262],
    tempo: 0.33, melodyType: "sine", bassType: "sine",
  },
  shadowAlley: {
    melody: [175, 196, 220, 196, 175, 165, 147, 165, 175, 196, 220, 247, 220, 196, 175, 165],
    bass: [88, 88, 98, 98, 110, 110, 98, 98, 88, 88, 82, 82, 88, 88, 98, 98],
    tempo: 0.35, melodyType: "sawtooth", bassType: "triangle",
  },
  galeCliffs: {
    melody: [494, 523, 587, 659, 698, 659, 587, 523, 494, 440, 392, 440, 494, 587, 659, 698],
    bass: [247, 247, 294, 294, 349, 349, 294, 294, 247, 247, 196, 196, 247, 247, 294, 294],
    tempo: 0.30, melodyType: "square", bassType: "triangle",
  },
  brawlDojo: {
    melody: [262, 294, 330, 349, 392, 349, 330, 294, 262, 294, 330, 392, 440, 392, 330, 294],
    bass: [131, 131, 165, 165, 196, 196, 165, 165, 131, 131, 165, 165, 220, 220, 165, 165],
    tempo: 0.28, melodyType: "square", bassType: "square",
  },
  boulderPass: {
    melody: [196, 220, 247, 262, 247, 220, 196, 175, 165, 175, 196, 220, 262, 294, 262, 220],
    bass: [98, 98, 123, 123, 131, 131, 123, 123, 98, 98, 88, 88, 98, 98, 131, 131],
    tempo: 0.34, melodyType: "sawtooth", bassType: "triangle",
  },
  tranquilGrove: {
    melody: [392, 440, 494, 523, 494, 440, 392, 349, 330, 349, 392, 440, 494, 523, 587, 523],
    bass: [196, 196, 247, 247, 262, 262, 247, 247, 196, 196, 175, 175, 196, 196, 247, 247],
    tempo: 0.36, melodyType: "triangle", bassType: "sine",
  },
  titaniumMine: {
    melody: [262, 330, 392, 330, 262, 294, 330, 392, 440, 392, 330, 294, 262, 294, 330, 262],
    bass: [131, 131, 196, 196, 131, 131, 165, 165, 220, 220, 196, 196, 131, 131, 147, 147],
    tempo: 0.24, melodyType: "square", bassType: "sawtooth",
  },
  spectralWoods: {
    melody: [220, 262, 247, 220, 196, 175, 196, 220, 262, 294, 262, 220, 196, 175, 165, 196],
    bass: [110, 110, 131, 131, 98, 98, 88, 88, 131, 131, 147, 147, 110, 110, 88, 88],
    tempo: 0.36, melodyType: "sine", bassType: "triangle",
  },
  cosmicRift: {
    melody: [440, 523, 587, 659, 587, 523, 440, 392, 440, 523, 587, 659, 784, 659, 587, 523],
    bass: [220, 220, 262, 262, 294, 294, 220, 220, 196, 196, 262, 262, 330, 330, 262, 262],
    tempo: 0.34, melodyType: "sine", bassType: "sine",
  },
  frostbiteChasm: {
    melody: [523, 494, 440, 392, 440, 494, 523, 587, 523, 494, 440, 392, 349, 392, 440, 494],
    bass: [262, 262, 220, 220, 196, 196, 262, 262, 247, 247, 220, 220, 175, 175, 220, 220],
    tempo: 0.36, melodyType: "sine", bassType: "triangle",
  },
  midnightAlley: {
    melody: [196, 233, 262, 233, 196, 175, 165, 175, 196, 233, 262, 294, 262, 233, 196, 175],
    bass: [98, 98, 117, 117, 98, 98, 88, 88, 98, 98, 131, 131, 117, 117, 98, 98],
    tempo: 0.30, melodyType: "sawtooth", bassType: "square",
  },
  pixieHollow: {
    melody: [523, 587, 659, 784, 659, 587, 523, 494, 523, 587, 659, 784, 880, 784, 659, 587],
    bass: [262, 262, 330, 330, 294, 294, 262, 262, 247, 247, 330, 330, 392, 392, 330, 330],
    tempo: 0.38, melodyType: "triangle", bassType: "sine",
  },
  drakeNest: {
    melody: [196, 262, 330, 392, 330, 262, 196, 175, 196, 262, 330, 392, 440, 392, 330, 262],
    bass: [98, 98, 165, 165, 196, 196, 98, 98, 88, 88, 131, 131, 220, 220, 165, 165],
    tempo: 0.26, melodyType: "sawtooth", bassType: "square",
  },
  stormyNest: {
    melody: [392, 440, 494, 523, 494, 440, 392, 349, 392, 440, 523, 587, 523, 494, 440, 392],
    bass: [196, 196, 220, 220, 247, 247, 196, 196, 175, 175, 220, 220, 262, 262, 220, 220],
    tempo: 0.28, melodyType: "square", bassType: "triangle",
  },
  cozyBurrow: {
    melody: [330, 349, 392, 440, 392, 349, 330, 294, 330, 349, 392, 440, 494, 440, 392, 349],
    bass: [165, 165, 175, 175, 196, 196, 165, 165, 147, 147, 175, 175, 220, 220, 196, 196],
    tempo: 0.34, melodyType: "triangle", bassType: "sine",
  },
  tidalGrotto: {
    melody: [330, 392, 440, 494, 440, 392, 330, 294, 330, 392, 440, 494, 523, 494, 440, 392],
    bass: [165, 165, 196, 196, 220, 220, 165, 165, 147, 147, 196, 196, 262, 262, 220, 220],
    tempo: 0.32, melodyType: "sine", bassType: "triangle",
  },
  blazingCaldera: {
    melody: [196, 262, 294, 330, 294, 262, 196, 175, 196, 262, 330, 392, 330, 294, 262, 196],
    bass: [98, 98, 131, 131, 165, 165, 98, 98, 88, 88, 131, 131, 196, 196, 131, 131],
    tempo: 0.24, melodyType: "sawtooth", bassType: "square",
  },
  verdantCanopy: {
    melody: [440, 494, 523, 587, 523, 494, 440, 392, 440, 494, 523, 587, 659, 587, 523, 494],
    bass: [220, 220, 247, 247, 262, 262, 220, 220, 196, 196, 247, 247, 330, 330, 262, 262],
    tempo: 0.36, melodyType: "triangle", bassType: "sine",
  },
  sparkingPlant: {
    melody: [330, 392, 440, 523, 440, 392, 330, 294, 330, 392, 523, 587, 523, 440, 392, 330],
    bass: [165, 165, 220, 220, 262, 262, 165, 165, 147, 147, 196, 196, 262, 262, 196, 196],
    tempo: 0.22, melodyType: "square", bassType: "sawtooth",
  },
  venomousReef: {
    melody: [220, 262, 294, 262, 220, 196, 175, 196, 220, 262, 294, 330, 294, 262, 220, 196],
    bass: [110, 110, 131, 131, 110, 110, 98, 98, 110, 110, 147, 147, 131, 131, 110, 110],
    tempo: 0.30, melodyType: "sawtooth", bassType: "triangle",
  },
  shiftingSands: {
    melody: [262, 294, 330, 349, 330, 294, 262, 247, 262, 294, 330, 392, 330, 294, 262, 247],
    bass: [131, 131, 147, 147, 165, 165, 131, 131, 124, 124, 147, 147, 196, 196, 147, 147],
    tempo: 0.28, melodyType: "sine", bassType: "square",
  },
  crystalCavern: {
    melody: [523, 587, 659, 784, 659, 587, 523, 494, 440, 494, 523, 587, 659, 587, 523, 494],
    bass: [262, 262, 330, 330, 294, 294, 262, 262, 220, 220, 262, 262, 330, 330, 262, 262],
    tempo: 0.32, melodyType: "sine", bassType: "triangle",
  },
  silkWeb: {
    melody: [294, 330, 349, 392, 349, 330, 294, 262, 294, 330, 392, 440, 392, 349, 330, 294],
    bass: [147, 147, 175, 175, 196, 196, 147, 147, 131, 131, 196, 196, 220, 220, 175, 175],
    tempo: 0.28, melodyType: "square", bassType: "sine",
  },
  championDojo: {
    melody: [262, 330, 392, 440, 523, 440, 392, 330, 262, 330, 392, 523, 587, 523, 440, 330],
    bass: [131, 131, 196, 196, 262, 262, 196, 196, 131, 131, 196, 196, 294, 294, 220, 220],
    tempo: 0.28, melodyType: "sine", bassType: "square",
  },
  stalactiteGrotto: {
    melody: [196, 220, 262, 247, 220, 196, 175, 196, 220, 262, 294, 262, 220, 196, 175, 165],
    bass: [98, 98, 131, 131, 110, 110, 88, 88, 110, 110, 147, 147, 131, 131, 98, 98],
    tempo: 0.30, melodyType: "sawtooth", bassType: "triangle",
  },
  chitinBurrow: {
    melody: [330, 392, 349, 330, 294, 330, 349, 392, 440, 392, 349, 330, 294, 262, 294, 330],
    bass: [165, 165, 175, 175, 147, 147, 175, 175, 220, 220, 196, 196, 147, 147, 131, 131],
    tempo: 0.26, melodyType: "square", bassType: "sine",
  },
  valorArena: {
    melody: [262, 330, 392, 440, 392, 330, 262, 294, 330, 392, 440, 523, 440, 392, 330, 262],
    bass: [131, 131, 196, 196, 220, 220, 131, 131, 165, 165, 220, 220, 262, 262, 196, 196],
    tempo: 0.22, melodyType: "sawtooth", bassType: "square",
  },
  seismicFault: {
    melody: [175, 196, 220, 262, 220, 196, 175, 165, 147, 165, 175, 196, 220, 262, 294, 262],
    bass: [88, 88, 110, 110, 131, 131, 88, 88, 73, 73, 88, 88, 110, 110, 147, 147],
    tempo: 0.28, melodyType: "sawtooth", bassType: "square",
  },
  corrosiveSewer: {
    melody: [220, 247, 262, 220, 196, 220, 247, 294, 262, 220, 196, 175, 196, 220, 262, 247],
    bass: [110, 110, 131, 131, 98, 98, 123, 123, 131, 131, 98, 98, 88, 88, 110, 110],
    tempo: 0.30, melodyType: "sawtooth", bassType: "triangle",
  },
  voltageSpire: {
    melody: [523, 587, 659, 784, 659, 587, 523, 440, 392, 440, 523, 587, 659, 784, 880, 784],
    bass: [262, 262, 330, 330, 392, 392, 262, 262, 196, 196, 262, 262, 330, 330, 440, 440],
    tempo: 0.20, melodyType: "square", bassType: "sawtooth",
  },
  infernoPit: {
    melody: [330, 392, 440, 494, 523, 494, 440, 392, 330, 294, 262, 294, 330, 392, 440, 523],
    bass: [165, 165, 220, 220, 262, 262, 220, 220, 165, 165, 131, 131, 165, 165, 220, 220],
    tempo: 0.22, melodyType: "sawtooth", bassType: "square",
  },
  abyssalTrench: {
    melody: [196, 220, 262, 294, 262, 220, 196, 175, 165, 175, 196, 220, 262, 294, 330, 294],
    bass: [98, 98, 131, 131, 147, 147, 98, 98, 82, 82, 98, 98, 131, 131, 165, 165],
    tempo: 0.36, melodyType: "sine", bassType: "triangle",
  },
  fungalMarsh: {
    melody: [262, 294, 330, 349, 330, 294, 262, 247, 220, 247, 262, 294, 330, 349, 392, 349],
    bass: [131, 131, 165, 165, 175, 175, 131, 131, 110, 110, 131, 131, 165, 165, 196, 196],
    tempo: 0.34, melodyType: "triangle", bassType: "sine",
  },
  // Phase 106-108: Steel/Ghost/Psychic 4th
  forgeMountain: {
    melody: [330, 392, 440, 523, 587, 523, 440, 392, 330, 294, 262, 294, 330, 392, 523, 440],
    bass: [165, 165, 220, 220, 294, 294, 220, 220, 165, 165, 131, 131, 165, 165, 262, 220],
    tempo: 0.26, melodyType: "sawtooth", bassType: "square",
  },
  hauntedManor: {
    melody: [196, 185, 175, 165, 156, 165, 175, 196, 220, 208, 196, 175, 165, 156, 147, 165],
    bass: [98, 98, 88, 88, 78, 78, 88, 88, 110, 110, 98, 98, 88, 88, 74, 74],
    tempo: 0.38, melodyType: "sine", bassType: "triangle",
  },
  dreamTemple: {
    melody: [523, 494, 440, 392, 440, 494, 523, 587, 659, 587, 523, 494, 440, 392, 349, 392],
    bass: [262, 262, 220, 220, 196, 196, 262, 262, 330, 330, 262, 262, 220, 220, 175, 175],
    tempo: 0.32, melodyType: "sine", bassType: "sine",
  },
  // Phase 109-111: Ice/Dark/Fairy 4th
  permafrostPeak: {
    melody: [523, 494, 440, 392, 349, 392, 440, 494, 523, 587, 523, 494, 440, 392, 349, 330],
    bass: [262, 262, 220, 220, 175, 175, 220, 220, 262, 262, 294, 294, 262, 262, 175, 175],
    tempo: 0.30, melodyType: "sine", bassType: "triangle",
  },
  thiefsDen: {
    melody: [196, 233, 262, 294, 262, 233, 196, 175, 165, 175, 196, 233, 262, 294, 330, 294],
    bass: [98, 98, 131, 131, 147, 147, 98, 98, 82, 82, 98, 98, 131, 131, 165, 165],
    tempo: 0.28, melodyType: "sawtooth", bassType: "square",
  },
  sugarGarden: {
    melody: [523, 587, 659, 698, 659, 587, 523, 494, 440, 494, 523, 587, 659, 698, 784, 698],
    bass: [262, 262, 330, 330, 349, 349, 262, 262, 220, 220, 262, 262, 330, 330, 392, 392],
    tempo: 0.34, melodyType: "triangle", bassType: "sine",
  },
  // Phase 112-114: Dragon/Flying/Normal 4th
  draconicSpire: {
    melody: [262, 294, 330, 392, 440, 392, 330, 294, 262, 330, 392, 440, 523, 440, 392, 330],
    bass: [131, 131, 165, 165, 220, 220, 165, 165, 131, 131, 196, 196, 262, 262, 196, 196],
    tempo: 0.26, melodyType: "square", bassType: "sawtooth",
  },
  skyHighNest: {
    melody: [392, 440, 494, 523, 587, 659, 587, 523, 494, 440, 392, 349, 330, 349, 392, 440],
    bass: [196, 196, 247, 247, 294, 294, 294, 294, 247, 247, 196, 196, 165, 165, 196, 196],
    tempo: 0.30, melodyType: "sine", bassType: "triangle",
  },
  pastoralPlains: {
    melody: [330, 392, 440, 494, 440, 392, 330, 294, 262, 294, 330, 392, 440, 494, 523, 494],
    bass: [165, 165, 220, 220, 220, 220, 165, 165, 131, 131, 165, 165, 220, 220, 262, 262],
    tempo: 0.34, melodyType: "triangle", bassType: "sine",
  },
  // Phase 118-120: Water/Fire/Grass 5th
  abyssalDepths: {
    melody: [165, 196, 220, 262, 247, 220, 196, 165, 147, 165, 196, 220, 262, 294, 262, 220],
    bass: [82, 82, 110, 110, 131, 131, 98, 98, 74, 74, 82, 82, 131, 131, 147, 147],
    tempo: 0.36, melodyType: "sine", bassType: "triangle",
  },
  volcanicCore: {
    melody: [294, 330, 392, 440, 494, 440, 392, 330, 294, 330, 392, 494, 523, 494, 392, 330],
    bass: [147, 147, 196, 196, 247, 247, 196, 196, 147, 147, 196, 196, 262, 262, 196, 196],
    tempo: 0.24, melodyType: "sawtooth", bassType: "square",
  },
  ancientWoods: {
    melody: [262, 294, 330, 349, 392, 349, 330, 294, 262, 247, 220, 247, 262, 294, 349, 330],
    bass: [131, 131, 165, 165, 196, 196, 165, 165, 131, 131, 110, 110, 131, 131, 175, 175],
    tempo: 0.32, melodyType: "triangle", bassType: "sine",
  },
  // Phase 121-123: Electric/Poison/Ground 5th
  // Thunder Dome — fast, electric, crackling
  thunderDome: {
    melody: [523, 587, 659, 784, 659, 587, 523, 494, 523, 659, 784, 880, 784, 659, 523, 494],
    bass: [262, 262, 330, 330, 392, 392, 262, 262, 247, 247, 330, 330, 440, 440, 330, 330],
    tempo: 0.24, melodyType: "sawtooth", bassType: "square",
  },
  // Miasma Swamp — slow, eerie, dripping
  miasmaSwamp: {
    melody: [220, 208, 196, 185, 175, 185, 196, 220, 247, 233, 220, 196, 185, 175, 165, 185],
    bass: [110, 110, 98, 98, 88, 88, 98, 98, 123, 123, 110, 110, 98, 98, 82, 82],
    tempo: 0.36, melodyType: "sine", bassType: "triangle",
  },
  // Tectonic Rift — heavy, rumbling, powerful
  tectonicRift: {
    melody: [196, 220, 262, 294, 330, 294, 262, 220, 196, 175, 196, 220, 262, 330, 294, 262],
    bass: [98, 98, 131, 131, 165, 165, 131, 131, 98, 98, 88, 88, 131, 131, 165, 165],
    tempo: 0.28, melodyType: "square", bassType: "sawtooth",
  },
  // Phase 124-126: Rock/Bug/Fighting 5th
  // Crystal Depths — deep, echoing, crystalline
  crystalDepths: {
    melody: [330, 392, 440, 523, 494, 440, 392, 349, 330, 294, 330, 392, 440, 523, 587, 523],
    bass: [165, 165, 220, 220, 247, 247, 196, 196, 165, 165, 147, 147, 220, 220, 294, 294],
    tempo: 0.30, melodyType: "sine", bassType: "triangle",
  },
  // Silkwood Grove — airy, buzzing
  silkwoodGrove: {
    melody: [494, 523, 587, 659, 587, 523, 494, 440, 392, 440, 494, 523, 587, 659, 698, 659],
    bass: [247, 247, 294, 294, 330, 330, 262, 262, 196, 196, 220, 220, 294, 294, 349, 349],
    tempo: 0.28, melodyType: "triangle", bassType: "sine",
  },
  // Warlord's Arena — intense, martial
  warlordsArena: {
    melody: [262, 330, 392, 440, 523, 440, 392, 330, 262, 294, 330, 392, 440, 523, 587, 523],
    bass: [131, 131, 196, 196, 262, 262, 220, 220, 131, 131, 147, 147, 220, 220, 294, 294],
    tempo: 0.22, melodyType: "sawtooth", bassType: "square",
  },
  // Phase 127-129: Steel/Ghost/Psychic 5th
  // Steelworks Citadel — industrial, heavy, rhythmic
  steelworksCitadel: {
    melody: [262, 330, 392, 440, 392, 330, 262, 294, 330, 392, 440, 523, 440, 392, 330, 262],
    bass: [131, 131, 196, 196, 220, 220, 131, 131, 165, 165, 220, 220, 262, 262, 196, 196],
    tempo: 0.24, melodyType: "square", bassType: "sawtooth",
  },
  // Spectral Crypt — eerie, slow, haunting
  spectralCrypt: {
    melody: [196, 185, 175, 196, 220, 208, 196, 175, 165, 175, 196, 220, 247, 220, 196, 175],
    bass: [98, 98, 88, 88, 110, 110, 98, 98, 82, 82, 88, 88, 123, 123, 98, 98],
    tempo: 0.38, melodyType: "sine", bassType: "triangle",
  },
  // Astral Sanctum — ethereal, dreamy, psychic
  astralSanctum: {
    melody: [523, 587, 659, 587, 523, 494, 440, 494, 523, 587, 659, 784, 659, 587, 523, 494],
    bass: [262, 262, 330, 330, 262, 262, 220, 220, 262, 262, 330, 330, 392, 392, 262, 262],
    tempo: 0.34, melodyType: "sine", bassType: "sine",
  },
  // Phase 130-132: Ice/Dark/Fairy 5th
  // Glacial Abyss — frigid, deep, echoing
  glacialAbyss: {
    melody: [494, 440, 392, 349, 330, 349, 392, 440, 494, 523, 494, 440, 392, 349, 330, 294],
    bass: [247, 247, 196, 196, 165, 165, 196, 196, 247, 247, 262, 262, 196, 196, 165, 165],
    tempo: 0.36, melodyType: "sine", bassType: "triangle",
  },
  // Shadow Labyrinth — dark, tense, winding
  shadowLabyrinth: {
    melody: [196, 185, 175, 196, 220, 208, 196, 175, 165, 175, 196, 220, 247, 233, 220, 196],
    bass: [98, 98, 88, 88, 110, 110, 98, 98, 82, 82, 98, 98, 123, 123, 110, 110],
    tempo: 0.30, melodyType: "sawtooth", bassType: "square",
  },
  // Faerie Garden — whimsical, bright, fairy-like
  faerieGarden: {
    melody: [587, 659, 698, 784, 698, 659, 587, 523, 494, 523, 587, 659, 698, 784, 880, 784],
    bass: [294, 294, 349, 349, 392, 392, 294, 294, 247, 247, 294, 294, 349, 349, 440, 440],
    tempo: 0.34, melodyType: "triangle", bassType: "sine",
  },
  // Phase 133-135: Dragon/Flying/Normal 5th
  // Dragon's Den — deep, draconic, powerful
  dragonsDen: {
    melody: [196, 233, 262, 294, 330, 294, 262, 233, 196, 220, 262, 330, 392, 330, 262, 220],
    bass: [98, 98, 131, 131, 165, 165, 131, 131, 110, 110, 131, 131, 196, 196, 131, 131],
    tempo: 0.26, melodyType: "sawtooth", bassType: "square",
  },
  // Stormy Skies — breezy, turbulent, soaring
  stormySkies: {
    melody: [440, 494, 523, 587, 659, 587, 523, 494, 440, 392, 440, 494, 523, 587, 659, 698],
    bass: [220, 220, 262, 262, 330, 330, 262, 262, 220, 220, 196, 196, 262, 262, 349, 349],
    tempo: 0.28, melodyType: "square", bassType: "triangle",
  },
  // Verdant Meadow — light, pastoral, cheerful
  verdantMeadow: {
    melody: [392, 440, 494, 523, 494, 440, 392, 349, 330, 349, 392, 440, 494, 523, 587, 523],
    bass: [196, 196, 247, 247, 262, 262, 196, 196, 165, 165, 175, 175, 247, 247, 294, 294],
    tempo: 0.32, melodyType: "triangle", bassType: "sine",
  },
  // Phase 137-139: Water/Fire/Grass/Electric/Poison/Ground 6th
  // Tidal Trench — deep, aquatic, flowing
  tidalTrench: {
    melody: [196, 220, 262, 294, 330, 294, 262, 220, 196, 175, 196, 220, 262, 330, 294, 262],
    bass: [98, 98, 131, 131, 165, 165, 131, 131, 98, 98, 88, 88, 131, 131, 165, 165],
    tempo: 0.34, melodyType: "sine", bassType: "triangle",
  },
  // Inferno Peak — aggressive, fiery, intense
  infernoPeak: {
    melody: [330, 392, 440, 523, 494, 440, 392, 330, 294, 330, 392, 440, 523, 587, 523, 440],
    bass: [165, 165, 220, 220, 262, 262, 196, 196, 147, 147, 196, 196, 262, 262, 220, 220],
    tempo: 0.22, melodyType: "sawtooth", bassType: "square",
  },
  // Eterna Forest — lush, mystical, verdant
  eternaForest: {
    melody: [392, 440, 494, 523, 587, 523, 494, 440, 392, 349, 330, 349, 392, 440, 494, 523],
    bass: [196, 196, 247, 247, 294, 294, 247, 247, 196, 196, 175, 175, 196, 196, 247, 247],
    tempo: 0.32, melodyType: "triangle", bassType: "sine",
  },
  // Volt Chamber — electronic, pulsing, high energy
  voltChamber: {
    melody: [523, 587, 659, 784, 880, 784, 659, 587, 523, 494, 440, 494, 523, 659, 784, 880],
    bass: [262, 262, 330, 330, 440, 440, 330, 330, 262, 262, 220, 220, 262, 262, 392, 392],
    tempo: 0.20, melodyType: "square", bassType: "sawtooth",
  },
  // Faultline Chasm — heavy, rumbling, seismic
  faultlineChasm: {
    melody: [175, 196, 220, 262, 294, 262, 220, 196, 175, 165, 175, 196, 220, 262, 294, 330],
    bass: [88, 88, 110, 110, 131, 131, 110, 110, 88, 88, 82, 82, 98, 98, 131, 131],
    tempo: 0.30, melodyType: "sawtooth", bassType: "square",
  },
  // Phase 140-142: Rock/Bug/Fighting/Steel/Ghost/Psychic 6th
  // Fossil Crypt — ancient, echoing, rocky
  fossilCrypt: {
    melody: [196, 220, 247, 262, 247, 220, 196, 175, 196, 220, 262, 294, 262, 220, 196, 175],
    bass: [98, 98, 123, 123, 131, 131, 98, 98, 88, 88, 131, 131, 147, 147, 110, 110],
    tempo: 0.32, melodyType: "sawtooth", bassType: "triangle",
  },
  // Cocoon Hollow — buzzing, airy, nature
  cocoonHollow: {
    melody: [392, 440, 494, 523, 494, 440, 392, 349, 392, 440, 523, 587, 523, 494, 440, 392],
    bass: [196, 196, 247, 247, 262, 262, 196, 196, 175, 175, 262, 262, 294, 294, 220, 220],
    tempo: 0.30, melodyType: "triangle", bassType: "sine",
  },
  // Titan's Dojo — intense, martial, fast
  titansDojo: {
    melody: [262, 330, 392, 440, 523, 440, 392, 330, 262, 294, 330, 392, 440, 523, 587, 523],
    bass: [131, 131, 196, 196, 262, 262, 220, 220, 131, 131, 165, 165, 220, 220, 294, 294],
    tempo: 0.22, melodyType: "sawtooth", bassType: "square",
  },
  // Iron Vault — heavy, metallic, rhythmic
  ironVault: {
    melody: [262, 294, 330, 392, 330, 294, 262, 247, 262, 330, 392, 440, 392, 330, 294, 262],
    bass: [131, 131, 165, 165, 196, 196, 131, 131, 124, 124, 165, 165, 220, 220, 165, 165],
    tempo: 0.26, melodyType: "square", bassType: "sawtooth",
  },
  // Phantom Rift — eerie, ghostly, slow
  phantomRift: {
    melody: [220, 208, 196, 185, 175, 185, 196, 220, 247, 233, 220, 208, 196, 185, 175, 165],
    bass: [110, 110, 98, 98, 88, 88, 98, 98, 123, 123, 110, 110, 98, 98, 88, 88],
    tempo: 0.38, melodyType: "sine", bassType: "triangle",
  },
  // Mind Palace — dreamy, ethereal, psychic
  mindPalace: {
    melody: [523, 587, 659, 698, 659, 587, 523, 494, 440, 494, 523, 587, 659, 698, 784, 698],
    bass: [262, 262, 330, 330, 349, 349, 262, 262, 220, 220, 262, 262, 330, 330, 392, 392],
    tempo: 0.34, melodyType: "sine", bassType: "sine",
  },
  // Frozen Citadel — icy, crystalline, cold
  frozenCitadel: {
    melody: [659, 622, 587, 523, 494, 523, 587, 659, 698, 659, 587, 523, 494, 440, 392, 440],
    bass: [330, 330, 294, 294, 247, 247, 294, 294, 349, 349, 294, 294, 247, 247, 220, 220],
    tempo: 0.32, melodyType: "sine", bassType: "triangle",
  },
  // Eclipse Vault — dark, ominous, slow
  eclipseVault: {
    melody: [175, 185, 196, 220, 196, 185, 175, 165, 156, 165, 175, 196, 220, 247, 220, 196],
    bass: [88, 88, 98, 98, 110, 110, 88, 88, 78, 78, 88, 88, 110, 110, 123, 123],
    tempo: 0.36, melodyType: "sawtooth", bassType: "triangle",
  },
  // Moonlit Garden — gentle, fairy-like, waltz
  moonlitGarden: {
    melody: [440, 523, 587, 659, 587, 523, 440, 392, 440, 494, 587, 659, 784, 659, 587, 523],
    bass: [220, 220, 294, 294, 330, 330, 220, 220, 196, 196, 247, 247, 330, 330, 294, 294],
    tempo: 0.30, melodyType: "sine", bassType: "sine",
  },
  // Wyrm's Nest — powerful, draconic, rumbling
  wyrmsNest: {
    melody: [196, 247, 294, 330, 294, 247, 196, 175, 196, 262, 330, 392, 330, 262, 220, 196],
    bass: [98, 98, 123, 123, 165, 165, 98, 98, 88, 88, 131, 131, 196, 196, 110, 110],
    tempo: 0.28, melodyType: "sawtooth", bassType: "square",
  },
  // Sky Pinnacle — airy, uplifting, soaring
  skyPinnacle: {
    melody: [523, 587, 659, 784, 659, 587, 523, 494, 440, 523, 659, 784, 880, 784, 659, 523],
    bass: [262, 262, 330, 330, 392, 392, 262, 262, 220, 220, 262, 262, 392, 392, 330, 330],
    tempo: 0.26, melodyType: "triangle", bassType: "sine",
  },
  // Primeval Plains — steady, natural, earthy
  primevalPlains: {
    melody: [330, 349, 392, 440, 392, 349, 330, 294, 330, 392, 440, 494, 440, 392, 349, 330],
    bass: [165, 165, 196, 196, 220, 220, 165, 165, 147, 147, 196, 196, 247, 247, 196, 196],
    tempo: 0.28, melodyType: "triangle", bassType: "triangle",
  },
  // Hub — peaceful town
  hub: {
    melody: [392, 440, 494, 523, 587, 523, 494, 440, 392, 349, 330, 349, 392, 440, 494, 440],
    bass: [196, 196, 247, 247, 262, 262, 247, 247, 196, 196, 165, 165, 196, 196, 220, 220],
    tempo: 0.35, melodyType: "triangle", bassType: "sine",
  },
};

/** Start BGM with dungeon-specific melody */
export function startBgm(dungeonId?: string) {
  const id = dungeonId ?? "beachCave";
  if (bgmPlaying && currentBgmId === id) return;

  stopBgm();
  bgmPlaying = true;
  currentBgmId = id;
  bgmNoteIdx = 0;

  const pattern = BGM_PATTERNS[id] ?? BGM_PATTERNS.beachCave;

  bgmTimer = setInterval(() => {
    if (!bgmPlaying) return;
    try {
      const c = getCtx();

      // Melody
      const melOsc = c.createOscillator();
      const melGain = c.createGain();
      melOsc.type = pattern.melodyType;
      melOsc.frequency.setValueAtTime(pattern.melody[bgmNoteIdx % pattern.melody.length], c.currentTime);
      melGain.gain.setValueAtTime(masterVolume * 0.12, c.currentTime);
      melGain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + pattern.tempo * 0.9);
      melOsc.connect(melGain);
      melGain.connect(c.destination);
      melOsc.start(c.currentTime);
      melOsc.stop(c.currentTime + pattern.tempo);

      // Bass
      const bassOsc = c.createOscillator();
      const bassGain = c.createGain();
      bassOsc.type = pattern.bassType;
      bassOsc.frequency.setValueAtTime(pattern.bass[bgmNoteIdx % pattern.bass.length], c.currentTime);
      bassGain.gain.setValueAtTime(masterVolume * 0.08, c.currentTime);
      bassGain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + pattern.tempo * 0.9);
      bassOsc.connect(bassGain);
      bassGain.connect(c.destination);
      bassOsc.start(c.currentTime);
      bassOsc.stop(c.currentTime + pattern.tempo);

      bgmNoteIdx++;
    } catch { /* ignore */ }
  }, pattern.tempo * 1000);
}

export function stopBgm() {
  bgmPlaying = false;
  currentBgmId = "";
  if (bgmTimer) {
    clearInterval(bgmTimer);
    bgmTimer = null;
  }
}

/** Initialize audio on first user interaction */
export function initAudio() {
  getCtx();
}
