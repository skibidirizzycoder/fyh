// look.test.ts — each 2004 moment has its own light, but always still looks like 2004 (grain, chunky pixels, dither).
import { describe, expect, it } from 'vitest';
import { content } from '../src/story/content.ts';
import { T } from '../src/tuning.ts';
import { lookFor, renderSize } from '../src/world/look.ts';

describe('scene looks', () => {
  const moments = content.cds.map((c) => c.moment);

  it('every CD moment has its own look, and they all differ', () => {
    moments.forEach((m) => expect(Object.keys(T.moments), m).toContain(m));
    const skies = moments.map((m) => lookFor('2004', m).sky);
    expect(new Set(skies).size).toBe(moments.length);
  });

  it('every past moment is grainier, more vignetted and warmer than today (red above blue)', () => {
    const today = lookFor('present', null);
    for (const m of moments) {
      const look = lookFor('2004', m);
      expect(look.grain, m).toBeGreaterThan(today.grain);
      expect(look.vignette, m).toBeGreaterThan(today.vignette);
      expect(look.tint[0], m).toBeGreaterThan(look.tint[2]);
    }
  });

  it('today ignores moments, and an unknown moment falls back to the era', () => {
    expect(lookFor('present', 'open_mic')).toEqual(lookFor('present', null));
    expect(lookFor('2004', 'nowhere')).toEqual(lookFor('2004', null));
  });

  it('each moment looks like its year: 1988 chunkier than 2002, 2017 sharp; today stays crisp', () => {
    const vhs = lookFor('2004', 'street_gig'); // 1988
    const retro = lookFor('2004', 'open_mic'); // 2002
    const phone = lookFor('2004', 'ringtone'); // 2017
    for (const look of [vhs, retro, lookFor('2004', null)]) {
      expect(look.pixelHeight).toBeGreaterThan(0);
      expect(look.colorLevels).toBeGreaterThan(1);
    }
    expect(vhs.pixelHeight).toBeLessThan(retro.pixelHeight);
    expect(vhs.colorLevels).toBeLessThan(retro.colorLevels);
    expect(vhs.grain).toBeGreaterThan(retro.grain);
    expect(phone.pixelHeight).toBe(0);
    expect(phone.colorLevels).toBe(0);
    expect(lookFor('present', null).pixelHeight).toBe(0);
    expect(lookFor('present', null).colorLevels).toBe(0);
  });
});

describe('tape and camera effects', () => {
  const vhs = lookFor('2004', 'street_gig'); // 1988
  const phone = lookFor('2004', 'ringtone'); // 2017
  const tape = (l: typeof vhs): number[] => [l.scanlines, l.chromaBleed, l.tracking];

  it('are off unless a moment turns them on', () => {
    for (const look of [lookFor('present', null), lookFor('2004', null), lookFor('2004', 'open_mic')]) {
      expect(tape(look)).toEqual([0, 0, 0]);
      expect(look.blackLevel).toBe(0);
    }
  });

  it('1988 is a worn VHS tape: faint scanlines, a little bleed, a rolling tracking band, lifted blacks', () => {
    expect(vhs.scanlines).toBeGreaterThan(0);
    expect(vhs.scanlines).toBeLessThan(0.25); // faint: the scene stays readable
    expect(vhs.chromaBleed).toBeGreaterThan(0);
    expect(vhs.chromaBleed).toBeLessThanOrEqual(2); // a little, in scene pixels
    expect(vhs.tracking).toBeGreaterThan(0);
    expect(Number.isInteger(vhs.tracking)).toBe(true); // whole scene pixels: chunky blocks stay whole
    expect(vhs.trackingSec).toBeGreaterThan(2); // slow
    expect(vhs.trackingBand).toBeGreaterThan(0);
    expect(vhs.trackingBand).toBeLessThan(0.25);
    expect(vhs.blackLevel).toBeGreaterThan(0);
    expect(vhs.blackLevel).toBeLessThan(0.15);
  });

  it('2017 is a phone camera: no tape, crushed blacks, a light vignette and a warm grade', () => {
    expect(tape(phone)).toEqual([0, 0, 0]);
    expect(phone.blackLevel).toBeLessThan(0);
    expect(phone.blackLevel).toBeGreaterThan(-0.15);
    expect(phone.vignette).toBeLessThan(lookFor('2004', null).vignette); // a touch, not the era's heavy one
    expect(phone.tint[0]).toBeGreaterThan(phone.tint[1]);
    expect(phone.tint[1]).toBeGreaterThan(phone.tint[2]);
  });
});

describe('render size', () => {
  it('pixelHeight 0 draws at the full (whole-pixel) screen size', () => {
    expect(renderSize(1280, 720, 0)).toEqual({ width: 1280, height: 720, scale: 1 });
    expect(renderSize(1600.75, 900.5, 0)).toEqual({ width: 1600, height: 900, scale: 1 });
  });

  it('scales down by a whole number, so every chunky pixel is the same size', () => {
    expect(renderSize(1920, 1080, 270)).toEqual({ width: 480, height: 270, scale: 4 });
    expect(renderSize(1280, 720, 270)).toEqual({ width: 427, height: 240, scale: 3 });
    expect(renderSize(2560, 1600, 270)).toEqual({ width: 427, height: 267, scale: 6 });
  });

  it('a window not much taller than pixelHeight stays at full resolution', () => {
    expect(renderSize(400, 300, 270)).toEqual({ width: 400, height: 300, scale: 1 });
    expect(renderSize(0, 0, 270)).toEqual({ width: 1, height: 1, scale: 1 });
  });

  it('2004 is drawn 160 to 200 lines tall on common screens (chunky, but objects still readable)', () => {
    for (const h of [720, 768, 900, 1080, 1200, 1440, 1600, 1800, 2160]) {
      const lines = renderSize(h * 16 / 9, h, T.eras['2004'].pixelHeight).height;
      expect(lines, `${h} px screen`).toBeGreaterThanOrEqual(160);
      expect(lines, `${h} px screen`).toBeLessThanOrEqual(200);
    }
  });
});
