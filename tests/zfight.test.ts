// zfight.test.ts — no two visible surfaces share a plane where they overlap.
import { describe, expect, it } from 'vitest';
import { content } from '../src/story/content.ts';
import { propOverrides, type Flags } from '../src/story/timeline.ts';
import { T, type Era } from '../src/tuning.ts';
import { visibleProps } from '../src/world/layout.ts';
import { findZFighting } from '../src/world/zfight.ts';

describe('z-fighting', () => {
  it('finds two boxes sitting in the same plane', () => {
    const a = { id: 'a', pos: [0, 0.5, 0], size: [1, 1, 1] } as const;
    const b = { id: 'b', pos: [0.5, 0.5, 0], size: [1, 1, 1] } as const; // same top and bottom faces
    expect(findZFighting([a, b], 0.01)).toEqual(['a / b']);
  });

  it('accepts boxes separated by the gap', () => {
    const a = { id: 'a', pos: [0, 0.5, 0], size: [1, 1, 1] } as const;
    const b = { id: 'b', pos: [0, 1.52, 0], size: [1, 1, 1] } as const;
    expect(findZFighting([a, b], 0.01)).toEqual([]);
  });

  // Check every scene (today + each CD's moment) at every step of the story,
  // since effects show and hide props.
  const ids = content.actions.map((a) => a.id);
  const stages: Flags[] = ids.map((_, i) => ids.slice(0, i));
  stages.push(ids);
  const scenes: { era: Era; moment: string | null }[] = [
    { era: 'present', moment: null },
    ...content.cds.map((c) => ({ era: '2004' as const, moment: c.moment })),
  ];
  for (const { era, moment } of scenes) {
    it(`layout has no z-fighting in ${moment ?? 'today'}, at any story step`, () => {
      for (const flags of stages) {
        const { shown, hidden } = propOverrides(content, flags);
        expect(findZFighting(visibleProps(era, moment, shown, hidden), T.world.surfaceGap / 2), `after ${flags.length} actions`).toEqual([]);
      }
    });
  }
});
