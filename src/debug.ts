// debug.ts — window.__game, a debug API for tests and for you.
// Installed ONLY in dev (`npm run dev`) and test builds (`vite build --mode test`);
// the shipped production build does not contain it (the smoke test checks).
//
// Two kinds of helpers:
//   shortcuts  travel(), interact(), placePlayer()   jump straight there (fast, for setup)
//   real input walkTo(), phoneTo()                     press real keys frame by frame, like a player

import * as THREE from 'three';
import type { GameAudio } from './audio/audio.ts';
import type { Loop } from './core/loop.ts';
import type { Input } from './core/input.ts';
import { forwardFromYaw } from './core/facing.ts';
import type { Game, InteractResult } from './game.ts';
import type { NewsDesk, NewsState } from './news/desk.ts';
import type { Avatar } from './player/avatar.ts';
import { wrapDegrees } from './player/controller.ts';
import { content } from './story/content.ts';
import { fixedCds } from './story/timeline.ts';
import { T, type Era } from './tuning.ts';

export interface Snapshot {
  scene: string;
  era: Era;
  moment: string | null; // the 2004 moment you are in; null today
  flags: string[];
  present: Record<string, boolean>;
  fixedCds: string[];
  reputation: number;
  target: string | null;
  dialogue: string;
  card: { visible: boolean; changes: string[]; causes: string[] };
  phone: { open: boolean; index: number; selected: string; items: string[] };
  audio: { lastCue: string; muted: boolean };
  events: string[]; // the last few game events, newest last
  player: { x: number; y: number; z: number; yawDeg: number; facing: { x: number; z: number }; measuredFacing: { x: number; z: number } };
  camera: { x: number; y: number; z: number; forward: { x: number; y: number; z: number } };
  frame: number;
  paused: boolean;
  drawCalls: number;
  visibleMeshes: string[];
  news: NewsState & { requests: number };
}

export interface WalkResult {
  ok: boolean; // reached the object and pressed E
  frames: number; // fixed steps it took
  state: Snapshot;
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
  /** Back to the title, then Enter: a fresh game in the present. */
  restart(): Snapshot;
  /** Shortcut: travel straight to a 2004 moment id or "present". */
  travel(to: string): Snapshot;
  /** Shortcut: use an interactable now, wherever the player stands. */
  interact(objectId: string): InteractResult;
  placePlayer(x: number, z: number, yawDeg: number): Snapshot;
  /** Real input: Q, then Down until `to` is selected, then E. */
  phoneTo(to: string): Snapshot;
  /** Real input: turn (A/D) and walk (W) to an interactable until it is targeted, then press E. */
  walkTo(objectId: string, maxFrames?: number): WalkResult;
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
  audio: GameAudio;
  camera: THREE.PerspectiveCamera;
  avatar: Avatar;
  scene: THREE.Scene;
  drawCalls: () => number;
}

const TURN_TOLERANCE_DEG = 3;
const WALK_KEYS = ['KeyW', 'KeyA', 'KeyD'];

/** Puts the debug API on window.__game. */
export function installDebugApi(rt: Runtime): void {
  const state = (): Snapshot => snapshot(rt);
  const step = (n: number): Snapshot => {
    rt.loop.stepFrames(n);
    return state();
  };
  /** Presses a key for exactly one fixed step. */
  const tap = (code: string): void => {
    rt.input.press(code);
    rt.loop.stepFrames(1);
    rt.input.release(code);
  };

  window.__game = {
    state,
    press: (code) => rt.input.press(code),
    release: (code) => rt.input.release(code),
    step,
    pause: () => rt.loop.pause(),
    resume: () => rt.loop.resume(),
    restart: () => {
      rt.input.releaseAll();
      rt.game.scenes.go('title');
      tap('Enter');
      return state();
    },
    travel: (to) => {
      rt.game.travel(to);
      return step(0); // redraw now
    },
    interact: (id) => {
      const result = rt.game.interact(id);
      rt.loop.stepFrames(0);
      return result;
    },
    placePlayer: (x, z, yawDeg) => {
      rt.game.state.player = { x, z, yawDeg };
      return step(0);
    },
    phoneTo: (to) => {
      if (!rt.game.state.phone.open) tap('KeyQ');
      const index = rt.game.state.phone.items.findIndex((i) => i.target === to);
      while (index >= 0 && rt.game.state.phone.index !== index) tap('ArrowDown');
      tap('KeyE');
      return state();
    },
    walkTo: (objectId, maxFrames = 20 * T.loop.stepsPerSecond) => walkTo(rt, objectId, maxFrames, tap),
    tuning: T,
  };
}

/** Steers the player to an interactable with real key presses, then presses E. */
function walkTo(rt: Runtime, objectId: string, maxFrames: number, tap: (code: string) => void): WalkResult {
  const g = rt.game;
  for (let frames = 0; frames < maxFrames; frames++) {
    if (g.state.target === objectId) {
      WALK_KEYS.forEach((k) => rt.input.release(k));
      tap('KeyE');
      return { ok: true, frames: frames + 1, state: snapshot(rt) };
    }
    const t = g.targets().find((x) => x.id === objectId);
    if (!t || g.state.phone.open) break;
    const p = g.state.player;
    const wantYaw = (Math.atan2(-(t.x - p.x), -(t.z - p.z)) * 180) / Math.PI; // yaw 0 faces -Z
    const turn = wrapDegrees(wantYaw - p.yawDeg);
    const key = Math.abs(turn) > TURN_TOLERANCE_DEG ? (turn > 0 ? 'KeyA' : 'KeyD') : 'KeyW';
    WALK_KEYS.forEach((k) => (k === key ? rt.input.press(k) : rt.input.release(k)));
    g.update(); // simulate only: drawing hundreds of frames here queues GPU work that stalls screenshots
  }
  WALK_KEYS.forEach((k) => rt.input.release(k));
  rt.loop.stepFrames(0); // draw once
  return { ok: false, frames: maxFrames, state: snapshot(rt) };
}

/** A plain-data copy of everything a test may want to measure. */
function snapshot(rt: Runtime): Snapshot {
  const s = rt.game.state;
  const cam = rt.camera;
  const forward = cam.getWorldDirection(new THREE.Vector3());
  const playing = rt.game.scenes.current() === 'play';
  const changes = rt.game.cardChanges().map((c) => c.id);
  const visibleMeshes: string[] = [];
  rt.scene.traverseVisible((o) => {
    if (o instanceof THREE.Mesh && o.name) visibleMeshes.push(o.name);
  });
  return {
    scene: rt.game.scenes.current(),
    era: s.era,
    moment: s.moment,
    flags: [...s.flags],
    present: rt.game.present(),
    fixedCds: fixedCds(content, s.flags),
    reputation: s.reputation,
    target: s.target,
    dialogue: s.dialogueLeft > 0 ? s.dialogue : '',
    card: { visible: playing && s.era === 'present' && changes.length > 0 && !s.phone.open, changes, causes: rt.game.causes().map((a) => a.id) },
    phone: { open: s.phone.open, index: s.phone.index, selected: s.phone.items[s.phone.index]?.target ?? '', items: s.phone.items.map((i) => i.target) },
    audio: { lastCue: rt.audio.lastCue() ?? '', muted: rt.audio.isMuted() },
    events: rt.game.events.recent(),
    player: { x: s.player.x, y: 0, z: s.player.z, yawDeg: s.player.yawDeg, facing: forwardFromYaw(s.player.yawDeg), measuredFacing: rt.avatar.measuredFacing() },
    camera: { x: cam.position.x, y: cam.position.y, z: cam.position.z, forward: { x: forward.x, y: forward.y, z: forward.z } },
    frame: s.frame,
    paused: rt.loop.isPaused(),
    drawCalls: rt.drawCalls(),
    visibleMeshes,
    news: { ...rt.news.current(), requests: rt.news.requestCount() },
  };
}
