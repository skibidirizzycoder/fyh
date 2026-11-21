// timeline.test.ts — requirements, the snowball order, reputation and the present-state function.
// Uses Mira's CD for exact ids (the other CDs are teammates' and may change).
import { describe, expect, it } from 'vitest';
import { content } from '../src/story/content.ts';
import { causesOf, doAction, fixedCds, isChangeActive, presentState, propOverrides, reputationLevel, type Flags } from '../src/story/timeline.ts';

const MIRA = ['mira_take_cd', 'mira_play_cd'];
const EVERYTHING = content.actions.map((a) => a.id); // CD files list actions in a doable order

/** Does actions in order and returns the final flags (failing ones are skipped). */
function play(ids: string[]): Flags {
  return ids.reduce<Flags>((flags, id) => doAction(content, flags, id).flags, []);
}

describe('requirements', () => {
  it('an action with no requirements can be done first', () => {
    expect(doAction(content, [], 'mira_take_cd')).toMatchObject({ ok: true, flags: ['mira_take_cd'] });
  });

  it('an action is locked until its requirement is done, and names what is missing', () => {
    expect(doAction(content, [], 'mira_play_cd')).toMatchObject({ ok: false, reason: 'locked', missing: ['mira_take_cd'] });
  });

  it('doing the same action twice is refused', () => {
    expect(doAction(content, ['mira_take_cd'], 'mira_take_cd')).toMatchObject({ ok: false, reason: 'already-done' });
  });

  it('an unknown action is refused', () => {
    expect(doAction(content, [], 'nope')).toMatchObject({ ok: false, reason: 'unknown' });
  });

  it('never changes the flags it was given', () => {
    const flags: Flags = Object.freeze([]);
    doAction(content, flags, 'mira_take_cd');
    expect(flags).toEqual([]);
  });
});

describe('the snowball', () => {
  it('the right order fixes the CD; the wrong order stalls', () => {
    expect(play(MIRA)).toEqual(MIRA);
    expect(play([...MIRA].reverse())).toEqual(['mira_take_cd']);
  });

  it('causes are listed earliest first, following requirements back to the start', () => {
    expect(causesOf(content, ['mira_play_cd']).map((a) => a.id)).toEqual(MIRA);
  });

  it('every action in the story can be done, in file order', () => {
    expect(play(EVERYTHING)).toEqual(EVERYTHING);
  });
});

describe('CDs and reputation', () => {
  it('a CD is fixed when its last action is done', () => {
    expect(fixedCds(content, ['mira_take_cd'])).toEqual([]);
    expect(fixedCds(content, play(MIRA))).toEqual(['mira']);
    expect(reputationLevel(content, play(EVERYTHING))).toBe(content.cds.length);
  });

  it('"at least N of" requirements count only what is done', () => {
    const change = { id: 'x', label: '', line: '', requires: [], minOf: { count: 2, of: ['a', 'b', 'c'] }, effects: { show: [], hide: [] } };
    expect(isChangeActive(change, ['a'])).toBe(false);
    expect(isChangeActive(change, ['a', 'c'])).toBe(true);
    expect(isChangeActive({ ...change, requires: ['z'] }, ['a', 'c'])).toBe(false);
  });
});

describe('present state', () => {
  const active = (flags: Flags): string[] => Object.entries(presentState(content, flags)).filter(([, on]) => on).map(([id]) => id);

  it('nothing done: the present is unchanged', () => {
    expect(active([])).toEqual([]);
  });

  it('half a CD does not change the present', () => {
    expect(active(['mira_take_cd'])).toEqual([]);
  });

  it('one CD fixed: its gold disc and the first reputation level', () => {
    expect(active(play(MIRA))).toEqual(['gold_mira', 'rep_open']);
  });

  it('every CD fixed: every gold disc and every reputation level', () => {
    expect(active(play(EVERYTHING))).toEqual(content.changes.map((c) => c.id));
  });

  it('is a pure function: same flags, same answer, every time', () => {
    const flags = play(MIRA);
    expect(presentState(content, flags)).toEqual(presentState(content, [...flags]));
  });

  it('one CD fixed opens the shop and hangs its gold disc', () => {
    const { shown, hidden } = propOverrides(content, play(MIRA));
    expect([...shown]).toEqual(expect.arrayContaining(['open_sign', 'lit_window', 'gold_mira', 'mira_flyer']));
    expect(hidden.has('boarded_window')).toBe(true);
    expect(shown.has('rep_posters')).toBe(false);
  });
});
