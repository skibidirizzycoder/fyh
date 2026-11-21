// content.test.ts — story data must only refer to things that exist.
import { describe, expect, it } from 'vitest';
import contentJson from '../src/story/content.json';
import type { StoryContent } from '../src/story/types.ts';
import { validateContent, type PropInfo } from '../src/story/validate.ts';
import { GROUND, PROPS } from '../src/world/layout.ts';

const content: StoryContent = contentJson;
const props: PropInfo[] = [GROUND, ...PROPS].map((p) => ({ id: p.id, eras: p.eras, interactable: !!p.interactable }));

/** A deep copy of the real content that a test can break. */
function copy(): StoryContent {
  return structuredClone(content);
}

describe('content.json', () => {
  it('is valid: every requirement, effect and object refers to an existing id', () => {
    expect(validateContent(content, props)).toEqual([]);
  });

  it('demo has 3 past actions chaining into 1 present-day change', () => {
    expect(content.actions).toHaveLength(3);
    expect(content.changes).toHaveLength(1);
  });

  it('catches a requirement on an unknown action', () => {
    const c = copy();
    c.actions[1]?.requires.push('ghost');
    expect(validateContent(c, props)).toContain('"play_cd" requires unknown action "ghost"');
  });

  it('catches an effect on an unknown prop', () => {
    const c = copy();
    c.changes[0]?.effects.show.push('ufo');
    expect(validateContent(c, props)).toContain('"shop_saved" has an effect on unknown prop "ufo"');
  });

  it('catches an action using an object that does not exist or is not interactable', () => {
    const c = copy();
    if (c.actions[0]) c.actions[0].objectId = 'bench';
    expect(validateContent(c, props)).toContain('action "take_cd" uses "bench", which is not interactable');
  });

  it('catches a requirement loop', () => {
    const c = copy();
    c.actions[0]?.requires.push('pin_flyer');
    expect(validateContent(c, props).some((e) => e.startsWith('requirement loop'))).toBe(true);
  });

  it('catches duplicate ids', () => {
    const c = copy();
    if (c.actions[2]) c.actions[2].id = 'take_cd';
    expect(validateContent(c, props)).toContain('duplicate id "take_cd"');
  });
});
