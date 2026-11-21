// soundscape.ts — each moment's background sounds, as plain samples (no Web Audio, so tests can check them).
// Murmuring voices, clinking glasses, passing traffic, wind, a far-off ice-cream van and a bus pulling in.
// Every generator is seeded, so the game sounds the same every run. ambience.ts loops and mixes them.

import { T, type Era } from '../tuning.ts';
import { noteHz, seededRandom } from './cues.ts';

export type Rand = () => number;

/** The moments with their own soundscape; any other 2004 moment gets the plain 2004 bed. */
export type SceneId = 'present' | 'open_mic' | 'street_gig' | 'ringtone' | '2004';

const S = T.audio.soundscape;

/** Which soundscape belongs to an era and moment. */
export function sceneFor(era: Era, moment: string | null): SceneId {
  if (era === 'present') return 'present';
  return moment === 'open_mic' || moment === 'street_gig' || moment === 'ringtone' ? moment : '2004';
}

/** A one-pole low-pass filter coefficient for a cutoff in Hz. */
function lpCoef(hz: number, sampleRate: number): number {
  return 1 - Math.exp((-2 * Math.PI * hz) / sampleRate);
}

/** Smooth random values: a new target `rateHz` times a second, glided towards. */
function wander(rand: Rand, rateHz: number, sampleRate: number): () => number {
  let value = rand();
  let target = rand();
  const k = lpCoef(rateHz, sampleRate);
  let left = 0;
  return () => {
    if (left-- <= 0) {
      target = rand();
      left = Math.round(sampleRate / rateHz);
    }
    value += (target - value) * k;
    return value;
  };
}

/** Murmuring voices: band-limited noise, each voice switching on and off in syllables. */
export function babble(n: number, sampleRate: number, rand: Rand, c: { voices: number; syllableHz: number; lowHz: number; highHz: number }): Float32Array {
  const out = new Float32Array(n);
  const lo = lpCoef(c.lowHz, sampleRate);
  const hi = lpCoef(c.highHz, sampleRate);
  for (let v = 0; v < c.voices; v++) {
    const level = wander(rand, c.syllableHz * (0.7 + rand() * 0.6), sampleRate);
    let a = 0;
    let b = 0;
    for (let i = 0; i < n; i++) {
      const x = rand() * 2 - 1;
      a += (x - a) * hi; // below highHz
      b += (a - b) * lo; // ... minus below lowHz = a band
      const syllable = Math.max(0, level() * 2 - 0.9); // on about half the time
      out[i] = (out[i] ?? 0) + ((a - b) * syllable) / Math.sqrt(c.voices);
    }
  }
  return out;
}

/** Glasses clinking now and then: short ringing tones with a few partials. */
export function clinks(n: number, sampleRate: number, rand: Rand, c: { perSec: number; minHz: number; maxHz: number; decaySec: number }): Float32Array {
  const out = new Float32Array(n);
  const count = Math.round((n / sampleRate) * c.perSec);
  const len = Math.round(c.decaySec * 3 * sampleRate);
  for (let k = 0; k < count; k++) {
    const start = Math.floor(rand() * Math.max(1, n - len));
    const hz = c.minHz + rand() * (c.maxHz - c.minHz);
    const loud = 0.4 + rand() * 0.6;
    for (let i = 0; i < len; i++) {
      const t = i / sampleRate;
      const ring = Math.sin(2 * Math.PI * hz * t) + 0.5 * Math.sin(2 * Math.PI * hz * 2.76 * t);
      out[start + i] = (out[start + i] ?? 0) + (ring / 1.5) * loud * Math.exp(-t / c.decaySec);
    }
  }
  return out;
}

/** Traffic: a low rumble that swells each time a car passes. */
export function traffic(n: number, sampleRate: number, rand: Rand, c: { carsPerSec: number; lowpassHz: number; passSec: number }): Float32Array {
  const out = new Float32Array(n);
  const k = lpCoef(c.lowpassHz, sampleRate);
  const cars = Array.from({ length: Math.max(1, Math.round((n / sampleRate) * c.carsPerSec)) }, () => rand() * n);
  const width = (c.passSec * sampleRate) / 2;
  let y = 0;
  for (let i = 0; i < n; i++) {
    y += (rand() * 2 - 1 - y) * k;
    let swell = 0.25; // distant hum, always there
    for (const at of cars) {
      const d = Math.min(Math.abs(i - at), n - Math.abs(i - at)) / width; // wraps, so the loop is seamless
      swell += Math.exp(-d * d);
    }
    out[i] = y * swell * 3;
  }
  return out;
}

/** Wind: noise through a resonant band that drifts, in slow gusts. */
export function wind(n: number, sampleRate: number, rand: Rand, c: { minHz: number; maxHz: number; gustHz: number; q: number }): Float32Array {
  const out = new Float32Array(n);
  const drift = wander(rand, c.gustHz * 2, sampleRate);
  const gust = wander(rand, c.gustHz, sampleRate);
  let low = 0;
  let band = 0;
  for (let i = 0; i < n; i++) {
    const hz = c.minHz + drift() * (c.maxHz - c.minHz);
    const f = 2 * Math.sin((Math.PI * hz) / sampleRate); // state-variable filter
    const high = rand() * 2 - 1 - low - band / c.q;
    band += f * high;
    low += f * band;
    out[i] = band * (0.3 + gust()) * 0.5;
  }
  return out;
}

/** A distant ice-cream van: its (original) jingle once per loop, with a wobbly vibrato. */
export function iceCreamVan(n: number, sampleRate: number, c: { notes: readonly number[]; noteSec: number; startSec: number; vibratoHz: number; vibrato: number }): Float32Array {
  const out = new Float32Array(n);
  const noteLen = Math.round(c.noteSec * sampleRate);
  let phase = 0;
  c.notes.forEach((note, j) => {
    const start = Math.round(c.startSec * sampleRate) + j * noteLen;
    for (let i = 0; i < noteLen && start + i < n; i++) {
      const t = (start + i) / sampleRate;
      const hz = noteHz(note) * (1 + c.vibrato * Math.sin(2 * Math.PI * c.vibratoHz * t));
      phase += (2 * Math.PI * hz) / sampleRate;
      const env = Math.min(1, i / 200, (noteLen - i) / 200);
      out[start + i] = (Math.sin(phase) + 0.3 * Math.sin(2 * phase)) * env * 0.7;
    }
  });
  return out;
}

/** A bus pulling in: engine growl rising then dying away, then the air-brake hiss. One shot. */
export function busArrives(sampleRate: number, rand: Rand, c: { sec: number; engineHz: number; hissSec: number; hissGain: number }): Float32Array {
  const n = Math.round(c.sec * sampleRate);
  const out = new Float32Array(n);
  const hissFrom = n - Math.round(c.hissSec * sampleRate);
  let phase = 0;
  let prev = 0;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const growl = Math.sin(Math.PI * Math.min(1, t * 1.25)); // up, then down as it stops
    phase += (2 * Math.PI * c.engineHz * (1 + 0.3 * growl)) / sampleRate;
    const engine = (Math.sin(phase) + 0.5 * Math.sin(2 * phase) + 0.25 * Math.sin(3 * phase)) * growl * 0.5;
    let hiss = 0;
    if (i >= hissFrom) {
      const x = rand() * 2 - 1;
      hiss = (x - prev) * c.hissGain * Math.exp((-(i - hissFrom) / sampleRate) * 4); // bright, fading
      prev = x;
    }
    out[i] = engine + hiss;
  }
  return out;
}

/** Scales samples to a fixed loudness, so a layer's `gain` in tuning.ts means the same for every sound. */
export function normalize(x: Float32Array): Float32Array {
  let sum = 0;
  for (const v of x) sum += v * v;
  const rms = Math.sqrt(sum / Math.max(1, x.length));
  if (rms > 0) for (let i = 0; i < x.length; i++) x[i] = ((x[i] ?? 0) * S.layerRms) / rms;
  return x;
}

/** One looping layer of a scene: its samples and its volume. */
export interface Layer {
  name: string;
  gain: number;
  samples(n: number, sampleRate: number): Float32Array;
}

/** The looping layers of each scene (the 2004 hum and crackle are separate, in ambience.ts). */
export function sceneLayers(scene: SceneId): Layer[] {
  return rawLayers(scene).map((l) => ({ ...l, samples: (n, sr) => normalize(l.samples(n, sr)) }));
}

function rawLayers(scene: SceneId): Layer[] {
  const rand = (salt: number): Rand => seededRandom(S.seed + salt);
  switch (scene) {
    case 'open_mic':
      return [
        { name: 'babble', gain: S.open_mic.babble.gain, samples: (n, sr) => babble(n, sr, rand(1), S.open_mic.babble) },
        { name: 'clinks', gain: S.open_mic.clinks.gain, samples: (n, sr) => clinks(n, sr, rand(2), S.open_mic.clinks) },
      ];
    case 'street_gig':
      return [
        { name: 'traffic', gain: S.street_gig.traffic.gain, samples: (n, sr) => traffic(n, sr, rand(3), S.street_gig.traffic) },
        { name: 'babble', gain: S.street_gig.babble.gain, samples: (n, sr) => babble(n, sr, rand(4), S.street_gig.babble) },
        { name: 'ice-cream', gain: S.street_gig.iceCream.gain, samples: (n, sr) => iceCreamVan(n, sr, S.street_gig.iceCream) },
      ];
    case 'ringtone':
      return [
        { name: 'wind', gain: S.ringtone.wind.gain, samples: (n, sr) => wind(n, sr, rand(5), S.ringtone.wind) },
        { name: 'traffic', gain: S.ringtone.traffic.gain, samples: (n, sr) => traffic(n, sr, rand(6), S.ringtone.traffic) },
      ];
    case 'present':
      return [{ name: 'traffic', gain: S.present.traffic.gain, samples: (n, sr) => traffic(n, sr, rand(7), S.present.traffic) }];
    default:
      return [];
  }
}
