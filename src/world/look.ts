// look.ts — the light and colour grade of a scene: the era's look, plus the 2004 moment's own
// time of day and weather (T.moments). Every moment keeps 2004's grain and vignette.

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
}

const MOMENTS: Readonly<Record<string, Partial<Look>>> = T.moments;

/** The look of an era, with a 2004 moment's overrides on top. */
export function lookFor(era: Era, moment: string | null): Look {
  const base = T.eras[era];
  const own = era === '2004' && moment ? MOMENTS[moment] : undefined;
  return { ...base, ...own };
}
