// controller.test.ts — movement follows facing at several headings; walking and turning ease
// in and out; targeting.
import { describe, expect, it } from 'vitest';
import { forwardFromYaw } from '../src/core/facing.ts';
import { ease, pickTarget, startPlayer, stepPlayer, wrapDegrees, type MoveInput, type PlayerState } from '../src/player/controller.ts';
import { T } from '../src/tuning.ts';

const still = { forward: false, back: false, turnLeft: false, turnRight: false };
const dt = 1 / T.loop.stepsPerSecond;
const P = T.player;

/** Runs n steps with the same keys held. */
function run(p: PlayerState, keys: MoveInput, n: number): PlayerState {
  for (let i = 0; i < n; i++) p = stepPlayer(p, keys, dt);
  return p;
}

/** Steps an even ramp of `sec` takes (the last one may be a part step). */
const rampSteps = (sec: number): number => Math.ceil(sec / dt - 1e-9);

describe('controller', () => {
  it.each([0, 90, 180, -90, 45])('at full speed, W moves exactly speed*dt along facing at yaw %i', (yaw) => {
    const p = stepPlayer({ x: 0, z: 0, yawDeg: yaw, speed: P.speed }, { ...still, forward: true }, dt);
    const f = forwardFromYaw(yaw);
    expect(p.x).toBeCloseTo(f.x * P.speed * dt, 10);
    expect(p.z).toBeCloseTo(f.z * P.speed * dt, 10);
  });

  it('from standing, W speeds up evenly and reaches full speed after accelSec', () => {
    const first = stepPlayer(startPlayer(), { ...still, forward: true }, dt);
    expect(first.speed).toBeCloseTo((P.speed * dt) / P.accelSec, 10); // one even step of the ramp
    const before = run(startPlayer(), { ...still, forward: true }, rampSteps(P.accelSec) - 1);
    expect(before.speed).toBeLessThan(P.speed);
    const after = run(startPlayer(), { ...still, forward: true }, rampSteps(P.accelSec));
    expect(after.speed).toBe(P.speed);
    const f = forwardFromYaw(P.startYawDeg); // still straight along the start facing
    expect(Math.abs((after.x - P.startX) * f.z - (after.z - P.startZ) * f.x)).toBeLessThan(1e-9);
    expect((after.x - P.startX) * f.x + (after.z - P.startZ) * f.z).toBeGreaterThan(0);
  });

  it('letting go of W slows down evenly to a stop within decelSec, then stays put', () => {
    const walking: PlayerState = { x: 0, z: 0, yawDeg: 0, speed: P.speed };
    const one = stepPlayer(walking, still, dt);
    expect(one.speed).toBeCloseTo(P.speed - (P.speed * dt) / P.decelSec, 10);
    const stopped = run(walking, still, rampSteps(P.decelSec));
    expect(stopped.speed).toBe(0);
    expect(stopped.z).toBeLessThan(0); // it coasted a little
    expect(stopped.z).toBeGreaterThan(-P.speed * P.decelSec); // but less than a full-speed walk
    expect(run(stopped, still, 10)).toEqual(stopped);
  });

  it('S from full speed forwards first slows down, then walks backwards', () => {
    const p = run({ x: 0, z: 0, yawDeg: 0, speed: P.speed }, { ...still, back: true }, rampSteps(P.decelSec) + rampSteps(P.accelSec) + 1);
    expect(p.speed).toBe(-P.speed);
  });

  it('at full turning speed, A turns left (positive yaw) by turnSpeed*dt', () => {
    expect(stepPlayer({ x: 0, z: 0, yawDeg: 0, turnRate: P.turnSpeedDeg }, { ...still, turnLeft: true }, dt).yawDeg).toBeCloseTo(P.turnSpeedDeg * dt);
  });

  it('turning eases in over turnAccelSec and out over turnDecelSec', () => {
    const turning = run(startPlayer(), { ...still, turnLeft: true }, rampSteps(P.turnAccelSec));
    expect(turning.turnRate).toBe(P.turnSpeedDeg);
    expect(stepPlayer(startPlayer(), { ...still, turnRight: true }, dt).turnRate).toBeCloseTo((-P.turnSpeedDeg * dt) / P.turnAccelSec, 10);
    const settled = run(turning, still, rampSteps(P.turnDecelSec));
    expect(settled.turnRate).toBe(0);
    expect(run(settled, still, 5).yawDeg).toBe(settled.yawDeg);
  });

  it('ease() never overshoots what you asked for', () => {
    expect(ease(2.9, 3, 3, 0.2, 0.15, dt)).toBe(3);
    expect(ease(0.1, 0, 3, 0.2, 0.15, dt)).toBe(0);
    expect(ease(0, 0, 3, 0.2, 0.15, dt)).toBe(0);
  });

  it('stays inside the ground', () => {
    const p = stepPlayer({ x: 100, z: -100, yawDeg: 0 }, still, dt);
    expect(p.x).toBe(T.world.groundCenterX + T.world.groundWidth / 2 - T.player.radius);
    expect(p.z).toBe(-(T.world.groundDepth / 2 - T.player.radius));
  });

  it('wraps angles into (-180, 180]', () => {
    expect(wrapDegrees(190)).toBe(-170);
    expect(wrapDegrees(-180)).toBe(180);
    expect(wrapDegrees(540)).toBe(180);
  });

  it('targets only things in range and in front', () => {
    const p = { x: 0, z: 0, yawDeg: 0 };
    expect(pickTarget(p, [{ id: 'ahead', x: 0, z: -1 }])).toBe('ahead');
    expect(pickTarget(p, [{ id: 'behind', x: 0, z: 1 }])).toBeNull();
    expect(pickTarget(p, [{ id: 'far', x: 0, z: -10 }])).toBeNull();
    expect(pickTarget(p, [{ id: 'b', x: 0, z: -2 }, { id: 'a', x: 0, z: -1 }])).toBe('a');
  });
});

describe('running', () => {
  it('holding Shift runs runMultiplier times faster, easing in over the same accelSec', () => {
    const dt = 1 / T.loop.stepsPerSecond;
    let walk = startPlayer();
    let run = startPlayer();
    for (let i = 0; i < Math.ceil(T.player.accelSec / dt) + 2; i++) {
      walk = stepPlayer(walk, { forward: true, back: false, turnLeft: false, turnRight: false }, dt);
      run = stepPlayer(run, { forward: true, back: false, turnLeft: false, turnRight: false, run: true }, dt);
    }
    expect(walk.speed).toBeCloseTo(T.player.speed, 6);
    expect(run.speed).toBeCloseTo(T.player.speed * T.player.runMultiplier, 6);
  });
});
