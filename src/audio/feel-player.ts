// feel-player.ts — plays the "game feel" sounds from feel.ts when the game says something happened:
// a footstep each stride, a rustle when a paper panel opens, a soft whoosh when the camera moves in,
// and blip voices while a line of dialogue shows.
// These events are REQUESTED from Claude (docs/notes/teammate-b.md); until the game sends them, nothing plays.
// No timers here: the game decides when a step lands (by distance walked, in fixed steps), so pausing the
// game or hiding the tab can never leave footsteps running.

import type { Cue } from './cues.ts';
import { footstepCue, paperCue, speakerFor, voiceCue, zoomCue } from './feel.ts';

/** The events feel listens to, with the shapes asked for. */
export interface FeelEvents {
  footstep: Record<string, never>; // the player walked one stride (T.audio.feel.step.strideM)
  dialogue: { line: string; speaker?: string | null }; // a line of dialogue appeared
  panel: { name: string; open: boolean }; // the "Because you..." card or the newspaper opened/closed
  'camera-zoom': { zoomIn: boolean }; // the camera eased in for dialogue, or back out
}

export interface FeelSource {
  on<K extends keyof FeelEvents>(name: K, listener: (payload: FeelEvents[K]) => void): unknown;
}

export interface Feel {
  travel(moment: string | null): void;
  footstep(): void;
  dialogue(line: string, speaker?: string | null): void;
  panel(open: boolean): void;
  zoom(zoomIn: boolean): void;
  /** The last few feel sounds that played, oldest first: "step", "paper", "zoom-in", "voice:mira", ... */
  history(): readonly string[];
}

const KEEP = 50;

/**
 * `play` sends a cue to the speakers (it does nothing while muted or before audio starts).
 * `failed` is called if building a cue throws: audio.ts then goes quiet, like any other audio failure,
 * instead of the error reaching the game.
 */
export function createFeel(play: (cue: Cue) => void, failed: () => void): Feel {
  const played: string[] = [];
  let moment: string | null = null;
  let steps = 0;
  let papers = 0;

  function sound(name: string, make: () => Cue): void {
    let cue: Cue;
    try {
      cue = make();
    } catch {
      failed();
      return; // not recorded: history only lists sounds that really played
    }
    played.push(name);
    if (played.length > KEEP) played.shift();
    play(cue);
  }

  return {
    travel(m) {
      moment = m;
    },
    footstep() {
      sound('step', () => footstepCue(steps++));
    },
    dialogue(line, speaker) {
      if (!line) return;
      const who = speakerFor(moment, speaker);
      sound(`voice:${who}`, () => voiceCue(line, who));
    },
    panel(open) {
      if (open) sound('paper', () => paperCue(papers++)); // its own counter: every rustle differs
    },
    zoom(zoomIn) {
      sound(zoomIn ? 'zoom-in' : 'zoom-out', () => zoomCue(zoomIn));
    },
    history: () => played,
  };
}

/** Routes the feel events to `feel`. */
export function subscribeFeel(events: FeelSource, feel: Feel): void {
  events.on('footstep', () => feel.footstep());
  events.on('dialogue', (e) => feel.dialogue(e.line, e.speaker));
  events.on('panel', (e) => feel.panel(e.open));
  events.on('camera-zoom', (e) => feel.zoom(e.zoomIn));
}
