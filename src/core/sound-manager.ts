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
  // Destiny Tower — grand, final
  destinyTower: {
    melody: [262, 330, 392, 523, 392, 330, 262, 196, 262, 392, 523, 659, 523, 392, 330, 262],
    bass: [131, 131, 196, 196, 262, 262, 131, 131, 98, 98, 196, 196, 262, 262, 165, 131],
    tempo: 0.25, melodyType: "square", bassType: "sawtooth",
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
