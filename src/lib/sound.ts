/**
 * Music and sound effects, all synthesised live with Web Audio, so nothing downloads.
 *
 * The music is a highlife-style loop: an agogo bell pattern, a shekere, a kick, a talking
 * drum that bends its pitch like speech, and a guitar-like pluck. A tiny scheduler queues
 * notes 120 ms ahead every 25 ms, which keeps time steady even when the phone is busy.
 *
 * Browsers only allow sound after a tap, so nothing plays until the first one. The music
 * pauses whenever the app is in the background.
 */
import { prefs } from './prefs';

type Ctx = AudioContext;

interface Engine {
  ctx: Ctx;
  master: DynamicsCompressorNode;
  music: GainNode;
  fx: GainNode;
  noise: AudioBuffer;
}

let E: Engine | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let nextAt = 0;
let step = 0;

/** Background level: quiet enough to sit under the game, not over it. */
const MUSIC_LEVEL = 0.09;
const MUSIC_DUCKED = 0.03;

function engine(): Engine | null {
  if (!E) {
    const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    // "Ambient" lets iPhones mix the game with other audio and respect the silent switch.
    try {
      const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
      if (session) session.type = 'ambient';
    } catch { /* not supported */ }
    let ctx: Ctx;
    try {
      ctx = new C();
    } catch {
      return null;
    }
    const master = ctx.createDynamicsCompressor();
    master.connect(ctx.destination);
    const music = ctx.createGain();
    music.gain.value = 0;
    music.connect(master);
    const fx = ctx.createGain();
    fx.gain.value = 0.6;
    fx.connect(master);
    const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    E = { ctx, master, music, fx, noise };
  }
  if (E.ctx.state === 'suspended') E.ctx.resume().catch(() => {});
  return E;
}

function env(g: GainNode, t: number, peak: number, dur: number, attack = 0.004) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
}

function bell(e: Engine, t: number, hi: boolean, out: AudioNode, v = 0.11) {
  const f = hi ? 1180 : 790;
  for (const [fr, type, vol] of [[f, 'triangle', v], [f * 2.76, 'sine', v * 0.25]] as const) {
    const o = e.ctx.createOscillator();
    const g = e.ctx.createGain();
    o.type = type;
    o.frequency.value = fr;
    env(g, t, vol, 0.2, 0.002);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + 0.25);
  }
}

function shaker(e: Engine, t: number, accent: boolean, out: AudioNode) {
  const s = e.ctx.createBufferSource();
  const f = e.ctx.createBiquadFilter();
  const g = e.ctx.createGain();
  s.buffer = e.noise;
  f.type = 'bandpass';
  f.frequency.value = 7200;
  f.Q.value = 1.1;
  env(g, t, accent ? 0.13 : 0.05, 0.07, 0.004);
  s.connect(f).connect(g).connect(out);
  s.start(t, Math.random() * 0.8, 0.09);
}

function kick(e: Engine, t: number, out: AudioNode, v = 0.6) {
  const o = e.ctx.createOscillator();
  const g = e.ctx.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(140, t);
  o.frequency.exponentialRampToValueAtTime(48, t + 0.12);
  env(g, t, v, 0.24, 0.003);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + 0.3);
}

/** The talking drum: a pitch that slides like a spoken word, plus a slap of noise. */
function talk(e: Engine, t: number, f0: number, f1: number, dur: number, out: AudioNode, v = 0.34) {
  const o = e.ctx.createOscillator();
  const lp = e.ctx.createBiquadFilter();
  const g = e.ctx.createGain();
  o.type = 'triangle';
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.7);
  lp.type = 'lowpass';
  lp.frequency.value = 1100;
  env(g, t, v, dur + 0.06, 0.004);
  o.connect(lp).connect(g).connect(out);
  o.start(t);
  o.stop(t + dur + 0.1);
  const s = e.ctx.createBufferSource();
  const sg = e.ctx.createGain();
  const hp = e.ctx.createBiquadFilter();
  s.buffer = e.noise;
  hp.type = 'highpass';
  hp.frequency.value = 2500;
  env(sg, t, v * 0.25, 0.03, 0.001);
  s.connect(hp).connect(sg).connect(out);
  s.start(t, Math.random() * 0.5, 0.04);
}

function pluck(e: Engine, t: number, f: number, out: AudioNode, v = 0.08) {
  const lp = e.ctx.createBiquadFilter();
  const g = e.ctx.createGain();
  lp.type = 'lowpass';
  lp.frequency.value = 2600;
  env(g, t, v, 0.38, 0.003);
  lp.connect(g).connect(out);
  ([[f, 'triangle', 1], [f * 2, 'sine', 0.35]] as const).forEach(([fr, type, level]) => {
    const o = e.ctx.createOscillator();
    const gg = e.ctx.createGain();
    o.type = type;
    o.frequency.value = fr;
    gg.gain.value = level;
    o.connect(gg).connect(lp);
    o.start(t);
    o.stop(t + 0.42);
  });
}

/* ---------- the loop: 4 bars of 12 pulses ---------- */

const PULSE = 0.17;
const BELL = [0, 2, 4, 5, 7, 9, 11];
const TALK: [number, number, number, number][][] = [
  [[3, 150, 210, 0.25], [5, 210, 170, 0.18], [8, 170, 120, 0.35]],
  [[1, 140, 140, 0.12], [3, 140, 200, 0.2], [6, 220, 150, 0.4], [10, 160, 230, 0.25]],
  [[3, 150, 210, 0.25], [4, 210, 210, 0.12], [5, 190, 150, 0.25], [9, 150, 200, 0.25]],
  [[0, 200, 130, 0.3], [6, 130, 240, 0.45], [9, 240, 180, 0.15], [10, 180, 130, 0.3]],
];
const RIFF = [[659, 784, 659, 523], [587, 659, 587, 392], [659, 784, 880, 784], [659, 587, 523, 587]];

function playStep(e: Engine, n: number, t: number) {
  const bar = Math.floor(n / 12);
  const p = n % 12;
  const out = e.music;
  if (BELL.includes(p)) bell(e, t, p !== 0, out);
  shaker(e, t, p % 3 === 0, out);
  if (p === 0 || p === 6 || (bar === 3 && p === 9)) kick(e, t, out, p === 0 ? 0.6 : 0.45);
  for (const [at, f0, f1, d] of TALK[bar]) if (at === p) talk(e, t, f0, f1, d, out);
  const ri = [1, 4, 7, 10].indexOf(p);
  if (ri >= 0) pluck(e, t, RIFF[bar][ri], out);
}

function tick() {
  if (!E) return;
  while (nextAt < E.ctx.currentTime + 0.12) {
    playStep(E, step, nextAt);
    nextAt += PULSE;
    step = (step + 1) % 48;
  }
}

export function startMusic() {
  const e = engine();
  if (!e || timer) return;
  nextAt = e.ctx.currentTime + 0.08;
  step = 0;
  timer = setInterval(tick, 25);
  const t = e.ctx.currentTime;
  e.music.gain.cancelScheduledValues(t);
  e.music.gain.setValueAtTime(0.0001, t);
  e.music.gain.exponentialRampToValueAtTime(MUSIC_LEVEL, t + 1.2);
}

export function stopMusic() {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
  if (E) {
    E.music.gain.cancelScheduledValues(E.ctx.currentTime);
    E.music.gain.setTargetAtTime(0.0001, E.ctx.currentTime, 0.1);
  }
}

/** Turns the music down for a moment so a stamp or win can be heard. */
function duck() {
  if (!E || !timer) return;
  const t = E.ctx.currentTime;
  E.music.gain.cancelScheduledValues(t);
  E.music.gain.setTargetAtTime(MUSIC_DUCKED, t, 0.03);
  E.music.gain.setTargetAtTime(MUSIC_LEVEL, t + 0.9, 0.25);
}

/** Wires up the first-tap start and the background pause. Call once. */
export function initSound() {
  let started = false;
  document.addEventListener(
    'pointerdown',
    () => {
      if (started) return;
      started = true;
      if (prefs.get().music) startMusic();
      else engine();
    },
    true,
  );
  document.addEventListener('visibilitychange', () => {
    if (!E) return;
    if (document.hidden) {
      stopMusic();
      E.ctx.suspend().catch(() => {});
    } else if (prefs.get().music && started) {
      E.ctx.resume().then(startMusic).catch(() => {});
    }
  });
  let last = prefs.get().music;
  prefs.subscribe(() => {
    const on = prefs.get().music;
    if (on === last) return;
    last = on;
    if (on) startMusic();
    else stopMusic();
  });
}

const fx = (play: (e: Engine, t: number) => void) => () => {
  if (!prefs.get().sfx) return;
  const e = engine();
  if (e) play(e, e.ctx.currentTime);
};

export const sfx = {
  tap: fx((e, t) => bell(e, t, true, e.fx, 0.05)),
  /** Your piece: a rising talking drum. */
  me: fx((e, t) => talk(e, t, 170, 250, 0.16, e.fx, 0.5)),
  /** Their piece: a falling one, so you can tell them apart without looking. */
  op: fx((e, t) => talk(e, t, 240, 160, 0.16, e.fx, 0.42)),
  tick: fx((e, t) => bell(e, t, true, e.fx, 0.04)),
  stamp: fx((e, t) => { duck(); kick(e, t, e.fx, 0.9); shaker(e, t, true, e.fx); }),
  win: fx((e, t) => {
    const s = t + 0.12;
    [523, 659, 784, 1047].forEach((f, i) => pluck(e, s + i * 0.09, f, e.fx, 0.16));
    bell(e, s + 0.4, true, e.fx, 0.12);
  }),
  lose: fx((e, t) => talk(e, t + 0.12, 220, 110, 0.5, e.fx, 0.45)),
  draw: fx((e, t) => { talk(e, t + 0.12, 180, 180, 0.15, e.fx, 0.4); talk(e, t + 0.32, 180, 180, 0.15, e.fx, 0.4); }),
  found: fx((e, t) => { duck(); [392, 523, 659].forEach((f, i) => pluck(e, t + i * 0.07, f, e.fx, 0.14)); }),
  levelUp: fx((e, t) => {
    duck();
    [523, 659, 784, 659, 784, 1047].forEach((f, i) => pluck(e, t + i * 0.08, f, e.fx, 0.15));
    bell(e, t + 0.5, true, e.fx, 0.12);
  }),
};
