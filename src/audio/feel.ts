// feel.ts — the small sounds that make every action feel physical: footsteps, paper, the camera
// moving in, and "voices" made of short blips (one pitch per speaker, a different note per letter).
// Pure data like cues.ts (synth.ts plays it), so tests can check it. Numbers: T.audio.feel.

import { T } from '../tuning.ts';
import { seededRandom, type Cue } from './cues.ts';

const F = T.audio.feel;

export type Speaker = keyof typeof F.voice.speakers;
export const SPEAKERS = Object.keys(F.voice.speakers) as Speaker[];

/** Who is talking: the event's speaker if it names one, else whoever belongs to the moment (today: the owner). */
export function speakerFor(moment: string | null, speaker?: string | null): Speaker {
  // Object.hasOwn, not `in`: "toString" or "constructor" must not count as a speaker.
  if (speaker && Object.hasOwn(F.voice.speakers, speaker)) return speaker as Speaker;
  const byMoment: Readonly<Record<string, string>> = F.voice.byMoment;
  const who = moment && Object.hasOwn(byMoment, moment) ? byMoment[moment] : undefined;
  return who && Object.hasOwn(F.voice.speakers, who) ? (who as Speaker) : 'owner';
}

/** Footstep number `i`: a scuff of noise plus a low thump, cycling through a few variants, each a bit off-pitch. */
export function footstepCue(i: number): Cue {
  const s = F.step;
  const variant = ((i % s.variants) + s.variants) % s.variants;
  const rand = seededRandom(F.seed + variant);
  const pitch = 1 + (rand() * 2 - 1) * s.pitchJitter;
  return {
    tones: [{ at: 0, sec: s.sec, note: s.thumpNote + 12 * Math.log2(pitch), wave: 'sine', gain: s.thumpGain }],
    noises: [{ at: 0, sec: s.sec * (0.8 + rand() * 0.4), gain: s.gain, fromHz: s.fromHz * pitch, toHz: s.toHz * pitch, q: s.q }],
  };
}

/** Paper being opened: a few quick rustles at random brightness. */
export function paperCue(seed = 0): Cue {
  const p = F.paper;
  const rand = seededRandom(F.seed + 100 + seed);
  const noises = Array.from({ length: p.rustles }, (_, i) => {
    const hz = p.minHz + rand() * (p.maxHz - p.minHz);
    return { at: i * p.gapSec, sec: p.sec, gain: p.gain * (0.6 + rand() * 0.4), fromHz: hz, toHz: hz * (0.7 + rand() * 0.6), q: p.q };
  });
  return { tones: [], noises };
}

/** The camera easing in (rising whoosh) or back out (falling). */
export function zoomCue(zoomIn: boolean): Cue {
  const z = F.zoom;
  const [fromHz, toHz] = zoomIn ? [z.lowHz, z.highHz] : [z.highHz, z.lowHz];
  return { tones: [], noises: [{ at: 0, sec: z.sec, gain: z.gain, fromHz, toHz, q: z.q }] };
}

/** Roughly one blip per syllable: each run of vowels starts one. */
export function syllables(line: string): string[] {
  return line.toLowerCase().match(/[^aeiouy\s]*[aeiouy]+/g) ?? [];
}

/** A line "spoken" as blips: the speaker's note plus a step picked by each syllable's letters. Same line = same tune. */
export function voiceCue(line: string, speaker: Speaker): Cue {
  const v = F.voice;
  const who = v.speakers[speaker];
  const tones = syllables(line).slice(0, v.maxBlips).map((syl, i) => {
    const code = [...syl].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
    return { at: i * v.gapSec, sec: v.blipSec, note: who.note + (code % (v.spread + 1)), wave: who.wave as OscillatorType, gain: v.gain };
  });
  return { tones, noises: [] };
}
