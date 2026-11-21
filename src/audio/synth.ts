// synth.ts — plays a Cue (from cues.ts) through the Web Audio API.
// Oscillators with short gain envelopes for tones; a shared white-noise buffer
// through a sweeping band-pass filter for noise bursts. Nodes stop themselves.

import { T } from '../tuning.ts';
import { noteHz, noiseSamples, type Cue, type NoiseBurst, type Tone } from './cues.ts';

/** A gain envelope: quick fade in, hold, quick fade out (avoids clicks). */
function envelope(ctx: BaseAudioContext, start: number, sec: number, peak: number): GainNode {
  const g = ctx.createGain();
  const attack = Math.min(T.audio.attackSec, sec / 2);
  const release = Math.min(T.audio.releaseSec, sec / 2);
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(peak, start + attack);
  g.gain.setValueAtTime(peak, start + sec - release);
  g.gain.linearRampToValueAtTime(0, start + sec);
  return g;
}

function playTone(ctx: BaseAudioContext, out: AudioNode, t0: number, tone: Tone): void {
  const start = t0 + tone.at;
  const osc = ctx.createOscillator();
  osc.type = tone.wave;
  osc.frequency.setValueAtTime(noteHz(tone.note), start);
  if (tone.toNote !== undefined) osc.frequency.exponentialRampToValueAtTime(noteHz(tone.toNote), start + tone.sec);
  osc.connect(envelope(ctx, start, tone.sec, tone.gain)).connect(out);
  osc.start(start);
  osc.stop(start + tone.sec);
}

function playNoise(ctx: BaseAudioContext, out: AudioNode, t0: number, burst: NoiseBurst, noise: AudioBuffer): void {
  const start = t0 + burst.at;
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = burst.q;
  filter.frequency.setValueAtTime(burst.fromHz, start);
  filter.frequency.exponentialRampToValueAtTime(burst.toHz, start + burst.sec);
  src.connect(filter).connect(envelope(ctx, start, burst.sec, burst.gain)).connect(out);
  src.start(start);
  src.stop(start + burst.sec);
}

/** A white-noise buffer to share between every noise burst. */
export function makeNoiseBuffer(ctx: BaseAudioContext, seconds: number, seed: number): AudioBuffer {
  const length = Math.max(1, Math.round(seconds * ctx.sampleRate));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  buffer.getChannelData(0).set(noiseSamples(length, seed));
  return buffer;
}

/** Schedules every tone and noise burst of a cue, starting `delaySec` from now. */
export function playCue(ctx: BaseAudioContext, out: AudioNode, cue: Cue, noise: AudioBuffer, delaySec = 0): void {
  const t0 = ctx.currentTime + delaySec;
  cue.tones.forEach((tone) => playTone(ctx, out, t0, tone));
  cue.noises.forEach((burst) => playNoise(ctx, out, t0, burst, noise));
}
