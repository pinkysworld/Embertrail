/**
 * Lightweight Web Audio SFX + ambient for Embertrail (no external assets required).
 * Procedural beeps/noise — works offline and on GitHub Pages.
 */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let ambientGain: GainNode | null = null;
let ambientNodes: AudioNode[] = [];
let muted = localStorage.getItem("embertrail_mute") === "1";
function readVolume(): number {
  const v = Number(localStorage.getItem("embertrail_vol") ?? "0.35");
  if (!Number.isFinite(v)) return 0.35;
  return Math.max(0, Math.min(1, v));
}
let volume = readVolume();

function ensure(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : volume;
    master.connect(ctx.destination);
    ambientGain = ctx.createGain();
    ambientGain.gain.value = 0.22;
    ambientGain.connect(master);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function setMuted(m: boolean): void {
  muted = m;
  localStorage.setItem("embertrail_mute", m ? "1" : "0");
  if (master) master.gain.value = m ? 0 : volume;
}

export function isMuted(): boolean {
  return muted;
}

export function setVolume(v: number): void {
  volume = Math.max(0, Math.min(1, v));
  localStorage.setItem("embertrail_vol", String(volume));
  if (master && !muted) master.gain.value = volume;
}

function tone(
  freq: number,
  dur: number,
  type: OscillatorType = "square",
  gain = 0.08,
  when = 0
): void {
  const c = ensure();
  if (!c || !master || muted) return;
  const t0 = c.currentTime + when;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g);
  g.connect(master);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

function noiseBurst(dur: number, gain = 0.05, filterFreq = 800): void {
  const c = ensure();
  if (!c || !master || muted) return;
  const n = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, n, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = filterFreq;
  const g = c.createGain();
  const t0 = c.currentTime;
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f);
  f.connect(g);
  g.connect(master);
  src.start();
}

export type SfxKind =
  | "ui_click"
  | "ui_open"
  | "notify"
  | "quest"
  | "hit"
  | "miss"
  | "cast"
  | "heal"
  | "footstep"
  | "door"
  | "victory"
  | "defeat"
  | "buy"
  | "levelup";

export function playSfx(kind: SfxKind): void {
  switch (kind) {
    case "ui_click":
      tone(520, 0.04, "square", 0.04);
      break;
    case "ui_open":
      tone(330, 0.06, "triangle", 0.05);
      tone(440, 0.08, "triangle", 0.04, 0.05);
      break;
    case "notify":
      tone(660, 0.07, "sine", 0.05);
      break;
    case "quest":
      tone(392, 0.1, "triangle", 0.06);
      tone(523, 0.12, "triangle", 0.05, 0.08);
      tone(659, 0.14, "triangle", 0.04, 0.16);
      break;
    case "hit":
      noiseBurst(0.08, 0.09, 1200);
      tone(120, 0.06, "sawtooth", 0.06);
      break;
    case "miss":
      tone(180, 0.05, "sine", 0.03);
      break;
    case "cast":
      tone(880, 0.12, "sine", 0.05);
      tone(1320, 0.1, "sine", 0.03, 0.05);
      break;
    case "heal":
      tone(523, 0.1, "sine", 0.05);
      tone(784, 0.12, "sine", 0.04, 0.08);
      break;
    case "footstep":
      noiseBurst(0.04, 0.025, 400);
      break;
    case "door":
      noiseBurst(0.12, 0.06, 500);
      tone(90, 0.1, "square", 0.03);
      break;
    case "victory":
      tone(523, 0.1, "triangle", 0.06);
      tone(659, 0.1, "triangle", 0.06, 0.1);
      tone(784, 0.18, "triangle", 0.07, 0.2);
      break;
    case "defeat":
      tone(200, 0.2, "sawtooth", 0.05);
      tone(140, 0.25, "sawtooth", 0.04, 0.12);
      break;
    case "buy":
      tone(880, 0.05, "square", 0.04);
      tone(1100, 0.05, "square", 0.03, 0.05);
      break;
    case "levelup":
      tone(523, 0.08, "square", 0.05);
      tone(659, 0.08, "square", 0.05, 0.07);
      tone(784, 0.08, "square", 0.05, 0.14);
      tone(1046, 0.16, "square", 0.06, 0.22);
      break;
  }
}

export function startAmbient(mode: "town" | "dungeon" | "combat" | "title" | "none"): void {
  stopAmbient();
  const c = ensure();
  if (!c || !ambientGain || muted || mode === "none") return;

  if (mode === "town" || mode === "title") {
    // soft wind drone
    const o = c.createOscillator();
    o.type = "sine";
    o.frequency.value = mode === "title" ? 55 : 70;
    const g = c.createGain();
    g.gain.value = 0.015;
    o.connect(g);
    g.connect(ambientGain);
    o.start();
    ambientNodes.push(o, g);
    // high airy layer
    const o2 = c.createOscillator();
    o2.type = "triangle";
    o2.frequency.value = 220;
    const g2 = c.createGain();
    g2.gain.value = 0.008;
    o2.connect(g2);
    g2.connect(ambientGain);
    o2.start();
    ambientNodes.push(o2, g2);
  } else if (mode === "dungeon") {
    const o = c.createOscillator();
    o.type = "sawtooth";
    o.frequency.value = 48;
    const f = c.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 200;
    const g = c.createGain();
    g.gain.value = 0.02;
    o.connect(f);
    f.connect(g);
    g.connect(ambientGain);
    o.start();
    ambientNodes.push(o, f, g);
    // drip-like sparse pings via LFO-ish second tone
    const o2 = c.createOscillator();
    o2.type = "sine";
    o2.frequency.value = 880;
    const g2 = c.createGain();
    g2.gain.value = 0.0;
    // schedule soft pings
    const now = c.currentTime;
    for (let i = 0; i < 20; i++) {
      const t = now + 1.5 + i * (1.8 + Math.random());
      g2.gain.setValueAtTime(0.0001, t);
      g2.gain.exponentialRampToValueAtTime(0.03, t + 0.02);
      g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    }
    o2.connect(g2);
    g2.connect(ambientGain);
    o2.start();
    ambientNodes.push(o2, g2);
  } else if (mode === "combat") {
    const o = c.createOscillator();
    o.type = "triangle";
    o.frequency.value = 90;
    const g = c.createGain();
    g.gain.value = 0.025;
    o.connect(g);
    g.connect(ambientGain);
    o.start();
    ambientNodes.push(o, g);
    const o2 = c.createOscillator();
    o2.type = "square";
    o2.frequency.value = 45;
    const g2 = c.createGain();
    g2.gain.value = 0.012;
    o2.connect(g2);
    g2.connect(ambientGain);
    o2.start();
    ambientNodes.push(o2, g2);
  }
}

export function stopAmbient(): void {
  for (const n of ambientNodes) {
    try {
      if ("stop" in n && typeof (n as OscillatorNode).stop === "function") {
        (n as OscillatorNode).stop();
      }
      n.disconnect();
    } catch {
      /* already stopped */
    }
  }
  ambientNodes = [];
}

/** Unlock audio on first user gesture */
export function unlockAudio(): void {
  ensure();
  playSfx("ui_click");
}
