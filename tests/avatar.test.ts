// avatar.test.ts — the low-poly player faces where it walks, fits its collision size, and walks.
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { forwardFromYaw } from '../src/core/facing.ts';
import { createAvatar, settlePhase } from '../src/player/avatar.ts';
import { T } from '../src/tuning.ts';

/** A fresh avatar in its own scene, with a camera to sync. */
function made() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera();
  const avatar = createAvatar(scene);
  return { scene, camera, avatar };
}

/** The x-rotation of the left leg's pivot (the walk swing). */
function legSwing(avatar: ReturnType<typeof createAvatar>): number {
  return avatar.root.getObjectByName('player_leg_l')?.rotation.x ?? NaN;
}

describe('avatar', () => {
  it('its nose (the cap brim) points along the facing at every heading', () => {
    const { camera, avatar } = made();
    for (const yawDeg of [0, 90, 180, -90, 37]) {
      avatar.sync({ x: 1, z: -2, yawDeg }, camera);
      const m = avatar.measuredFacing();
      const f = forwardFromYaw(yawDeg);
      expect(m.x * f.x + m.z * f.z, `yaw ${yawDeg}`).toBeGreaterThan(0.999);
    }
    avatar.dispose();
  });

  it('fits inside the player\'s height and radius, standing on the ground', () => {
    const { camera, avatar } = made();
    avatar.sync({ x: 0, z: 0, yawDeg: 0 }, camera);
    avatar.root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(avatar.root);
    expect(box.min.y).toBeGreaterThanOrEqual(T.world.surfaceGap - 1e-6);
    expect(box.max.y).toBeLessThanOrEqual(T.player.height + T.world.surfaceGap + 0.01);
    expect(box.max.y).toBeGreaterThan(T.player.height * 0.95);
    for (const v of [box.min.x, box.max.x, box.min.z, box.max.z]) expect(Math.abs(v)).toBeLessThanOrEqual(T.player.radius);
    avatar.dispose();
  });

  it('swings its legs while walking and settles back to standing when it stops', () => {
    const { camera, avatar } = made();
    const step = T.player.speed / T.loop.stepsPerSecond;
    avatar.sync({ x: 0, z: 0, yawDeg: 0 }, camera);
    for (let i = 1; i <= 10; i++) avatar.sync({ x: 0, z: -i * step, yawDeg: 0 }, camera);
    expect(Math.abs(legSwing(avatar))).toBeGreaterThan(0.1);
    const settleFrames = Math.ceil(Math.PI / T.avatar.settleRad) + 1;
    for (let i = 0; i < settleFrames; i++) avatar.sync({ x: 0, z: -10 * step, yawDeg: 0 }, camera);
    expect(legSwing(avatar)).toBeCloseTo(0, 6);
    avatar.dispose();
  });

  it('a jump (travel, restart) is not walking', () => {
    const { camera, avatar } = made();
    avatar.sync({ x: 0, z: 0, yawDeg: 0 }, camera);
    avatar.sync({ x: 3, z: -4, yawDeg: 0 }, camera);
    expect(legSwing(avatar)).toBeCloseTo(0, 6);
    avatar.dispose();
  });

  it('settlePhase moves to the nearest standing pose without overshooting', () => {
    expect(settlePhase(0.1, 0.25)).toBe(0);
    expect(settlePhase(1.0, 0.25)).toBeCloseTo(0.75);
    expect(settlePhase(Math.PI - 0.2, 0.25)).toBe(Math.PI);
  });
});
