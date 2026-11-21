// kbit.test.ts — DJ K-Bit's story data and props fit together and fit in the street.
import { describe, expect, it } from 'vitest';
import kbit from '../src/story/cds/kbit.json';
import { T } from '../src/tuning.ts';
import { GROUND, PROPS } from '../src/world/layout.ts';
import { KBIT_PROPS } from '../src/world/props/kbit.ts';
import { findZFighting, type Box } from '../src/world/zfight.ts';

const propById = new Map(KBIT_PROPS.map((p) => [p.id, p]));
const street2004 = [GROUND, ...PROPS].filter((p) => p.eras.includes('2004'));

/** True when two boxes overlap in all three axes by more than `eps`. */
function intersects(a: Box, b: Box, eps = 1e-6): boolean {
  return [0, 1, 2].every((i) => {
    const lo = Math.max((a.pos[i] ?? 0) - (a.size[i] ?? 0) / 2, (b.pos[i] ?? 0) - (b.size[i] ?? 0) / 2);
    const hi = Math.min((a.pos[i] ?? 0) + (a.size[i] ?? 0) / 2, (b.pos[i] ?? 0) + (b.size[i] ?? 0) / 2);
    return hi - lo > eps;
  });
}

describe('DJ K-Bit story', () => {
  it('happens in the "ringtone" moment on 5 December 2004', () => {
    expect(kbit.cd.moment).toBe('ringtone');
    expect(kbit.cd.date).toBe('5 December 2004');
    kbit.actions.forEach((a) => expect(a.moment, a.id).toBe(kbit.cd.moment));
  });

  it('beam first, then ring: step 2 requires step 1', () => {
    const [beam, ring] = kbit.actions;
    expect(beam?.requires).toEqual([]);
    expect(ring?.requires).toEqual([beam?.id]);
    expect(ring?.lockedLine).not.toBe('');
  });

  it('the last action plays the ringtone', () => {
    expect(T.audio.ringtoneActions).toContain(kbit.actions.at(-1)?.id);
  });

  it('every action uses an interactable K-Bit prop in this moment', () => {
    for (const a of kbit.actions) {
      const prop = propById.get(a.objectId);
      expect(prop?.interactable, a.objectId).toBe(true);
      expect(prop?.eras).toContain('2004');
      expect(prop?.moments).toContain(kbit.cd.moment);
    }
  });

  it('every interactable prop is used by an action (decoration never glows)', () => {
    const used = new Set(kbit.actions.map((a) => a.objectId));
    KBIT_PROPS.filter((p) => p.interactable).forEach((p) => expect(used.has(p.id), p.id).toBe(true));
  });

  it('effects only show or hide K-Bit props that start hidden', () => {
    for (const a of kbit.actions) {
      a.effects.show.forEach((id) => expect(propById.get(id)?.startsHidden, id).toBe(true));
      a.effects.hide.forEach((id) => expect(propById.has(id), id).toBe(true));
    }
  });

  it('has an offline newspaper', () => {
    expect(kbit.offline.headline.length).toBeGreaterThan(10);
    expect(kbit.offline.article.length).toBeGreaterThan(40);
  });
});

describe('DJ K-Bit props', () => {
  it('ids are unique and never clash with the street', () => {
    const ids = [...street2004, ...KBIT_PROPS].map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('only exist in 2004, in the ringtone moment', () => {
    KBIT_PROPS.forEach((p) => {
      expect(p.eras, p.id).toEqual(['2004']);
      expect(p.moments, p.id).toEqual(['ringtone']);
    });
  });

  it('stand inside the street', () => {
    for (const p of KBIT_PROPS) {
      expect(Math.abs(p.pos[0]) + p.size[0] / 2, p.id).toBeLessThan(T.world.groundWidth / 2);
      expect(Math.abs(p.pos[2]) + p.size[2] / 2, p.id).toBeLessThan(T.world.groundDepth / 2);
      expect(p.pos[1] - p.size[1] / 2, p.id).toBeGreaterThan(0); // above the ground, not in it
    }
  });

  it('never z-fight with each other or the 2004 street (all phones shown)', () => {
    expect(findZFighting([...street2004, ...KBIT_PROPS], T.world.surfaceGap / 2)).toEqual([]);
  });

  it('never poke into each other or the 2004 street', () => {
    const clashes: string[] = [];
    for (const k of KBIT_PROPS) {
      for (const other of [...street2004, ...KBIT_PROPS]) {
        if (other !== k && intersects(k, other)) clashes.push(`${k.id} / ${other.id}`);
      }
    }
    expect(clashes).toEqual([]);
  });
});
