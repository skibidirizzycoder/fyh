// music.test.ts — which song plays when, the code beat, and the music config.
// Node has no Web Audio: these test the pure rules and nowPlaying(), not real sound.
import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createAudio } from '../src/audio/audio.ts';
import { barSec, beatBar } from '../src/audio/beat.ts';
import { addFixed, chooseMusic, pastMode, type MusicWorld } from '../src/audio/music-rules.ts';
import { createEvents } from '../src/core/events.ts';
import { content } from '../src/story/content.ts';
import { T } from '../src/tuning.ts';

const world = (w: Partial<MusicWorld>): MusicWorld => ({ era: '2004', cd: null, done: [], fixed: [], todayIndex: 0, ...w });

describe('music rules in 2004', () => {
  it('Mira is silent until her CD is played at the listening post', () => {
    expect(pastMode('mira', [])).toBeNull();
    expect(pastMode('mira', ['mira_take_cd'])).toBeNull();
    expect(pastMode('mira', ['mira_take_cd', 'mira_play_cd'])).toBe('2004');
  });

  it('The Static cut out until the amp is plugged in, then open up with the mic', () => {
    expect(pastMode('static', [])).toBe('2004-broken');
    expect(pastMode('static', ['static_plug_amp'])).toBe('2004');
    expect(pastMode('static', ['static_plug_amp', 'static_give_mic'])).toBe('2004-live');
  });

  it('K-Bit\'s track leaks from his headphones, goes quiet for your ringtone, then plays from every phone', () => {
    expect(pastMode('kbit', [])).toBe('2004-leak');
    expect(pastMode('kbit', ['kbit_beam_track'])).toBeNull(); // AirDropped: your ringtone is next
    expect(pastMode('kbit', ['kbit_beam_track', 'kbit_ring_bus_stop'])).toBe('2004-live'); // the queue plays it
  });

  it('plays the song of the moment you are in', () => {
    expect(chooseMusic(world({ cd: 'static' }))).toEqual({ cd: 'static', mode: '2004-broken' });
    expect(chooseMusic(world({ cd: null }))).toBeNull();
  });
});

describe('music rules today', () => {
  it('is silent until a CD is fixed', () => {
    expect(chooseMusic(world({ era: 'present' }))).toBeNull();
  });

  it('plays the most recently fixed CD first, then rotates', () => {
    const fixed = addFixed(addFixed([], ['kbit']), ['kbit', 'mira']);
    expect(fixed).toEqual(['mira', 'kbit']);
    expect(chooseMusic(world({ era: 'present', fixed }))).toEqual({ cd: 'mira', mode: 'today' });
    expect(chooseMusic(world({ era: 'present', fixed, todayIndex: 1 }))?.cd).toBe('kbit');
    expect(chooseMusic(world({ era: 'present', fixed, todayIndex: 2 }))?.cd).toBe('mira');
  });
});

describe('nowPlaying() follows game events', () => {
  function play() {
    const events = createEvents();
    const audio = createAudio(events, { makeContext: () => null });
    events.emit('game-start', {});
    const travel = (to: string): void => {
      const cd = content.cds.find((c) => c.moment === to);
      events.emit('travel', { to, era: cd ? '2004' : 'present', moment: cd ? cd.moment : null });
    };
    const done = (actionId: string): void => events.emit('action-done', { actionId, cd: null });
    return { events, audio, travel, done };
  }

  it('the smoke route: broken Static, plugged in, then Mira today', () => {
    const { events, audio, travel, done } = play();
    expect(audio.nowPlaying()).toBe('');
    travel('street_gig');
    expect(audio.nowPlaying()).toBe('static:2004-broken');
    done('static_plug_amp');
    expect(audio.nowPlaying()).toBe('static:2004');
    travel('open_mic');
    expect(audio.nowPlaying()).toBe('');
    done('mira_take_cd');
    done('mira_play_cd');
    expect(audio.nowPlaying()).toBe('mira:2004');
    travel('present');
    events.emit('reputation', { level: 1 });
    expect(audio.nowPlaying()).toBe('mira:today');
  });

  it('a new game forgets the fixed CDs', () => {
    const { events, audio, travel, done } = play();
    done('mira_take_cd');
    done('mira_play_cd');
    travel('present');
    expect(audio.nowPlaying()).toBe('mira:today');
    events.emit('game-start', {});
    expect(audio.nowPlaying()).toBe('');
  });
});

describe('the code beat', () => {
  it('is exactly one bar of 4 beats long', () => {
    const rate = 48000;
    expect(beatBar(120, rate).length).toBe(Math.round(0.5 * rate) * 4);
    expect(barSec(120)).toBeCloseTo(2);
  });

  it('hits on every beat and stays within -1..1', () => {
    const rate = 48000;
    const bar = beatBar(100, rate);
    const beat = Math.round(0.6 * rate);
    for (let i = 0; i < 4; i++) {
      const hit = bar.slice(i * beat, i * beat + 2000);
      expect(Math.max(...hit.map(Math.abs)), `beat ${i}`).toBeGreaterThan(0.3);
    }
    expect(Math.max(...bar.map(Math.abs))).toBeLessThanOrEqual(1);
  });
});

describe('music config', () => {
  const cds = T.audio.music.cds as Readonly<Record<string, { file: string; past: Record<string, string> }>>;

  it('has a song entry for every CD', () => {
    expect(Object.keys(cds).sort()).toEqual(content.cds.map((c) => c.id).sort());
  });

  it('every 2004 rule names a real action of that CD', () => {
    for (const [cd, cfg] of Object.entries(cds)) {
      for (const actionId of Object.values(cfg.past)) {
        expect(content.actions.find((a) => a.id === actionId)?.cd, `${cd}: ${actionId}`).toBe(cd);
      }
    }
  });

  it('every song file that is set exists in public/ (a missing one would 404 in the console)', () => {
    for (const [cd, cfg] of Object.entries(cds)) {
      if (cfg.file) expect(existsSync(`public/${cfg.file}`), `${cd}: public/${cfg.file}`).toBe(true);
    }
  });
});
