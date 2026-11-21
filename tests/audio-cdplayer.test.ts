// audio-cdplayer.test.ts — the CD player's sounds (B7): tray, click, spin-up, seek, then the time whoosh.
import { describe, expect, it } from 'vitest';
import { createAudio } from '../src/audio/audio.ts';
import { buildCue, cueLength, maxPolyphony, whooshDelay } from '../src/audio/cues.ts';
import type { UpcomingEvents } from '../src/audio/upcoming.ts';
import { createEvents } from '../src/core/events.ts';
import { T } from '../src/tuning.ts';

const C = T.audio.cdInsert;

describe('the CD player cue', () => {
  const cue = buildCue('cd-insert');

  it('runs in order: tray out + clunk, disc click, tray in + clunk, spin-up, laser seeks', () => {
    const clunks = cue.tones.filter((t) => t.note === C.clunk.note).map((t) => t.at);
    expect(clunks).toEqual(C.trays.map((at) => at + C.motor.sec));
    const [out, back] = clunks;
    expect(C.click.at).toBeGreaterThan(out ?? Infinity); // the disc goes in while the tray is out...
    expect(C.click.at + C.click.sec).toBeLessThan(C.trays[1] ?? 0); // ...before it closes
    expect(C.spin.at).toBeGreaterThanOrEqual((back ?? Infinity) + C.clunk.sec); // spins once the tray is shut
    for (const at of C.seek.at) {
      expect(at).toBeGreaterThan(C.spin.at);
      expect(at).toBeLessThan(C.spin.at + C.spin.sec);
    }
  });

  it('spins UP (pitch and hiss rise), and is short enough to feel snappy', () => {
    const spin = cue.tones.find((t) => t.at === C.spin.at && t.wave === 'sine');
    expect((spin?.toNote ?? 0) > (spin?.note ?? 0)).toBe(true);
    const hiss = cue.noises.find((n) => n.at === C.spin.at);
    expect((hiss?.toHz ?? 0) > (hiss?.fromHz ?? 0)).toBe(true);
    expect(cueLength(cue)).toBeLessThan(1.5);
    expect(maxPolyphony(cue)).toBeLessThanOrEqual(4);
  });

  it('the whoosh lands during the spin-up', () => {
    expect(C.whooshAtSec).toBeGreaterThan(C.spin.at);
    expect(C.whooshAtSec).toBeLessThanOrEqual(C.spin.at + C.spin.sec);
  });

  it('the music ducks under it', () => {
    expect(T.audio.music.duckCues).toContain('cd-insert');
  });
});

describe('the time whoosh after a CD goes in', () => {
  it('waits for the spin-up if travel comes straight away, never if it comes later', () => {
    expect(whooshDelay(null, 10)).toBe(0); // no CD yet (the phone): at once
    expect(whooshDelay(10, 10)).toBeCloseTo(C.whooshAtSec); // same moment: on the spin-up
    expect(whooshDelay(10, 10.4)).toBeCloseTo(C.whooshAtSec - 0.4);
    expect(whooshDelay(10, 10 + C.whooshAtSec + 1)).toBe(0); // long after: at once
  });
});

describe('the cd-insert event', () => {
  it('plays the CD player, then travel plays the whoosh', () => {
    const events = createEvents();
    const audio = createAudio(events, { makeContext: () => null });
    const send = <K extends keyof UpcomingEvents>(name: K, payload: UpcomingEvents[K]): void =>
      (events.emit as unknown as (n: K, p: UpcomingEvents[K]) => void)(name, payload);
    send('cd-insert', { cd: 'kbit' });
    expect(audio.lastCue()).toBe('cd-insert');
    events.emit('travel', { to: 'ringtone', era: '2004', moment: 'ringtone' });
    expect(audio.history().slice(-2)).toEqual(['cd-insert', 'whoosh']);
  });
});

describe('the title event (B9, bug 5)', () => {
  it("back on the title, the last game's music stops", () => {
    const events = createEvents();
    const audio = createAudio(events, { makeContext: () => null });
    const send = <K extends keyof UpcomingEvents>(name: K, payload: UpcomingEvents[K]): void =>
      (events.emit as unknown as (n: K, p: UpcomingEvents[K]) => void)(name, payload);
    events.emit('game-start', {});
    events.emit('action-done', { actionId: 'mira_take_cd', cd: 'mira' });
    events.emit('action-done', { actionId: 'mira_play_cd', cd: 'mira' });
    events.emit('travel', { to: 'present', era: 'present', moment: null });
    expect(audio.nowPlaying()).toBe('mira:today'); // the ending's music, still playing...
    send('title', {});
    expect(audio.nowPlaying()).toBe(''); // ...until the title: silence
    events.emit('game-start', {});
    expect(audio.nowPlaying()).toBe(''); // and a new game starts with nothing fixed
  });
});
