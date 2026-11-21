// ui-tv.test.ts — the shop TV follows the game's music and keeps to YouTube's embed rules.

import { describe, expect, it } from 'vitest';
import { content } from '../src/story/content.ts';
import { T } from '../src/tuning.ts';
import { tvWant } from '../src/ui/tv.ts';

const VIDEOS = T.tv.videos as Readonly<Record<string, { id: string; startSec: number; lengthSec: number; credit: string }>>;
const VOLUME = T.tv.volume as Readonly<Record<string, number>>;

describe('the shop TV', () => {
  it('has an official video for every CD, with its song in the credit', () => {
    for (const cd of content.cds) {
      const v = VIDEOS[cd.id];
      expect(v?.id, cd.id).toMatch(/^[\w-]{11}$/);
      expect(v?.credit, cd.id).toContain(cd.title);
    }
  });

  it('starts every song at its chorus, not the intro', () => {
    for (const [cd, v] of Object.entries(VIDEOS)) expect(v.startSec, cd).toBeGreaterThanOrEqual(30);
  });

  it("is at least YouTube's minimum player size (200 x 200) and sits above the dialogue", () => {
    expect(T.tv.screenPx).toBeGreaterThanOrEqual(200);
    expect(T.tv.bottomPx).toBeGreaterThanOrEqual(140); // the three-line dialogue box reaches ~134 px up
  });

  it('plays nothing when the music plays nothing, or for an unknown CD', () => {
    expect(tvWant('', false, 0)).toBeNull();
    expect(tvWant('nobody:today', false, 0)).toBeNull();
  });

  it('sets the volume by music mode, and to 0 when muted', () => {
    expect(tvWant('mira:2004', false, 0)).toEqual({ cd: 'mira', volume: VOLUME['2004'] });
    expect(tvWant('kbit:2004-leak', false, 0)?.volume).toBe(VOLUME['2004-leak']);
    expect(tvWant('static:2004-live', false, 0)?.volume).toBe(VOLUME['2004-live']);
    expect(tvWant('mira:today', false, 0)?.volume).toBe(VOLUME.today);
    expect(tvWant('mira:today', true, 0)?.volume).toBe(0);
    expect(VOLUME['2004-leak']).toBeLessThan(VOLUME['2004'] ?? 0); // the leak is tinny and quiet
  });

  it("cuts in and out with The Static's dying amp, at the amp's rate", () => {
    const half = 1 / (T.audio.music.broken.cutHz * 2); // seconds on, then seconds off
    expect(tvWant('static:2004-broken', false, half * 0.5)?.volume).toBe(VOLUME['2004-broken']);
    expect(tvWant('static:2004-broken', false, half * 1.5)?.volume).toBe(0);
    expect(tvWant('static:2004-broken', false, half * 2.5)?.volume).toBe(VOLUME['2004-broken']);
  });
});
