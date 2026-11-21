// audio.test.ts — sound reacts to the right events with the right cues.
// Node has no AudioContext, so these check the cue data and lastCue(), not real sound.
import { describe, expect, it } from 'vitest';
import { actionCue, createAudio } from '../src/audio/audio.ts';
import { buildCue, crackleSamples, CUE_NAMES, cueLength, maxPolyphony, noteHz } from '../src/audio/cues.ts';
import { createEvents, type EventName, type GameEvents } from '../src/core/events.ts';
import { T } from '../src/tuning.ts';

/** Real events + audio with no AudioContext (silent, cues still recorded). */
function silentAudio(makeContext: () => AudioContext | null = () => null) {
  const events = createEvents();
  const audio = createAudio(events, { makeContext });
  return { events, audio };
}

const PAYLOADS: { [K in EventName]: GameEvents[K] } = {
  'game-start': {},
  mute: {},
  travel: { to: 'ringtone', era: '2004', moment: 'ringtone' },
  'action-done': { actionId: 'mira_take_cd', cd: 'mira' },
  'action-locked': { actionId: 'kbit_ring_bus_stop', missing: ['kbit_beam_track'] },
  'phone-open': {},
  'phone-close': {},
  'phone-move': { index: 1 },
  'phone-select': { target: 'ringtone' },
  reputation: { level: 1 },
};

describe('cues', () => {
  it('converts MIDI notes to Hz', () => {
    expect(noteHz(69)).toBeCloseTo(440);
    expect(noteHz(81)).toBeCloseTo(880);
  });

  it('every cue makes some sound, quietly, and ends', () => {
    for (const name of CUE_NAMES) {
      const cue = buildCue(name);
      expect(cue.tones.length + cue.noises.length, name).toBeGreaterThan(0);
      expect(cueLength(cue), name).toBeGreaterThan(0);
      expect(cueLength(cue), name).toBeLessThan(5);
      for (const part of [...cue.tones, ...cue.noises]) {
        expect(part.gain, name).toBeGreaterThan(0);
        expect(part.gain, name).toBeLessThanOrEqual(1);
      }
    }
  });

  it('the ringtone is polyphonic: 3-4 notes at once', () => {
    const p = maxPolyphony(buildCue('ringtone'));
    expect(p).toBeGreaterThanOrEqual(3);
    expect(p).toBeLessThanOrEqual(4);
  });

  it('notes play one after another in an arpeggio', () => {
    expect(maxPolyphony(buildCue('beep'))).toBe(1);
    const chime = buildCue('chime');
    expect(chime.tones.map((t) => t.at)).toEqual(T.audio.chime.notes.map((_, i) => i * T.audio.chime.gapSec));
  });

  it('crackle is sparse, about the configured rate, and repeatable', () => {
    const rate = 48000;
    const pops = crackleSamples(rate * 10, rate, 9, 7).filter((s) => s !== 0).length;
    expect(pops).toBeGreaterThan(50);
    expect(pops).toBeLessThan(130);
    expect(crackleSamples(1000, rate, 900, 3)).toEqual(crackleSamples(1000, rate, 900, 3));
  });
});

describe('createAudio', () => {
  it('starts with no cue', () => {
    expect(silentAudio().audio.lastCue()).toBeNull();
  });

  it('maps each game event to its cue', () => {
    const { events, audio } = silentAudio();
    const expected: [EventName, string][] = [
      ['phone-open', 'flip-open'], ['phone-move', 'beep'], ['phone-select', 'blip'], ['travel', 'whoosh'],
      ['action-done', 'chime'], ['action-locked', 'nope'], ['reputation', 'fanfare'], ['phone-close', 'flip-close'],
    ];
    for (const [name, cue] of expected) {
      events.emit(name, PAYLOADS[name]);
      expect(audio.lastCue(), name).toBe(cue);
    }
    expect(audio.history()).toHaveLength(expected.length);
  });

  it('plays the ringtone when the K-Bit bus stop action is done', () => {
    const { events, audio } = silentAudio();
    events.emit('action-done', { actionId: 'kbit_ring_bus_stop', cd: 'kbit' });
    expect(audio.lastCue()).toBe('ringtone');
    expect(actionCue('kbit_beam_track')).toBe('chime');
  });

  it('travel switches the background era', () => {
    const { events, audio } = silentAudio();
    events.emit('travel', PAYLOADS.travel);
    expect(audio.era()).toBe('2004');
    events.emit('travel', { to: 'present', era: 'present', moment: null });
    expect(audio.era()).toBe('present');
  });

  it('the mute event (M) mutes and unmutes; cues are still recorded while muted', () => {
    const { events, audio } = silentAudio();
    events.emit('mute', {});
    expect(audio.isMuted()).toBe(true);
    events.emit('action-locked', PAYLOADS['action-locked']);
    expect(audio.lastCue()).toBe('nope');
    events.emit('mute', {});
    expect(audio.isMuted()).toBe(false);
  });

  it('makes the AudioContext on game-start, never before', () => {
    let made = 0;
    const { events } = silentAudio(() => {
      made++;
      return null;
    });
    events.emit('travel', PAYLOADS.travel);
    expect(made).toBe(0);
    events.emit('game-start', {});
    expect(made).toBe(1);
  });

  it('a broken AudioContext goes quiet instead of breaking the game', () => {
    const { events, audio } = silentAudio(() => {
      throw new Error('no audio device');
    });
    expect(() => events.emit('game-start', {})).not.toThrow();
    expect(audio.failed()).toBe(true);
    events.emit('action-done', PAYLOADS['action-done']);
    expect(audio.lastCue()).toBe('chime');
  });
});

describe('tuning', () => {
  it('the fanfare waits until the travel whoosh is nearly over', () => {
    expect(T.audio.fanfare.delaySec).toBeGreaterThan(T.audio.whoosh.sec / 2);
    expect(T.audio.fanfare.delaySec).toBeLessThanOrEqual(T.audio.whoosh.sec);
  });
});
