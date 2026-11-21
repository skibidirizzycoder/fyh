// helpers.ts — shared measurements and helpers for placing props.
// Use standOn / mountOn so touching surfaces keep a gap (no z-fighting).

import { T, type Era } from '../../tuning.ts';

export const GAP = T.world.surfaceGap;
export const BOTH: readonly Era[] = ['2004', 'present'];
export const PAST: readonly Era[] = ['2004'];
export const NOW: readonly Era[] = ['present'];

export const WALL_FRONT_Z = -5; // front face of the shop wall (the shop faces +Z, towards the player)
export const DOOR_DEPTH = 0.1;
export const PLACEHOLDER_COLOR = '#ff00ff'; // bright magenta: "this prop is a placeholder"

/** Centre y for something of height h standing on top of a surface at height `top` (the ground is 0). */
export function standOn(top: number, h: number): number {
  return top + GAP + h / 2;
}

/** Centre z for something of depth d mounted on the front of a surface whose front is at z. */
export function mountOn(frontZ: number, d: number): number {
  return frontZ + GAP + d / 2;
}

export const BENCH_TOP = standOn(0, 0.5) + 0.25; // the bench is 0.5 high
export const POST_TOP = standOn(0, 1.3) + 0.65; // the listening post is 1.3 high
export const BOARD_FRONT = 0.5 + 0.075; // front face of the noticeboard
export const DOOR_FRONT = mountOn(WALL_FRONT_Z, DOOR_DEPTH) + DOOR_DEPTH / 2;
