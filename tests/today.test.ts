// today.test.ts — today's shop: every level's props exist, fit together and grow with reputation.
import { describe, expect, it } from 'vitest';
import contentJson from '../src/story/content.json';
import { GROUND, PROPS } from '../src/world/layout.ts';
import { PROPS_TODAY } from '../src/world/props/today.ts';
import type { Box } from '../src/world/zfight.ts';

const levels = contentJson.reputation;
const todayIds = new Set(PROPS_TODAY.map((p) => p.id));
const street = [GROUND, ...PROPS].filter((p) => p.eras.includes('present') && !todayIds.has(p.id));

/** True when two boxes overlap in all three axes by more than `eps`. */
function intersects(a: Box, b: Box, eps = 1e-6): boolean {
  return [0, 1, 2].every((i) => {
    const lo = Math.max((a.pos[i] ?? 0) - (a.size[i] ?? 0) / 2, (b.pos[i] ?? 0) - (b.size[i] ?? 0) / 2);
    const hi = Math.min((a.pos[i] ?? 0) + (a.size[i] ?? 0) / 2, (b.pos[i] ?? 0) + (b.size[i] ?? 0) / 2);
    return hi - lo > eps;
  });
}

/** Today's props visible at a reputation level (levels add up). */
function visibleAt(level: number): typeof PROPS_TODAY {
  const on = levels.filter((l) => l.count <= level);
  const shown = new Set(on.flatMap((l) => l.effects.show));
  const hidden = new Set(on.flatMap((l) => l.effects.hide));
  return PROPS_TODAY.filter((p) => !hidden.has(p.id) && (!p.startsHidden || shown.has(p.id) || p.id.startsWith('gold_')));
}

describe('today\'s shop', () => {
  it('every reputation effect names a today prop', () => {
    for (const l of levels) {
      [...l.effects.show, ...l.effects.hide].forEach((id) => expect(todayIds.has(id), `${l.id}: ${id}`).toBe(true));
    }
  });

  it('starts boarded up: boards on, nothing open, frames waiting for discs', () => {
    const ids = visibleAt(0).map((p) => p.id);
    expect(ids).toEqual(expect.arrayContaining(['boarded_window', 'rep_door_boards', 'frame_mira', 'frame_static', 'frame_kbit']));
    expect(ids).not.toContain('open_sign');
  });

  it('gets fuller at every level', () => {
    const counts = [0, 1, 2, 3].map((l) => visibleAt(l).filter((p) => !p.id.startsWith('gold_')).length);
    for (let l = 1; l <= 3; l++) expect(counts[l], `level ${l}`).toBeGreaterThan(counts[l - 1] ?? 0);
  });

  it('level 2 has a queue of 3-4 and level 3 a crowd and the neon sign', () => {
    const at2 = visibleAt(2).map((p) => p.id);
    expect(at2.filter((id) => id.startsWith('rep_queue_')).length).toBeGreaterThanOrEqual(3);
    const at3 = visibleAt(3).map((p) => p.id);
    expect(at3).toEqual(expect.arrayContaining(['rep_plaque', 'rep_neon', 'rep_crowd_1']));
  });

  it('nothing pokes into anything else, at any level', () => {
    for (let level = 0; level <= 3; level++) {
      const scene = [...street, ...visibleAt(level)];
      const clashes: string[] = [];
      for (const t of visibleAt(level)) {
        for (const other of scene) if (other !== t && intersects(t, other)) clashes.push(`${t.id} / ${other.id}`);
      }
      expect(clashes, `level ${level}`).toEqual([]);
    }
  });

  it('decoration never glows: today has no interactables', () => {
    PROPS_TODAY.forEach((p) => expect(p.interactable, p.id).toBeFalsy());
  });
});
