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
}

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
