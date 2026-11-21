// audio.ts — all of the game's sound. It only LISTENS to game events (src/core/events.ts)
// and never edits game.ts. Browsers allow sound only after a key press, so the AudioContext
// is made on `game-start` (Enter on the title), never at page load. `mute` (the M key) mutes.
// Headless tests can't hear anything; they check lastCue(), which works even when muted.
// Audio must never break the game: every Web Audio call is wrapped, and a failure just goes quiet.

import type { GameEvents } from '../core/events.ts';
import { T, type Era } from '../tuning.ts';
import { createAmbience, type Ambience } from './ambience.ts';
import { buildCue, type CueName } from './cues.ts';
import { makeNoiseBuffer, playCue } from './synth.ts';

/** The game events sound reacts to. */
export type SoundEvent = Extract<keyof GameEvents, 'game-start' | 'mute' | 'travel' | 'action-done' | 'action-locked' | 'phone-open' | 'phone-close' | 'phone-move' | 'phone-select' | 'reputation'>;

/** Anything we can subscribe to game events on (the real Events, or a fake in tests). */
export interface SoundEvents {
  on<K extends SoundEvent>(name: K, listener: (payload: GameEvents[K]) => void): unknown;
}

export interface AudioOptions {
  /** Window to watch for key presses and clicks: they resume a context the browser suspended. */
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
  /** Makes or resumes the AudioContext (the game calls this on game-start). */
  unlock(): void;
  play(name: CueName): void;
  era(): Era;
  /** True once Web Audio failed; the game carries on silently. */
  failed(): boolean;
  dispose(): void;
}

/** The cue for a finished action: the ringtone for K-Bit's bus stop, a chime otherwise. */
export function actionCue(actionId: string): CueName {
  return (T.audio.ringtoneActions as readonly string[]).includes(actionId) ? 'ringtone' : 'chime';
}

/** Cues that wait a moment so they don't land on top of the travel whoosh. */
const DELAY: Partial<Record<CueName, number>> = { fanfare: T.audio.fanfare.delaySec };

function defaultContext(): AudioContext | null {
  return typeof AudioContext === 'undefined' ? null : new AudioContext();
}

type Sound = { ctx: AudioContext; master: GainNode; noise: AudioBuffer; ambience: Ambience };

/** Creates the game's audio and subscribes it to game events. */
export function createAudio(events: SoundEvents, options: AudioOptions = {}): GameAudio {
  const makeContext = options.makeContext ?? defaultContext;
  const played: CueName[] = [];
  let muted = false;
  let broken = false;
  let era: Era = 'present';
  let sound: Sound | null = null;

  /** Runs some Web Audio code; if it throws, sound switches off for good instead of breaking the game. */
  function safely(fn: () => void): void {
    if (broken) return;
    try {
      fn();
    } catch {
      broken = true;
    }
  }

  function resume(): void {
    if (sound?.ctx.state === 'suspended') sound.ctx.resume().catch(() => undefined);
  }

  function unlock(): void {
    safely(() => {
      if (!sound) {
        const ctx = makeContext();
        if (!ctx) return;
        const master = ctx.createGain();
        master.gain.value = muted ? 0 : T.audio.master;
        master.connect(ctx.destination);
        const noise = makeNoiseBuffer(ctx, T.audio.ambience.loopSec, T.audio.ambience.seed);
        sound = { ctx, master, noise, ambience: createAmbience(ctx, master, era) };
      }
      resume();
    });
  }

  function play(name: CueName): void {
    played.push(name);
    const s = sound;
    if (s && !muted) safely(() => playCue(s.ctx, s.master, buildCue(name), s.noise, DELAY[name] ?? 0));
  }

  function toggleMute(): boolean {
    muted = !muted;
    const s = sound;
    if (s) safely(() => s.master.gain.setValueAtTime(muted ? 0 : T.audio.master, s.ctx.currentTime));
    return muted;
  }

  events.on('game-start', unlock);
  events.on('mute', () => toggleMute());
  events.on('travel', (e) => {
    era = e.era;
    const s = sound;
    if (s) safely(() => s.ambience.setEra(era));
    play('whoosh');
  });
  events.on('action-done', (e) => play(actionCue(e.actionId)));
  events.on('action-locked', () => play('nope'));
  events.on('phone-open', () => play('flip-open'));
  events.on('phone-close', () => play('flip-close'));
  events.on('phone-move', () => play('beep'));
  events.on('phone-select', () => play('blip'));
  events.on('reputation', () => play('fanfare'));

  // The browser may suspend audio (e.g. a background tab); any key or click wakes it up again.
  options.target?.addEventListener('keydown', resume);
  options.target?.addEventListener('pointerdown', resume);

  return {
    lastCue: () => played.at(-1) ?? null,
    history: () => played,
    isMuted: () => muted,
    toggleMute,
    unlock,
    play,
    era: () => era,
    failed: () => broken,
    dispose() {
      options.target?.removeEventListener('keydown', resume);
      options.target?.removeEventListener('pointerdown', resume);
      const s = sound;
      sound = null;
      if (s) safely(() => {
        s.ambience.stop();
        s.ctx.close().catch(() => undefined);
      });
    },
  };
}
