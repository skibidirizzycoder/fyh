// zfight.test.ts — no two visible surfaces share a plane where they overlap.
import { describe, expect, it } from 'vitest';
import contentJson from '../src/story/content.json';
import { propOverrides, type Flags } from '../src/story/timeline.ts';
import type { StoryContent } from '../src/story/types.ts';
import { ERAS, T } from '../src/tuning.ts';
import { visibleProps } from '../src/world/layout.ts';
import { findZFighting } from '../src/world/zfight.ts';

const content: StoryContent = contentJson;

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

  // Check every era at every step of the story, since effects show and hide props.
  const stages: Flags[] = content.actions.map((_, i) => content.actions.slice(0, i).map((a) => a.id));
  stages.push(content.actions.map((a) => a.id));
  for (const era of ERAS) {
    stages.forEach((flags, i) => {
      it(`layout has no z-fighting in ${era}, story step ${i}`, () => {
        const { shown, hidden } = propOverrides(content, flags);
        expect(findZFighting(visibleProps(era, shown, hidden), T.world.surfaceGap / 2)).toEqual([]);
      });
    });
  }
});
