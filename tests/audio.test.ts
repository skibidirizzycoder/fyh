// audio.test.ts — sound reacts to the right events with the right cues.
// Node has no AudioContext, so these check the cue data and lastCue(), not real sound.
import { describe, expect, it } from 'vitest';
import { actionCue, createAudio, travelEra, type SoundEvent, type SoundEvents } from '../src/audio/audio.ts';
import { buildCue, crackleSamples, CUE_NAMES, cueLength, maxPolyphony, noteHz } from '../src/audio/cues.ts';
import { T } from '../src/tuning.ts';

/** A tiny event bus standing in for src/core/events.ts. */
function fakeEvents(): SoundEvents & { emit(name: SoundEvent, payload?: unknown): void } {
  const listeners = new Map<SoundEvent, ((p?: unknown) => void)[]>();
  return {
    on(name, fn) {
      listeners.set(name, [...(listeners.get(name) ?? []), fn]);
    },
    emit(name, payload) {
      (listeners.get(name) ?? []).forEach((fn) => fn(payload));
    },
  };
}

function silentAudio() {
  const events = fakeEvents();
  const audio = createAudio(events, { makeContext: () => null });
  return { events, audio };
}

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
    const expected: [SoundEvent, string][] = [
      ['phone-open', 'flip-open'], ['phone-move', 'beep'], ['phone-select', 'blip'], ['travel', 'whoosh'],
      ['action-done', 'chime'], ['action-locked', 'nope'], ['reputation', 'fanfare'], ['phone-close', 'flip-close'],
    ];
    for (const [event, cue] of expected) {
      events.emit(event, {});
      expect(audio.lastCue(), event).toBe(cue);
    }
    expect(audio.history()).toHaveLength(expected.length);
  });

  it('plays the ringtone when the K-Bit bus stop action is done', () => {
    const { events, audio } = silentAudio();
    events.emit('action-done', { actionId: T.audio.ringtoneActions[0] });
    expect(audio.lastCue()).toBe('ringtone');
  });

  it('travel switches the background era', () => {
    const { events, audio } = silentAudio();
    events.emit('travel', { to: 'ringtone' });
    expect(audio.era()).toBe('2004');
    events.emit('travel', { to: 'today' });
    expect(audio.era()).toBe('present');
  });

  it('M mutes and unmutes; cues are still recorded while muted', () => {
    const { events, audio } = silentAudio();
    expect(audio.toggleMute()).toBe(true);
    events.emit('action-locked');
    expect(audio.lastCue()).toBe('nope');
    expect(audio.toggleMute()).toBe(false);
  });
});

describe('event payloads', () => {
  it('reads the travel destination from several shapes', () => {
    expect(travelEra({ era: 'present' })).toBe('present');
    expect(travelEra('today')).toBe('present');
    expect(travelEra({ to: 'open_mic' })).toBe('2004');
  });

  it('reads the action id from several shapes', () => {
    const ring = T.audio.ringtoneActions[0];
    expect(actionCue(ring)).toBe('ringtone');
    expect(actionCue({ id: ring })).toBe('ringtone');
    expect(actionCue({ actionId: 'take_cd' })).toBe('chime');
  });
});
