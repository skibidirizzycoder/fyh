// songs.ts — which recording each CD plays.
// The CDs are covers of real songs ("Lose Yourself", "Sweet Child O' Mine", "Despacito"). Those
// recordings are copyrighted, so they are NEVER committed or deployed: for a local demo, put your own
// copies in src/audio/local-songs/<cd>.mp3 (mira, static, kbit; the folder is git-ignored) and the
// build plays them, cut to T.audio.music.cds[cd].real (startSec, lengthSec, bpm). Without them, each
// CD plays its Creative Commons stand-in from public/music/ (credited in public/music/CREDITS.md).

import { T } from '../tuning.ts';

/** Local real songs found at build time: './local-songs/mira.mp3' -> its URL. Empty in git and on the live site. */
const LOCAL = import.meta.glob('./local-songs/*.mp3', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

interface CdConfig {
  file: string;
  bpm: number;
  beatOffsetSec: number;
  real?: { startSec: number; lengthSec: number; bpm: number };
}

export interface Song {
  url: string;
  local: boolean; // the real recording from local-songs/
  bpm: number;
  beatOffsetSec: number;
  section: { startSec: number; lengthSec: number } | null; // the part of a full song to keep; null = the whole clip
}

const CDS = T.audio.music.cds as Readonly<Record<string, CdConfig>>;

/** The recording a CD plays: the local real song when there is one, else the stand-in; null if neither. */
export function songFor(cd: string, local: Readonly<Record<string, string>> = LOCAL): Song | null {
  const cfg = CDS[cd];
  if (!cfg) return null;
  const url = local[`./local-songs/${cd}.mp3`];
  if (url && cfg.real) {
    return { url, local: true, bpm: cfg.real.bpm, beatOffsetSec: 0, section: { startSec: cfg.real.startSec, lengthSec: cfg.real.lengthSec } };
  }
  if (!cfg.file) return null;
  return { url: cfg.file, local: false, bpm: cfg.bpm, beatOffsetSec: cfg.beatOffsetSec, section: null };
}

/** Which CDs play their real recording in this build. */
export function localSongs(local: Readonly<Record<string, string>> = LOCAL): string[] {
  return Object.keys(CDS).filter((cd) => songFor(cd, local)?.local === true);
}

/** Copies [startSec, startSec + lengthSec) of a decoded song into a new buffer: the part that loops. */
export function cutSection(ctx: BaseAudioContext, song: AudioBuffer, startSec: number, lengthSec: number): AudioBuffer {
  const from = Math.min(Math.floor(startSec * song.sampleRate), song.length - 1);
  const length = Math.max(1, Math.min(Math.floor(lengthSec * song.sampleRate), song.length - from));
  const out = ctx.createBuffer(song.numberOfChannels, length, song.sampleRate);
  for (let c = 0; c < song.numberOfChannels; c++) out.copyToChannel(song.getChannelData(c).subarray(from, from + length), c);
  return out;
}
