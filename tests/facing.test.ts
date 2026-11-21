// facing.test.ts — one source of truth for direction; Three.js forward is -Z.
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { angleToTarget, forwardFromYaw, yawFromForward } from '../src/core/facing.ts';

describe('facing', () => {
  it.each([
    [0, 0, -1],
    [90, -1, 0],
    [180, 0, 1],
    [-90, 1, 0],
  ])('yaw %i faces (%i, %i)', (yaw, x, z) => {
    const f = forwardFromYaw(yaw);
    expect(f.x).toBeCloseTo(x, 10);
    expect(f.z).toBeCloseTo(z, 10);
  });

  it('matches what Three.js does to a mesh rotated by the same yaw', () => {
    for (const yaw of [0, 45, 90, 135, 180, -45, -90, -135]) {
      const o = new THREE.Object3D();
      o.rotation.y = (yaw * Math.PI) / 180;
      const threeForward = new THREE.Vector3(0, 0, -1).applyQuaternion(o.quaternion);
      const f = forwardFromYaw(yaw);
      expect(f.x).toBeCloseTo(threeForward.x, 10);
      expect(f.z).toBeCloseTo(threeForward.z, 10);
    }
  });

  it('yawFromForward undoes forwardFromYaw', () => {
    for (const yaw of [0, 30, 90, 179, -60, -120]) expect(yawFromForward(forwardFromYaw(yaw))).toBeCloseTo(yaw, 10);
  });

  it('angleToTarget is 0 straight ahead and 180 straight behind', () => {
    expect(angleToTarget(0, { x: 0, z: 0 }, { x: 0, z: -5 })).toBeCloseTo(0);
    expect(angleToTarget(0, { x: 0, z: 0 }, { x: 0, z: 5 })).toBeCloseTo(180);
  });
});
