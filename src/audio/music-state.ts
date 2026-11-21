// music-state.ts — follows game events and remembers what the music needs: where you are,
// which actions are done, which CDs are fixed (most recent first) and the reputation level.
// No Web Audio here, so tests can drive it with plain events.

import { content } from '../story/content.ts';
import { fixedCds } from '../story/timeline.ts';
import type { Era } from '../tuning.ts';
import { addFixed, chooseMusic, type MusicWorld, type NowPlaying } from './music-rules.ts';

export interface MusicTracker {
  /** A new game (Enter on the title): forget everything. */
  reset(): void;
  travel(era: Era, moment: string | null): void;
  actionDone(actionId: string): void;
  reputation(level: number): void;
  /** Today, with several fixed CDs: move on to the next song. */
  nextToday(): void;
  pick(): NowPlaying | null;
  level(): number;
  /** How many CDs today's playlist rotates through. */
  playlistLength(): number;
}

/** The CD whose 2004 moment this is. */
function cdOfMoment(moment: string | null): string | null {
  return content.cds.find((c) => c.moment === moment)?.id ?? null;
}

export function createMusicTracker(): MusicTracker {
  let world: MusicWorld = { era: 'present', cd: null, done: [], fixed: [], todayIndex: 0 };
  let level = 0;

  return {
    reset() {
      world = { era: 'present', cd: null, done: [], fixed: [], todayIndex: 0 };
      level = 0;
    },
    travel(era, moment) {
      world = { ...world, era, cd: era === '2004' ? cdOfMoment(moment) : null, todayIndex: 0 };
    },
    actionDone(actionId) {
      const done = world.done.includes(actionId) ? world.done : [...world.done, actionId];
      world = { ...world, done, fixed: addFixed(world.fixed, fixedCds(content, done)) };
    },
    reputation(l) {
      level = l;
    },
    nextToday() {
      world = { ...world, todayIndex: world.todayIndex + 1 };
    },
    pick: () => chooseMusic(world),
    level: () => level,
    playlistLength: () => (world.era === 'present' ? world.fixed.length : 0),
  };
}
