// controller.ts — third-person "tank" controls, as pure functions.
// W/S move along the facing, A/D turn. Facing comes ONLY from yawDeg
// (see core/facing.ts), so movement, the avatar's nose and the camera agree.
// Walking and turning ease in and out: the speed ramps up evenly when you press a key
// and back down when you let go (T.player.accelSec, decelSec, turnAccelSec, turnDecelSec).
// Solid props stop the player and it slides along them (see collide.ts).

import { angleToTarget, forwardFromYaw } from '../core/facing.ts';
import { T } from '../tuning.ts';
import { moveTo, type Footprint } from './collide.ts';

export interface PlayerState {
  x: number;
  z: number;
  yawDeg: number;
  speed?: number; // metres per second along the facing right now (negative = backwards); missing = standing
  turnRate?: number; // degrees per second right now (positive = turning left); missing = not turning
}

export interface MoveInput {
  forward: boolean;
  back: boolean;
  turnLeft: boolean;
  turnRight: boolean;
  run?: boolean; // Shift: walking speed times T.player.runMultiplier
}

/** Where the player starts: standing still. */
export function startPlayer(): PlayerState {
  return { x: T.player.startX, z: T.player.startZ, yawDeg: T.player.startYawDeg, speed: 0, turnRate: 0 };
}

/**
 * Moves `current` towards `wanted` by one step of an even ramp: speeding up takes `upSec`
 * from 0 to `full`; slowing down (or turning round) takes `downSec` from `full` to 0.
 */
export function ease(current: number, wanted: number, full: number, upSec: number, downSec: number, dt: number): number {
  const sameWay = Math.sign(wanted) !== -Math.sign(current); // standing still counts as the same way
  const speedingUp = wanted !== 0 && sameWay && Math.abs(wanted) > Math.abs(current);
  const maxChange = (full / (speedingUp ? upSec : downSec)) * dt;
  if (Math.abs(wanted - current) <= maxChange + T.player.easeSnap) return wanted;
  return current + Math.sign(wanted - current) * maxChange;
}

/** Advances the player by one fixed step of `dt` seconds; it stays on the ground and out of `obstacles`. */
export function stepPlayer(p: PlayerState, input: MoveInput, dt: number, obstacles: readonly Footprint[] = []): PlayerState {
  const P = T.player;
  const turnWanted = ((input.turnLeft ? 1 : 0) - (input.turnRight ? 1 : 0)) * P.turnSpeedDeg;
  const turnRate = ease(p.turnRate ?? 0, turnWanted, P.turnSpeedDeg, P.turnAccelSec, P.turnDecelSec, dt);
  const yawDeg = wrapDegrees(p.yawDeg + turnRate * dt);
  const top = P.speed * (input.run ? P.runMultiplier : 1);
  const speedWanted = ((input.forward ? 1 : 0) - (input.back ? 1 : 0)) * top;
  const speed = ease(p.speed ?? 0, speedWanted, top, P.accelSec, P.decelSec, dt);
  const f = forwardFromYaw(yawDeg);
  const to = { x: p.x + f.x * speed * dt, z: p.z + f.z * speed * dt };
  return { ...moveTo(p, to, obstacles), yawDeg, speed, turnRate };
}

export interface Target {
  id: string;
  x: number;
  z: number;
}

/** The closest target in range and in front of the player, or null. */
export function pickTarget(p: PlayerState, targets: readonly Target[]): string | null {
  let best: string | null = null;
  let bestDist = Infinity;
  for (const t of targets) {
    const dist = Math.hypot(t.x - p.x, t.z - p.z);
    const inCone = angleToTarget(p.yawDeg, p, t) <= T.player.interactConeDeg;
    if (dist <= T.player.interactRange && inCone && dist < bestDist) {
      best = t.id;
      bestDist = dist;
    }
  }
  return best;
}

/** Keeps an angle in (-180, 180]. */
export function wrapDegrees(deg: number): number {
  const d = ((((deg + 180) % 360) + 360) % 360) - 180;
  return d === -180 ? 180 : d;
}
