// ui-tv.test.ts — the shop TV follows the game's music and keeps to YouTube's embed rules.

import { describe, expect, it } from 'vitest';
import { content } from '../src/story/content.ts';
import { T } from '../src/tuning.ts';
import { tvWant } from '../src/ui/tv.ts';

const VIDEOS = T.tv.videos as Readonly<Record<string, { id: string; startSec: number; lengthSec: number; credit: string }>>;

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

  const cds = content.cds;
  const at = (moment: string | null, flags: string[]) => ({ era: moment ? '2004' : 'present', moment, flags });
  const finalOf = (id: string): string => cds.find((c) => c.id === id)?.finalAction ?? '';

  it("stays off when you arrive in a moment, until that moment's objective is done", () => {
    for (const cd of cds) {
      expect(tvWant(at(cd.moment, []), cds, false), `${cd.id} on arrival`).toBeNull();
      expect(tvWant(at(cd.moment, [cd.finalAction]), cds, false), `${cd.id} fixed`).toEqual({ cd: cd.id, volume: T.tv.volume });
    }
  });

  it("is off after travelling: in another CD's unfixed moment, and today", () => {
    const flags = [finalOf('mira')];
    expect(tvWant(at('open_mic', flags), cds, false)?.cd).toBe('mira');
    expect(tvWant(at('street_gig', flags), cds, false)).toBeNull(); // Mira's song doesn't follow you
    expect(tvWant(at(null, cds.map((c) => c.finalAction)), cds, false)).toBeNull(); // today: off
  });

  it("doesn't count earlier steps as the objective (The Static's amp, K-Bit's beam)", () => {
    expect(tvWant(at('street_gig', ['static_plug_amp']), cds, false)).toBeNull();
    expect(tvWant(at('ringtone', ['kbit_beam_track']), cds, false)).toBeNull();
  });

  it('is silent when muted', () => {
    expect(tvWant(at('open_mic', [finalOf('mira')]), cds, true)?.volume).toBe(0);
  });
});
