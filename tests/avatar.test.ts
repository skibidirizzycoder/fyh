// avatar.test.ts — the low-poly player faces where it walks, fits its collision size, and walks.
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { forwardFromYaw } from '../src/core/facing.ts';
import { createAvatar, settlePhase } from '../src/player/avatar.ts';
import { cheerCurve, followShare, framing } from '../src/player/camera.ts';
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

  it('the camera glides after the player by game steps, and cuts after a jump', () => {
    const { camera, avatar } = made();
    avatar.sync({ x: 0, z: 0, yawDeg: 0 }, camera, 0);
    const behind = camera.position.z;
    expect(behind).toBeCloseTo(T.camera.distance, 6);
    avatar.sync({ x: 0, z: -1, yawDeg: 0 }, camera, 1); // one step later the player is 1 m further on
    expect(camera.position.z).toBeCloseTo(behind - followShare(T.avatar.cameraFollow, 1), 6);
    avatar.sync({ x: 0, z: -1, yawDeg: 0 }, camera, 1); // a redraw with no new step: the camera stays put
    expect(camera.position.z).toBeCloseTo(behind - followShare(T.avatar.cameraFollow, 1), 6);
    avatar.sync({ x: 0, z: -1, yawDeg: 0 }, camera, 400); // many steps later it has caught up
    expect(camera.position.z).toBeCloseTo(T.camera.distance - 1, 6);
    avatar.sync({ x: 20, z: -1, yawDeg: 0 }, camera, 401); // a jump (travel): cut straight there
    expect(camera.position.x).toBeCloseTo(20, 6);
    avatar.dispose();
  });

  it('while a dialogue line shows the camera eases closer and lower, then back, by game steps', () => {
    const { camera, avatar } = made();
    const at = { x: 0, z: 0, yawDeg: 0 };
    avatar.sync(at, camera, 0);
    const normal = camera.position.clone();
    for (let f = 1; f <= 600; f++) avatar.sync(at, camera, f, { talking: true });
    const close = framing(1, 0);
    expect(camera.position.z).toBeCloseTo(close.distance, 3);
    expect(camera.position.y).toBeCloseTo(close.height, 3);
    expect(camera.position.z).toBeLessThan(normal.z);
    for (let f = 601; f <= 1200; f++) avatar.sync(at, camera, f, { talking: false });
    expect(camera.position.distanceTo(normal)).toBeLessThan(1e-3);
    avatar.dispose();
  });

  it('a fixed CD pushes the camera in with a tilt, then it settles back level', () => {
    const { camera, avatar } = made();
    const at = { x: 0, z: 0, yawDeg: 0 };
    avatar.sync(at, camera, 0);
    avatar.cheer(0);
    const peak = (T.avatar.cheerSec * T.loop.stepsPerSecond) / 2;
    for (let f = 1; f <= peak; f++) avatar.sync(at, camera, f);
    expect(camera.position.z).toBeLessThan(T.camera.distance - 0.3);
    const level = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
    expect(Math.abs(level.x)).toBeGreaterThan(0.01); // tilted
    for (let f = peak + 1; f <= peak + 600; f++) avatar.sync(at, camera, f);
    expect(camera.position.z).toBeCloseTo(T.camera.distance, 3);
    expect(Math.abs(new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion).x)).toBeLessThan(1e-9);
    expect(cheerCurve(0)).toBe(0);
    expect(cheerCurve(T.avatar.cheerSec * T.loop.stepsPerSecond)).toBe(0);
    avatar.dispose();
  });

  it('followShare: nothing after no steps, all the way after many, never past it', () => {
    expect(followShare(0.2, 0)).toBe(0);
    expect(followShare(0.2, 1)).toBeCloseTo(0.2);
    expect(followShare(0.2, 1000)).toBeCloseTo(1);
    expect(followShare(0.2, -3)).toBe(0);
  });

  it('settlePhase moves to the nearest standing pose without overshooting', () => {
    expect(settlePhase(0.1, 0.25)).toBe(0);
    expect(settlePhase(1.0, 0.25)).toBeCloseTo(0.75);
    expect(settlePhase(Math.PI - 0.2, 0.25)).toBe(Math.PI);
  });
});
