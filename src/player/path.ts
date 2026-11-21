// path.ts — finds a way around solid props to an interactable, as pure functions.
// The debug walkTo() (src/debug.ts) follows the route with real key presses, and
// tests/collide.test.ts uses it to prove every interactable can be reached in every scene.
// Straight at the target when nothing is in the way; otherwise a breadth-first search over a
// grid of spots T.collide.pathCell apart (a spot is free when the player fits there),
// straightened into a few clear lines.

import { angleToTarget, yawFromForward } from '../core/facing.ts';
import { T } from '../tuning.ts';
import { onGround, overlapsAny, type Footprint, type Spot } from './collide.ts';
import { wrapDegrees, type PlayerState } from './controller.ts';

/** One key's worth of steering: turn left (A), turn right (D) or walk forward (W). */
export type Steer = 'left' | 'right' | 'walk';

/** True when the player can walk in a straight line from a to b (b included) without overlapping anything. */
export function lineClear(a: Spot, b: Spot, obstacles: readonly Footprint[]): boolean {
  const near = obstacles.filter((f) => reachesBox(f, Math.min(a.x, b.x), Math.max(a.x, b.x), Math.min(a.z, b.z), Math.max(a.z, b.z)));
  const steps = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / (T.collide.pathCell / 2));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    if (overlapsAny({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t }, near)) return false;
  }
  return true;
}

/** True when a footprint, grown by the player's radius, reaches into the box x0..x1, z0..z1 (only those can block in it). */
function reachesBox(f: Footprint, x0: number, x1: number, z0: number, z1: number): boolean {
  const [halfW, halfD] = f.shape === 'circle' ? [f.r, f.r] : [f.halfW, f.halfD];
  const r = T.player.radius;
  return f.x + halfW + r >= x0 && f.x - halfW - r <= x1 && f.z + halfD + r >= z0 && f.z - halfD - r <= z1;
}

/** The footprints that can block in each 1 m strip of x, so a grid spot only checks the few props near it. */
function stripsOf(obstacles: readonly Footprint[]): (x: number) => readonly Footprint[] {
  const strips = new Map<number, Footprint[]>();
  for (const f of obstacles) {
    const half = f.shape === 'circle' ? f.r : f.halfW;
    for (let k = Math.floor(f.x - half - T.player.radius); k <= Math.floor(f.x + half + T.player.radius); k++) {
      strips.set(k, [...(strips.get(k) ?? []), f]);
    }
  }
  return (x) => strips.get(Math.floor(x)) ?? [];
}

/** True when the player at `s` is close enough to use something at `target` (with a margin). */
export function inReach(s: Spot, target: Spot): boolean {
  return Math.hypot(target.x - s.x, target.z - s.z) <= reach();
}

/**
 * Waypoints from `from` to a free spot in reach of `target`, joined by clear straight lines.
 * Empty when `from` is already in reach; null when no free spot in reach can be walked to.
 */
export function findRoute(from: Spot, target: Spot, obstacles: readonly Footprint[]): Spot[] | null {
  if (inReach(from, target)) return [];
  const direct = reachPointOnLine(from, target);
  if (lineClear(from, direct, obstacles)) return [direct]; // nothing in the way: straight at it
  const cells = searchGrid(from, target, obstacles);
  return cells && straighten(from, cells, obstacles);
}

/** How far from a target's centre a route ends. */
function reach(): number {
  return T.player.interactRange - T.collide.reachMargin;
}

/** The spot on the line from `from` to `target` that is just in reach of the target. */
function reachPointOnLine(from: Spot, target: Spot): Spot {
  const d = Math.hypot(target.x - from.x, target.z - from.z);
  const k = (d - reach()) / d;
  return { x: from.x + (target.x - from.x) * k, z: from.z + (target.z - from.z) * k };
}

/** The walkable grid: spots T.collide.pathCell apart covering the ground the player's centre can reach. */
interface Grid {
  cols: number;
  rows: number;
  corner: Spot; // the spot with index 0 (smallest x and z)
}

function makeGrid(): Grid {
  const corner = onGround({ x: -Infinity, z: -Infinity });
  const far = onGround({ x: Infinity, z: Infinity });
  const cols = Math.floor((far.x - corner.x) / T.collide.pathCell) + 1;
  const rows = Math.floor((far.z - corner.z) / T.collide.pathCell) + 1;
  return { cols, rows, corner };
}

function spotOf(g: Grid, i: number): Spot {
  return { x: g.corner.x + (i % g.cols) * T.collide.pathCell, z: g.corner.z + Math.floor(i / g.cols) * T.collide.pathCell };
}

/** The grid index nearest to a spot. */
function indexNear(g: Grid, s: Spot): number {
  const col = Math.min(g.cols - 1, Math.max(0, Math.round((s.x - g.corner.x) / T.collide.pathCell)));
  const row = Math.min(g.rows - 1, Math.max(0, Math.round((s.z - g.corner.z) / T.collide.pathCell)));
  return row * g.cols + col;
}

/** Neighbouring indices (8 ways); a diagonal only when both sides of it are free, so it never cuts a corner. */
function neighbours(g: Grid, i: number, isFree: (j: number) => boolean): number[] {
  const col = i % g.cols;
  const row = Math.floor(i / g.cols);
  const inGrid = (c: number, r: number): boolean => c >= 0 && c < g.cols && r >= 0 && r < g.rows;
  const out: number[] = [];
  for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] as const) {
    const [c, r] = [col + dc, row + dr];
    if (!inGrid(c, r)) continue;
    const diagonal = dc !== 0 && dr !== 0;
    if (diagonal && !(isFree(row * g.cols + c) && isFree(r * g.cols + col))) continue;
    out.push(r * g.cols + c);
  }
  return out;
}

/** Breadth-first search from the grid spot nearest `from` to the nearest free spot in reach. Spots, start excluded. */
function searchGrid(from: Spot, target: Spot, obstacles: readonly Footprint[]): Spot[] | null {
  const g = makeGrid();
  const near = stripsOf(obstacles);
  const state = new Int8Array(g.cols * g.rows); // 0 = not checked yet, 1 = free, 2 = blocked
  const isFree = (j: number): boolean => {
    const spot = spotOf(g, j);
    if (state[j] === 0) state[j] = overlapsAny(spot, near(spot.x)) ? 2 : 1;
    return state[j] === 1;
  };
  const start = indexNear(g, from);
  const parent = new Int32Array(g.cols * g.rows).fill(-1);
  parent[start] = start;
  const queue = [start];
  for (let head = 0; head < queue.length; head++) {
    const i = queue[head] ?? start;
    if (isFree(i) && inReach(spotOf(g, i), target)) return pathBack(parent, start, i).map((j) => spotOf(g, j));
    for (const j of neighbours(g, i, isFree)) {
      if (parent[j] !== -1 || !isFree(j)) continue;
      parent[j] = i;
      queue.push(j);
    }
  }
  return null;
}

/** Indices from just after `start` to `end`, following parents back (just [end] if end is the start). */
function pathBack(parent: Int32Array, start: number, end: number): number[] {
  const path: number[] = [];
  for (let i = end; i !== start; i = parent[i] ?? start) path.push(i);
  return path.length > 0 ? path.reverse() : [end];
}

/** Skips every grid spot a clear straight line can jump over, so the route has few turns. */
function straighten(from: Spot, cells: readonly Spot[], obstacles: readonly Footprint[]): Spot[] {
  const route: Spot[] = [];
  let at = from;
  for (let i = 0; i < cells.length; ) {
    let j = cells.length - 1;
    while (j > i && !lineClear(at, cells[j] ?? at, obstacles)) j--;
    at = cells[j] ?? at;
    route.push(at);
    i = j + 1;
  }
  return route;
}

/**
 * How to steer along a route to `target` with tank controls: turn until facing the next
 * point, then walk. Drops the points already reached from `route`; after the last one it
 * heads for the target itself (so the player ends up facing it).
 */
export function steerAlong(p: PlayerState, route: Spot[], target: Spot): Steer {
  while (route[0] && Math.hypot(route[0].x - p.x, route[0].z - p.z) <= T.collide.waypointReached) route.shift();
  const aim = route[0] ?? target;
  if (angleToTarget(p.yawDeg, p, aim) <= T.collide.aimToleranceDeg) return 'walk';
  const turn = wrapDegrees(yawFromForward({ x: aim.x - p.x, z: aim.z - p.z }) - p.yawDeg);
  return turn > 0 ? 'left' : 'right';
}

