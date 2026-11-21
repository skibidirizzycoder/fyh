// audio-feel.test.ts — footsteps, paper, camera whoosh, blip voices, and the key click on the phone.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAudio } from '../src/audio/audio.ts';
import { buildCue, cueLength, noiseOffset } from '../src/audio/cues.ts';
import { footstepCue, paperCue, SPEAKERS, speakerFor, syllables, voiceCue, zoomCue } from '../src/audio/feel.ts';
import type { FeelEvents } from '../src/audio/feel-player.ts';
import { createEvents } from '../src/core/events.ts';
import { T } from '../src/tuning.ts';

const F = T.audio.feel;

/** The real event bus, plus a way to send the feel events the game doesn't send yet. */
function setup() {
  const events = createEvents();
  const audio = createAudio(events, { makeContext: () => null });
  const send = <K extends keyof FeelEvents>(name: K, payload: FeelEvents[K]): void =>
    (events.emit as unknown as (n: K, p: FeelEvents[K]) => void)(name, payload);
  return { events, audio, send };
}

afterEach(() => vi.useRealTimers());

describe('footsteps', () => {
  it('cycle through a few variants, each a little off-pitch', () => {
    const steps = Array.from({ length: F.step.variants }, (_, i) => footstepCue(i));
    expect(new Set(steps.map((c) => c.noises[0]?.fromHz)).size).toBe(F.step.variants);
    expect(footstepCue(F.step.variants)).toEqual(steps[0]);
    for (const c of steps) {
      expect(Math.abs((c.noises[0]?.fromHz ?? 0) / F.step.fromHz - 1)).toBeLessThanOrEqual(F.step.pitchJitter);
      expect(cueLength(c)).toBeLessThan(F.step.stepSec);
    }
  });

  it('play while walking, one every stepSec, and stop when you stop', () => {
    vi.useFakeTimers();
    const { audio, send } = setup();
    send('walk', { moving: true });
    vi.advanceTimersByTime(F.step.stepSec * 1000 * 3 + 1);
    send('walk', { moving: true }); // still walking: no second rhythm
    expect(audio.feel().filter((n) => n === 'step')).toHaveLength(4);
    send('walk', { moving: false });
    vi.advanceTimersByTime(5000);
    expect(audio.feel()).toHaveLength(4);
  });

  it('never become the lastCue (the story sounds stay checkable)', () => {
    vi.useFakeTimers();
    const { audio, events, send } = setup();
    events.emit('action-done', { actionId: 'kbit_ring_bus_stop', cd: 'kbit' });
    send('walk', { moving: true });
    vi.advanceTimersByTime(2000);
    expect(audio.lastCue()).toBe('ringtone');
    events.emit('travel', { to: 'present', era: 'present', moment: null }); // travelling stops the feet
    const n = audio.feel().length;
    vi.advanceTimersByTime(2000);
    expect(audio.feel()).toHaveLength(n);
    audio.dispose();
  });
});

describe('voices', () => {
  it('each moment has its speaker; the event can name one', () => {
    expect(speakerFor('open_mic')).toBe('mira');
    expect(speakerFor('street_gig')).toBe('band');
    expect(speakerFor('ringtone')).toBe('kbit');
    expect(speakerFor(null)).toBe('owner');
    expect(speakerFor('open_mic', 'kbit')).toBe('kbit');
    expect(speakerFor('open_mic', 'nobody')).toBe('mira');
  });

  it('one blip per syllable, capped, same line = same tune', () => {
    expect(syllables('Is that a ringtone')).toEqual(['i', 'tha', 'a', 'ri', 'ngto', 'ne']);
    const line = 'Is that... a ringtone? Where can I GET that?';
    const v = voiceCue(line, 'kbit');
    expect(v.tones.length).toBe(syllables(line).length);
    expect(voiceCue(line, 'kbit')).toEqual(v);
    expect(voiceCue('a '.repeat(100), 'owner').tones).toHaveLength(F.voice.maxBlips);
    expect(cueLength(voiceCue('a '.repeat(100), 'owner'))).toBeLessThan(T.timing.dialogueSec);
  });

  it('every speaker has its own pitch range', () => {
    const lows = SPEAKERS.map((s) => Math.min(...voiceCue('hello there how are you doing today', s).tones.map((t) => t.note)));
    expect(new Set(lows).size).toBe(SPEAKERS.length);
    for (const s of SPEAKERS) {
      for (const t of voiceCue('the quick brown fox jumps over the lazy dog', s).tones) {
        expect(t.note - F.voice.speakers[s].note).toBeGreaterThanOrEqual(0);
        expect(t.note - F.voice.speakers[s].note).toBeLessThanOrEqual(F.voice.spread);
      }
    }
  });

  it('a dialogue event speaks in the voice of the moment you are in', () => {
    const { audio, events, send } = setup();
    events.emit('travel', { to: 'open_mic', era: '2004', moment: 'open_mic' });
    send('dialogue', { line: 'Thanks for coming.' });
    send('dialogue', { line: 'Hey!', speaker: 'band' });
    send('dialogue', { line: '' }); // a cleared line says nothing
    expect(audio.feel()).toEqual(['voice:mira', 'voice:band']);
  });
});

describe('paper, camera and keys', () => {
  it('a panel opening rustles; closing is quiet', () => {
    const { audio, send } = setup();
    send('panel', { name: 'card', open: true });
    send('panel', { name: 'card', open: false });
    send('panel', { name: 'news', open: true });
    expect(audio.feel()).toEqual(['paper', 'paper']);
    expect(paperCue().noises).toHaveLength(F.paper.rustles);
  });

  it('the camera whoosh rises going in and falls coming out', () => {
    const { audio, send } = setup();
    send('camera-zoom', { zoomIn: true });
    send('camera-zoom', { zoomIn: false });
    expect(audio.feel()).toEqual(['zoom-in', 'zoom-out']);
    const into = zoomCue(true).noises[0];
    const out = zoomCue(false).noises[0];
    expect((into?.toHz ?? 0) > (into?.fromHz ?? 0)).toBe(true);
    expect((out?.toHz ?? 0) < (out?.fromHz ?? 0)).toBe(true);
    expect(zoomCue(true).noises[0]?.gain ?? 1).toBeLessThan(T.audio.whoosh.gain); // softer than travel
  });

  it('phone keys click as well as beep', () => {
    for (const name of ['beep', 'blip'] as const) {
      const click = buildCue(name).noises[0];
      expect(click?.sec).toBe(T.audio.keyClick.sec);
      expect(click?.fromHz).toBe(T.audio.keyClick.hz);
    }
  });
});

describe('robustness', () => {
  it('a speaker or moment that is a built-in object name falls back to the owner', () => {
    expect(speakerFor(null, 'toString')).toBe('owner');
    expect(speakerFor('constructor')).toBe('owner');
    expect(speakerFor('__proto__', 'hasOwnProperty')).toBe('owner');
    expect(voiceCue('hello', speakerFor('constructor')).tones[0]?.note).toBe(F.voice.speakers.owner.note + ('he'.charCodeAt(0) + 'he'.charCodeAt(1)) % (F.voice.spread + 1));
  });

  it('a strange dialogue event never throws into the game', () => {
    const { audio, events, send } = setup();
    events.emit('travel', { to: 'x', era: '2004', moment: 'constructor' });
    expect(() => send('dialogue', { line: 'hello there', speaker: 'toString' })).not.toThrow();
    expect(audio.feel()).toEqual(['voice:owner']);
  });
});

describe('noise bursts', () => {
  it('each footstep variant and paper rustle starts at its own point in the noise', () => {
    const bursts = [...Array.from({ length: F.step.variants }, (_, i) => footstepCue(i).noises[0]), ...paperCue().noises];
    const offsets = bursts.map((b) => (b ? noiseOffset(b, T.audio.ambience.loopSec) : -1));
    expect(new Set(offsets.map((o) => o.toFixed(3))).size).toBe(offsets.length);
    for (const [i, o] of offsets.entries()) {
      expect(o).toBeGreaterThanOrEqual(0);
      expect(o + (bursts[i]?.sec ?? 0)).toBeLessThanOrEqual(T.audio.ambience.loopSec);
    }
  });
});
