// audio.ts — all of the game's sound. It only LISTENS to game events (src/core/events.ts)
// and never edits game.ts. Browsers allow sound only after a key press, so the AudioContext
// is made on `game-start` (Enter on the title), never at page load. `mute` (the M key) mutes.
// Headless tests can't hear anything; they check lastCue(), which works even when muted.
// Audio must never break the game: every Web Audio call is wrapped, and a failure just goes quiet.

import type { GameEvents } from '../core/events.ts';
import { T, type Era } from '../tuning.ts';
import { createAmbience, type Ambience } from './ambience.ts';
import { buildCue, cueLength, queueRingtones, whooshDelay, type Cue, type CueName } from './cues.ts';
import { createFeel, subscribeFeel, type Feel, type FeelSource } from './feel-player.ts';
import { createMusicDirector, type MusicDirector } from './music-director.ts';
import { createMusicPlayer, type MusicPlayer } from './music.ts';
import { sceneFor, type SceneId } from './soundscape.ts';
import type { UpcomingSource } from './upcoming.ts';
import { makeNoiseBuffer, playCue } from './synth.ts';
import { cutSection, songFor } from './songs.ts';

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
  /** The last few small "feel" sounds (footsteps, paper, camera, voices), oldest first. Never a cue. */
  feel(): readonly string[];
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

const DUCK_CUES: readonly string[] = T.audio.music.duckCues;

/**
 * Fetches and decodes every CD's song (your local copy of the real song if there is one, else the
 * stand-in; see songs.ts). A full local song is cut to its section. Failures stay silent.
 */
function loadSongs(ctx: AudioContext, music: MusicPlayer): void {
  for (const cd of Object.keys(T.audio.music.cds)) {
    const song = songFor(cd);
    if (!song) continue; // no MP3 yet: don't even ask (a 404 is a console error)
    fetch(song.url)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then((bytes) => ctx.decodeAudioData(bytes))
      .then((buffer) => music.addSong(cd, song.section ? cutSection(ctx, buffer, song.section.startSec, song.section.lengthSec) : buffer))
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

/**
 * Events the game doesn't send yet: the feel events requested from Claude (feel-player.ts) and the round 3
 * events announced in the backlog (upcoming.ts). Harmless until sent; they work as soon as they are.
 */
function subscribeAhead(events: SoundEvents, a: { feel: Feel; play: (name: CueName) => void; music: MusicDirector }): void {
  events.on('travel', (e) => a.feel.travel(e.moment));
  subscribeFeel(events as unknown as FeelSource, a.feel);
  const upcoming = events as unknown as UpcomingSource;
  upcoming.on('cd-insert', () => a.play('cd-insert'));
  upcoming.on('title', () => a.music.reset()); // back on the title: the last game's song fades out
}

/** The bus queue catches your ringtone: each phone joins in turn, panned to where it stands. Returns how long it lasts. */
function playQueue(s: Sound): number {
  let end = 0;
  for (const phone of queueRingtones()) {
    const pan = s.ctx.createStereoPanner();
    pan.pan.value = phone.pan;
    pan.connect(s.master);
    playCue(s.ctx, pan, phone.cue, s.noise, phone.delaySec);
    end = Math.max(end, phone.delaySec + cueLength(phone.cue));
  }
  return end;
}

/** Plays a cue now (the whoosh waits for a CD's spin-up), the queue after the ringtone, and ducks the music. */
function playOn(s: Sound, name: CueName, insertAt: number | null): void {
  const cue = buildCue(name);
  const delay = name === 'whoosh' ? whooshDelay(insertAt, s.ctx.currentTime) : DELAY[name] ?? 0;
  playCue(s.ctx, s.master, cue, s.noise, delay);
  const spread = name === 'ringtone' ? playQueue(s) : 0; // and then the whole queue rings
  if (DUCK_CUES.includes(name)) s.music.duck(Math.max(cueLength(cue), spread));
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
  let insertAt: number | null = null; // audio-clock time the last CD went into the player
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
      if (name === 'cd-insert') insertAt = s.ctx.currentTime;
      playOn(s, name, insertAt);
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

  const feel = createFeel((cue: Cue) => {
    const s = sound;
    if (s && !muted) safely(() => playCue(s.ctx, s.master, cue, s.noise));
  }, () => {
    broken = true; // a feel sound failed to build: go quiet, as for any audio failure (failed() reports it)
  });
  subscribeAhead(events, { feel, play, music });

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
    feel: feel.history,
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
