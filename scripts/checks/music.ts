// music.ts — smoke checks for the CD music. Owner: Teammate B.
// Headless Chrome plays no real sound: check what SHOULD play via state().audio.music,
// which reads nowPlaying() from src/audio/. See docs/prompts/06-teammate-b-cd-music.md.

import type { Page } from 'playwright';
import { expect, interact, restart, state, travel, type Check } from './tools.ts';

/** Fails unless the music is `want`. */
function expectMusic(s: { audio: { music: string } }, want: string, after: string): void {
  expect(s.audio.music === want, `${after}: music should be "${want}", got "${s.audio.music}"`);
}

/** Uses objects in order; fails if one doesn't work. */
async function use(page: Page, ids: string[]): Promise<void> {
  for (const id of ids) {
    const r = await interact(page, id);
    expect(r.ok, `could not use ${id}: ${JSON.stringify(r)}`);
  }
}

export const checkMusic: Check = async (page: Page) => {
  let s = await restart(page);
  expectMusic(s, '', 'a new game');

  s = await travel(page, 'street_gig');
  expectMusic(s, 'static:2004-broken', 'arriving at the street gig');
  await use(page, ['static_cable_reel']);
  s = await state(page);
  expectMusic(s, 'static:2004', 'after plugging in the amp');

  s = await travel(page, 'open_mic');
  expectMusic(s, '', 'the open mic before Mira\'s CD is played');
  await use(page, ['mira_cd', 'listening_post']);
  s = await travel(page, 'present');
  expectMusic(s, 'mira:today', 'today after fixing Mira');
  return { music: s.audio.music };
};
