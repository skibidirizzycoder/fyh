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

  const beamed = await interact(page, 'kbit_phone');
  expect(beamed.ok, 'could not beam the track from K-Bit\'s phone');
  s = await step(page, 1);
  expectCue(s, 'beam', 'beaming the track by infrared');

  await travel(page, 'open_mic');
  const done = await interact(page, 'mira_cd');
  expect(done.ok, 'could not pick up Mira\'s CD');
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
  return { cues: 7, muteToggles: 2, soundscapes: await checkSoundscapes(page) };
};

/**
 * Each moment has its own background. Checked once the debug API shows `audio.ambience`
 * (requested from Claude: it should read soundscape() from src/audio/); until then it says so.
 */
async function checkSoundscapes(page: Page): Promise<string> {
  const places = ['open_mic', 'street_gig', 'ringtone', 'present'];
  for (const place of places) {
    const s = await travel(page, place);
    const ambience = (s.audio as { ambience?: string }).ambience;
    if (ambience === undefined) return 'not exposed by the debug API yet';
    expect(ambience === place, `${place} should sound like "${place}", got "${ambience}"`);
  }
  return places.join(',');
}
