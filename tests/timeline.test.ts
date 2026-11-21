// timeline.test.ts — requirements, the snowball order and the present-state function.
import { describe, expect, it } from 'vitest';
import contentJson from '../src/story/content.json';
import { causesOf, doAction, presentState, propOverrides, type Flags } from '../src/story/timeline.ts';
import type { StoryContent } from '../src/story/types.ts';

const content: StoryContent = contentJson;

/** Does actions in order and returns the final flags (failing ones are skipped). */
function play(ids: string[]): Flags {
  return ids.reduce<Flags>((flags, id) => doAction(content, flags, id).flags, []);
}

describe('requirements', () => {
  it('an action with no requirements can be done first', () => {
    expect(doAction(content, [], 'take_cd')).toMatchObject({ ok: true, flags: ['take_cd'] });
  });

  it('an action is locked until its requirement is done, and names what is missing', () => {
    expect(doAction(content, [], 'play_cd')).toMatchObject({ ok: false, reason: 'locked', missing: ['take_cd'] });
  });

  it('doing the same action twice is refused', () => {
    expect(doAction(content, ['take_cd'], 'take_cd')).toMatchObject({ ok: false, reason: 'already-done' });
  });

  it('an unknown action is refused', () => {
    expect(doAction(content, [], 'nope')).toMatchObject({ ok: false, reason: 'unknown' });
  });

  it('never changes the flags it was given', () => {
    const flags: Flags = Object.freeze([]);
    doAction(content, flags, 'take_cd');
    expect(flags).toEqual([]);
  });
});

describe('the snowball', () => {
  it('only the right order reaches the last action', () => {
    expect(play(['take_cd', 'play_cd', 'pin_flyer'])).toEqual(['take_cd', 'play_cd', 'pin_flyer']);
  });

  it('the wrong order stalls: later actions fail until earlier ones are done', () => {
    expect(play(['pin_flyer', 'play_cd', 'take_cd'])).toEqual(['take_cd']);
  });

  it('causes are listed earliest first, following requirements back to the start', () => {
    expect(causesOf(content, ['pin_flyer']).map((a) => a.id)).toEqual(['take_cd', 'play_cd', 'pin_flyer']);
  });
});

describe('present state', () => {
  it('nothing done: the present is unchanged', () => {
    expect(presentState(content, [])).toEqual({ shop_saved: false });
  });

  it('a partial chain does not change the present', () => {
    expect(presentState(content, play(['take_cd', 'play_cd']))).toEqual({ shop_saved: false });
  });

  it('the full chain changes the present', () => {
    expect(presentState(content, play(['take_cd', 'play_cd', 'pin_flyer']))).toEqual({ shop_saved: true });
  });

  it('is a pure function: same flags, same answer, every time', () => {
    const flags = play(['take_cd', 'play_cd', 'pin_flyer']);
    expect(presentState(content, flags)).toEqual(presentState(content, [...flags]));
  });

  it('the present change swaps the boarded window for the open shop', () => {
    const { shown, hidden } = propOverrides(content, play(['take_cd', 'play_cd', 'pin_flyer']));
    expect([...shown]).toEqual(expect.arrayContaining(['open_sign', 'lit_window']));
    expect(hidden.has('boarded_window')).toBe(true);
  });
});
