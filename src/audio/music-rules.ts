// music-rules.ts — WHICH song plays, and how, at any moment. Pure functions, no Web Audio.
// In 2004 you hear a CD's raw, broken or ignored version; today the fixed CDs play as remixes.
// music.ts plays whatever these rules pick; nowPlaying() reports it for tests.

import { T, type Era } from '../tuning.ts';

/** How a song is played: muffled 2004, cutting out, opened up, leaking from headphones, or the remix. */
export type MusicMode = '2004' | '2004-broken' | '2004-live' | '2004-leak' | 'today';

export interface NowPlaying {
  cd: string;
  mode: MusicMode;
}

/** What the music needs to know about the game. */
export interface MusicWorld {
  era: Era;
  cd: string | null; // the CD whose 2004 moment you are in (null today)
  done: readonly string[]; // actions done so far
  fixed: readonly string[]; // fixed CDs, most recently fixed first
  todayIndex: number; // which fixed CD today's playlist is on
}

/** When a CD's 2004 song starts, breaks, opens up or leaks (action ids from its story). */
interface PastRule {
  silentUntil?: string;
  brokenUntil?: string;
  liveAfter?: string;
  leakUntil?: string;
}

type CdMusic = { past: PastRule };
const CDS = T.audio.music.cds as Readonly<Record<string, CdMusic>>;

/** The 2004 mode for a CD, given the actions done, or null for silence. */
export function pastMode(cd: string, done: readonly string[]): MusicMode | null {
  const rule = CDS[cd]?.past;
  if (!rule) return null;
  const has = (id: string | undefined): boolean => id !== undefined && done.includes(id);
  if (rule.silentUntil && !has(rule.silentUntil)) return null;
  if (rule.leakUntil) return has(rule.leakUntil) ? null : '2004-leak';
  if (rule.brokenUntil && !has(rule.brokenUntil)) return '2004-broken';
  if (rule.liveAfter && has(rule.liveAfter)) return '2004-live';
  return '2004';
}

/** Picks what plays now: a 2004 moment's song, today's playlist of fixed CDs, or nothing. */
export function chooseMusic(w: MusicWorld): NowPlaying | null {
  if (w.era === '2004') {
    const mode = w.cd ? pastMode(w.cd, w.done) : null;
    return w.cd && mode ? { cd: w.cd, mode } : null;
  }
  if (w.fixed.length === 0) return null;
  const cd = w.fixed[w.todayIndex % w.fixed.length];
  return cd ? { cd, mode: 'today' } : null;
}

/** The test label: "mira:2004", "static:2004-broken", "kbit:today", or "" for none. */
export function musicLabel(np: NowPlaying | null): string {
  return np ? `${np.cd}:${np.mode}` : '';
}

/** Adds newly fixed CDs to the front of the list (most recent first), keeping the rest in order. */
export function addFixed(fixed: readonly string[], fixedNow: readonly string[]): string[] {
  const fresh = fixedNow.filter((cd) => !fixed.includes(cd));
  return [...fresh, ...fixed];
}

/** True when two picks are the same song played the same way. */
export function samePick(a: NowPlaying | null, b: NowPlaying | null): boolean {
  return a?.cd === b?.cd && a?.mode === b?.mode;
}
