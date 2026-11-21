// collide.ts — the player can't walk through solid props, as pure functions.
// The player is a circle on the ground (T.player.radius). Each prop that blocks becomes a
// footprint on the ground: a box -> a rectangle, a cylinder -> a circle. Which props block:
// see the `collide` section of src/tuning.ts. A move that would end inside a footprint is
// pushed back out of it, so the player slides along walls instead of stopping dead.

import { T } from '../tuning.ts';
import type { Prop } from '../world/layout.ts';

/** A point on the ground. */
export interface Spot {
  x: number;
  z: number;
}

/** What a solid prop covers on the ground. */
export type Footprint =
  | { shape: 'rect'; x: number; z: number; halfW: number; halfD: number }
  | { shape: 'circle'; x: number; z: number; r: number };

/** True when a prop is solid for the player: not walked over, not overhead, not a thin pole. */
export function blocks(p: Prop): boolean {
  const bottom = p.pos[1] - p.size[1] / 2;
  const top = p.pos[1] + p.size[1] / 2;
  if (top <= T.collide.stepHeight) return false; // the ground, cables on it
  if (bottom >= T.player.height) return false; // shop sign, roofs, high signs
  return Math.max(p.size[0], p.size[2]) >= T.collide.minWidth; // thin poles and stands
}

/** A prop's footprint: a circle for a cylinder, else its rectangle. */
export function footprintOf(p: Prop): Footprint {
  const [x, , z] = p.pos;
  if (p.shape === 'cylinder') return { shape: 'circle', x, z, r: Math.max(p.size[0], p.size[2]) / 2 };
  return { shape: 'rect', x, z, halfW: p.size[0] / 2, halfD: p.size[2] / 2 };
}

/** The footprints of the props that block, out of the props in a scene. */
export function obstaclesOf(props: readonly Prop[]): Footprint[] {
  return props.filter(blocks).map(footprintOf);
}

/** Keeps the player's centre on the ground, a radius away from its edges. */
export function onGround(s: Spot): Spot {
  const halfW = T.world.groundWidth / 2 - T.player.radius;
  const halfD = T.world.groundDepth / 2 - T.player.radius;
  return { x: clamp(s.x, -halfW, halfW), z: clamp(s.z, -halfD, halfD) };
}

/** The shortest move that takes the player at `s` out of footprint `f`, or null if they don't overlap. */
export function pushOut(s: Spot, f: Footprint): Spot | null {
  return f.shape === 'circle' ? pushOutOfCircle(s, f) : pushOutOfRect(s, f);
}

/** True when the player at `s` overlaps any footprint. */
export function overlapsAny(s: Spot, obstacles: readonly Footprint[]): boolean {
  return obstacles.some((f) => pushOut(s, f) !== null);
}

/**
 * Where the player ends up when it tries to move from `from` to `to`: on the ground and out of
 * every footprint. Pushing out only cancels the part of the move that goes into a prop, so the
 * player slides along it. If a tight corner can't be settled, the player stays where it was.
 */
export function moveTo(from: Spot, to: Spot, obstacles: readonly Footprint[]): Spot {
  const settled = settle(to, obstacles);
  return overlapsAny(settled, obstacles) && !overlapsAny(from, obstacles) ? { x: from.x, z: from.z } : settled;
}

/** Pushes a spot out of each footprint it overlaps, a few passes so corners settle, staying on the ground. */
function settle(to: Spot, obstacles: readonly Footprint[]): Spot {
  let s = onGround(to);
  for (let pass = 0; pass < T.collide.passes; pass++) {
    let pushed = false;
    for (const f of obstacles) {
      const push = pushOut(s, f);
      if (!push) continue;
      s = onGround({ x: s.x + push.x, z: s.z + push.z });
      pushed = true;
    }
    if (!pushed) break;
  }
  return s;
}

/** Push out of a circle footprint: straight away from its centre. */
function pushOutOfCircle(s: Spot, f: Footprint & { shape: 'circle' }): Spot | null {
  const dx = s.x - f.x;
  const dz = s.z - f.z;
  const d = Math.hypot(dx, dz);
  const min = T.player.radius + f.r;
  if (d >= min - T.collide.skin) return null;
  if (d === 0) return { x: 0, z: min }; // dead centre: step out towards +Z (the street)
  return { x: (dx / d) * (min - d), z: (dz / d) * (min - d) };
}

/** Push out of a rectangle footprint: away from its closest point, or out of its nearest side if inside. */
function pushOutOfRect(s: Spot, f: Footprint & { shape: 'rect' }): Spot | null {
  const r = T.player.radius;
  const [x0, x1, z0, z1] = [f.x - f.halfW, f.x + f.halfW, f.z - f.halfD, f.z + f.halfD];
  const dx = s.x - clamp(s.x, x0, x1);
  const dz = s.z - clamp(s.z, z0, z1);
  const d = Math.hypot(dx, dz);
  if (d >= r - T.collide.skin) return null;
  if (d > 0) return { x: (dx / d) * (r - d), z: (dz / d) * (r - d) };
  const exits: Spot[] = [
    { x: x0 - r - s.x, z: 0 },
    { x: x1 + r - s.x, z: 0 },
    { x: 0, z: z0 - r - s.z },
    { x: 0, z: z1 + r - s.z },
  ];
  return exits.reduce((best, e) => (Math.hypot(e.x, e.z) < Math.hypot(best.x, best.z) ? e : best));
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), hi);
}
