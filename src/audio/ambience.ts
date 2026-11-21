// ambience.ts — the background sound of each era, so you can HEAR when you are.
// 2004: a soft low hum, warm muffled noise and vinyl crackle. Today: quieter, cleaner air.
// Both beds run all the time; travelling crossfades their volumes.

import { ERAS, T, type Era } from '../tuning.ts';
import { crackleSamples, noiseSamples } from './cues.ts';

export interface Ambience {
  /** Fades to an era's background sound. */
  setEra(era: Era): void;
  stop(): void;
}

/** A looping buffer source filled with the given samples. */
function loop(ctx: BaseAudioContext, samples: Float32Array): AudioBufferSourceNode {
  const buffer = ctx.createBuffer(1, samples.length, ctx.sampleRate);
  buffer.getChannelData(0).set(samples);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  return src;
}

/** Builds one era's bed (hum + filtered noise + crackle) into `bed`. Returns the sources to start. */
function buildBed(ctx: BaseAudioContext, bed: GainNode, era: Era, seed: number): AudioScheduledSourceNode[] {
  const cfg = T.audio.ambience[era];
  const length = Math.round(T.audio.ambience.loopSec * ctx.sampleRate);
  const sources: AudioScheduledSourceNode[] = [];

  const noise = loop(ctx, noiseSamples(length, seed));
  const lowpass = ctx.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.value = cfg.noiseLowpassHz;
  const noiseGain = ctx.createGain();
  noiseGain.gain.value = cfg.noiseGain;
  noise.connect(lowpass).connect(noiseGain).connect(bed);
  sources.push(noise);

  if (cfg.humGain > 0) {
    const hum = ctx.createOscillator();
    hum.frequency.value = cfg.humHz;
    const humGain = ctx.createGain();
    humGain.gain.value = cfg.humGain;
    hum.connect(humGain).connect(bed);
    sources.push(hum);
  }

  if (cfg.crackleGain > 0) {
    const crackle = loop(ctx, crackleSamples(length, ctx.sampleRate, cfg.cracklePerSec, seed + 1));
    const crackleGain = ctx.createGain();
    crackleGain.gain.value = cfg.crackleGain;
    crackle.connect(crackleGain).connect(bed);
    sources.push(crackle);
  }
  return sources;
}

/** Starts both eras' background beds, with only `era` audible. */
export function createAmbience(ctx: BaseAudioContext, out: AudioNode, era: Era): Ambience {
  const beds = new Map<Era, GainNode>();
  const sources: AudioScheduledSourceNode[] = [];
  ERAS.forEach((e, i) => {
    const bed = ctx.createGain();
    bed.gain.value = e === era ? 1 : 0;
    bed.connect(out);
    beds.set(e, bed);
    sources.push(...buildBed(ctx, bed, e, T.audio.ambience.seed + i * 10));
  });
  sources.forEach((s) => s.start());

  return {
    setEra(next) {
      const now = ctx.currentTime;
      beds.forEach((bed, e) => {
        bed.gain.cancelScheduledValues(now);
        bed.gain.setValueAtTime(bed.gain.value, now);
        bed.gain.linearRampToValueAtTime(e === next ? 1 : 0, now + T.audio.ambience.fadeSec);
      });
    },
    stop() {
      sources.forEach((s) => s.stop());
      beds.forEach((bed) => bed.disconnect());
    },
  };
}
