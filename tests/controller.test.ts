// controller.test.ts — movement follows facing at several headings; targeting.
import { describe, expect, it } from 'vitest';
import { forwardFromYaw } from '../src/core/facing.ts';
import { pickTarget, stepPlayer, wrapDegrees } from '../src/player/controller.ts';
import { T } from '../src/tuning.ts';

const still = { forward: false, back: false, turnLeft: false, turnRight: false };
const dt = 1 / T.loop.stepsPerSecond;

describe('controller', () => {
  it.each([0, 90, 180, -90, 45])('W moves exactly speed*dt along facing at yaw %i', (yaw) => {
    const p = stepPlayer({ x: 0, z: 0, yawDeg: yaw }, { ...still, forward: true }, dt);
    const f = forwardFromYaw(yaw);
    expect(p.x).toBeCloseTo(f.x * T.player.speed * dt, 10);
    expect(p.z).toBeCloseTo(f.z * T.player.speed * dt, 10);
  });

  it('A turns left (positive yaw) by turnSpeed*dt', () => {
    expect(stepPlayer({ x: 0, z: 0, yawDeg: 0 }, { ...still, turnLeft: true }, dt).yawDeg).toBeCloseTo(T.player.turnSpeedDeg * dt);
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
