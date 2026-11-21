// music.ts — plays the CD songs that music-rules.ts picks, through Web Audio.
// Each song is a "voice": song -> low-pass -> high-pass -> gate -> volume -> music bus -> duck -> out.
//   2004:   muffled and mono; "broken" = a square LFO on the gate (the dying amp cuts in and out).
//   today:  clean and stereo, plus a code-made beat (beat.ts) locked to whole bars of the song.
// Changing mode within the same song changes its filters live; a different song crossfades.

import { T } from '../tuning.ts';
import { barSec, beatBar } from './beat.ts';
import type { MusicMode, NowPlaying } from './music-rules.ts';

export interface MusicPlayer {
  /** Plays a pick (or silence) at a reputation level (today's volume and beat). */
  set(pick: NowPlaying | null, level: number): void;
  /** A song finished loading; starts it if it is wanted right now. */
  addSong(cd: string, buffer: AudioBuffer): void;
  /** Turns the music down for `sec` seconds, so a sound effect can be heard. */
  duck(sec: number): void;
  stop(): void;
}

interface Voice {
  cd: string;
  today: boolean;
  sources: AudioScheduledSourceNode[];
  lowpass: BiquadFilterNode;
  highpass: BiquadFilterNode;
  gate: GainNode;
  gain: GainNode;
  beatGain: GainNode | null;
  lfo: OscillatorNode | null;
}

type CdMusic = { gain: number; bpm: number; beatOffsetSec: number };
const M = T.audio.music;
const CDS = M.cds as Readonly<Record<string, CdMusic>>;
const OPEN_HZ = 20000; // a low-pass this high (or a high-pass this low) does nothing
const CLOSED_HZ = 20;

/** Filter and volume targets for a mode. */
function targets(mode: MusicMode, cd: string, level: number): { lp: number; hp: number; gain: number; beat: number } {
  const g = CDS[cd]?.gain ?? 0;
  const pick = (a: readonly number[]): number => a[Math.min(level, a.length - 1)] ?? 0;
  switch (mode) {
    case 'today':
      return { lp: OPEN_HZ, hp: CLOSED_HZ, gain: g * pick(M.today.levelGain), beat: pick(M.today.beatGain) };
    case '2004-live':
      return { lp: M.live.lowpassHz, hp: CLOSED_HZ, gain: g * M.live.gain, beat: 0 };
    case '2004-leak':
      return { lp: M.leak.lowpassHz, hp: M.leak.highpassHz, gain: g * M.leak.gain, beat: 0 };
    default:
      return { lp: M.past.lowpassHz, hp: CLOSED_HZ, gain: g * M.past.gain, beat: 0 };
  }
}

/** Glides an AudioParam from where it is now to `value` over `sec` seconds. */
function glide(param: AudioParam, value: number, now: number, sec: number): void {
  param.cancelScheduledValues(now);
  param.setValueAtTime(param.value, now);
  param.linearRampToValueAtTime(value, now + sec);
}

/** Starts a song's voice at volume 0 (set() fades it in). */
function startVoice(ctx: BaseAudioContext, bus: AudioNode, song: AudioBuffer, cd: string, today: boolean): Voice {
  const now = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = song;
  src.loop = true;
  const lowpass = ctx.createBiquadFilter();
  lowpass.type = 'lowpass';
  if (!today) {
    lowpass.channelCount = 1; // 2004 is mono
    lowpass.channelCountMode = 'explicit';
  }
  const highpass = ctx.createBiquadFilter();
  highpass.type = 'highpass';
  highpass.frequency.value = CLOSED_HZ;
  const gate = ctx.createGain();
  const gain = ctx.createGain();
  gain.gain.value = 0;
  src.connect(lowpass).connect(highpass).connect(gate).connect(gain).connect(bus);
  const v: Voice = { cd, today, sources: [src], lowpass, highpass, gate, gain, beatGain: null, lfo: null };
  const offset = CDS[cd]?.beatOffsetSec ?? 0;
  if (today) {
    const bar = barSec(CDS[cd]?.bpm ?? 120);
    const bars = Math.floor((song.duration - offset) / bar);
    if (bars >= 1) {
      src.loopStart = offset; // loop whole bars so the beat stays in time
      src.loopEnd = offset + bars * bar;
    }
    v.beatGain = ctx.createGain();
    v.beatGain.gain.value = 0;
    const samples = beatBar(CDS[cd]?.bpm ?? 120, ctx.sampleRate);
    const buffer = ctx.createBuffer(1, samples.length, ctx.sampleRate);
    buffer.getChannelData(0).set(samples);
    const beat = ctx.createBufferSource();
    beat.buffer = buffer;
    beat.loop = true;
    beat.connect(v.beatGain).connect(gain);
    beat.start(now);
    v.sources.push(beat);
  }
  src.start(now, Math.min(offset, song.duration));
  return v;
}

/** Turns the dying-amp cut-outs on or off. */
function setBroken(ctx: BaseAudioContext, v: Voice, broken: boolean, now: number): void {
  if (broken && !v.lfo) {
    v.lfo = ctx.createOscillator();
    v.lfo.type = 'square';
    v.lfo.frequency.value = M.broken.cutHz;
    const depth = ctx.createGain();
    depth.gain.value = 0.5;
    v.gate.gain.setValueAtTime(0.5, now); // 0.5 +/- 0.5: fully on, fully off
    v.lfo.connect(depth).connect(v.gate.gain);
    v.lfo.start(now);
  } else if (!broken && v.lfo) {
    v.lfo.stop(now);
    v.lfo = null;
    v.gate.gain.setValueAtTime(1, now);
  }
}

/** Fades a voice out, then stops it. */
function fadeOut(v: Voice, now: number): void {
  glide(v.gain.gain, 0, now, M.fadeSec);
  v.sources.forEach((s) => s.stop(now + M.fadeSec));
  v.lfo?.stop(now + M.fadeSec);
}

/** Creates the music player. Nothing plays until a song has loaded and a pick wants it. */
export function createMusicPlayer(ctx: BaseAudioContext, out: AudioNode): MusicPlayer {
  const songs = new Map<string, AudioBuffer>();
  const bus = ctx.createGain();
  const ducker = ctx.createGain();
  bus.gain.value = M.busGain;
  bus.connect(ducker).connect(out);
  let voice: Voice | null = null;
  let wanted: { pick: NowPlaying | null; level: number } = { pick: null, level: 0 };

  function apply(): void {
    const { pick, level } = wanted;
    const now = ctx.currentTime;
    const today = pick?.mode === 'today';
    if (voice && (!pick || voice.cd !== pick.cd || voice.today !== today)) {
      fadeOut(voice, now);
      voice = null;
    }
    if (!pick) return;
    const song = songs.get(pick.cd);
    if (!voice && song) voice = startVoice(ctx, bus, song, pick.cd, today);
    if (!voice) return; // the song has not loaded (or has no file): stay silent
    const t = targets(pick.mode, pick.cd, level);
    glide(voice.lowpass.frequency, t.lp, now, M.fadeSec);
    glide(voice.highpass.frequency, t.hp, now, M.fadeSec);
    glide(voice.gain.gain, t.gain, now, M.fadeSec);
    if (voice.beatGain) glide(voice.beatGain.gain, t.beat, now, M.fadeSec);
    setBroken(ctx, voice, pick.mode === '2004-broken', now);
  }

  return {
    set(pick, level) {
      wanted = { pick, level };
      apply();
    },
    addSong(cd, buffer) {
      songs.set(cd, buffer);
      if (wanted.pick?.cd === cd) apply();
    },
    duck(sec) {
      const now = ctx.currentTime;
      const g = ducker.gain;
      g.cancelScheduledValues(now);
      g.setValueAtTime(g.value, now);
      g.linearRampToValueAtTime(M.duckGain, now + M.duckAttackSec);
      g.setValueAtTime(M.duckGain, now + M.duckAttackSec + sec);
      g.linearRampToValueAtTime(1, now + M.duckAttackSec + sec + M.duckReleaseSec);
    },
    stop() {
      if (voice) voice.sources.forEach((s) => s.stop());
      voice?.lfo?.stop();
      voice = null;
      bus.disconnect();
    },
  };
}
