// look.ts — the light and colour grade of a scene: the era's look, plus the past moment's own
// time of day, weather and screen of its year (T.moments: 1988 VHS, 2002 retro pixels, 2017 sharp).

import { T, type Era } from '../tuning.ts';

export interface Look {
  sky: string;
  fogNear: number;
  fogFar: number;
  sunColor: string;
  sunIntensity: number;
  ambient: number;
  tint: readonly [number, number, number];
  saturation: number;
  grain: number;
  vignette: number;
  /** About how many lines tall the scene is drawn before it is scaled up with chunky pixels (0 = full resolution). */
  pixelHeight: number;
  /** Colour levels per channel after ordered dithering (0 = off). */
  colorLevels: number;
  /** Ink outline width in screen pixels on a 1080-line screen (0 = no outlines); see outlineWidth. */
  outlinePx: number;
  /** Ink colour of the outlines. */
  outlineColor: string;
  /** Depth edge: ink a pixel when a neighbour is this fraction nearer than the pixel's surface continues. */
  outlineDepth: number;
  /** Colour edge: ink the darker pixel when a neighbour's colour differs this much (0..1.7, 0 = off). */
  outlineColorEdge: number;
  /** Crease: ink where the surface bends by more than this many degrees (0 = off). */
  outlineCreaseDeg: number;
  /** Crease ink needs this much colour change across the crease (tone units, 0..1.7), so flat unlit things stay clean. */
  outlineCreaseTone: number;
  /** How much the lines fade in the gaps of the breakup noise (0 = solid lines). */
  outlineBreakup: number;
  /** Size of the breakup noise's patches, in screen pixels on a 1080-line screen. */
  outlineNoisePx: number;
}

/** Outline widths in the look are screen pixels on a screen this many lines tall (the unit, like metres). */
export const OUTLINE_REFERENCE_LINES = 1080;
/** Crease ink fades in from outlineCreaseDeg and is full at this many times that bend. */
export const CREASE_FULL = 1.5;

/** The size the 3D scene is drawn at, and how many screen pixels wide one scene pixel is. */
export interface RenderSize {
  width: number;
  height: number;
  scale: number;
}

const MOMENTS: Readonly<Record<string, Partial<Look>>> = T.moments;

/** The look of an era, with a 2004 moment's overrides on top. */
export function lookFor(era: Era, moment: string | null): Look {
  const base = T.eras[era];
  const own = era === '2004' && moment ? MOMENTS[moment] : undefined;
  return { ...base, ...own };
}

/**
 * The scene's render size for a screen of `width` x `height` device pixels.
 * pixelHeight 0 means full resolution. Otherwise the screen is divided by the whole number
 * nearest to height / pixelHeight, so every chunky pixel is the same size on screen.
 */
export function renderSize(width: number, height: number, pixelHeight: number): RenderSize {
  const w = Math.max(1, Math.floor(width));
  const h = Math.max(1, Math.floor(height));
  const scale = pixelHeight > 0 ? Math.max(1, Math.round(h / pixelHeight)) : 1;
  return { width: Math.ceil(w / scale), height: Math.ceil(h / scale), scale };
}

/** Screen pixels on a 1080-line screen -> scene pixels, for a screen `screenHeight` tall drawn at `scale` (see renderSize). */
export function toScenePx(px: number, screenHeight: number, scale: number): number {
  return (px * Math.max(1, screenHeight)) / OUTLINE_REFERENCE_LINES / Math.max(1, scale);
}

/**
 * The outline width in whole scene pixels (0 = off). Never thinner than one scene pixel, so in
 * 2004 the lines are exactly as chunky as the rest of the picture.
 */
export function outlineWidth(outlinePx: number, screenHeight: number, scale: number): number {
  if (outlinePx <= 0) return 0;
  return Math.max(1, Math.round(toScenePx(outlinePx, screenHeight, scale)));
}

/**
 * The crease test's offset in scene pixels for an outline `width`. Both sides of a crease get ink,
 * so half the width keeps creases about as thick as silhouettes (never under one pixel).
 */
export function creaseOffset(width: number): number {
  return width > 0 ? Math.max(1, Math.floor(width / 2)) : 0;
}
