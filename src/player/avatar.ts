// avatar.ts — the player's body and the follow camera.
// The body is a round person (src/player/person.ts) in the player's look: a knit jumper, jeans, white
// trainers, an orange cap and headphones. The cap's brim is the "nose": it sits on the local -Z side
// (Three.js forward), so you can see — and measure — which way the player faces.
// The stride moves with the distance walked (not with time); the pose blends idle, walk and run by the
// (eased) speed and leans into turns, and the legs finish their step when you stop.
// The camera glides after the player (a damped follow, per game step), and cuts after a jump.

import * as THREE from 'three';
import { forwardFromYaw } from '../core/facing.ts';
import { T } from '../tuning.ts';
import type { PlayerState } from './controller.ts';
import { advancePhase, createPerson, createPersonTextures, posePerson, type Person } from './person.ts';

export interface Avatar {
  root: THREE.Group;
  nose: THREE.Mesh;
  /** Moves the body and camera to match the player state. With the game `frame`, the camera glides
   *  there by the steps since the last call; without it, it goes straight there. */
  sync(p: PlayerState, camera: THREE.PerspectiveCamera, frame?: number): void;
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

/** How fast the body moves, either way (a state without a speed, from a test or a jump, walks). */
export function gaitSpeed(p: PlayerState): number {
  return p.speed === undefined ? T.player.speed : Math.abs(p.speed);
}

/** The player's nose: the brim of their cap (the player's look always wears one). */
function noseOf(person: Person): THREE.Mesh {
  if (!person.brim) throw new Error("the player's look needs a cap: its brim is the nose");
  return person.brim;
}

/** Where the camera wants to be for a player state, and the point it aims at. */
function cameraGoal(p: PlayerState): { eye: THREE.Vector3; aim: THREE.Vector3 } {
  const f = forwardFromYaw(p.yawDeg);
  return {
    eye: new THREE.Vector3(p.x - f.x * T.camera.distance, T.camera.height, p.z - f.z * T.camera.distance),
    aim: new THREE.Vector3(p.x, T.camera.lookHeight, p.z),
  };
}

/** The part of the way to go after `steps` game steps, moving `rate` of what is left each step. */
export function followShare(rate: number, steps: number): number {
  return 1 - Math.pow(1 - rate, Math.max(0, steps));
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
  let view: { eye: THREE.Vector3; aim: THREE.Vector3; frame: number | undefined } | null = null; // the camera now

  /** Moves the stride on by the distance walked since the last frame (settles it when standing still) and poses the body. */
  function walk(p: PlayerState, frame: number | undefined): void {
    const moved = last ? Math.hypot(p.x - last.x, p.z - last.z) : 0;
    last = { x: p.x, z: p.z };
    const speed = gaitSpeed(p);
    if (moved > 0 && moved < A.teleportM) phase = advancePhase(phase, moved, speed);
    else phase = settlePhase(phase, A.settleRad);
    posePerson(person, { phase, speed, turnRate: p.turnRate ?? 0, time: (frame ?? 0) / T.loop.stepsPerSecond });
  }

  /** Glides the camera towards its spot behind the player; cuts there after a jump or with no frame. */
  function follow(p: PlayerState, camera: THREE.PerspectiveCamera, frame: number | undefined): void {
    const goal = cameraGoal(p);
    const glide = view && frame !== undefined && view.frame !== undefined && view.eye.distanceTo(goal.eye) <= A.cameraSnapM;
    if (view && glide) {
      const steps = (frame ?? 0) - (view.frame ?? 0);
      view.eye.lerp(goal.eye, followShare(A.cameraFollow, steps));
      view.aim.lerp(goal.aim, followShare(A.cameraLookFollow, steps));
      view.frame = frame;
    } else {
      view = { ...goal, frame };
    }
    camera.position.copy(view.eye);
    camera.lookAt(view.aim);
  }

  function sync(p: PlayerState, camera: THREE.PerspectiveCamera, frame?: number): void {
    root.position.set(p.x, 0, p.z);
    root.rotation.y = (p.yawDeg * Math.PI) / 180;
    walk(p, frame);
    follow(p, camera, frame);
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
