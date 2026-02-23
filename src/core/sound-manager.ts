/**
 * Sound manager — synthesized 8-bit style sound effects + looping BGM
 * Uses Web Audio API oscillators (no external audio files needed)
 */

let ctx: AudioContext | null = null;
let bgmGain: GainNode | null = null;
let bgmOsc1: OscillatorNode | null = null;
let bgmOsc2: OscillatorNode | null = null;
let bgmPlaying = false;
let masterVolume = 0.3;
let sfxVolume = 0.4;

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

// ── BGM (simple dungeon loop) ──

/** Dungeon melody pattern — plays in loop via scheduling */
const DUNGEON_MELODY = [
  262, 294, 330, 262, 294, 349, 330, 294,
  262, 294, 330, 392, 349, 330, 294, 262,
];
const BASS_PATTERN = [
  131, 131, 165, 165, 147, 147, 131, 131,
  131, 131, 165, 165, 175, 165, 147, 131,
];
const NOTE_DUR = 0.28;

let bgmTimer: ReturnType<typeof setInterval> | null = null;
let bgmNoteIdx = 0;

export function startBgm() {
  if (bgmPlaying) return;
  bgmPlaying = true;
  bgmNoteIdx = 0;

  bgmTimer = setInterval(() => {
    if (!bgmPlaying) return;
    const c = getCtx();

    // Melody
    const melOsc = c.createOscillator();
    const melGain = c.createGain();
    melOsc.type = "triangle";
    melOsc.frequency.setValueAtTime(DUNGEON_MELODY[bgmNoteIdx % DUNGEON_MELODY.length], c.currentTime);
    melGain.gain.setValueAtTime(masterVolume * 0.12, c.currentTime);
    melGain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + NOTE_DUR * 0.9);
    melOsc.connect(melGain);
    melGain.connect(c.destination);
    melOsc.start(c.currentTime);
    melOsc.stop(c.currentTime + NOTE_DUR);

    // Bass
    const bassOsc = c.createOscillator();
    const bassGain = c.createGain();
    bassOsc.type = "sine";
    bassOsc.frequency.setValueAtTime(BASS_PATTERN[bgmNoteIdx % BASS_PATTERN.length], c.currentTime);
    bassGain.gain.setValueAtTime(masterVolume * 0.08, c.currentTime);
    bassGain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + NOTE_DUR * 0.9);
    bassOsc.connect(bassGain);
    bassGain.connect(c.destination);
    bassOsc.start(c.currentTime);
    bassOsc.stop(c.currentTime + NOTE_DUR);

    bgmNoteIdx++;
  }, NOTE_DUR * 1000);
}

export function stopBgm() {
  bgmPlaying = false;
  if (bgmTimer) {
    clearInterval(bgmTimer);
    bgmTimer = null;
  }
}

/** Initialize audio on first user interaction */
export function initAudio() {
  getCtx();
}
