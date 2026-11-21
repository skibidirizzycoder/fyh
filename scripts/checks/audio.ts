// audio.ts — smoke checks for sound. Owner: Teammate B.
// Headless Chrome plays no real sound, so we check which cue each game event triggered (lastCue).
// Keys go through the game's input (tap), the same path as a real key press.

import type { Page } from 'playwright';
import { expect, interact, restart, step, tap, travel, type Check } from './tools.ts';

/** Fails unless the last cue is `cue`. */
function expectCue(s: { audio: { lastCue: string } }, cue: string, after: string): void {
  expect(s.audio.lastCue === cue, `${after} should play "${cue}", got "${s.audio.lastCue}"`);
}

export const checkAudio: Check = async (page: Page) => {
  await restart(page);
  let s = await travel(page, 'ringtone');
  expectCue(s, 'whoosh', 'travelling');

  const locked = await interact(page, 'kbit_bus_stop'); // needs the beamed track first
  expect(!locked.ok, 'the bus stop should be locked before the track is beamed');
  s = await step(page, 1); // a real frame, then read the cue
  expectCue(s, 'nope', 'a locked action');

  const done = await interact(page, 'kbit_phone');
  expect(done.ok, 'could not beam the track from K-Bit\'s phone');
  s = await step(page, 1);
  expectCue(s, 'chime', 'a finished action');

  s = await tap(page, 'KeyQ');
  expectCue(s, 'flip-open', 'opening the phone');
  s = await tap(page, 'ArrowDown');
  expectCue(s, 'beep', 'moving in the phone menu');
  s = await tap(page, 'KeyQ');
  expectCue(s, 'flip-close', 'closing the phone');

  s = await tap(page, 'KeyM');
  expect(s.audio.muted, 'M did not mute');
  s = await tap(page, 'KeyM');
  expect(!s.audio.muted, 'M did not unmute');
  return { cues: 6, muteToggles: 2 };
};
