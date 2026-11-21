// avatar.ts — the player's body and the follow camera.
// The body is a cylinder with a "nose" box on its local -Z side (Three.js
// forward), so you can see — and measure — which way it faces.

import * as THREE from 'three';
import { forwardFromYaw } from '../core/facing.ts';
import { T } from '../tuning.ts';
import type { PlayerState } from './controller.ts';

export interface Avatar {
  root: THREE.Group;
  nose: THREE.Mesh;
  /** Moves the body and camera to match the player state. */
  sync(p: PlayerState, camera: THREE.PerspectiveCamera): void;
  /** Direction from body centre to nose, measured from the real meshes. */
  measuredFacing(): { x: number; z: number };
  dispose(): void;
}

/** Creates the avatar and adds it to the scene. */
export function createAvatar(scene: THREE.Scene): Avatar {
  const bodyGeo = new THREE.CylinderGeometry(T.player.radius, T.player.radius, T.player.height, 16);
  const noseGeo = new THREE.BoxGeometry(0.15, 0.15, 0.3);
  const bodyMat = new THREE.MeshStandardMaterial({ color: T.player.bodyColor });
  const noseMat = new THREE.MeshStandardMaterial({ color: T.player.noseColor });

  const root = new THREE.Group();
  root.name = 'player';
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = T.player.height / 2 + T.world.surfaceGap;
  const nose = new THREE.Mesh(noseGeo, noseMat);
  nose.position.set(0, T.player.height * 0.8, -T.player.radius - 0.15); // local -Z = forward
  root.add(body, nose);
  scene.add(root);

  function sync(p: PlayerState, camera: THREE.PerspectiveCamera): void {
    root.position.set(p.x, 0, p.z);
    root.rotation.y = (p.yawDeg * Math.PI) / 180;
    const f = forwardFromYaw(p.yawDeg);
    camera.position.set(p.x - f.x * T.camera.distance, T.camera.height, p.z - f.z * T.camera.distance);
    camera.lookAt(p.x, T.camera.lookHeight, p.z);
  }

  function measuredFacing(): { x: number; z: number } {
    root.updateMatrixWorld(true);
    const a = root.getWorldPosition(new THREE.Vector3());
    const b = nose.getWorldPosition(new THREE.Vector3());
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    return { x: (b.x - a.x) / len, z: (b.z - a.z) / len };
  }

  function dispose(): void {
    [bodyGeo, noseGeo, bodyMat, noseMat].forEach((x) => x.dispose());
    scene.remove(root);
  }

  return { root, nose, sync, measuredFacing, dispose };
}
