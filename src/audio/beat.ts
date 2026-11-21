// beat.ts — the modern remix's drum loop, made in code: one bar of 4/4 at a song's bpm.
// A kick on every beat (four on the floor) and a hi-hat on every off-beat.
// Pure sample maths (no Web Audio), so tests can check it; music.ts loops the result.

import { T } from '../tuning.ts';
import { seededRandom } from './cues.ts';

const BEATS_PER_BAR = 4;

/** Length of one bar in seconds. */
export function barSec(bpm: number): number {
  return (BEATS_PER_BAR * 60) / bpm;
}

/** Adds a kick drum at sample `start`: a sine that drops in pitch and fades out. */
function addKick(out: Float32Array, start: number, sampleRate: number): void {
  const b = T.audio.music.beat;
  const n = Math.round(b.kickSec * sampleRate);
  let phase = 0;
  for (let i = 0; i < n && start + i < out.length; i++) {
    const t = i / n;
    const hz = b.kickHz * (b.kickEndHz / b.kickHz) ** t; // exponential pitch drop
    phase += (2 * Math.PI * hz) / sampleRate;
    out[start + i] = (out[start + i] ?? 0) + Math.sin(phase) * b.kickGain * (1 - t) ** 2;
  }
}

/** Adds a hi-hat at sample `start`: a very short burst of bright (high-passed) noise. */
function addHat(out: Float32Array, start: number, sampleRate: number, rand: () => number): void {
  const b = T.audio.music.beat;
  const n = Math.round(b.hatSec * sampleRate);
  let prev = 0;
  for (let i = 0; i < n && start + i < out.length; i++) {
    const noise = rand() * 2 - 1;
    const bright = (noise - prev) / 2; // first difference: keeps the hiss, drops the rumble
    prev = noise;
    out[start + i] = (out[start + i] ?? 0) + bright * b.hatGain * (1 - i / n) ** 3;
  }
}

/** One bar of kick + hi-hat at `bpm`, as mono samples. Loop it for a steady beat. */
export function beatBar(bpm: number, sampleRate: number): Float32Array {
  const beat = Math.round((60 / bpm) * sampleRate);
  const out = new Float32Array(beat * BEATS_PER_BAR);
  const rand = seededRandom(T.audio.music.beat.seed);
  for (let i = 0; i < BEATS_PER_BAR; i++) {
    addKick(out, i * beat, sampleRate);
    addHat(out, i * beat + Math.round(beat / 2), sampleRate, rand);
  }
  return out;
}
