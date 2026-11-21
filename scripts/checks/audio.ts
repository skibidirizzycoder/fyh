// audio.ts — smoke checks for sound. Owner: Teammate B.
// Headless Chrome plays no real sound, so we check which cue was triggered (lastCue).
// The basics below work with the silent stub. Add the rest from your prompt
// (docs/prompts/04-teammate-b-sound-and-dj-kbit.md).

import type { Page } from 'playwright';
import { expect, restart, tap, travel } from './tools.ts';

export async function checkAudio(page: Page): Promise<Record<string, unknown>> {
  await restart(page);
  let s = await travel(page, 'open_mic');
  expect(s.audio.lastCue === 'whoosh', `travelling should whoosh, got "${s.audio.lastCue}"`);
  s = await tap(page, 'KeyM');
  expect(s.audio.muted, 'M did not mute');
  s = await tap(page, 'KeyM');
  expect(!s.audio.muted, 'M did not unmute');
  // TODO(Teammate B): an action plays "chime", a locked action plays "nope", the phone beeps...
  return { lastCue: s.audio.lastCue };
}
