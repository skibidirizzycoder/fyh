// mira.test.ts — Mira's story data and props fit together and fit in the street.
import { describe, expect, it } from 'vitest';
import mira from '../src/story/cds/mira.json';
import { T } from '../src/tuning.ts';
import { GROUND, PROPS } from '../src/world/layout.ts';
import { MIRA_PLAY_HIDES, MIRA_PLAY_SHOWS, PROPS_MIRA } from '../src/world/props/mira.ts';
import { findZFighting, type Box } from '../src/world/zfight.ts';

const propById = new Map(PROPS_MIRA.map((p) => [p.id, p]));
const street2004 = [GROUND, ...PROPS].filter((p) => p.eras.includes('2004') && !p.moments); // shared by every 2004 moment
const [take, play] = mira.actions;

/** True when two boxes overlap in all three axes by more than `eps`. */
function intersects(a: Box, b: Box, eps = 1e-6): boolean {
  return [0, 1, 2].every((i) => {
    const lo = Math.max((a.pos[i] ?? 0) - (a.size[i] ?? 0) / 2, (b.pos[i] ?? 0) - (b.size[i] ?? 0) / 2);
    const hi = Math.min((a.pos[i] ?? 0) + (a.size[i] ?? 0) / 2, (b.pos[i] ?? 0) + (b.size[i] ?? 0) / 2);
    return hi - lo > eps;
  });
}

describe('Mira story', () => {
  it('happens in the "open_mic" moment on 14 March 2004, with the ids other code uses', () => {
    expect(mira.cd.moment).toBe('open_mic');
    expect(mira.cd.date).toBe('14 March 2004');
    expect(mira.actions.map((a) => [a.id, a.objectId])).toEqual([['mira_take_cd', 'mira_cd'], ['mira_play_cd', 'listening_post']]);
  });

  it('take the CD first, then play it: step 2 requires step 1 and says why when locked', () => {
    expect(take?.requires).toEqual([]);
    expect(play?.requires).toEqual(['mira_take_cd']);
    expect(play?.lockedLine).not.toBe('');
  });

  it('has no placeholder text, a "today" line and an offline newspaper', () => {
    expect(JSON.stringify(mira)).not.toMatch(/PLACEHOLDER/i);
    expect(mira.cd.today.length).toBeGreaterThan(20);
    expect(mira.offline.headline.length).toBeGreaterThan(10);
    expect(mira.offline.article.length).toBeGreaterThan(40);
  });

  it('every action uses an interactable Mira prop, and every interactable is used', () => {
    for (const a of mira.actions) expect(propById.get(a.objectId)?.interactable, a.objectId).toBe(true);
    const used = new Set(mira.actions.map((a) => a.objectId));
    PROPS_MIRA.filter((p) => p.interactable).forEach((p) => expect(used.has(p.id), p.id).toBe(true));
  });

  it('playing the CD swaps the whole scene: exactly the hidden props appear, the waiting/bored ones go', () => {
    expect([...(play?.effects.show ?? [])].sort()).toEqual([...MIRA_PLAY_SHOWS].sort());
    expect([...(play?.effects.hide ?? [])].sort()).toEqual([...MIRA_PLAY_HIDES].sort());
    expect(MIRA_PLAY_SHOWS).toEqual(expect.arrayContaining(['mira_live', 'mira_gathered_1', 'mira_flyer']));
    expect(MIRA_PLAY_HIDES).toEqual(expect.arrayContaining(['mira_waiting', 'mira_bored_1', 'mira_bored_phone_1']));
  });

  it('effects only show props that start hidden, and only hide props that exist', () => {
    for (const a of mira.actions) {
      a.effects.show.forEach((id) => expect(propById.get(id)?.startsHidden, id).toBe(true));
      a.effects.hide.forEach((id) => expect(propById.has(id), id).toBe(true));
    }
  });
});

describe('Mira props', () => {
  it('ids are unique and never clash with the street', () => {
    const ids = [...street2004, ...PROPS_MIRA].map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('only exist in 2004, in the open_mic moment', () => {
    PROPS_MIRA.forEach((p) => {
      expect(p.eras, p.id).toEqual(['2004']);
      expect(p.moments, p.id).toEqual(['open_mic']);
    });
  });

  it('stand inside the street, above the ground', () => {
    for (const p of PROPS_MIRA) {
      expect(Math.abs(p.pos[0]) + p.size[0] / 2, p.id).toBeLessThan(T.world.groundWidth / 2);
      expect(Math.abs(p.pos[2]) + p.size[2] / 2, p.id).toBeLessThan(T.world.groundDepth / 2);
      expect(p.pos[1] - p.size[1] / 2, p.id).toBeGreaterThan(0);
    }
  });

  it('never z-fight or poke into each other or the 2004 street, even with every prop shown', () => {
    const all = [...street2004, ...PROPS_MIRA];
    expect(findZFighting(all, T.world.surfaceGap / 2)).toEqual([]);
    const clashes: string[] = [];
    for (const m of PROPS_MIRA) {
      for (const other of all) if (other !== m && intersects(m, other)) clashes.push(`${m.id} / ${other.id}`);
    }
    expect(clashes).toEqual([]);
  });
});
