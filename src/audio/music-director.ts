// music-director.ts — connects the music tracker (what should play) to the music player
// (what does play), and rotates today's playlist when several CDs are fixed.

import { T, type Era } from '../tuning.ts';
import { musicLabel } from './music-rules.ts';
import { createMusicTracker } from './music-state.ts';
import type { MusicPlayer } from './music.ts';

export interface MusicDirector {
  reset(): void;
  travel(era: Era, moment: string | null): void;
  actionDone(actionId: string): void;
  reputation(level: number): void;
  /** Re-sends the current pick to the player (e.g. once the player exists). */
  refresh(): void;
  /** "mira:2004", "static:2004-broken", "kbit:today" or "" (see music-rules.ts). */
  nowPlaying(): string;
  dispose(): void;
}

/**
 * `player()` returns the player once sound is unlocked (null before);
 * `run()` runs Web Audio code safely (audio.ts goes quiet if it throws);
 * `onPick(cd)` hears after every change which CD's song is wanted now, or null (the background ducks under it).
 */
export function createMusicDirector(player: () => MusicPlayer | null, run: (fn: () => void) => void, onPick?: (cd: string | null) => void): MusicDirector {
  const tracker = createMusicTracker();
  let rotation: ReturnType<typeof setTimeout> | null = null;

  function refresh(): void {
    const p = player();
    if (p) run(() => p.set(tracker.pick(), tracker.level()));
    onPick?.(tracker.pick()?.cd ?? null);
    if (rotation) clearTimeout(rotation);
    rotation = null;
    if (p && tracker.playlistLength() > 1) {
      rotation = setTimeout(() => {
        tracker.nextToday();
        refresh();
      }, T.audio.music.todaySwitchSec * 1000);
    }
  }

  /** Runs a tracker update, then tells the player. */
  const then = <A extends unknown[]>(fn: (...args: A) => void) => (...args: A): void => {
    fn(...args);
    refresh();
  };

  return {
    reset: then(() => tracker.reset()),
    travel: then((era: Era, moment: string | null) => tracker.travel(era, moment)),
    actionDone: then((id: string) => tracker.actionDone(id)),
    reputation: then((level: number) => tracker.reputation(level)),
    refresh,
    nowPlaying: () => musicLabel(tracker.pick()),
    dispose() {
      if (rotation) clearTimeout(rotation);
      rotation = null;
    },
  };
}
