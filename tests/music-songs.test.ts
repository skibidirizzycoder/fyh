// music-songs.test.ts — which recording each CD plays: your local copy of the real song, or the stand-in.

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { cutSection, localSongs, songFor } from '../src/audio/songs.ts';
import { content } from '../src/story/content.ts';
import { T } from '../src/tuning.ts';

type Real = { song: string; startSec: number; lengthSec: number; bpm: number };
const CDS = T.audio.music.cds as Readonly<Record<string, { file: string; bpm: number; real: Real }>>;
const NONE: Record<string, string> = {};

describe('the songs each CD plays', () => {
  it('every CD names the real song it covers, and its title matches the story', () => {
    const titles: Record<string, string> = { mira: 'Lose Yourself', static: "Sweet Child O' Mine", kbit: 'Despacito' };
    for (const [cd, title] of Object.entries(titles)) {
      expect(CDS[cd]?.real.song, cd).toContain(title);
      expect(content.cds.find((c) => c.id === cd)?.title, cd).toBe(title);
    }
  });

  it('without local copies (git, the live site) every CD plays its Creative Commons stand-in', () => {
    for (const cd of Object.keys(CDS)) {
      const song = songFor(cd, NONE);
      expect(song, cd).toMatchObject({ url: CDS[cd]?.file, local: false, bpm: CDS[cd]?.bpm, section: null });
    }
    expect(localSongs(NONE)).toEqual([]);
  });

  it('a local copy of the real song replaces the stand-in, cut to its section at its own tempo', () => {
    const local = { './local-songs/mira.mp3': '/src/audio/local-songs/mira.mp3' };
    const real = CDS.mira?.real;
    expect(songFor('mira', local)).toEqual({
      url: '/src/audio/local-songs/mira.mp3', local: true, bpm: real?.bpm, beatOffsetSec: 0,
      section: { startSec: real?.startSec, lengthSec: real?.lengthSec },
    });
    expect(songFor('static', local)?.local).toBe(false); // the others keep their stand-ins
    expect(localSongs(local)).toEqual(['mira']);
  });

  it('each real section is whole bars, so the loop stays on the beat', () => {
    for (const [cd, { real }] of Object.entries(CDS)) {
      const bars = real.lengthSec / ((4 * 60) / real.bpm);
      expect(Math.abs(bars - Math.round(bars)), `${cd}: ${bars.toFixed(3)} bars`).toBeLessThan(0.02);
      expect(bars, cd).toBeGreaterThanOrEqual(8);
    }
  });

  it('cutSection keeps exactly the chosen part of every channel', () => {
    const rate = 10;
    const data = [Float32Array.from({ length: 100 }, (_, i) => i), Float32Array.from({ length: 100 }, (_, i) => -i)];
    const song = { sampleRate: rate, length: 100, numberOfChannels: 2, getChannelData: (c: number) => data[c] } as unknown as AudioBuffer;
    const made: Float32Array[] = [];
    const ctx = {
      createBuffer: (channels: number, length: number) => {
        for (let c = 0; c < channels; c++) made.push(new Float32Array(length));
        return { copyToChannel: (src: Float32Array, c: number) => made[c]?.set(src) };
      },
    } as unknown as BaseAudioContext;
    cutSection(ctx, song, 2, 3); // samples 20..49
    expect(made.map((m) => [m.length, m[0], m.at(-1)])).toEqual([[30, 20, 49], [30, -20, -49]]);
    made.length = 0;
    cutSection(ctx, song, 8, 5); // runs off the end: stops at the last sample
    expect(made[0]?.length).toBe(20);
  });

  it('the real recordings can never be committed: the folder is git-ignored and holds only its README', () => {
    const ignore = readFileSync('.gitignore', 'utf8');
    expect(ignore).toContain('src/audio/local-songs/*');
    expect(ignore).toContain('!src/audio/local-songs/README.md');
    const tracked = execSync('git ls-files src/audio/local-songs', { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
    expect(tracked.every((f) => f.endsWith('README.md')), tracked.join(', ')).toBe(true);
  });
});
