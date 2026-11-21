// avatar.ts — the player's body and the follow camera.
// The body is a round person (src/player/person.ts) in the player's look: a knit jumper, jeans, white
// trainers, an orange cap and headphones. The cap's brim is the "nose": it sits on the local -Z side
// (Three.js forward), so you can see — and measure — which way the player faces.
// The stride moves with the distance walked (not with time); the pose blends idle, walk and run by the
// (eased) speed and leans into turns, and the legs finish their step when you stop.
// The follow camera (glide, dialogue framing, the push-in when a CD is fixed) lives in camera.ts.

import * as THREE from 'three';
import { T } from '../tuning.ts';
import { createFollowCamera, type CameraMood } from './camera.ts';
import type { PlayerState } from './controller.ts';
import { createPuffs } from './puffs.ts';
import { advancePhase, createPerson, createPersonTextures, easePose, lookAngle, posePerson, type Person } from './person.ts';

export interface Avatar {
  root: THREE.Group;
  nose: THREE.Mesh;
  /** Moves the body and camera to match the player state. With the game `frame`, the camera glides
   *  there by the steps since the last call; without it, it goes straight there. `mood`: see camera.ts. */
  sync(p: PlayerState, camera: THREE.PerspectiveCamera, frame?: number, mood?: CameraMood): void;
  /** A CD was just fixed (at game `frame`): the camera pushes in for a moment. */
  cheer(frame: number): void;
  /** What the player could use now (its spot), or null: the head turns a little towards it. */
  lookAt(point: { x: number; z: number } | null): void;
  /** Direction the nose points, measured from the real meshes (head to brim), with the head's glance at a target taken out. */
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

/** Creates the avatar and adds it to the scene. */
export function createAvatar(scene: THREE.Scene): Avatar {
  const textures = createPersonTextures();
  const person = createPerson(T.person.looks.player, textures, 'player');
  const { root } = person;
  const nose = noseOf(person);
  scene.add(root);

  let phase = 0;
  let last: { x: number; z: number } | null = null;
  let eased: { speed: number; turnRate: number; look: number; frame: number } | null = null; // what the pose follows, a little behind
  let lookPoint: { x: number; z: number } | null = null;
  let cheerFrame: number | null = null; // when the last CD was fixed
  const follow = createFollowCamera();
  const puffs = createPuffs(scene); // dust at the feet when you break into a run or stop

  /** Moves the stride on by the distance walked since the last frame (settles it when standing still) and poses the body. */
  function walk(p: PlayerState, frame: number | undefined): void {
    const moved = last ? Math.hypot(p.x - last.x, p.z - last.z) : 0;
    last = { x: p.x, z: p.z };
    const steps = eased && frame !== undefined ? frame - eased.frame : undefined;
    const speed = easePose(eased?.speed ?? 0, gaitSpeed(p), steps);
    const turnRate = easePose(eased?.turnRate ?? 0, p.turnRate ?? 0, steps);
    const look = easePose(eased?.look ?? 0, lookAngle(p, lookPoint), steps);
    eased = frame === undefined ? null : { speed, turnRate, look, frame };
    if (moved > 0 && moved < A.teleportM) phase = advancePhase(phase, moved, speed);
    else phase = settlePhase(phase, A.settleRad);
    const cheer = cheerFrame === null || frame === undefined ? 0 : (frame - cheerFrame) / (T.person.gait.cheer.sec * T.loop.stepsPerSecond);
    posePerson(person, { phase, speed, turnRate, look, cheer, time: (frame ?? 0) / T.loop.stepsPerSecond });
  }

  function sync(p: PlayerState, camera: THREE.PerspectiveCamera, frame?: number, mood: CameraMood = { talking: false }): void {
    root.position.set(p.x, 0, p.z);
    root.rotation.y = (p.yawDeg * Math.PI) / 180;
    walk(p, frame);
    puffs.update(p, frame);
    follow.update(p, camera, frame, mood);
  }

  function measuredFacing(): { x: number; z: number } {
    root.updateMatrixWorld(true);
    const a = person.bones.head.getWorldPosition(new THREE.Vector3());
    const b = nose.getWorldPosition(new THREE.Vector3());
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const [dx, dz] = [(b.x - a.x) / len, (b.z - a.z) / len];
    const back = -(eased?.look ?? 0); // turn the glance back (rotation about +Y)
    return { x: dx * Math.cos(back) + dz * Math.sin(back), z: -dx * Math.sin(back) + dz * Math.cos(back) };
  }

  function dispose(): void {
    person.dispose();
    textures.dispose();
    puffs.dispose();
  }

  /** A CD was fixed: the camera pushes in and the player cheers (T.person.gait.cheer.sec), both from this game frame. */
  function cheer(frame: number): void {
    follow.cheer(frame);
    cheerFrame = frame;
  }

  return { root, nose, sync, cheer, lookAt: (point) => (lookPoint = point), measuredFacing, dispose };
}
