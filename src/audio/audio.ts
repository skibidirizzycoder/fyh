// audio.ts — all sound, generated in code with the Web Audio API. Owner: Teammate B.
// PLACEHOLDER: silent. It only remembers which sound WOULD play (lastCue), so tests work.
// Fill it in: listen to events, play sounds, keep every number in the `audio` section of tuning.ts.

import type { Events } from '../core/events.ts';

export interface GameAudio {
  /** Name of the last sound played, e.g. "ringtone" (tests read it via __game.state().audio). */
  lastCue(): string;
  muted(): boolean;
}

/** Creates the sound system and starts listening to game events. */
export function createAudio(events: Events): GameAudio {
  let last = '';
  let isMuted = false;
  const cue = (name: string): void => {
    last = name; // PLACEHOLDER: no sound yet. Teammate B plays a real sound here.
  };

  events.on('travel', () => cue('whoosh'));
  events.on('action-done', (e) => cue(e.actionId === 'kbit_ring' ? 'ringtone' : 'chime'));
  events.on('action-locked', () => cue('nope'));
  events.on('phone-open', () => cue('flip-open'));
  events.on('phone-close', () => cue('flip-close'));
  events.on('phone-move', () => cue('beep'));
  events.on('phone-select', () => cue('select'));
  events.on('reputation', () => cue('fanfare'));
  events.on('mute', () => {
    isMuted = !isMuted;
  });

  return { lastCue: () => last, muted: () => isMuted };
}
