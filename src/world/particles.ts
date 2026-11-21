// particles.ts — life in the air: dust motes drifting in the warm 2004 light (open mic, street
// gig), snow falling in December (ringtone) and a few slow specks of pollen today.
// One THREE.Points per kind (only the current scene's is drawn: one draw call), each mote a soft
// round dot drawn on a canvas, sizes in world units. Every position is a pure function of game
// time (frame / stepsPerSecond), so `step()` stays deterministic. The motes fill a box in front of
// the camera and wrap at its edges: they stay put in the world while the box follows you.
// They never block anything: no collisions, no picking, no depth writes.
// Numbers: the `particles` section of tuning.ts.

import * as THREE from 'three';
import { T, type Era } from '../tuning.ts';

export type MoteKind = keyof typeof T.particles.kinds;
type Vec3 = readonly [number, number, number];

export interface Particles {
  /** Shows this scene's motes where they are at game time `seconds`, around what `camera` sees. */
  update(era: Era, moment: string | null, seconds: number, camera: THREE.Camera): void;
  dispose(): void;
}

/** One mote's fixed random start: a spot in the box (0..1 each way), a wobble phase and its own pace. */
export interface MoteSeed {
  u: number;
  v: number;
  w: number;
  phase: number;
  pace: number;
}

/** A small seeded random generator (mulberry32): the same motes every run. */
function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** `n` mote seeds, the same every run. */
export function moteSeeds(n: number): MoteSeed[] {
  const random = seededRandom(T.particles.seed);
  return Array.from({ length: n }, () => ({
    u: random(), v: random(), w: random(), phase: random() * 2 * Math.PI, pace: T.particles.paceMin + random() * T.particles.paceRange,
  }));
}

/** Which kind of mote floats in this era and moment. */
export function kindFor(era: Era, moment: string | null): MoteKind {
  return T.particles.byScene[era === 'present' ? 'present' : moment ?? ''] ?? 'dust';
}

/** Keeps v in [0, size). */
function wrap(v: number, size: number): number {
  return ((v % size) + size) % size;
}

/**
 * Where a mote is at time `t` (seconds), inside the box of size `size` whose low corner is `corner`.
 * It drifts sideways and falls (or rises) steadily, sways a little, and wraps at the box's edges,
 * so a mote keeps its place in the world when the box moves.
 */
export function motePosition(s: MoteSeed, kind: MoteKind, t: number, corner: Vec3, size: Vec3): Vec3 {
  const k = T.particles.kinds[kind];
  const angle = t * k.wobbleHz * 2 * Math.PI * s.pace + s.phase;
  const x = s.u * size[0] + t * k.drift * s.pace + Math.sin(angle) * k.wobble;
  const y = s.v * size[1] - t * k.fall * s.pace;
  const z = s.w * size[2] + Math.cos(angle) * k.wobble;
  return [
    corner[0] + wrap(x - corner[0], size[0]),
    corner[1] + wrap(y - corner[1], size[1]),
    corner[2] + wrap(z - corner[2], size[2]),
  ];
}

/** The soft round dot every mote is drawn with: white in the middle, fading to clear at the edge. */
export function softDot(): THREE.CanvasTexture {
  const px = T.particles.spritePx;
  const canvas = document.createElement('canvas');
  canvas.width = px;
  canvas.height = px;
  const g = canvas.getContext('2d');
  if (g) {
    const r = px / 2;
    const grad = g.createRadialGradient(r, r, 0, r, r, r);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(T.particles.softCore, 'rgba(255,255,255,0.6)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, px, px);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** The Points for one kind of mote (hidden until its scene shows). */
function makePoints(kind: MoteKind, dot: THREE.Texture): THREE.Points {
  const k = T.particles.kinds[kind];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(k.count * 3), 3));
  const material = new THREE.PointsMaterial({
    color: k.color, size: k.size, sizeAttenuation: true, map: dot, transparent: true, opacity: k.opacity, depthWrite: false,
  });
  const points = new THREE.Points(geometry, material);
  points.name = `particles_${kind}`;
  points.frustumCulled = false; // the motes move every frame
  points.raycast = () => undefined; // never picked
  points.visible = false;
  return points;
}

/** The low corner of the motes' box: centred a little in front of the camera, from just above the ground. */
function boxCorner(camera: THREE.Camera, ahead: THREE.Vector3, at: THREE.Vector3): Vec3 {
  camera.getWorldDirection(ahead).setY(0).normalize();
  camera.getWorldPosition(at).addScaledVector(ahead, T.particles.aheadM);
  const [sx, , sz] = T.particles.box;
  return [at.x - sx / 2, T.particles.floorM, at.z - sz / 2];
}

/** Adds one Points per kind of mote to the scene; update() shows only the current scene's kind. */
export function createParticles(scene: THREE.Scene): Particles {
  const kinds = Object.keys(T.particles.kinds) as MoteKind[];
  const seeds = moteSeeds(Math.max(...kinds.map((k) => T.particles.kinds[k].count)));
  const dot = softDot();
  const all = new Map(kinds.map((kind) => [kind, makePoints(kind, dot)]));
  all.forEach((p) => scene.add(p));
  const ahead = new THREE.Vector3();
  const at = new THREE.Vector3();

  return {
    update(era, moment, seconds, camera) {
      const kind = kindFor(era, moment);
      all.forEach((p, k) => (p.visible = k === kind));
      const points = all.get(kind);
      if (!points) return;
      const corner = boxCorner(camera, ahead, at);
      const position = points.geometry.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < position.count; i++) {
        const seed = seeds[i];
        if (seed) position.setXYZ(i, ...motePosition(seed, kind, seconds, corner, T.particles.box));
      }
      position.needsUpdate = true;
    },
    dispose() {
      all.forEach((p) => {
        scene.remove(p);
        p.geometry.dispose();
        (p.material as THREE.Material).dispose();
      });
      dot.dispose();
    },
  };
}
