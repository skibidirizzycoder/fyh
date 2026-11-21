// debug.ts — window.__game, a debug API for tests and for you.
// Installed ONLY in dev (`npm run dev`) and test builds (`vite build --mode test`);
// the shipped production build does not contain it (the smoke test checks).

import * as THREE from 'three';
import type { Loop } from './core/loop.ts';
import type { Input } from './core/input.ts';
import { forwardFromYaw } from './core/facing.ts';
import type { Game, InteractResult } from './game.ts';
import type { NewsDesk, NewsState } from './news/desk.ts';
import type { Avatar } from './player/avatar.ts';
import { T, type Era } from './tuning.ts';

export interface Snapshot {
  scene: string;
  era: Era;
  flags: string[];
  present: Record<string, boolean>;
  target: string | null;
  dialogue: string;
  card: { visible: boolean; causes: string[] };
  player: { x: number; y: number; z: number; yawDeg: number; facing: { x: number; z: number }; measuredFacing: { x: number; z: number } };
  camera: { x: number; y: number; z: number; forward: { x: number; y: number; z: number } };
  frame: number;
  paused: boolean;
  drawCalls: number;
  visibleMeshes: string[];
  news: NewsState & { requests: number };
}

export interface DebugApi {
  state(): Snapshot;
  press(code: string): void;
  release(code: string): void;
  /** Runs exactly n fixed steps, draws once and returns the new state. */
  step(n: number): Snapshot;
  /** Stops real time from moving the game, so only step() does. */
  pause(): void;
  resume(): void;
  setEra(era: Era): Snapshot;
  interact(objectId: string): InteractResult;
  placePlayer(x: number, z: number, yawDeg: number): Snapshot;
  tuning: typeof T;
}

declare global {
  interface Window {
    __game?: DebugApi;
  }
}

export interface Runtime {
  game: Game;
  input: Input;
  loop: Loop;
  news: NewsDesk;
  camera: THREE.PerspectiveCamera;
  avatar: Avatar;
  scene: THREE.Scene;
  drawCalls: () => number;
}

/** Puts the debug API on window.__game. */
export function installDebugApi(rt: Runtime): void {
  const state = (): Snapshot => snapshot(rt);
  window.__game = {
    state,
    press: (code) => rt.input.press(code),
    release: (code) => rt.input.release(code),
    step: (n) => {
      rt.loop.stepFrames(n);
      return state();
    },
    pause: () => rt.loop.pause(),
    resume: () => rt.loop.resume(),
    setEra: (era) => {
      rt.game.setEra(era);
      rt.loop.stepFrames(0); // redraw now
      return state();
    },
    interact: (id) => {
      const result = rt.game.interact(id);
      rt.loop.stepFrames(0);
      return result;
    },
    placePlayer: (x, z, yawDeg) => {
      rt.game.state.player = { x, z, yawDeg };
      rt.loop.stepFrames(0);
      return state();
    },
    tuning: T,
  };
}

/** A plain-data copy of everything a test may want to measure. */
function snapshot(rt: Runtime): Snapshot {
  const s = rt.game.state;
  const cam = rt.camera;
  const forward = cam.getWorldDirection(new THREE.Vector3());
  const playing = rt.game.scenes.current() === 'play';
  const causes = rt.game.causes().map((a) => a.id);
  const visibleMeshes: string[] = [];
  rt.scene.traverseVisible((o) => {
    if (o instanceof THREE.Mesh && o.name) visibleMeshes.push(o.name);
  });
  return {
    scene: rt.game.scenes.current(),
    era: s.era,
    flags: [...s.flags],
    present: rt.game.present(),
    target: s.target,
    dialogue: s.dialogueLeft > 0 ? s.dialogue : '',
    card: { visible: playing && s.era === 'present' && causes.length > 0, causes },
    player: { x: s.player.x, y: 0, z: s.player.z, yawDeg: s.player.yawDeg, facing: forwardFromYaw(s.player.yawDeg), measuredFacing: rt.avatar.measuredFacing() },
    camera: { x: cam.position.x, y: cam.position.y, z: cam.position.z, forward: { x: forward.x, y: forward.y, z: forward.z } },
    frame: s.frame,
    paused: rt.loop.isPaused(),
    drawCalls: rt.drawCalls(),
    visibleMeshes,
    news: { ...rt.news.current(), requests: rt.news.requestCount() },
  };
}
