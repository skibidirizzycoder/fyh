// ambience.ts — the background sound, so you can HEAR when and where you are.
// Era beds: 2004 = a soft low hum, warm muffled noise and vinyl crackle; today = quieter, cleaner air.
// Scene beds on top (soundscape.ts): pub murmur, summer street, December wind, modern traffic.
// Beds are built the first time they are needed, then crossfaded when you travel.

import { ERAS, T, type Era } from '../tuning.ts';
import { crackleSamples, noiseSamples, seededRandom } from './cues.ts';
import { busArrives, sceneLayers, type SceneId } from './soundscape.ts';

export interface Ambience {
  /** Fades to an era's background sound. */
  setEra(era: Era): void;
  /** Fades to a moment's soundscape (and lets the bus pull in at the bus stop). */
  setScene(scene: SceneId): void;
  /** Turns the whole background down while a song plays (T.audio.ambience.underMusic), so the song is heard. */
  setUnderMusic(on: boolean): void;
  stop(): void;
}

/** A looping buffer source filled with the given samples. */
function loop(ctx: BaseAudioContext, samples: Float32Array, sampleRate = ctx.sampleRate): AudioBufferSourceNode {
  const buffer = ctx.createBuffer(1, samples.length, sampleRate);
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

/** Builds a scene's looping layers into a new bed (volume 0). Returns the bed and its sources. */
function buildScene(ctx: BaseAudioContext, out: AudioNode, scene: SceneId): { bed: GainNode; sources: AudioScheduledSourceNode[] } {
  const bed = ctx.createGain();
  bed.gain.value = 0;
  bed.connect(out);
  const rate = Math.min(ctx.sampleRate, T.audio.soundscape.sampleRate); // the context resamples it
  const n = Math.round(T.audio.soundscape.loopSec * rate);
  const sources = sceneLayers(scene).map((layer) => {
    const src = loop(ctx, layer.samples(n, rate), rate);
    const g = ctx.createGain();
    g.gain.value = layer.gain;
    src.connect(g).connect(bed);
    src.start();
    return src;
  });
  return { bed, sources };
}

/** Plays the bus pulling in, once, a moment after you arrive. */
function playBus(ctx: BaseAudioContext, out: AudioNode): AudioBufferSourceNode {
  const b = T.audio.soundscape.ringtone.bus;
  const samples = busArrives(ctx.sampleRate, seededRandom(T.audio.soundscape.seed + 99), b);
  const buffer = ctx.createBuffer(1, samples.length, ctx.sampleRate);
  buffer.getChannelData(0).set(samples);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const g = ctx.createGain();
  g.gain.value = b.gain;
  src.connect(g).connect(out);
  src.start(ctx.currentTime + b.delaySec);
  return src;
}

/** Starts both eras' background beds, with only `era` audible. */
export function createAmbience(ctx: BaseAudioContext, out: AudioNode, era: Era): Ambience {
  const beds = new Map<Era, GainNode>();
  const sources: AudioScheduledSourceNode[] = [];
  const level = ctx.createGain(); // everything below goes through this: ducked while a song plays
  level.connect(out);
  let under = false;
  ERAS.forEach((e, i) => {
    const bed = ctx.createGain();
    bed.gain.value = e === era ? 1 : 0;
    bed.connect(level);
    beds.set(e, bed);
    sources.push(...buildBed(ctx, bed, e, T.audio.ambience.seed + i * 10));
  });
  sources.forEach((s) => s.start());
  const scenes = new Map<SceneId, GainNode>();
  let current: SceneId | null = null;

  return {
    setScene(next) {
      if (next === current) return;
      current = next;
      const now = ctx.currentTime;
      if (!scenes.has(next)) {
        const built = buildScene(ctx, level, next);
        scenes.set(next, built.bed);
        sources.push(...built.sources);
      }
      scenes.forEach((bed, id) => {
        bed.gain.cancelScheduledValues(now);
        bed.gain.setValueAtTime(bed.gain.value, now);
        bed.gain.linearRampToValueAtTime(id === next ? 1 : 0, now + T.audio.soundscape.fadeSec);
      });
      if (next === 'ringtone') sources.push(playBus(ctx, level));
    },
    setUnderMusic(on) {
      if (on === under) return;
      under = on;
      const now = ctx.currentTime;
      level.gain.cancelScheduledValues(now);
      level.gain.setValueAtTime(level.gain.value, now);
      level.gain.linearRampToValueAtTime(on ? T.audio.ambience.underMusic : 1, now + T.audio.ambience.fadeSec);
    },
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
      scenes.forEach((bed) => bed.disconnect());
      level.disconnect();
    },
  };
}
