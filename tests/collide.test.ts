// collide.test.ts — the player can't walk through solid props, slides along them,
// can still reach every interactable in every scene, and only this scene's props block.
import { describe, expect, it } from 'vitest';
import { usedObjects } from '../src/game.ts';
import { blocks, obstaclesOf, overlapsAny, type Footprint, type Spot } from '../src/player/collide.ts';
import { pickTarget, startPlayer, stepPlayer, type MoveInput, type PlayerState, type Target } from '../src/player/controller.ts';
import { findRoute, lineClear, steerAlong, type Steer } from '../src/player/path.ts';
import { content } from '../src/story/content.ts';
import { propOverrides, type Flags } from '../src/story/timeline.ts';
import { T, type Era } from '../src/tuning.ts';
import { placed } from '../src/world/areas.ts';
import { PROPS, visibleProps } from '../src/world/layout.ts';

const dt = 1 / T.loop.stepsPerSecond;
const R = T.player.radius;
const walk: MoveInput = { forward: true, back: false, turnLeft: false, turnRight: false };
const STEER: Record<Steer, MoveInput> = {
  walk,
  left: { ...walk, forward: false, turnLeft: true },
  right: { ...walk, forward: false, turnRight: true },
};
const WALK_LIMIT = 20 * T.loop.stepsPerSecond; // the debug walkTo() gives up after this many steps
const WALK_TEST_MS = 30_000; // tests that walk thousands of steps: the street is long and has many props to bump into
const WALL: Footprint = { shape: 'rect', x: 0, z: -5, halfW: 4, halfD: 0.5 }; // front face at z = -4.5

// Every scene (today + each CD's moment) at every step of the story, since effects show and hide props.
const IDS = content.actions.map((a) => a.id);
const STAGES: Flags[] = [...IDS.map((_, i) => IDS.slice(0, i)), IDS];
const SCENES: { era: Era; moment: string | null }[] = [
  { era: 'present', moment: null },
  ...content.cds.map((c) => ({ era: '2004' as const, moment: c.moment })),
];

/** Holds W for n steps. */
function hold(p: PlayerState, n: number, obstacles: readonly Footprint[]): PlayerState {
  for (let i = 0; i < n; i++) p = stepPlayer(p, walk, dt, obstacles);
  return p;
}

/** The solid footprints of one scene after some story flags. */
function sceneObstacles(era: Era, moment: string | null, flags: Flags): Footprint[] {
  const { shown, hidden } = propOverrides(content, flags);
  return obstaclesOf(visibleProps(era, moment, shown, hidden));
}

/** A prop where it stands in the world (moments' props are moved into their area of the street). */
function prop(id: string) {
  const p = PROPS.find((x) => x.id === id);
  if (!p) throw new Error(`no prop ${id}`);
  return placed(p);
}

describe('what blocks', () => {
  it('walls, furniture and wide thin boards block', () => {
    for (const id of ['shop_wall', 'bench', 'old_car', 'payphone', 'noticeboard', 'lamp_post', 'static_stage', 'kbit_body']) {
      expect(blocks(prop(id)), id).toBe(true);
    }
  });

  it('the ground and cables (walked over), signs overhead and thin poles do not', () => {
    for (const id of ['static_cable_run', 'shop_sign', 'kbit_bus_stop', 'kbit_shelter_roof', 'kbit_sign_pole', 'static_cymbal_stand']) {
      expect(blocks(prop(id)), id).toBe(false);
    }
    expect(obstaclesOf(visibleProps('present', null, new Set(), new Set())).length).toBeLessThan(visibleProps('present', null, new Set(), new Set()).length);
  });
});

describe('collisions', () => {
  it('a wall stops the player one radius in front of it', () => {
    const p = hold({ x: 0, z: -3, yawDeg: 0 }, 2 * T.loop.stepsPerSecond, [WALL]);
    expect(p.z).toBeCloseTo(-4.5 + R, 6);
    expect(p.x).toBeCloseTo(0, 10);
  });

  it('walking into a wall at an angle slides along it', () => {
    const yaw = 45; // facing -Z and -X
    const n = T.loop.stepsPerSecond; // 1 s: about 2 m sideways, still in front of the 8 m wall
    const p = hold({ x: 0, z: -4.5 + R, yawDeg: yaw }, n, [WALL]);
    expect(p.z).toBeCloseTo(-4.5 + R, 6);
    expect(p.x).toBeCloseTo(-Math.SQRT1_2 * T.player.speed * dt * n, 6); // all of the sideways part of the move
  });

  it('slides around a round post instead of stopping on it', () => {
    const post: Footprint = { shape: 'circle', x: 0.05, z: -2, r: 0.3 };
    const p = hold({ x: 0, z: 0, yawDeg: 0 }, 2 * T.loop.stepsPerSecond, [post]);
    expect(p.z).toBeLessThan(-3); // got past it
    expect(overlapsAny(p, [post])).toBe(false);
  });

  it('the shop wall stops the player in a real scene', () => {
    const p = hold({ x: 1, z: -3, yawDeg: 0 }, 2 * T.loop.stepsPerSecond, sceneObstacles('present', null, []));
    expect(p.z).toBeCloseTo(prop('shop_wall').pos[2] + prop('shop_wall').size[2] / 2 + R, 6);
  });

  it('never ends a step inside a prop, in any scene, walking about at random', () => {
    let seed = 2004;
    const random = (): number => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (const { era, moment } of SCENES) {
      const obstacles = sceneObstacles(era, moment, []);
      let p = startPlayer();
      for (let i = 0; i < 3000; i++) {
        p = stepPlayer(p, { forward: random() < 0.8, back: false, turnLeft: random() < 0.3, turnRight: random() < 0.3 }, dt, obstacles);
        expect(overlapsAny(p, obstacles), `${moment ?? 'today'} step ${i} at (${p.x.toFixed(2)}, ${p.z.toFixed(2)})`).toBe(false);
      }
    }
  }, WALK_TEST_MS);

  it('a prop that appears on the player pushes it out', () => {
    const crowd = prop('static_crowd_1');
    const at: PlayerState = { x: crowd.pos[0], z: crowd.pos[2], yawDeg: 0 };
    const obstacles = sceneObstacles('2004', 'street_gig', ['static_plug_amp', 'static_give_mic']);
    expect(overlapsAny(at, obstacles)).toBe(true);
    const p = stepPlayer(at, { ...walk, forward: false }, dt, obstacles);
    expect(overlapsAny(p, obstacles)).toBe(false);
  });
});

describe('only this scene\'s props block', () => {
  it('another moment\'s props do not block', () => {
    const stage = prop('static_stage');
    const spot: Spot = { x: stage.pos[0], z: stage.pos[2] };
    expect(overlapsAny(spot, sceneObstacles('2004', 'street_gig', []))).toBe(true);
    expect(overlapsAny(spot, sceneObstacles('2004', 'open_mic', []))).toBe(false);
    expect(overlapsAny(spot, sceneObstacles('present', null, []))).toBe(false);
  });

  it('props that are not shown yet do not block, and do once shown', () => {
    const crowd = prop('static_crowd_2');
    const spot: Spot = { x: crowd.pos[0], z: crowd.pos[2] };
    expect(overlapsAny(spot, sceneObstacles('2004', 'street_gig', ['static_plug_amp']))).toBe(false);
    expect(overlapsAny(spot, sceneObstacles('2004', 'street_gig', ['static_plug_amp', 'static_give_mic']))).toBe(true);
  });

  it('props hidden by the story do not block', () => {
    const bench = prop('bench');
    const spot: Spot = { x: bench.pos[0], z: bench.pos[2] };
    expect(overlapsAny(spot, obstaclesOf(visibleProps('present', null, new Set(), new Set())))).toBe(true);
    expect(overlapsAny(spot, obstaclesOf(visibleProps('present', null, new Set(), new Set(['bench']))))).toBe(false);
  });
});

describe('every interactable can still be reached', () => {
  for (const { era, moment } of SCENES) {
    it(`${moment ?? 'today'}: walking from the start spot, at every story step`, () => {
      for (const flags of STAGES) {
        const when = `${moment ?? 'today'} after [${flags.join()}]`;
        const obstacles = sceneObstacles(era, moment, flags);
        expect(overlapsAny(startPlayer(), obstacles), `${when}: the start spot is inside a prop`).toBe(false);
        const { shown, hidden } = propOverrides(content, flags);
        const used = usedObjects(content, flags);
        const targets: Target[] = visibleProps(era, moment, shown, hidden)
          .filter((p) => p.interactable && !used.has(p.id))
          .map((p) => ({ id: p.id, x: p.pos[0], z: p.pos[2] }));
        for (const t of targets) expectRouteTo(t, obstacles, `${when}: ${t.id}`);
        for (const t of targets.filter((x) => canDoNow(x.id, flags))) {
          expect(walkUntilTargeted(t, targets, obstacles), `${when}: walking to ${t.id} never targeted it`).toBe(true);
        }
      }
    }, WALK_TEST_MS);
  }
});

/** A route from the start spot along clear straight lines to a free spot within interact range of `t`. */
function expectRouteTo(t: Target, obstacles: readonly Footprint[], when: string): void {
  let at: Spot = startPlayer();
  const route = findRoute(at, t, obstacles);
  expect(route, `${when}: no route`).not.toBeNull();
  for (const w of route ?? []) {
    expect(lineClear(at, w, obstacles), `${when}: route leg (${at.x.toFixed(2)}, ${at.z.toFixed(2)}) -> (${w.x.toFixed(2)}, ${w.z.toFixed(2)}) is blocked`).toBe(true);
    at = w;
  }
  expect(overlapsAny(at, obstacles), `${when}: the route ends inside a prop`).toBe(false);
  expect(Math.hypot(t.x - at.x, t.z - at.z), `${when}: the route ends out of range`).toBeLessThanOrEqual(T.player.interactRange);
}

/** True when the action on this object is not done yet and its requirements are met. */
function canDoNow(objectId: string, flags: Flags): boolean {
  const action = content.actions.find((a) => a.objectId === objectId);
  return !!action && !flags.includes(action.id) && action.requires.every((r) => flags.includes(r));
}

/** Plays the debug walkTo() with the real controller and collisions: true once `t` is the target. */
function walkUntilTargeted(t: Target, targets: readonly Target[], obstacles: readonly Footprint[]): boolean {
  let p = startPlayer();
  const route = findRoute(p, t, obstacles) ?? [];
  for (let i = 0; i < WALK_LIMIT; i++) {
    if (pickTarget(p, targets) === t.id) return true;
    p = stepPlayer(p, STEER[steerAlong(p, route, t)], dt, obstacles);
  }
  return false;
}
