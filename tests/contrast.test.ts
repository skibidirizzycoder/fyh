// contrast.test.ts — the contrast maths the smoke test uses on real pixels.
import { describe, expect, it } from 'vitest';
import { contrastRatio, measureTextContrast } from '../src/core/contrast.ts';

describe('contrast', () => {
  it('black on white is 21:1, a colour on itself is 1:1', () => {
    expect(contrastRatio([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 5);
    expect(contrastRatio([90, 90, 90], [90, 90, 90])).toBe(1);
  });

  it('mid grey #777 on white is just under 4.5:1', () => {
    expect(contrastRatio([0x77, 0x77, 0x77], [255, 255, 255])).toBeLessThan(4.5);
  });

  it('measures text against the most common (background) colour', () => {
    const bg = [20, 20, 20, 255];
    const fg = [240, 240, 240, 255];
    const pixels = [...bg, ...bg, ...bg, ...fg];
    const m = measureTextContrast(pixels);
    expect(m.background).toEqual([20, 20, 20]);
    expect(m.text).toEqual([240, 240, 240]);
    expect(m.ratio).toBeGreaterThan(15);
  });
});
