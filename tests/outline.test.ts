// outline.test.ts — ink outlines: on in both eras, a dark blue-grey ink, about 2 px at 1080p today
// and exactly one chunky pixel in 2004 (src/world/look.ts, drawn in src/world/post.ts).
import { describe, expect, it } from 'vitest';
import { Color } from 'three';
import { content } from '../src/story/content.ts';
import { ERAS, T } from '../src/tuning.ts';
import { creaseOffset, lookFor, outlineWidth, renderSize, toScenePx } from '../src/world/look.ts';

const SCREENS = [720, 768, 900, 1080, 1200, 1440, 1600, 1800, 2160];

describe('outline width', () => {
  it('0 turns the outlines off', () => {
    expect(outlineWidth(0, 1080, 1)).toBe(0);
    expect(outlineWidth(-1, 1080, 1)).toBe(0);
  });

  it('scales with the screen height, in whole pixels, never thinner than one', () => {
    expect(outlineWidth(2, 1080, 1)).toBe(2);
    expect(outlineWidth(2, 720, 1)).toBe(1);
    expect(outlineWidth(2, 1440, 1)).toBe(3);
    expect(outlineWidth(2, 2160, 1)).toBe(4);
    expect(outlineWidth(2, 100, 1)).toBe(1);
  });

  it('is measured in scene pixels: a scene drawn at scale s needs s times fewer', () => {
    expect(toScenePx(6, 1080, 6)).toBe(1);
    expect(toScenePx(72, 1080, 1)).toBe(72);
    expect(toScenePx(72, 720, 4)).toBe(12);
  });

  it('today is about 2 px at 1080p and grows with the screen', () => {
    const today = lookFor('present', null);
    expect(outlineWidth(today.outlinePx, 1080, 1)).toBe(2);
    let last = 0;
    for (const h of SCREENS) {
      const w = outlineWidth(today.outlinePx, h, renderSize(h * 16 / 9, h, today.pixelHeight).scale);
      expect(w, `${h} px screen`).toBeGreaterThanOrEqual(last);
      last = w;
    }
  });

  it('2004 (every moment) is exactly one chunky pixel wide on common screens', () => {
    for (const m of [null, ...content.cds.map((c) => c.moment)]) {
      const look = lookFor('2004', m);
      for (const h of SCREENS) {
        const { scale } = renderSize(h * 16 / 9, h, look.pixelHeight);
        expect(outlineWidth(look.outlinePx, h, scale), `${String(m)} at ${h} px`).toBe(1);
      }
    }
  });
});

describe('crease offset', () => {
  it('is half the outline width (both sides of a crease get ink), at least one pixel, 0 when off', () => {
    expect(creaseOffset(0)).toBe(0);
    expect(creaseOffset(1)).toBe(1);
    expect(creaseOffset(2)).toBe(1);
    expect(creaseOffset(3)).toBe(1);
    expect(creaseOffset(4)).toBe(2);
  });
});

describe('outline look', () => {
  it('every era draws outlines with a dark blue-grey ink, never pure black', () => {
    for (const era of ERAS) {
      const look = T.eras[era];
      expect(look.outlinePx, era).toBeGreaterThan(0);
      const ink = new Color(look.outlineColor);
      expect(ink.getHex(), era).not.toBe(0x000000);
      const hsl = ink.getHSL({ h: 0, s: 0, l: 0 });
      expect(hsl.l, `${era}: ink lightness`).toBeLessThan(0.3);
      expect(ink.b, `${era}: ink is blue-grey`).toBeGreaterThanOrEqual(ink.r);
    }
  });

  it('the edge thresholds and breakup are in range', () => {
    for (const era of ERAS) {
      const look = T.eras[era];
      expect(look.outlineDepth, era).toBeGreaterThan(0);
      expect(look.outlineDepth, era).toBeLessThan(0.5);
      expect(look.outlineColorEdge, era).toBeGreaterThanOrEqual(0);
      expect(look.outlineColorEdge, era).toBeLessThan(Math.sqrt(3));
      expect(look.outlineCreaseDeg, era).not.toBeLessThan(0);
      if (look.outlineCreaseDeg > 0) expect(look.outlineCreaseDeg, `${era}: creases must skip the 22.5° facets of round props`).toBeGreaterThan(360 / 16);
      expect(look.outlineCreaseDeg, era).toBeLessThan(90);
      expect(look.outlineBreakup, era).toBeGreaterThanOrEqual(0);
      expect(look.outlineBreakup, `${era}: lines must not vanish completely`).toBeLessThan(1);
      expect(toScenePx(look.outlineNoisePx, 1080, 1), `${era}: noise patches much wider than the lines`)
        .toBeGreaterThan(4 * toScenePx(look.outlinePx, 1080, 1));
    }
  });
});
