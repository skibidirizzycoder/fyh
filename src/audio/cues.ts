// cues.ts — every sound effect described as plain data (tones and noise bursts).
// Pure functions, no Web Audio, so tests can check them. synth.ts plays them.
// All numbers come from the `audio` section of src/tuning.ts.

import { T } from '../tuning.ts';

export type CueName = 'beep' | 'blip' | 'flip-open' | 'flip-close' | 'ringtone' | 'whoosh' | 'chime' | 'nope' | 'remaster' | 'beam' | 'cd-insert';

export const CUE_NAMES: readonly CueName[] = ['beep', 'blip', 'flip-open', 'flip-close', 'ringtone', 'whoosh', 'chime', 'nope', 'remaster', 'beam', 'cd-insert'];

/** One oscillator note. `toNote` slides the pitch during the note. */
export interface Tone {
  at: number; // seconds after the cue starts
  sec: number;
  note: number; // MIDI note
  toNote?: number;
  wave: OscillatorType;
  gain: number;
}

/** One burst of filtered white noise. The filter sweeps from fromHz to toHz. */
export interface NoiseBurst {
  at: number;
  sec: number;
  gain: number;
  fromHz: number;
  toHz: number;
  q: number;
}

export interface Cue {
  tones: Tone[];
  noises: NoiseBurst[];
}

type SongPart = { wave: string; gain: number; notes: readonly (readonly [number, number, number])[] };

/** Frequency in Hz of a MIDI note (69 = A 440 Hz, 12 notes per octave). */
export function noteHz(note: number): number {
  return 440 * 2 ** ((note - 69) / 12);
}

/** Notes played one after another, `gapSec` apart (chime, nope, fanfare). */
function arpeggio(a: { notes: readonly number[]; gapSec: number; sec: number; gain: number; wave: string }): Cue {
  const tones = a.notes.map((note, i) => ({ at: i * a.gapSec, sec: a.sec, note, wave: a.wave as OscillatorType, gain: a.gain }));
  return { tones, noises: [] };
}

/** A short pitched click plus a burst of noise: the phone's hinge. */
function clack(c: typeof T.audio.flipOpen | typeof T.audio.flipClose): Cue {
  return {
    tones: [{ at: 0, sec: c.sec, note: c.note, toNote: c.toNote, wave: 'square', gain: c.gain }],
    noises: [{ at: 0, sec: c.noiseSec, gain: c.noiseGain, fromHz: c.noiseHz, toHz: c.noiseHz, q: 1 }],
  };
}

/** The polyphonic ringtone: melody, bass and chord stabs on a 16th-note grid. */
function ringtone(): Cue {
  const r = T.audio.ringtone;
  const stepSec = 60 / r.bpm / 4;
  const parts: SongPart[] = [r.melody, r.bass, r.chords];
  const tones = parts.flatMap((part) =>
    part.notes.map(([step, note, len]) => ({ at: step * stepSec, sec: len * stepSec, note, wave: part.wave as OscillatorType, gain: part.gain })),
  );
  return { tones, noises: [] };
}

/** K-Bit's AirDrop: a quick upward swoosh as the file flies over, then a bright two-note "received" ping. */
function beam(): Cue {
  const b = T.audio.beam;
  const wave = b.wave as OscillatorType;
  const tones = b.pingNotes.map((note, i) => ({ at: b.pingAt + i * b.pingGapSec, sec: b.pingSec, note, wave, gain: b.pingGain }));
  const swoosh = { at: 0, sec: b.swooshSec, gain: b.swooshGain, fromHz: b.swooshFromHz, toHz: b.swooshToHz, q: b.swooshQ };
  return { tones, noises: [swoosh] };
}

/** The CD player: tray out (motor + clunk), the disc clicks in, tray in, the disc spins up, the laser seeks. */
function cdInsert(): Cue {
  const c = T.audio.cdInsert;
  const tones: Tone[] = [];
  const noises: NoiseBurst[] = [];
  for (const at of c.trays) {
    tones.push({ at, sec: c.motor.sec, note: c.motor.note, toNote: c.motor.toNote, wave: 'square', gain: c.motor.gain });
    noises.push({ at, sec: c.motor.sec, gain: c.motor.noiseGain, fromHz: c.motor.noiseHz, toHz: c.motor.noiseHz, q: 2 });
    const end = at + c.motor.sec;
    tones.push({ at: end, sec: c.clunk.sec, note: c.clunk.note, wave: 'sine', gain: c.clunk.gain });
    noises.push({ at: end, sec: c.clunk.sec, gain: c.clunk.noiseGain, fromHz: c.clunk.noiseHz, toHz: c.clunk.toHz, q: 1 });
  }
  noises.push({ at: c.click.at, sec: c.click.sec, gain: c.click.gain, fromHz: c.click.hz, toHz: c.click.hz, q: c.click.q });
  tones.push({ at: c.click.at, sec: c.click.sec, note: c.click.note, wave: 'square', gain: c.click.toneGain });
  const s = c.spin;
  tones.push({ at: s.at, sec: s.sec, note: s.fromNote, toNote: s.toNote, wave: 'sine', gain: s.gain });
  tones.push({ at: s.at, sec: s.sec, note: s.fromNote + 12, toNote: s.toNote + 12, wave: 'triangle', gain: s.gain / 3 });
  noises.push({ at: s.at, sec: s.sec, gain: s.hissGain, fromHz: s.hissFromHz, toHz: s.hissToHz, q: 0.7 });
  c.seek.notes.forEach((note, i) => tones.push({ at: c.seek.at[i] ?? 0, sec: c.seek.sec, note, wave: 'square', gain: c.seek.gain }));
  return { tones, noises };
}

/** How long the travel whoosh waits after a CD went in at `insertAt` (audio clock): it lands on the spin-up. */
export function whooshDelay(insertAt: number | null, now: number): number {
  return insertAt === null ? 0 : Math.max(0, insertAt + T.audio.cdInsert.whooshAtSec - now);
}

/** One queue phone catching the ringtone: when it starts, where it sits, and its version of the tune. */
export interface QueuePhone {
  id: string;
  delaySec: number;
  pan: number;
  cue: Cue;
}

/** The queue's phones ringing one after another, each its own 4-voice phone (an octave and a wave of its own). */
export function queueRingtones(): QueuePhone[] {
  const q = T.kbit.spread;
  const tune = ringtone();
  return q.phones.map((id, i) => ({
    id,
    delaySec: (i + 1) * q.gapSec,
    pan: q.pans[i] ?? 0,
    cue: {
      noises: [],
      tones: tune.tones.map((t) => ({
        ...t,
        note: t.note + 12 * (q.octaves[i] ?? 0),
        toNote: t.toNote === undefined ? undefined : t.toNote + 12 * (q.octaves[i] ?? 0),
        wave: (q.waves[i] ?? t.wave) as OscillatorType,
        gain: t.gain * q.gain,
      })),
    },
  }));
}

/** The remaster sting: a tape rewinding (a rising, wobbling squeal over hiss), then the play key's clunk. */
function remaster(): Cue {
  const r = T.audio.remaster;
  const stepSec = r.rewindSec / r.steps;
  const tones: Tone[] = Array.from({ length: r.steps }, (_, i) => {
    const from = r.fromNote + ((r.toNote - r.fromNote) * i) / r.steps;
    const wobble = i % 2 === 0 ? r.warble : -r.warble; // the tape's wow and flutter
    return { at: i * stepSec, sec: stepSec, note: from, toNote: from + (r.toNote - r.fromNote) / r.steps + wobble, wave: 'sawtooth', gain: r.gain };
  });
  const c = r.clunk;
  tones.push({ at: r.rewindSec, sec: c.sec, note: c.note, wave: 'sine', gain: c.gain });
  return {
    tones,
    noises: [
      { at: 0, sec: r.rewindSec, gain: r.hiss.gain, fromHz: r.hiss.fromHz, toHz: r.hiss.toHz, q: r.hiss.q },
      { at: r.rewindSec, sec: c.sec, gain: c.noiseGain, fromHz: c.noiseHz, toHz: c.toHz, q: 1 },
    ],
  };
}

/** Builds the data for one cue. */
export function buildCue(name: CueName): Cue {
  const a = T.audio;
  const k = a.keyClick;
  const click: NoiseBurst = { at: 0, sec: k.sec, gain: k.gain, fromHz: k.hz, toHz: k.hz, q: k.q }; // the key going down
  switch (name) {
    case 'beep':
      return { tones: [{ at: 0, sec: a.beep.sec, note: a.beep.note, wave: a.beep.wave, gain: a.beep.gain }], noises: [click] };
    case 'blip':
      return { tones: [{ at: 0, sec: a.blip.sec, note: a.blip.note, toNote: a.blip.toNote, wave: a.blip.wave, gain: a.blip.gain }], noises: [click] };
    case 'flip-open':
      return clack(a.flipOpen);
    case 'flip-close':
      return clack(a.flipClose);
    case 'ringtone':
      return ringtone();
    case 'whoosh':
      return { tones: [], noises: [{ at: 0, sec: a.whoosh.sec, gain: a.whoosh.gain, fromHz: a.whoosh.fromHz, toHz: a.whoosh.toHz, q: a.whoosh.q }] };
    case 'chime':
      return arpeggio(a.chime);
    case 'nope':
      return arpeggio(a.nope);
    case 'remaster':
      return remaster();
    case 'beam':
      return beam();
    case 'cd-insert':
      return cdInsert();
  }
}

/**
 * Where in the shared noise buffer a burst starts, in seconds: a fixed point picked from the burst's own
 * numbers, so different bursts (footstep variants, paper rustles) are different noise, not the same snippet.
 */
export function noiseOffset(burst: NoiseBurst, bufferSec: number): number {
  const room = Math.max(0, bufferSec - burst.sec);
  const h = Math.sin(burst.fromHz * 12.9898 + burst.toHz * 78.233 + burst.at * 37.719 + burst.sec * 4.581) * 43758.5453;
  return (h - Math.floor(h)) * room;
}

/** How long a cue lasts, in seconds. */
export function cueLength(cue: Cue): number {
  const ends = [...cue.tones, ...cue.noises].map((p) => p.at + p.sec);
  return Math.max(0, ...ends);
}

/** The most tones sounding at the same moment (a ringtone needs 3-4 to be "polyphonic"). */
export function maxPolyphony(cue: Cue): number {
  const eps = 1e-9;
  return Math.max(0, ...cue.tones.map((t) => cue.tones.filter((o) => o.at <= t.at + eps && o.at + o.sec > t.at + eps).length));
}

/** Random-looking but repeatable numbers in [0, 1) (so crackle is the same every run). */
export function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

/** Samples of vinyl-style crackle: silence with sparse random pops, about `perSec` per second. */
export function crackleSamples(length: number, sampleRate: number, perSec: number, seed: number): Float32Array {
  const out = new Float32Array(length);
  const rand = seededRandom(seed);
  const chance = perSec / sampleRate;
  for (let i = 0; i < length; i++) {
    if (rand() < chance) out[i] = (rand() * 2 - 1) * (0.5 + rand() * 0.5);
  }
  return out;
}

/** Samples of white noise in [-1, 1]. */
export function noiseSamples(length: number, seed: number): Float32Array {
  const out = new Float32Array(length);
  const rand = seededRandom(seed);
  for (let i = 0; i < length; i++) out[i] = rand() * 2 - 1;
  return out;
}
