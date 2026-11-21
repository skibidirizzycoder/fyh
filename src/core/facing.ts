// facing.ts — the ONE source of truth for facing and direction.
// Three.js convention: forward is -Z, right is +X, up is +Y.
// Yaw is in degrees, turning LEFT (counter-clockwise seen from above) is positive.
//   yaw 0   -> forward (0, 0, -1)
//   yaw 90  -> left    (-1, 0, 0)
//   yaw 180 -> back    (0, 0, 1)
//   yaw -90 -> right   (1, 0, 0)

export interface Flat {
  x: number;
  z: number;
}

/** Unit forward vector on the ground plane for a yaw in degrees. */
export function forwardFromYaw(yawDeg: number): Flat {
  const rad = (yawDeg * Math.PI) / 180;
  return { x: -Math.sin(rad), z: -Math.cos(rad) };
}

/** Yaw in degrees (-180..180] for a ground-plane direction (inverse of forwardFromYaw). */
export function yawFromForward(dir: Flat): number {
  return (Math.atan2(-dir.x, -dir.z) * 180) / Math.PI;
}

/** Angle in degrees between a facing yaw and the direction to a target. */
export function angleToTarget(yawDeg: number, from: Flat, to: Flat): number {
  const f = forwardFromYaw(yawDeg);
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const len = Math.hypot(dx, dz);
  if (len === 0) return 0;
  const cos = (f.x * dx + f.z * dz) / len;
  return (Math.acos(Math.min(1, Math.max(-1, cos))) * 180) / Math.PI;
}
