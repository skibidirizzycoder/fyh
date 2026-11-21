// street.test.ts — the shared street's details stay decoration and never cover a teammate's prop.
import { describe, expect, it } from 'vitest';
import { content } from '../src/story/content.ts';
import { GROUND, PROPS, type Prop } from '../src/world/layout.ts';
import { KBIT_PROPS } from '../src/world/props/kbit.ts';
import { PROPS_MIRA } from '../src/world/props/mira.ts';
import { PROPS_STATIC } from '../src/world/props/static.ts';
import { PROPS_TODAY } from '../src/world/props/today.ts';
import { STREET_DETAIL } from '../src/world/street.ts';
import type { Box } from '../src/world/zfight.ts';

const byId = new Map(PROPS.map((p) => [p.id, p]));
const STORY_PROPS: readonly Prop[] = [...PROPS_MIRA, ...PROPS_STATIC, ...KBIT_PROPS, ...PROPS_TODAY];

/** True when two boxes overlap in all three axes by more than `eps`. */
function intersects(a: Box, b: Box, eps = 1e-6): boolean {
  return [0, 1, 2].every((i) => {
    const lo = Math.max((a.pos[i] ?? 0) - (a.size[i] ?? 0) / 2, (b.pos[i] ?? 0) - (b.size[i] ?? 0) / 2);
    const hi = Math.min((a.pos[i] ?? 0) + (a.size[i] ?? 0) / 2, (b.pos[i] ?? 0) + (b.size[i] ?? 0) / 2);
    return hi - lo > eps;
  });
}

/** True when two props can be on screen together (a shared era; moments only narrow 2004). */
function shareAScene(a: Prop, b: Prop): boolean {
  return a.eras.some((e) => b.eras.includes(e));
}

describe('the shared street', () => {
  it('keeps the anchors teammates placed their props around', () => {
    const anchors: Record<string, [number, number]> = {
      payphone: [5, -1], old_car: [5, 3.5], bench: [-2, 0], noticeboard: [3.6, 0.5], lamp_post: [-3.5, -3],
      shop_wall: [0, -5.5], shop_door: [2.5, -4.93],
    };
    for (const [id, [x, z]] of Object.entries(anchors)) {
      const p = byId.get(id);
      expect(p, id).toBeDefined();
      expect(p?.pos[0], id).toBeCloseTo(x, 6);
      expect(p?.pos[2], id).toBeCloseTo(z, 6);
    }
  });

  it('every prop id is unique', () => {
    const ids = [GROUND, ...PROPS].map((p) => p.id);
    expect(ids.length - new Set(ids).size).toBe(0);
  });

  it('details are plain decoration: no marker, never hidden at the start, in every scene of their era', () => {
    expect(STREET_DETAIL.length).toBeGreaterThan(0);
    for (const p of STREET_DETAIL) {
      expect(p.decor, p.id).toBe(true);
      expect(p.interactable, p.id).toBeFalsy();
      expect(p.startsHidden, p.id).toBeFalsy();
      expect(p.moments, p.id).toBeUndefined();
    }
  });

  it('the story never shows or hides a detail (they are drawn merged, so they cannot be)', () => {
    const decor = new Set(PROPS.filter((p) => p.decor).map((p) => p.id));
    const effects = [...content.actions, ...content.changes].flatMap((x) => [...x.effects.show, ...x.effects.hide]);
    expect(effects.filter((id) => decor.has(id))).toEqual([]);
  });

  it('lying cylinders and labels are only used where build.ts supports them', () => {
    PROPS.filter((p) => p.axis).forEach((p) => expect(p.shape, p.id).toBe('cylinder'));
    PROPS.filter((p) => p.label).forEach((p) => expect(p.shape, p.id).toBe('box'));
    expect(byId.get('shop_sign')?.label).toBe('HOLLOW RECORDS');
  });

  it('no detail pokes into a prop of a CD moment or of today\'s shop', () => {
    const clashes: string[] = [];
    for (const d of STREET_DETAIL) {
      for (const p of STORY_PROPS) {
        if (shareAScene(d, p) && intersects(d, p)) clashes.push(`${d.id} / ${p.id}`);
      }
    }
    expect(clashes).toEqual([]);
  });

  it('no detail pokes into anything you can interact with', () => {
    const clashes = STREET_DETAIL.flatMap((d) =>
      PROPS.filter((p) => p.interactable && shareAScene(d, p) && intersects(d, p)).map((p) => `${d.id} / ${p.id}`));
    expect(clashes).toEqual([]);
  });
});
