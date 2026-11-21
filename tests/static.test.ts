// static.test.ts — The Static's story data and props fit together and fit in the street.
import { describe, expect, it } from 'vitest';
import staticCd from '../src/story/cds/static.json';
import { T } from '../src/tuning.ts';
import { GROUND, PROPS } from '../src/world/layout.ts';
import { PROPS_STATIC, STATIC_FIX_SHOWS } from '../src/world/props/static.ts';
import { findZFighting, type Box } from '../src/world/zfight.ts';

const propById = new Map(PROPS_STATIC.map((p) => [p.id, p]));
const street2004 = [GROUND, ...PROPS].filter((p) => p.eras.includes('2004') && !p.moments); // shared by every 2004 moment
const [plug, give] = staticCd.actions;
const AISLE = { minX: 0, maxX: 1.6 }; // from the player's start to the mic: nobody stands here

/** True when two boxes overlap in all three axes by more than `eps`. */
function intersects(a: Box, b: Box, eps = 1e-6): boolean {
  return [0, 1, 2].every((i) => {
    const lo = Math.max((a.pos[i] ?? 0) - (a.size[i] ?? 0) / 2, (b.pos[i] ?? 0) - (b.size[i] ?? 0) / 2);
    const hi = Math.min((a.pos[i] ?? 0) + (a.size[i] ?? 0) / 2, (b.pos[i] ?? 0) + (b.size[i] ?? 0) / 2);
    return hi - lo > eps;
  });
}

describe('The Static story', () => {
  it('keeps the ids other code uses', () => {
    expect(staticCd.cd.moment).toBe('street_gig');
    expect(staticCd.actions.map((a) => [a.id, a.objectId])).toEqual([['static_plug_amp', 'static_cable_reel'], ['static_give_mic', 'static_mic']]);
  });

  it('handing over the mic shows exactly the payoff: crowd, set list and tip jar', () => {
    expect([...(give?.effects.show ?? [])].sort()).toEqual([...STATIC_FIX_SHOWS].sort());
    expect(give?.effects.hide).toEqual([]);
    expect(STATIC_FIX_SHOWS).toEqual(expect.arrayContaining(['static_crowd_1', 'static_crowd_2', 'static_crowd_3', 'static_setlist', 'static_tip_jar']));
  });

  it('the crowd is bigger, and some have their arms up', () => {
    const bodies = PROPS_STATIC.filter((p) => /^static_crowd_\d+$/.test(p.id));
    const arms = PROPS_STATIC.filter((p) => /^static_crowd_\d+_arm_[lr]$/.test(p.id));
    expect(bodies.length).toBeGreaterThanOrEqual(6);
    expect(arms.length).toBeGreaterThanOrEqual(4);
    for (const arm of arms) {
      const head = propById.get(arm.id.replace(/_arm_[lr]$/, '_head'));
      expect(head, arm.id).toBeDefined();
      expect(arm.pos[1] + arm.size[1] / 2, `${arm.id} reaches above the head`).toBeGreaterThan((head?.pos[1] ?? 0) + (head?.size[1] ?? 0) / 2);
    }
  });

  it('nobody in the crowd stands in the aisle from the start to the mic', () => {
    for (const p of PROPS_STATIC.filter((x) => x.id.startsWith('static_crowd_'))) {
      const [x] = p.pos;
      const half = p.size[0] / 2;
      expect(x + half <= AISLE.minX || x - half >= AISLE.maxX, p.id).toBe(true);
    }
  });

  it('effects only show props that start hidden, and only hide props that exist', () => {
    for (const a of [plug, give]) {
      a?.effects.show.forEach((id) => expect(propById.get(id)?.startsHidden, id).toBe(true));
      a?.effects.hide.forEach((id) => expect(propById.has(id), id).toBe(true));
    }
  });

  it('decoration never gets a marker: only the reel and the mic are interactable', () => {
    expect(PROPS_STATIC.filter((p) => p.interactable).map((p) => p.id).sort()).toEqual(['static_cable_reel', 'static_mic']);
  });
});

describe('The Static props', () => {
  it('ids are unique and never clash with the street', () => {
    const ids = [...street2004, ...PROPS_STATIC].map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('stand inside the street, above the ground', () => {
    for (const p of PROPS_STATIC) {
      expect(Math.abs(p.pos[0]) + p.size[0] / 2, p.id).toBeLessThan(T.world.groundWidth / 2);
      expect(Math.abs(p.pos[2]) + p.size[2] / 2, p.id).toBeLessThan(T.world.groundDepth / 2);
      expect(p.pos[1] - p.size[1] / 2, p.id).toBeGreaterThan(0);
    }
  });

  it('never z-fight or poke into each other or the 2004 street, even with every prop shown', () => {
    const all = [...street2004, ...PROPS_STATIC];
    // A prop one step hides and another it shows may share a spot (the amp's red and green light).
    const swaps = new Set(staticCd.actions.flatMap((a) => a.effects.show.flatMap((s) => a.effects.hide.map((h) => [s, h].sort().join(' / ')))));
    expect(findZFighting(all, T.world.surfaceGap / 2).filter((pair) => !swaps.has(pair.split(' / ').sort().join(' / ')))).toEqual([]);
    const clashes: string[] = [];
    for (const s of PROPS_STATIC) {
      for (const other of all) {
        if (other !== s && intersects(s, other) && !swaps.has([s.id, other.id].sort().join(' / '))) clashes.push(`${s.id} / ${other.id}`);
      }
    }
    expect(clashes).toEqual([]);
  });
});
