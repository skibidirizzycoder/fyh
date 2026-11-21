// music.ts — smoke checks for the CD music. Owner: Teammate B.
// Headless Chrome plays no real sound: check what SHOULD play via state().audio.music,
// which reads nowPlaying() from src/audio/. See docs/prompts/06-teammate-b-cd-music.md.

import type { Page } from 'playwright';

export async function checkMusic(page: Page): Promise<Record<string, unknown>> {
  void page;
  // TODO(Teammate B): e.g. restart; travel to 'street_gig' -> music "static:2004-broken";
  // do static_plug_amp -> "static:2004"; fix Mira, travel to 'present' -> "mira:today".
  return {};
}
