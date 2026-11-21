// controller.ts — third-person "tank" controls, as pure functions.
// W/S move along the facing, A/D turn. Facing comes ONLY from yawDeg
// (see core/facing.ts), so movement, the avatar's nose and the camera agree.

import { angleToTarget, forwardFromYaw } from '../core/facing.ts';
import { T } from '../tuning.ts';

export interface PlayerState {
  x: number;
  z: number;
  yawDeg: number;
}

export interface MoveInput {
  forward: boolean;
  back: boolean;
  turnLeft: boolean;
  turnRight: boolean;
}

/** Where the player starts. */
export function startPlayer(): PlayerState {
  return { x: T.player.startX, z: T.player.startZ, yawDeg: T.player.startYawDeg };
}

/** Advances the player by one fixed step of `dt` seconds. */
export function stepPlayer(p: PlayerState, input: MoveInput, dt: number): PlayerState {
  const turn = (input.turnLeft ? 1 : 0) - (input.turnRight ? 1 : 0);
  const yawDeg = wrapDegrees(p.yawDeg + turn * T.player.turnSpeedDeg * dt);
  const move = (input.forward ? 1 : 0) - (input.back ? 1 : 0);
  const f = forwardFromYaw(yawDeg);
  const halfW = T.world.groundWidth / 2 - T.player.radius;
  const halfD = T.world.groundDepth / 2 - T.player.radius;
  return {
    x: clamp(p.x + f.x * move * T.player.speed * dt, -halfW, halfW),
    z: clamp(p.z + f.z * move * T.player.speed * dt, -halfD, halfD),
    yawDeg,
  };
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

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), hi);
}
