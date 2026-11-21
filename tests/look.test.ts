// look.test.ts — each 2004 moment has its own light, but always still looks like 2004.
import { describe, expect, it } from 'vitest';
import { content } from '../src/story/content.ts';
import { T } from '../src/tuning.ts';
import { lookFor } from '../src/world/look.ts';

describe('scene looks', () => {
  const moments = content.cds.map((c) => c.moment);

  it('every CD moment has its own look, and they all differ', () => {
    moments.forEach((m) => expect(Object.keys(T.moments), m).toContain(m));
    const skies = moments.map((m) => lookFor('2004', m).sky);
    expect(new Set(skies).size).toBe(moments.length);
  });

  it('every moment keeps 2004\'s grain, vignette and warm grade (red above blue)', () => {
    for (const m of moments) {
      const look = lookFor('2004', m);
      expect(look.grain, m).toBe(T.eras['2004'].grain);
      expect(look.vignette, m).toBe(T.eras['2004'].vignette);
      expect(look.tint[0], m).toBeGreaterThan(look.tint[2]);
    }
  });

  it('today ignores moments, and an unknown moment falls back to the era', () => {
    expect(lookFor('present', 'open_mic')).toEqual(lookFor('present', null));
    expect(lookFor('2004', 'nowhere')).toEqual(lookFor('2004', null));
  });
});
