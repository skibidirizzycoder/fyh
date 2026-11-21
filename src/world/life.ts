// life.ts — a little street life, all by game time (so the debug step() stays exact):
// the tower clock's hands show each scene's time and run on from there, the pub sign flickers,
// and pigeons by the kerb in the square hop away when you walk near, then wander back home.
// Draw calls: two clock hands and one InstancedMesh for all the pigeons. Numbers: T.life.

import * as THREE from 'three';
import { T } from '../tuning.ts';
import { celMaterial } from './materials.ts';
import { CLOCK } from './street.ts';

const L = T.life;
const STEP_S = 1 / T.loop.stepsPerSecond;
const RESET_STEPS = T.loop.stepsPerSecond * 2; // a longer gap (travel, restart) puts the pigeons back home

export interface StreetLife {
  /** Moves everything to game `frame` in `scene` (a moment id, or the era with no moment), with the player at (x, z). */
  update(scene: string, frame: number, player: { x: number; z: number }): void;
  dispose(): void;
}

/** One pigeon: where it is, where it lives, and how far into a hop it is. */
interface Pigeon {
  x: number;
  z: number;
  home: readonly [number, number];
  hop: number; // radians; its height is |sin(hop)|
  yaw: number;
}

/** The tower clock's time in a scene, as 'HH:MM': the same as the phone's screen in a moment. */
export function sceneClock(scene: string): string {
  return T.phone.momentTimes[scene] ?? L.presentClock;
}

/** Hand angles (radians clockwise from 12) for a time `seconds` after 'HH:MM'. */
export function clockAngles(start: string, seconds: number): { hour: number; minute: number } {
  const [h = 0, m = 0] = start.split(':').map(Number);
  const minutes = h * 60 + m + seconds / 60;
  return { hour: ((minutes / 720) % 1) * Math.PI * 2, minute: ((minutes / 60) % 1) * Math.PI * 2 };
}

/** How much of its glow the pub sign has at `seconds`: 1, or a short dip now and then (the same dips every run). */
export function pubBrightness(seconds: number): number {
  const slot = Math.floor(seconds * L.pubFlickerHz);
  const noise = Math.abs(Math.sin(slot * 12.9898) * 43758.5453) % 1;
  return noise < L.pubFlickerShare ? L.pubFlickerDim : 1;
}

/** Moves a pigeon on by `dt` seconds: away from the player when they are close, else slowly home. */
export function movePigeon(b: Pigeon, player: { x: number; z: number }, dt: number): void {
  const away = { x: b.x - player.x, z: b.z - player.z };
  const near = Math.hypot(away.x, away.z);
  const fleeing = near < L.pigeonScareM || (b.hop !== 0 && near < L.pigeonFleeM);
  const goal = fleeing ? { x: b.x + away.x / (near || 1), z: b.z + away.z / (near || 1) } : { x: b.home[0], z: b.home[1] };
  const d = { x: goal.x - b.x, z: goal.z - b.z };
  const len = Math.hypot(d.x, d.z);
  const step = Math.min(len, (fleeing ? L.pigeonHopMs : L.pigeonHomeMs) * dt);
  if (len > 1e-6 && step > 0) {
    b.x = THREE.MathUtils.clamp(b.x + (d.x / len) * step, L.pigeonArea.x[0], L.pigeonArea.x[1]);
    b.z = THREE.MathUtils.clamp(b.z + (d.z / len) * step, L.pigeonArea.z[0], L.pigeonArea.z[1]);
    b.yaw = Math.atan2(-d.x, -d.z); // the head (local -Z) towards where it goes
  }
  b.hop = fleeing ? (b.hop + Math.PI * L.pigeonHopHz * dt) % Math.PI || 1e-3 : 0; // hops while it flees, walks home
}

/** One clock hand: a thin dark box from the face's centre up to its tip, turned about the centre. */
function hand(size: { length: number; width: number }, depth: number, material: THREE.Material): THREE.Mesh {
  const geo = new THREE.BoxGeometry(size.width, size.length, 0.02).translate(0, size.length / 2, 0);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(CLOCK.x, CLOCK.y, CLOCK.front + depth);
  return mesh;
}

/** A pigeon's shape: a body and a small head in front, standing on y = 0. */
function pigeonGeometry(): THREE.BufferGeometry {
  const body = new THREE.BoxGeometry(0.16, 0.13, 0.26).translate(0, 0.1, 0.02);
  const head = new THREE.BoxGeometry(0.09, 0.09, 0.09).translate(0, 0.2, -0.12);
  const merged = new THREE.BufferGeometry();
  const pos = [...body.toNonIndexed().getAttribute('position').array, ...head.toNonIndexed().getAttribute('position').array];
  merged.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  merged.computeVertexNormals();
  body.dispose();
  head.dispose();
  return merged;
}

/** Adds the clock hands, the pigeons and the pub sign flicker to the scene. `pubSign`: the sign's mesh. */
export function createStreetLife(scene: THREE.Scene, pubSign: THREE.Mesh | undefined): StreetLife {
  const handMaterial = celMaterial(T.street.clockHands);
  const hourHand = hand(L.hourHand, 0.03, handMaterial);
  const minuteHand = hand(L.minuteHand, 0.06, handMaterial);
  const pigeonMaterial = celMaterial(L.pigeon);
  const flock = new THREE.InstancedMesh(pigeonGeometry(), pigeonMaterial, L.pigeonHomes.length);
  flock.frustumCulled = false; // the instances move; the base geometry's bounds don't
  scene.add(hourHand, minuteHand, flock);
  const pigeons: Pigeon[] = L.pigeonHomes.map((home) => ({ x: home[0], z: home[1], home, hop: 0, yaw: 0 }));
  const place = new THREE.Object3D();
  let lastFrame: number | null = null;

  /** Moves the flock on to `frame`, one game step at a time (home again after a long gap). */
  function flap(frame: number, player: { x: number; z: number }): void {
    const steps = lastFrame === null ? RESET_STEPS + 1 : frame - lastFrame;
    lastFrame = frame;
    if (steps < 0 || steps > RESET_STEPS) pigeons.forEach((b) => Object.assign(b, { x: b.home[0], z: b.home[1], hop: 0 }));
    else for (let i = 0; i < steps; i++) pigeons.forEach((b) => movePigeon(b, player, STEP_S));
    pigeons.forEach((b, i) => {
      place.position.set(b.x, T.world.surfaceGap + L.pigeonHopM * Math.sin(b.hop), b.z);
      place.rotation.set(0, b.yaw, 0);
      place.updateMatrix();
      flock.setMatrixAt(i, place.matrix);
    });
    flock.instanceMatrix.needsUpdate = true;
  }

  function update(sceneId: string, frame: number, player: { x: number; z: number }): void {
    const seconds = frame * STEP_S;
    const time = clockAngles(sceneClock(sceneId), seconds);
    hourHand.rotation.z = -time.hour; // seen from the street (+Z), clockwise is a negative turn about Z
    minuteHand.rotation.z = -time.minute;
    const sign = pubSign?.material; // its own label material (it isn't interactable, so nothing else sets its glow)
    if (sign instanceof THREE.MeshLambertMaterial) {
      sign.emissive.set(L.pubGlow);
      sign.emissiveIntensity = L.pubGlowIntensity * pubBrightness(seconds);
    }
    flap(frame, player);
  }

  function dispose(): void {
    [hourHand, minuteHand, flock].forEach((m) => {
      m.geometry.dispose();
      scene.remove(m);
    });
    [handMaterial, pigeonMaterial].forEach((m) => m.dispose());
  }

  return { update, dispose };
}
