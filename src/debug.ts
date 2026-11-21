// debug.ts — window.__game, a debug API for tests and for you.
// Installed ONLY in dev (`npm run dev`) and test builds (`vite build --mode test`);
// the shipped production build does not contain it (the smoke test checks).
//
// Two kinds of helpers:
//   shortcuts  travel(), interact(), placePlayer()   jump straight there (fast, for setup)
//   real input walkTo(), phoneTo(), cdTo()           press real keys frame by frame, like a player

import * as THREE from 'three';
import type { GameAudio } from './audio/audio.ts';
import type { Loop } from './core/loop.ts';
import type { Input } from './core/input.ts';
import { forwardFromYaw } from './core/facing.ts';
import type { Game, InteractResult } from './game.ts';
import type { NewsDesk, NewsState } from './news/desk.ts';
import type { Avatar } from './player/avatar.ts';
import type { Spot } from './player/collide.ts';
import { findRoute, steerAlong, type Steer } from './player/path.ts';
import { cdObjectId } from './story/cdplayer.ts';
import { content } from './story/content.ts';
import { fixedCds } from './story/timeline.ts';
import { T, type Era } from './tuning.ts';

export interface Snapshot {
  scene: string;
  era: Era;
  moment: string | null; // the 2004 moment you are in; null today
  flags: string[];
  visited: string[]; // 2004 moments you have been to
  inserting: string | null; // the CD going into the CD player right now (you travel when it's in)
  present: Record<string, boolean>;
  fixedCds: string[];
  reputation: number;
  target: string | null;
  dialogue: string;
  card: { visible: boolean; changes: string[]; causes: string[] };
  phone: { open: boolean; index: number; selected: string; items: string[]; locked: string[] }; // locked: targets you can't choose now (fresh)
  audio: { lastCue: string; muted: boolean; music: string; ambience: string }; // music: what the CD music plays now, e.g. "mira:2004" ("" = none); ambience: the soundscape now
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
  /** Real input: Q, then Down until `to` is selected, then E. Presses nothing if `to` is locked on the phone. */
  phoneTo(to: string): Snapshot;
  /**
   * Real input: into a 2004 moment through the CD player. In 2004 it phones home first, then
   * walks to that moment's CD, presses E and steps until you arrive. `frames` counts all of it.
   */
  cdTo(to: string): WalkResult;
  /** Real input: turn (A/D) and walk (W) to an interactable (around solid props) until it is targeted, then press E. */
  walkTo(objectId: string, maxFrames?: number): WalkResult;
  /** Turns the ink outlines off or back on (for measuring them) and redraws the same frame. */
  outlines(on: boolean): Snapshot;
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
  showOutlines: (on: boolean) => void;
}

const STEER_KEY: Record<Steer, string> = { walk: 'KeyW', left: 'KeyA', right: 'KeyD' };
const WALK_KEYS = Object.values(STEER_KEY);
const WALK_FRAMES = 20 * T.loop.stepsPerSecond; // walkTo() gives up after this many steps
const INSERT_FRAMES = Math.round(T.cdPlayer.insertSec * T.loop.stepsPerSecond);

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
      phoneTo(rt, to, tap);
      return state();
    },
    cdTo: (to) => cdTo(rt, to, tap),
    walkTo: (objectId, maxFrames = WALK_FRAMES) => walkTo(rt, objectId, maxFrames, tap),
    outlines: (on) => {
      rt.showOutlines(on);
      return step(0); // redraw now
    },
    tuning: T,
  };
}

/** Real input: Q (if closed), Down until `to` is selected, then E. Nothing if `to` is locked or not on the phone. */
function phoneTo(rt: Runtime, to: string, tap: (code: string) => void): void {
  const index = rt.game.phoneItems().findIndex((i) => i.target === to && !i.locked);
  if (index < 0) return;
  if (!rt.game.state.phone.open) tap('KeyQ');
  for (let presses = 0; presses < rt.game.state.phone.items.length && rt.game.state.phone.index !== index; presses++) tap('ArrowDown');
  tap('KeyE');
}

/** Real input: into a 2004 moment through the CD player (see DebugApi.cdTo). */
function cdTo(rt: Runtime, to: string, tap: (code: string) => void): WalkResult {
  const g = rt.game;
  const start = g.state.frame;
  const cd = content.cds.find((c) => c.moment === to);
  if (!cd) return { ok: false, frames: 0, state: snapshot(rt) };
  if (g.state.era !== 'present') phoneTo(rt, 'present', tap);
  const walk = walkTo(rt, cdObjectId(cd.id), WALK_FRAMES, tap);
  if (walk.ok) rt.loop.stepFrames(INSERT_FRAMES); // the CD goes in, then you arrive (draws once)
  const s = snapshot(rt);
  return { ok: walk.ok && s.moment === to, frames: s.frame - start, state: s };
}

/**
 * Steers the player to an interactable with real key presses, then presses E.
 * The route (src/player/path.ts) is planned once: straight at it when nothing is in the way,
 * else around the solid props. After the last waypoint the player turns to face the object.
 */
function walkTo(rt: Runtime, objectId: string, maxFrames: number, tap: (code: string) => void): WalkResult {
  const g = rt.game;
  let route: Spot[] | null = null;
  for (let frames = 0; frames < maxFrames; frames++) {
    if (g.state.target === objectId) {
      WALK_KEYS.forEach((k) => rt.input.release(k));
      tap('KeyE');
      return { ok: true, frames: frames + 1, state: snapshot(rt) };
    }
    const t = g.targets().find((x) => x.id === objectId);
    if (!t || g.state.phone.open) break;
    const p = g.state.player;
    route ??= findRoute(p, t, g.obstacles()) ?? []; // no route: head straight for it and let it fail
    holdOnly(rt, STEER_KEY[steerAlong(p, route, t)]);
    g.update(); // simulate only: drawing hundreds of frames here queues GPU work that stalls screenshots
  }
  WALK_KEYS.forEach((k) => rt.input.release(k));
  rt.loop.stepFrames(0); // draw once
  return { ok: false, frames: maxFrames, state: snapshot(rt) };
}

/** Holds one of the walking keys and releases the others. */
function holdOnly(rt: Runtime, key: string): void {
  WALK_KEYS.forEach((k) => (k === key ? rt.input.press(k) : rt.input.release(k)));
}

/** What the CD music plays now, if the audio module reports it (Teammate B adds `nowPlaying()`). */
function nowPlaying(audio: object): string {
  const fn = (audio as { nowPlaying?: () => string }).nowPlaying;
  return typeof fn === 'function' ? fn.call(audio) : '';
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
    visited: [...s.visited],
    inserting: s.inserting?.cd ?? null,
    present: rt.game.present(),
    fixedCds: fixedCds(content, s.flags),
    reputation: s.reputation,
    target: s.target,
    dialogue: s.dialogueLeft > 0 ? s.dialogue : '',
    card: { visible: playing && s.era === 'present' && changes.length > 0 && !s.phone.open, changes, causes: rt.game.causes().map((a) => a.id) },
    phone: {
      open: s.phone.open, index: s.phone.index, selected: s.phone.items[s.phone.index]?.target ?? '', items: s.phone.items.map((i) => i.target),
      locked: rt.game.phoneItems().filter((i) => i.locked).map((i) => i.target),
    },
    audio: { lastCue: rt.audio.lastCue() ?? '', muted: rt.audio.isMuted(), music: nowPlaying(rt.audio), ambience: rt.audio.soundscape() },
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
