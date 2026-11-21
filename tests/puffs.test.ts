// puffs.test.ts — dust puffs start as you break into a run or stop, spread, rise, fade, and cost one draw.
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { forwardFromYaw } from '../src/core/facing.ts';
import { createPuffs, motePlace, puffAt, puffTrigger, type PuffWatch } from '../src/player/puffs.ts';
import { T } from '../src/tuning.ts';

const U = T.puffs;
const WALK: number = T.player.speed;
const RUN: number = T.player.speed * T.player.runMultiplier;
const LIFE = U.lifeSec * T.loop.stepsPerSecond;

/** Feeds speeds to the trigger in order; returns the puffs it asked for. */
function kinds(speeds: number[]): (string | null)[] {
  let watch: PuffWatch = { last: 0, peak: 0 };
  return speeds.map((v) => {
    const seen = puffTrigger(watch, v);
    watch = seen.watch;
    return seen.kind;
  });
}

describe('dust puffs', () => {
  it('puff once as you break into a run and once as you stop, not while walking or creeping', () => {
    expect(kinds([0, 1, 2, WALK, WALK, 4, RUN, RUN])).toEqual([null, null, null, null, null, 'run', null, null]);
    expect(kinds([WALK, 2, 1, 0.2, 0])).toEqual([null, null, null, 'stop', null]);
    expect(kinds([RUN, 3, 0.1])).toEqual(['run', null, 'stop']); // straight into a run, then a stop
    expect(kinds([1, 1.5, 0.2, 0])).toEqual([null, null, null, null]); // a slow shuffle
  });

  it('kick a run\'s puff out behind the feet and a stop\'s in front', () => {
    const p = { x: 1, z: 2, yawDeg: 30 };
    const f = forwardFromYaw(30);
    const run = puffAt(p, 'run', 5);
    const stop = puffAt(p, 'stop', 5);
    expect((run.x - p.x) * f.x + (run.z - p.z) * f.z).toBeCloseTo(-U.kickM, 9);
    expect((stop.x - p.x) * f.x + (stop.z - p.z) * f.z).toBeCloseTo(U.kickM, 9);
  });

  it('spread out, rise and fade over lifeSec, the same every time', () => {
    const puff = { x: 0, z: 0, frame: 100 };
    const at = (frame: number) => motePlace(puff, 3, frame);
    expect(at(99).alpha).toBe(0);
    expect(at(100).alpha).toBeCloseTo(U.alpha, 9);
    const mid = at(100 + LIFE / 2);
    expect(Math.hypot(mid.x, mid.z)).toBeGreaterThan(U.spreadM * 0.5);
    expect(mid.y).toBeGreaterThan(at(100).y);
    expect(mid.alpha).toBeLessThan(U.alpha / 2);
    expect(at(100 + LIFE).alpha).toBe(0);
    expect(at(130)).toEqual(motePlace({ ...puff }, 3, 130));
  });

  it('draw with one Points, shown only while a puff is alive', () => {
    const scene = new THREE.Scene();
    const puffs = createPuffs(scene);
    const points = scene.getObjectByName('player_puffs') as THREE.Points;
    expect(points.visible).toBe(false);
    const p = (frame: number, speed: number) => puffs.update({ x: 0, z: 0, yawDeg: 0, speed }, frame);
    p(1, WALK);
    p(2, WALK);
    expect(points.visible).toBe(false);
    p(3, RUN); // breaks into a run
    expect(points.visible).toBe(true);
    p(3 + LIFE, RUN);
    expect(points.visible).toBe(false);
    puffs.dispose();
    expect(scene.getObjectByName('player_puffs')).toBeUndefined();
  });
});
