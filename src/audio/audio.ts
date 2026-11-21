// audio.ts — all of the game's sound. It only LISTENS to game events and never edits game.ts.
// Browsers allow sound only after a key press, so the AudioContext starts on the first
// `start` key (Enter/Space) or click. Until then cues are still recorded (lastCue) but silent.
// M mutes and unmutes. Headless tests can't hear anything; they check lastCue() instead.

import { KEY_MAP } from '../core/input.ts';
import { T, type Era } from '../tuning.ts';
import { createAmbience, type Ambience } from './ambience.ts';
import { buildCue, type CueName } from './cues.ts';
import { makeNoiseBuffer, playCue } from './synth.ts';

/** The game events sound reacts to (see src/core/events.ts). */
export type SoundEvent = 'travel' | 'action-done' | 'action-locked' | 'phone-open' | 'phone-close' | 'phone-move' | 'phone-select' | 'reputation';

/** Anything we can subscribe to game events on. */
export interface SoundEvents {
  on(name: SoundEvent, listener: (payload?: unknown) => void): unknown;
}

export interface AudioOptions {
  /** Window to listen to for the unlock key, clicks and the mute key. */
  target?: Window;
  /** Makes the AudioContext; tests pass one that returns null (silent, cues still recorded). */
  makeContext?: () => AudioContext | null;
}

export interface GameAudio {
  /** Name of the last sound played, e.g. "ringtone" (null before any). */
  lastCue(): CueName | null;
  /** Every cue played so far, oldest first. */
  history(): readonly CueName[];
  isMuted(): boolean;
  toggleMute(): boolean;
  /** Starts or resumes the AudioContext (call from a key press or click). */
  unlock(): void;
  play(name: CueName): void;
  era(): Era;
  dispose(): void;
}

/** Reads one field of an event payload, if the payload is an object. */
function field(payload: unknown, key: string): unknown {
  return typeof payload === 'object' && payload !== null ? (payload as Record<string, unknown>)[key] : undefined;
}

/** Which era a `travel` event goes to: today if it says so, otherwise a 2004 moment. */
export function travelEra(payload: unknown): Era {
  const to = field(payload, 'era') ?? field(payload, 'to') ?? payload;
  return to === 'present' || to === 'today' ? 'present' : '2004';
}

/** The cue for an `action-done` event: the ringtone for the K-Bit ringing action, a chime otherwise. */
export function actionCue(payload: unknown): CueName {
  const id = field(payload, 'actionId') ?? field(payload, 'id') ?? payload;
  return (T.audio.ringtoneActions as readonly unknown[]).includes(id) ? 'ringtone' : 'chime';
}

function defaultContext(): AudioContext | null {
  return typeof AudioContext === 'undefined' ? null : new AudioContext();
}

/** Creates the game's audio and subscribes it to game events. */
export function createAudio(events: SoundEvents, options: AudioOptions = {}): GameAudio {
  const makeContext = options.makeContext ?? defaultContext;
  const played: CueName[] = [];
  let muted = false;
  let era: Era = 'present';
  let sound: { ctx: AudioContext; master: GainNode; noise: AudioBuffer; ambience: Ambience } | null = null;

  function unlock(): void {
    if (!sound) {
      const ctx = makeContext();
      if (!ctx) return;
      const master = ctx.createGain();
      master.gain.value = muted ? 0 : T.audio.master;
      master.connect(ctx.destination);
      const noise = makeNoiseBuffer(ctx, T.audio.ambience.loopSec, T.audio.ambience.seed);
      sound = { ctx, master, noise, ambience: createAmbience(ctx, master, era) };
    }
    if (sound.ctx.state === 'suspended') void sound.ctx.resume();
  }

  function play(name: CueName): void {
    played.push(name);
    if (sound && !muted) playCue(sound.ctx, sound.master, buildCue(name), sound.noise);
  }

  function toggleMute(): boolean {
    muted = !muted;
    if (sound) sound.master.gain.setValueAtTime(muted ? 0 : T.audio.master, sound.ctx.currentTime);
    return muted;
  }

  events.on('travel', (p) => {
    era = travelEra(p);
    sound?.ambience.setEra(era);
    play('whoosh');
  });
  events.on('action-done', (p) => play(actionCue(p)));
  events.on('action-locked', () => play('nope'));
  events.on('phone-open', () => play('flip-open'));
  events.on('phone-close', () => play('flip-close'));
  events.on('phone-move', () => play('beep'));
  events.on('phone-select', () => play('blip'));
  events.on('reputation', () => play('fanfare'));

  const startKeys: readonly string[] = KEY_MAP.start;
  const onKey = (e: KeyboardEvent): void => {
    if (startKeys.includes(e.code)) unlock();
    if (e.code === T.audio.muteKey && !e.repeat) toggleMute();
  };
  options.target?.addEventListener('keydown', onKey);
  options.target?.addEventListener('pointerdown', unlock);

  return {
    lastCue: () => played.at(-1) ?? null,
    history: () => played,
    isMuted: () => muted,
    toggleMute,
    unlock,
    play,
    era: () => era,
    dispose() {
      options.target?.removeEventListener('keydown', onKey);
      options.target?.removeEventListener('pointerdown', unlock);
      sound?.ambience.stop();
      void sound?.ctx.close();
      sound = null;
    },
  };
}
