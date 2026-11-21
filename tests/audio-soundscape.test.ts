// audio-soundscape.test.ts — each moment's background: the right scene, and sane, repeatable samples.
import { describe, expect, it } from 'vitest';
import { createAudio } from '../src/audio/audio.ts';
import { seededRandom } from '../src/audio/cues.ts';
import { babble, busArrives, clinks, iceCreamVan, sceneFor, sceneLayers, traffic, wind, type SceneId } from '../src/audio/soundscape.ts';
import { createEvents } from '../src/core/events.ts';
import { T } from '../src/tuning.ts';

const RATE = 22050;
const S = T.audio.soundscape;

const rms = (x: Float32Array, from = 0, to = x.length): number => {
  let s = 0;
  for (let i = from; i < to; i++) s += (x[i] ?? 0) ** 2;
  return Math.sqrt(s / Math.max(1, to - from));
};
const peak = (x: Float32Array): number => x.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
/** Loudness in 0.1 s windows. */
const windows = (x: Float32Array): number[] =>
  Array.from({ length: Math.floor(x.length / (RATE / 10)) }, (_, i) => rms(x, (i * RATE) / 10, ((i + 1) * RATE) / 10));

describe('which soundscape plays', () => {
  it('each moment has its own, any other 2004 moment gets the plain 2004 bed', () => {
    expect(sceneFor('present', null)).toBe('present');
    expect(sceneFor('2004', 'open_mic')).toBe('open_mic');
    expect(sceneFor('2004', 'street_gig')).toBe('street_gig');
    expect(sceneFor('2004', 'ringtone')).toBe('ringtone');
    expect(sceneFor('2004', 'some_new_moment')).toBe('2004');
  });

  it('soundscape() follows the travel event', () => {
    const events = createEvents();
    const audio = createAudio(events, { makeContext: () => null });
    expect(audio.soundscape()).toBe('present');
    events.emit('travel', { to: 'ringtone', era: '2004', moment: 'ringtone' });
    expect(audio.soundscape()).toBe('ringtone');
    events.emit('travel', { to: 'present', era: 'present', moment: null });
    expect(audio.soundscape()).toBe('present');
  });
});

describe('soundscape samples', () => {
  const n = RATE * 4;

  it('every scene layer is repeatable, makes sound and never clips', () => {
    const scenes: SceneId[] = ['open_mic', 'street_gig', 'ringtone', 'present'];
    for (const scene of scenes) {
      for (const layer of sceneLayers(scene)) {
        const a = layer.samples(n, RATE);
        expect(rms(a), `${scene}/${layer.name}`).toBeGreaterThan(0.001);
        expect(peak(a) * layer.gain, `${scene}/${layer.name}`).toBeLessThan(0.5);
        expect(layer.samples(n, RATE)).toEqual(a);
      }
    }
  });

  it('babble comes and goes like syllables (not a steady hiss)', () => {
    const w = windows(babble(n, RATE, seededRandom(1), S.open_mic.babble));
    expect(Math.max(...w) / Math.min(...w)).toBeGreaterThan(2);
  });

  it('glasses clink now and then: mostly quiet, with short bright hits', () => {
    const w = windows(clinks(n, RATE, seededRandom(2), S.open_mic.clinks));
    const quiet = w.filter((v) => v < Math.max(...w) * 0.05).length;
    expect(quiet / w.length).toBeGreaterThan(0.3);
  });

  it('traffic swells as cars pass, and the loop joins up seamlessly', () => {
    const x = traffic(n, RATE, seededRandom(3), S.street_gig.traffic);
    const w = windows(x);
    expect(Math.max(...w) / Math.min(...w)).toBeGreaterThan(1.5);
    const edge = RATE / 10;
    expect(rms(x, 0, edge) / rms(x, n - edge, n)).toBeGreaterThan(0.5); // no jump in loudness at the loop point
    expect(rms(x, 0, edge) / rms(x, n - edge, n)).toBeLessThan(2);
  });

  it('wind gusts: its loudness keeps changing', () => {
    const w = windows(wind(RATE * 8, RATE, seededRandom(5), S.ringtone.wind));
    expect(Math.max(...w) / Math.min(...w)).toBeGreaterThan(1.5);
  });

  it('the ice-cream van plays its jingle once per loop, after a pause', () => {
    const c = S.street_gig.iceCream;
    const x = iceCreamVan(n, RATE, c);
    const start = Math.round(c.startSec * RATE);
    expect(rms(x, 0, start)).toBe(0);
    expect(rms(x, start, start + Math.round(c.notes.length * c.noteSec * RATE))).toBeGreaterThan(0.1);
  });

  it('the bus growls, then ends with a bright air-brake hiss', () => {
    const b = S.ringtone.bus;
    const x = busArrives(RATE, seededRandom(9), b);
    expect(x.length).toBe(Math.round(b.sec * RATE));
    const hissFrom = x.length - Math.round(b.hissSec * RATE);
    const zeroCrossings = (from: number, to: number): number => {
      let c = 0;
      for (let i = from + 1; i < to; i++) if (Math.sign(x[i] ?? 0) !== Math.sign(x[i - 1] ?? 0)) c++;
      return c / (to - from);
    };
    expect(zeroCrossings(hissFrom, hissFrom + RATE / 10)).toBeGreaterThan(zeroCrossings(RATE / 2, RATE / 2 + RATE / 10) * 5);
  });
});
