// puffs.ts — little dust puffs at the player's feet when they break into a run or stop from a walk or run.
// One THREE.Points (one draw call, hidden while no puff is alive). Everything follows game frames:
// a puff is where and when it started, and each mote's place, height and fade follow from its age.
// Numbers: T.puffs.

import * as THREE from 'three';
import { forwardFromYaw } from '../core/facing.ts';
import { T } from '../tuning.ts';
import { softDot } from '../world/particles.ts';
import type { PlayerState } from './controller.ts';

const U = T.puffs;

/** One puff: where and at which game frame it started. */
export interface Puff {
  x: number;
  z: number;
  frame: number;
}

/** What the puff trigger remembers between frames: the last speed and the fastest since the last stop. */
export interface PuffWatch {
  last: number;
  peak: number;
}

/** Says whether this speed starts a puff ('run' as you break into a run, 'stop' as you stop), and what to remember. */
export function puffTrigger(watch: PuffWatch, speed: number): { kind: 'run' | 'stop' | null; watch: PuffWatch } {
  const runFrom = T.player.speed * U.runShare;
  if (speed < U.stopBelow) {
    const kind = watch.peak >= T.player.speed * U.stopFromShare ? 'stop' : null;
    return { kind, watch: { last: speed, peak: speed } };
  }
  const kind = watch.last <= runFrom && speed > runFrom ? 'run' : null;
  return { kind, watch: { last: speed, peak: Math.max(watch.peak, speed) } };
}

/** Where a puff starts: kicked out behind the feet for a run, just in front for a stop. */
export function puffAt(p: PlayerState, kind: 'run' | 'stop', frame: number): Puff {
  const f = forwardFromYaw(p.yawDeg);
  const k = kind === 'run' ? -U.kickM : U.kickM;
  return { x: p.x + f.x * k, z: p.z + f.z * k, frame };
}

/** Mote `i` of a puff at game `frame`: its position and how visible it is (0 = gone). */
export function motePlace(puff: Puff, i: number, frame: number): { x: number; y: number; z: number; alpha: number } {
  const u = (frame - puff.frame) / (U.lifeSec * T.loop.stepsPerSecond);
  if (u < 0 || u >= 1) return { x: puff.x, y: 0, z: puff.z, alpha: 0 };
  const angle = (i / U.motes) * Math.PI * 2 + puff.frame * U.turnPerFrame; // each puff turned a little differently
  const out = U.spreadM * (1 - (1 - u) * (1 - u)); // fast, then slowing
  return { x: puff.x + Math.cos(angle) * out, y: T.world.surfaceGap + U.riseM * u, z: puff.z + Math.sin(angle) * out, alpha: U.alpha * (1 - u) * (1 - u) };
}

export interface Puffs {
  /** Watches the player's speed at game `frame`, starts puffs and moves their motes. */
  update(p: PlayerState, frame: number | undefined): void;
  dispose(): void;
}

/** The one Points that draws every mote; its sprite is a soft dot (a plain square without a page, in tests). */
function makePoints(): THREE.Points {
  const n = U.maxPuffs * U.motes;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 4), 4));
  const map = typeof document === 'undefined' ? null : softDot();
  const material = new THREE.PointsMaterial({ size: U.sizeM, map, vertexColors: true, transparent: true, depthWrite: false });
  const points = new THREE.Points(geo, material);
  points.name = 'player_puffs';
  points.frustumCulled = false; // its motes move every frame
  points.raycast = () => undefined; // never in the way of a click
  points.visible = false;
  return points;
}

/** Creates the puffs and adds their Points to the scene. */
export function createPuffs(scene: THREE.Scene): Puffs {
  const points = makePoints();
  scene.add(points);
  const color = new THREE.Color(U.color);
  let watch: PuffWatch = { last: 0, peak: 0 };
  let puffs: Puff[] = [];
  let lastFrame: number | null = null;

  /** Writes every mote's place and fade into the buffers; hides the Points when nothing shows. */
  function draw(frame: number): void {
    const pos = points.geometry.getAttribute('position') as THREE.BufferAttribute;
    const rgba = points.geometry.getAttribute('color') as THREE.BufferAttribute;
    let shown = 0;
    for (let k = 0; k < U.maxPuffs; k++) {
      for (let i = 0; i < U.motes; i++) {
        const puff = puffs[k];
        const m = puff ? motePlace(puff, i, frame) : { x: 0, y: 0, z: 0, alpha: 0 };
        const at = k * U.motes + i;
        pos.setXYZ(at, m.x, m.y, m.z);
        rgba.setXYZW(at, color.r, color.g, color.b, m.alpha);
        if (m.alpha > 0) shown++;
      }
    }
    pos.needsUpdate = true;
    rgba.needsUpdate = true;
    points.visible = shown > 0;
  }

  function update(p: PlayerState, frame: number | undefined): void {
    if (frame === undefined) return;
    if (frame !== lastFrame) {
      const seen = puffTrigger(watch, Math.abs(p.speed ?? 0));
      watch = seen.watch;
      if (seen.kind) puffs = [...puffs, puffAt(p, seen.kind, frame)].slice(-U.maxPuffs);
      lastFrame = frame;
    }
    draw(frame);
  }

  function dispose(): void {
    points.geometry.dispose();
    const m = points.material as THREE.PointsMaterial;
    m.map?.dispose();
    m.dispose();
    scene.remove(points);
  }

  return { update, dispose };
}
