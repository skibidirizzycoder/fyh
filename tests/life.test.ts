// Street life (src/world/life.ts): the tower clock, the pub sign flicker and the pigeons.
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { T } from '../src/tuning.ts';
import { clockAngles, createStreetLife, movePigeon, pubBrightness, sceneClock } from '../src/world/life.ts';

const L = T.life;
const STEPS = T.loop.stepsPerSecond;

/** A pigeon at its first home spot. */
function pigeon(): Parameters<typeof movePigeon>[0] {
  const home = L.pigeonHomes[0] ?? [0, 0];
  return { x: home[0], z: home[1], home, hop: 0, yaw: 0 };
}

describe('street life', () => {
  it('the clock hands show the time: 3:00 is a quarter turn on the hour hand, 0 on the minute hand', () => {
    const t = clockAngles('03:00', 0);
    expect(t.hour).toBeCloseTo(Math.PI / 2, 9);
    expect(t.minute).toBeCloseTo(0, 9);
    expect(clockAngles('03:00', 15 * 60).minute).toBeCloseTo(Math.PI / 2, 9); // it runs on with game time
    expect(clockAngles('21:30', 0).hour).toBeCloseTo((Math.PI * 2 * 9.5) / 12, 9);
    expect(sceneClock('open_mic')).toBe(T.phone.momentTimes.open_mic); // the same time as the phone
    expect(sceneClock('present')).toBe(L.presentClock);
  });

  it('the pub sign is mostly fully lit and dips now and then, the same way every run', () => {
    const seen = Array.from({ length: 600 }, (_, i) => pubBrightness(i / 60));
    const dips = seen.filter((b) => b < 1).length / seen.length;
    expect(dips).toBeGreaterThan(0);
    expect(dips).toBeLessThan(0.3);
    expect(seen.every((b) => b === 1 || b === L.pubFlickerDim)).toBe(true);
    expect(Array.from({ length: 600 }, (_, i) => pubBrightness(i / 60))).toEqual(seen);
  });

  it('a pigeon hops away when you walk near, stays in its strip, and walks home once you are gone', () => {
    const b = pigeon();
    const you = { x: b.x - 1, z: b.z };
    let hopped = false;
    for (let i = 0; i < STEPS * 2; i++) {
      movePigeon(b, you, 1 / STEPS);
      hopped ||= b.hop > 0;
      expect(b.x >= L.pigeonArea.x[0] && b.x <= L.pigeonArea.x[1] && b.z >= L.pigeonArea.z[0] && b.z <= L.pigeonArea.z[1]).toBe(true);
    }
    expect(hopped).toBe(true);
    expect(Math.hypot(b.x - you.x, b.z - you.z)).toBeGreaterThanOrEqual(L.pigeonScareM);
    const far = { x: -100, z: 0 };
    for (let i = 0; i < STEPS * 60; i++) movePigeon(b, far, 1 / STEPS);
    expect(Math.hypot(b.x - b.home[0], b.z - b.home[1])).toBeLessThan(1e-6);
    expect(b.hop).toBe(0); // standing, not hopping
  });

  it('adds two clock hands and one pigeon mesh, and removes them again', () => {
    const scene = new THREE.Scene();
    const sign = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshLambertMaterial());
    const life = createStreetLife(scene, sign);
    expect(scene.children.length).toBe(3);
    life.update('open_mic', 0, { x: 0, z: 0 });
    life.update('open_mic', 10, { x: 0, z: 0 });
    const m = sign.material;
    expect(m.emissiveIntensity).toBeCloseTo(L.pubGlowIntensity * pubBrightness(10 / STEPS), 9);
    life.dispose();
    expect(scene.children.length).toBe(0);
  });
});
