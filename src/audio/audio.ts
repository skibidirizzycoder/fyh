// audio.ts — all of the game's sound. It only LISTENS to game events (src/core/events.ts)
// and never edits game.ts. Browsers allow sound only after a key press, so the AudioContext
// is made on `game-start` (Enter on the title), never at page load. `mute` (the M key) mutes.
// Headless tests can't hear anything; they check lastCue(), which works even when muted.
// Audio must never break the game: every Web Audio call is wrapped, and a failure just goes quiet.

import type { GameEvents } from '../core/events.ts';
import { T, type Era } from '../tuning.ts';
import { createAmbience, type Ambience } from './ambience.ts';
import { buildCue, cueLength, type CueName } from './cues.ts';
import { createMusicDirector, type MusicDirector } from './music-director.ts';
import { createMusicPlayer, type MusicPlayer } from './music.ts';
import { sceneFor, type SceneId } from './soundscape.ts';
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
  /** What the CD music plays now, e.g. "mira:2004", "static:2004-broken", "kbit:today" ("" = none). */
  nowPlaying(): string;
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
  /** Which moment's background is playing: "open_mic", "street_gig", "ringtone", "present" or "2004". */
  soundscape(): SceneId;
  /** True once Web Audio failed; the game carries on silently. */
  failed(): boolean;
  dispose(): void;
}

/** The cue for a finished action: K-Bit's beam and ringtone are special, everything else chimes. */
export function actionCue(actionId: string): CueName {
  if ((T.audio.ringtoneActions as readonly string[]).includes(actionId)) return 'ringtone';
  if ((T.audio.beamActions as readonly string[]).includes(actionId)) return 'beam';
  return 'chime';
}

/** Cues that wait a moment so they don't land on top of the travel whoosh. */
const DELAY: Partial<Record<CueName, number>> = { fanfare: T.audio.fanfare.delaySec };

function defaultContext(): AudioContext | null {
  return typeof AudioContext === 'undefined' ? null : new AudioContext();
}

type Sound = { ctx: AudioContext; master: GainNode; noise: AudioBuffer; ambience: Ambience; music: MusicPlayer };

type CdMusic = { file: string };
const DUCK_CUES: readonly string[] = T.audio.music.duckCues;

/** Fetches and decodes every CD song that has a file. Failures stay silent (the song just won't play). */
function loadSongs(ctx: AudioContext, music: MusicPlayer): void {
  for (const [cd, cfg] of Object.entries(T.audio.music.cds as Readonly<Record<string, CdMusic>>)) {
    if (!cfg.file) continue; // no MP3 yet: don't even ask (a 404 is a console error)
    fetch(cfg.file)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then((bytes) => ctx.decodeAudioData(bytes))
      .then((buffer) => music.addSong(cd, buffer))
      .catch(() => undefined);
  }
}

/** Routes each game event to its sound and to the music. */
function subscribe(events: SoundEvents, a: {
  play: (name: CueName) => void;
  unlock: () => void;
  toggleMute: () => boolean;
  setPlace: (era: Era, moment: string | null) => void;
  music: MusicDirector;
}): void {
  const { play, unlock, toggleMute, setPlace, music } = a;
  events.on('game-start', () => {
    unlock();
    music.reset();
  });
  events.on('mute', () => toggleMute());
  events.on('travel', (e) => {
    setPlace(e.era, e.moment);
    play('whoosh');
    music.travel(e.era, e.moment);
  });
  events.on('action-done', (e) => {
    play(actionCue(e.actionId));
    music.actionDone(e.actionId);
  });
  events.on('action-locked', () => play('nope'));
  events.on('phone-open', () => play('flip-open'));
  events.on('phone-close', () => play('flip-close'));
  events.on('phone-move', () => play('beep'));
  events.on('phone-select', () => play('blip'));
  events.on('reputation', (e) => {
    play('fanfare');
    music.reputation(e.level);
  });
}

/** Creates the game's audio and subscribes it to game events. */
export function createAudio(events: SoundEvents, options: AudioOptions = {}): GameAudio {
  const makeContext = options.makeContext ?? defaultContext;
  const played: CueName[] = [];
  let muted = false;
  let broken = false;
  let era: Era = 'present';
  let scene: SceneId = 'present';
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

  const music = createMusicDirector(() => sound?.music ?? null, safely);

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
        const music = createMusicPlayer(ctx, master);
        sound = { ctx, master, noise, ambience: createAmbience(ctx, master, era), music };
        sound.ambience.setScene(scene);
        loadSongs(ctx, music);
      }
      resume();
    });
  }

  function play(name: CueName): void {
    played.push(name);
    const s = sound;
    if (!s || muted) return;
    safely(() => {
      const cue = buildCue(name);
      playCue(s.ctx, s.master, cue, s.noise, DELAY[name] ?? 0);
      if (DUCK_CUES.includes(name)) s.music.duck(cueLength(cue));
    });
  }

  function toggleMute(): boolean {
    muted = !muted;
    const s = sound;
    if (s) safely(() => s.master.gain.setValueAtTime(muted ? 0 : T.audio.master, s.ctx.currentTime));
    return muted;
  }

  subscribe(events, { play, unlock, toggleMute, music, setPlace: (e, moment) => {
    era = e;
    scene = sceneFor(e, moment);
    const s = sound;
    if (s) safely(() => {
      s.ambience.setEra(e);
      s.ambience.setScene(scene);
    });
  } });

  // The browser may suspend audio (e.g. a background tab); any key or click wakes it up again.
  options.target?.addEventListener('keydown', resume);
  options.target?.addEventListener('pointerdown', resume);

  return {
    nowPlaying: music.nowPlaying,
    lastCue: () => played.at(-1) ?? null,
    history: () => played,
    isMuted: () => muted,
    toggleMute,
    unlock,
    play,
    era: () => era,
    soundscape: () => scene,
    failed: () => broken,
    dispose() {
      music.dispose();
      options.target?.removeEventListener('keydown', resume);
      options.target?.removeEventListener('pointerdown', resume);
      const s = sound;
      sound = null;
      if (s) safely(() => {
        s.music.stop();
        s.ambience.stop();
        s.ctx.close().catch(() => undefined);
      });
    },
  };
}
