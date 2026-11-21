// lanes.test.ts — `npm run ship` lets a lane change only its own files.
import { describe, expect, it } from 'vitest';
import { LANES, laneForBranch, matches, outsideLane } from '../scripts/lanes.ts';

describe('lane ownership', () => {
  it('matches exact paths, dir/** and * inside a name', () => {
    expect(matches('src/audio/music.ts', 'src/audio/**')).toBe(true);
    expect(matches('tests/music-mix.test.ts', 'tests/music*.test.ts')).toBe(true);
    expect(matches('src/audio.ts', 'src/audio/**')).toBe(false);
    expect(matches('tests/sub/music.test.ts', 'tests/music*.test.ts')).toBe(false);
  });

  it('finds the lane for a branch, and none for main', () => {
    expect(laneForBranch('feat/sound-kbit')?.name).toBe('sound-kbit');
    expect(laneForBranch('feat/sound-kbit-music')?.name).toBe('sound-kbit'); // a second session's branch
    expect(laneForBranch('feat/sound-kbitx')).toBeUndefined();
    expect(laneForBranch('main')).toBeUndefined();
  });

  it('refuses files outside the lane but allows the shared ones', () => {
    const lane = LANES.find((l) => l.name === 'phone-static');
    if (!lane) throw new Error('lane missing');
    expect(outsideLane(lane, ['src/phone/view.ts', 'src/tuning.ts', 'src/ui/hud.ts'])).toEqual([]);
    expect(outsideLane(lane, ['src/game.ts', 'src/audio/audio.ts'])).toEqual(['src/game.ts', 'src/audio/audio.ts']);
  });

  it('no file is owned by two lanes', () => {
    const [a, b] = LANES;
    if (!a || !b) throw new Error('need two lanes');
    expect(a.owns.filter((p) => b.owns.includes(p))).toEqual([]);
  });
});
