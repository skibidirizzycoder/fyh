// avatar.ts — the player's body and the follow camera.
// A low-poly person in a hoodie, jeans, white trainers, an orange cap and headphones.
// The cap's brim is the "nose": it sits on the local -Z side (Three.js forward), so you
// can see — and measure — which way the player faces.
// Draw calls: one merged body (torso, head, cap, headphones), two legs, two arms and the brim.
// Legs and arms swing with the distance walked (not with time) and finish their step when you stop.
// The camera glides after the player (a damped follow, per game step), and cuts after a jump.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { forwardFromYaw } from '../core/facing.ts';
import { T } from '../tuning.ts';
import type { PlayerState } from './controller.ts';

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

/** One coloured box: centre, size and colour (metres; relative to its limb's pivot for legs and arms). */
interface Part {
  at: readonly [number, number, number];
  size: readonly [number, number, number];
  color: string;
}

const A = T.avatar;
const GAP = T.world.surfaceGap;

// The body, from the soles up (y = 0 is the bottom of the trainers).
const BODY: readonly Part[] = [
  { at: [0, 1.02, 0], size: [0.42, 0.48, 0.24], color: A.hoodie }, // torso
  { at: [0, 0.8, 0], size: [0.44, 0.07, 0.26], color: A.hoodieTrim }, // waistband
  { at: [0, 0.92, -0.125], size: [0.24, 0.12, 0.03], color: A.hoodieTrim }, // front pocket
  { at: [0, 1.29, 0.13], size: [0.26, 0.13, 0.1], color: A.hoodieTrim }, // hood, down on the back
  { at: [0, 1.29, 0], size: [0.1, 0.08, 0.1], color: A.skin }, // neck
  { at: [0, 1.42, 0], size: [0.22, 0.22, 0.22], color: A.skin }, // head
  { at: [-0.05, 1.44, -0.115], size: [0.035, 0.035, 0.02], color: A.headphones }, // eyes
  { at: [0.05, 1.44, -0.115], size: [0.035, 0.035, 0.02], color: A.headphones },
  { at: [0, 1.535, 0], size: [0.235, 0.07, 0.235], color: T.player.noseColor }, // cap
  { at: [-0.13, 1.42, 0], size: [0.05, 0.12, 0.1], color: A.headphones }, // headphone cups...
  { at: [0.13, 1.42, 0], size: [0.05, 0.12, 0.1], color: A.headphones },
  { at: [-0.14, 1.525, 0], size: [0.025, 0.11, 0.04], color: A.headphones }, // ...the band's sides...
  { at: [0.14, 1.525, 0], size: [0.025, 0.11, 0.04], color: A.headphones },
  { at: [0, 1.575, 0], size: [0.305, 0.025, 0.04], color: A.headphones }, // ...and its top, over the cap
];
// A leg hangs from the hip (its top reaches up into the waistband), with a trainer, toe forward.
const LEG: readonly Part[] = [
  { at: [0, -0.31, 0], size: [0.14, 0.74, 0.16], color: A.jeans },
  { at: [0, -0.7, -0.04], size: [0.15, 0.08, 0.26], color: A.shoes },
];
// An arm hangs from the shoulder: a sleeve and a hand.
const ARM: readonly Part[] = [
  { at: [0, -0.21, 0], size: [0.11, 0.5, 0.12], color: A.hoodie },
  { at: [0, -0.51, 0], size: [0.09, 0.09, 0.09], color: A.skin },
];
const BRIM = { at: [0, 1.51, -0.19], size: [0.2, 0.025, 0.14] } as const; // the nose: the cap's brim, forward

/** Merges coloured boxes into one geometry with vertex colours. */
function boxesGeometry(parts: readonly Part[]): THREE.BufferGeometry {
  const color = new THREE.Color();
  const boxes = parts.map((p) => {
    const box = new THREE.BoxGeometry(...p.size).translate(...p.at);
    color.set(p.color); // converted to linear, like a material colour
    const n = box.getAttribute('position').count;
    const rgb = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) rgb.set([color.r, color.g, color.b], i * 3);
    box.setAttribute('color', new THREE.BufferAttribute(rgb, 3));
    return box;
  });
  const merged = mergeGeometries(boxes);
  boxes.forEach((b) => b.dispose());
  if (!merged) throw new Error('could not merge the avatar body');
  return merged;
}

/** A leg or an arm: a mesh hanging from a pivot group at the hip or shoulder. */
function limb(geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, name: string): THREE.Group {
  const pivot = new THREE.Group();
  pivot.name = name;
  pivot.position.set(x, y, 0);
  pivot.add(new THREE.Mesh(geometry, material));
  return pivot;
}

/** Moves a walk phase towards the nearest standing pose (a multiple of pi), by at most `rate`. */
export function settlePhase(phase: number, rate: number): number {
  const rest = Math.round(phase / Math.PI) * Math.PI;
  const d = rest - phase;
  return Math.abs(d) <= rate ? rest : phase + Math.sign(d) * rate;
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
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
  const brimMaterial = new THREE.MeshStandardMaterial({ color: T.player.noseColor, roughness: 0.85 });
  const bodyGeo = boxesGeometry(BODY);
  const legGeo = boxesGeometry(LEG);
  const armGeo = boxesGeometry(ARM);
  const brimGeo = new THREE.BoxGeometry(...BRIM.size);

  const root = new THREE.Group();
  root.name = 'player';
  const rig = new THREE.Group(); // everything that bobs while walking
  rig.position.y = GAP;
  const body = new THREE.Mesh(bodyGeo, material);
  body.name = 'player_body';
  const nose = new THREE.Mesh(brimGeo, brimMaterial);
  nose.name = 'player_nose';
  nose.position.set(...BRIM.at); // local -Z = forward
  const legs = [-1, 1].map((s) => limb(legGeo, material, s * A.legX, A.hipY, s < 0 ? 'player_leg_l' : 'player_leg_r'));
  const arms = [-1, 1].map((s) => limb(armGeo, material, s * A.armX, A.shoulderY, s < 0 ? 'player_arm_l' : 'player_arm_r'));
  rig.add(body, nose, ...legs, ...arms);
  root.add(rig);
  scene.add(root);

  let phase = 0;
  let last: { x: number; z: number } | null = null;
  let view: { eye: THREE.Vector3; aim: THREE.Vector3; frame: number | undefined } | null = null; // the camera now

  /** Swings legs and arms by the distance walked since the last frame; settles them when standing still. */
  function walk(p: PlayerState): void {
    const moved = last ? Math.hypot(p.x - last.x, p.z - last.z) : 0;
    last = { x: p.x, z: p.z };
    if (moved > 0 && moved < A.teleportM) phase = (phase + (moved / A.strideM) * Math.PI * 2) % (Math.PI * 2);
    else phase = settlePhase(phase, A.settleRad);
    const swing = Math.sin(phase);
    const leg = THREE.MathUtils.degToRad(A.legSwingDeg) * swing;
    const arm = THREE.MathUtils.degToRad(A.armSwingDeg) * swing;
    legs.forEach((g, i) => (g.rotation.x = i === 0 ? leg : -leg));
    arms.forEach((g, i) => (g.rotation.x = i === 0 ? -arm : arm)); // each arm swings with the opposite leg
    rig.position.y = GAP + A.bobM * swing * swing;
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
    walk(p);
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
    [bodyGeo, legGeo, armGeo, brimGeo, material, brimMaterial].forEach((x) => x.dispose());
    scene.remove(root);
  }

  return { root, nose, sync, measuredFacing, dispose };
}
