// cues.ts — every sound effect described as plain data (tones and noise bursts).
// Pure functions, no Web Audio, so tests can check them. synth.ts plays them.
// All numbers come from the `audio` section of src/tuning.ts.

import { T } from '../tuning.ts';

export type CueName = 'beep' | 'blip' | 'flip-open' | 'flip-close' | 'ringtone' | 'whoosh' | 'chime' | 'nope' | 'fanfare';

export const CUE_NAMES: readonly CueName[] = ['beep', 'blip', 'flip-open', 'flip-close', 'ringtone', 'whoosh', 'chime', 'nope', 'fanfare'];

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

/** Builds the data for one cue. */
export function buildCue(name: CueName): Cue {
  const a = T.audio;
  switch (name) {
    case 'beep':
      return { tones: [{ at: 0, sec: a.beep.sec, note: a.beep.note, wave: a.beep.wave, gain: a.beep.gain }], noises: [] };
    case 'blip':
      return { tones: [{ at: 0, sec: a.blip.sec, note: a.blip.note, toNote: a.blip.toNote, wave: a.blip.wave, gain: a.blip.gain }], noises: [] };
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
    case 'fanfare':
      return arpeggio(a.fanfare);
  }
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
