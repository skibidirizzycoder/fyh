// feel-player.ts — plays the "game feel" sounds from feel.ts when the game says something happened:
// footsteps while walking, a rustle when a paper panel opens, a soft whoosh when the camera moves in,
// and blip voices while a line of dialogue shows.
// These events are REQUESTED from Claude (docs/notes/teammate-b.md); until the game sends them, nothing plays.

import { T } from '../tuning.ts';
import type { Cue } from './cues.ts';
import { footstepCue, paperCue, speakerFor, voiceCue, zoomCue } from './feel.ts';

/** The events feel listens to, with the shapes asked for. */
export interface FeelEvents {
  walk: { moving: boolean }; // the player started or stopped walking
  dialogue: { line: string; speaker?: string | null }; // a line of dialogue appeared
  panel: { name: string; open: boolean }; // the "Because you..." card or the newspaper opened/closed
  'camera-zoom': { zoomIn: boolean }; // the camera eased in for dialogue, or back out
}

export interface FeelSource {
  on<K extends keyof FeelEvents>(name: K, listener: (payload: FeelEvents[K]) => void): unknown;
}

export interface Feel {
  travel(moment: string | null): void;
  walk(moving: boolean): void;
  dialogue(line: string, speaker?: string | null): void;
  panel(open: boolean): void;
  zoom(zoomIn: boolean): void;
  /** The last few feel sounds, oldest first: "step", "paper", "zoom-in", "voice:mira", ... */
  history(): readonly string[];
  dispose(): void;
}

const KEEP = 50;

/** `play` sends a cue to the speakers (it does nothing while muted or before audio starts). */
export function createFeel(play: (cue: Cue) => void): Feel {
  const played: string[] = [];
  let moment: string | null = null;
  let steps = 0;
  let walking: ReturnType<typeof setInterval> | null = null;

  function sound(name: string, cue: Cue): void {
    played.push(name);
    if (played.length > KEEP) played.shift();
    play(cue);
  }
  function stopWalking(): void {
    if (walking !== null) clearInterval(walking);
    walking = null;
  }

  return {
    travel(m) {
      moment = m;
      stopWalking();
    },
    walk(moving) {
      if (!moving) return stopWalking();
      if (walking !== null) return;
      sound('step', footstepCue(steps++)); // the first step lands at once
      walking = setInterval(() => sound('step', footstepCue(steps++)), T.audio.feel.step.stepSec * 1000);
    },
    dialogue(line, speaker) {
      if (!line) return;
      const who = speakerFor(moment, speaker);
      sound(`voice:${who}`, voiceCue(line, who));
    },
    panel(open) {
      if (open) sound('paper', paperCue(played.length));
    },
    zoom(zoomIn) {
      sound(zoomIn ? 'zoom-in' : 'zoom-out', zoomCue(zoomIn));
    },
    history: () => played,
    dispose: stopWalking,
  };
}

/** Routes the feel events to `feel`. */
export function subscribeFeel(events: FeelSource, feel: Feel): void {
  events.on('walk', (e) => feel.walk(e.moving));
  events.on('dialogue', (e) => feel.dialogue(e.line, e.speaker));
  events.on('panel', (e) => feel.panel(e.open));
  events.on('camera-zoom', (e) => feel.zoom(e.zoomIn));
}
