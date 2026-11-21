// ui-area.test.ts — A9: area titles pop in letter by letter like Messenger's.

import { describe, expect, it } from 'vitest';
import { T } from '../src/tuning.ts';
import { letterDelays } from '../src/ui/area.ts';

const A = T.screens.areaTitle;

describe('A9: area titles', () => {
  it('pops the letters in one after another, the last one landing at inSec (1.5 s)', () => {
    const d = letterDelays('The Square');
    expect(d).toHaveLength(10);
    expect(d[0]).toBe(0);
    d.slice(1).forEach((x, i) => expect(x).toBeGreaterThan(d[i] ?? 0));
    expect((d.at(-1) ?? 0) + A.popSec).toBeCloseTo(A.inSec);
  });

  it('holds 4 s and shrinks out in 0.35 s (the backlog spec)', () => {
    expect(A.inSec).toBe(1.5);
    expect(A.holdSec).toBe(4);
    expect(A.outSec).toBe(0.35);
  });

  it('a one-letter title still works', () => {
    expect(letterDelays('X')).toEqual([0]);
  });
});
