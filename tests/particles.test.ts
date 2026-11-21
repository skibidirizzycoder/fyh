// particles.test.ts — the motes in the air: the right kind per scene, sparse, and every position
// a pure function of game time that stays inside the box around the camera.
import { describe, expect, it } from 'vitest';
import { content } from '../src/story/content.ts';
import { T } from '../src/tuning.ts';
import { kindFor, motePosition, moteSeeds } from '../src/world/particles.ts';

const BOX = T.particles.box;
const CORNER = [-9, T.particles.floorM, -10] as const;

describe('particles', () => {
  it('dust in the warm 2004 moments, snow in December, pollen today', () => {
    expect(kindFor('2004', 'open_mic')).toBe('dust');
    expect(kindFor('2004', 'street_gig')).toBe('dust');
    expect(kindFor('2004', 'ringtone')).toBe('snow');
    expect(kindFor('present', null)).toBe('pollen');
    for (const cd of content.cds) expect(T.particles.byScene[cd.moment], cd.moment).toBeDefined();
  });

  it('are the same every run and at the same game time (deterministic)', () => {
    expect(moteSeeds(5)).toEqual(moteSeeds(5));
    const [seed] = moteSeeds(1);
    if (!seed) throw new Error('no seed');
    expect(motePosition(seed, 'snow', 12.5, CORNER, BOX)).toEqual(motePosition(seed, 'snow', 12.5, CORNER, BOX));
  });

  it('always stay inside the box, wrapping at its edges', () => {
    const seeds = moteSeeds(50);
    for (const kind of ['dust', 'snow', 'pollen'] as const) {
      for (const t of [0, 1.7, 60, 3600]) {
        for (const s of seeds) {
          const p = motePosition(s, kind, t, CORNER, BOX);
          p.forEach((v, i) => {
            expect(v, `${kind} at ${t}s`).toBeGreaterThanOrEqual(CORNER[i] ?? 0);
            expect(v, `${kind} at ${t}s`).toBeLessThan((CORNER[i] ?? 0) + (BOX[i] ?? 0));
          });
        }
      }
    }
  });

  it('snow falls, dust barely moves', () => {
    const [seed] = moteSeeds(1);
    if (!seed) throw new Error('no seed');
    const lift = (kind: 'dust' | 'snow', t: number) => motePosition(seed, kind, t, CORNER, BOX)[1];
    expect(lift('snow', 0) - lift('snow', 0.5)).toBeCloseTo(T.particles.kinds.snow.fall * seed.pace * 0.5, 6); // half a second of falling
    expect(Math.abs(lift('dust', 1) - lift('dust', 0))).toBeLessThan(0.05);
  });

  it('stay sparse: a few hundred motes at most, small and soft', () => {
    for (const k of Object.values(T.particles.kinds)) {
      expect(k.count).toBeLessThanOrEqual(300);
      expect(k.size).toBeLessThanOrEqual(0.1);
      expect(k.opacity).toBeLessThan(1);
    }
  });
});
