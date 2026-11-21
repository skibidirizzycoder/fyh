// avatar.ts — the player's body and the follow camera.
// The body is a round person (src/player/person.ts) in the player's look: a knit jumper, jeans, white
// trainers, an orange cap and headphones. The cap's brim is the "nose": it sits on the local -Z side
// (Three.js forward), so you can see — and measure — which way the player faces.
// Legs and arms swing with the distance walked (not with time), as hard as the walking speed says,
// and finish their step when you stop.

import * as THREE from 'three';
import { forwardFromYaw } from '../core/facing.ts';
import { T } from '../tuning.ts';
import type { PlayerState } from './controller.ts';
import { createPerson, createPersonTextures, posePerson, type Person } from './person.ts';

export interface Avatar {
  root: THREE.Group;
  nose: THREE.Mesh;
  /** Moves the body and camera to match the player state. */
  sync(p: PlayerState, camera: THREE.PerspectiveCamera): void;
  /** Direction from body centre to nose, measured from the real meshes. */
  measuredFacing(): { x: number; z: number };
  dispose(): void;
}

const A = T.avatar;

/** Moves a walk phase towards the nearest standing pose (a multiple of pi), by at most `rate`. */
export function settlePhase(phase: number, rate: number): number {
  const rest = Math.round(phase / Math.PI) * Math.PI;
  const d = rest - phase;
  return Math.abs(d) <= rate ? rest : phase + Math.sign(d) * rate;
}

/** How hard the walk swings: the walking speed as a share of full speed (a state with no speed swings fully). */
export function walkAmount(p: PlayerState): number {
  return p.speed === undefined ? 1 : Math.min(1, Math.abs(p.speed) / T.player.speed);
}

/** The player's nose: the brim of their cap (the player's look always wears one). */
function noseOf(person: Person): THREE.Mesh {
  if (!person.brim) throw new Error("the player's look needs a cap: its brim is the nose");
  return person.brim;
}

/** Creates the avatar and adds it to the scene. */
export function createAvatar(scene: THREE.Scene): Avatar {
  const textures = createPersonTextures();
  const person = createPerson(T.person.looks.player, textures, 'player');
  const { root } = person;
  const nose = noseOf(person);
  scene.add(root);

  let phase = 0;
  let last: { x: number; z: number } | null = null;

  /** Swings legs and arms by the distance walked since the last frame; settles them when standing still. */
  function walk(p: PlayerState): void {
    const moved = last ? Math.hypot(p.x - last.x, p.z - last.z) : 0;
    last = { x: p.x, z: p.z };
    if (moved > 0 && moved < A.teleportM) phase = (phase + (moved / A.strideM) * Math.PI * 2) % (Math.PI * 2);
    else phase = settlePhase(phase, A.settleRad);
    posePerson(person, phase, walkAmount(p));
  }

  function sync(p: PlayerState, camera: THREE.PerspectiveCamera): void {
    root.position.set(p.x, 0, p.z);
    root.rotation.y = (p.yawDeg * Math.PI) / 180;
    walk(p);
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
    person.dispose();
    textures.dispose();
  }

  return { root, nose, sync, measuredFacing, dispose };
}
