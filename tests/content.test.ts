// content.test.ts — story data must only refer to things that exist.
import { describe, expect, it } from 'vitest';
import base from '../src/story/content.json';
import { buildContent, CD_FILES, content } from '../src/story/content.ts';
import type { StoryContent } from '../src/story/types.ts';
import { validateContent, type PropInfo } from '../src/story/validate.ts';
import { GROUND, PROPS } from '../src/world/layout.ts';

const props: PropInfo[] = [GROUND, ...PROPS].map((p) => ({ id: p.id, eras: p.eras, moments: p.moments, interactable: !!p.interactable }));

/** A deep copy of the real content that a test can break. */
function copy(): StoryContent {
  return structuredClone(content);
}

/** Mira's actions in a copy (always present: Claude owns this CD). */
function mira(c: StoryContent) {
  const [take, play] = c.actions.filter((a) => a.cd === 'mira');
  if (!take || !play) throw new Error("Mira's CD needs two actions");
  return { take, play };
}

describe('the story files', () => {
  it('are valid: every requirement, effect and object refers to an existing id', () => {
    expect(validateContent(content, props)).toEqual([]);
  });

  it('has 3 CDs, each with its own 2004 moment and actions in that moment', () => {
    expect(content.cds).toHaveLength(3);
    for (const cd of content.cds) {
      const actions = content.actions.filter((a) => a.cd === cd.id);
      expect(actions.length, cd.id).toBeGreaterThanOrEqual(1);
      expect(actions.every((a) => a.moment === cd.moment), cd.id).toBe(true);
      expect(cd.finalAction).toBe(actions.at(-1)?.id);
    }
  });

  it('makes one gold disc per CD and one change per reputation level', () => {
    expect(content.changes.map((c) => c.id)).toEqual([...CD_FILES.map((f) => `gold_${f.cd.id}`), ...base.reputation.map((r) => r.id)]);
  });

  it('has offline newspaper text for every change', () => {
    expect(Object.keys(content.news.offline).sort()).toEqual(['default', ...content.changes.map((c) => c.id)].sort());
  });

  it('keeps an action moment that a CD file sets itself', () => {
    const file = structuredClone(CD_FILES[0]);
    if (!file?.actions[0]) throw new Error('no CD');
    file.actions[0].moment = 'elsewhere';
    expect(buildContent(base, [file]).actions[0]?.moment).toBe('elsewhere');
  });
});

describe('the validator catches', () => {
  it('a requirement on an unknown action', () => {
    const c = copy();
    mira(c).play.requires.push('ghost');
    expect(validateContent(c, props)).toContain('"mira_play_cd" requires unknown action "ghost"');
  });

  it('an effect on an unknown prop', () => {
    const c = copy();
    c.changes[0]?.effects.show.push('ufo');
    expect(validateContent(c, props)).toContain(`"${c.changes[0]?.id}" has an effect on unknown prop "ufo"`);
  });

  it('an action using an object that is not interactable', () => {
    const c = copy();
    mira(c).take.objectId = 'bench';
    expect(validateContent(c, props)).toContain('action "mira_take_cd" uses "bench", which is not interactable');
  });

  it('an action using an object from a different moment', () => {
    const c = copy();
    mira(c).take.objectId = 'static_mic';
    expect(validateContent(c, props)).toContain('action "mira_take_cd" happens in "open_mic" but "static_mic" is not in that moment');
  });

  it('a requirement loop', () => {
    const c = copy();
    mira(c).take.requires.push('mira_play_cd');
    expect(validateContent(c, props).some((e) => e.startsWith('requirement loop'))).toBe(true);
  });

  it('offline news for an unknown change', () => {
    const c = copy();
    c.news.offline.ghost = { headline: 'H', article: 'A' };
    expect(validateContent(c, props)).toContain('news.offline has unknown change "ghost"');
  });

  it('duplicate ids, and two CDs in one moment', () => {
    const c = copy();
    mira(c).play.id = 'mira_take_cd';
    const second = c.cds[1];
    if (second) second.moment = 'open_mic';
    const errors = validateContent(c, props);
    expect(errors).toContain('duplicate id "mira_take_cd"');
    expect(errors).toContain('two CDs share the moment "open_mic"');
  });

  it('an ending that is not a change', () => {
    const c = copy();
    c.endingChange = 'nope';
    expect(validateContent(c, props)).toContain('endingChange "nope" is not a change');
  });
});
