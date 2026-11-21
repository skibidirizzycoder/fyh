// tv.ts — the shop TV: plays each CD's real song from its official YouTube video.
// YouTube's embed rules: the player stays visible (at least 200 x 200 px) and nothing covers it, so the
// TV appears in the bottom-left corner, clear of the dialogue, only while a song plays (else it pauses).
// The game's music rules still decide what plays (audio.nowPlaying()); the TV follows them: quiet in
// the past, cutting in and out with The Static's dying amp, a tinny leak from K-Bit's headphones, full
// volume once fixed. Nothing is fetched until the first song is wanted. If YouTube doesn't load within
// T.tv.apiTimeoutSec, or a video won't play, that CD falls back to its Creative Commons stand-in
// (audio.external()); if YouTube turns up later, the TV takes over again. Off in test builds (smoke allows no network) and on narrow screens (no room).

import './tv.css';
import { T } from '../tuning.ts';

/** The audio module, as far as the TV needs it. */
export interface TvAudio {
  nowPlaying(): string; // "static:2004-broken", "kbit:today" or ""
  isMuted(): boolean;
  /** CDs the TV plays: their built-in song stays silent. */
  external(cds: readonly string[]): void;
}

export interface Tv {
  /** Follows the music; call once per frame. */
  update(): void;
}

/** What the TV should play: a CD at a volume (0-100). */
export interface TvWant {
  cd: string;
  volume: number;
}

interface Video {
  id: string;
  startSec: number;
  lengthSec: number; // 0 = to the end of the video
  credit: string;
}

const VIDEOS = T.tv.videos as Readonly<Record<string, Video>>;
const VOLUME = T.tv.volume as Readonly<Record<string, number>>;

/** What the TV plays for a music label at time `nowSec`; null = nothing (the TV pauses and hides). */
export function tvWant(label: string, muted: boolean, nowSec: number): TvWant | null {
  const [cd, mode] = label.split(':');
  if (!cd || !mode || !VIDEOS[cd]) return null;
  let volume = VOLUME[mode] ?? 100;
  const cutOut = Math.floor(nowSec * T.audio.music.broken.cutHz * 2) % 2 === 1; // the amp's square wave
  if (mode === '2004-broken' && cutOut) volume = 0;
  return { cd, volume: muted ? 0 : volume };
}

// The few parts of the YouTube IFrame API we use (https://developers.google.com/youtube/iframe_api_reference).
interface YtPlayer {
  loadVideoById(o: { videoId: string; startSeconds: number }): void;
  playVideo(): void;
  pauseVideo(): void;
  setVolume(v: number): void;
  seekTo(sec: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
}
interface YtApi {
  Player: new (el: HTMLElement, options: object) => YtPlayer;
}
type YtWindow = Window & { YT?: YtApi; onYouTubeIframeAPIReady?: () => void };
const ENDED = 0; // YT.PlayerState.ENDED

/** Loads the IFrame API once; onFail after the timeout or a load error. */
function loadApi(onReady: (api: YtApi) => void, onFail: () => void): void {
  const w = window as YtWindow;
  if (w.YT?.Player) return onReady(w.YT);
  const timer = setTimeout(onFail, T.tv.apiTimeoutSec * 1000);
  const before = w.onYouTubeIframeAPIReady;
  w.onYouTubeIframeAPIReady = () => {
    before?.();
    clearTimeout(timer);
    if (w.YT?.Player) onReady(w.YT);
    else onFail();
  };
  const script = document.createElement('script');
  script.src = T.tv.apiUrl;
  script.async = true;
  script.onerror = () => {
    clearTimeout(timer);
    onFail();
  };
  document.head.appendChild(script);
}

function make(tag: string, className: string, text?: string): HTMLElement {
  const el = document.createElement(tag);
  el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

/** The TV: just the player (it goes in `holder`), at YouTube's smallest size; hidden until a song plays. */
function buildBox(root: HTMLElement): { box: HTMLElement; holder: HTMLElement } {
  const box = make('div', 'tv');
  box.id = 'tv';
  box.hidden = true;
  box.setAttribute('role', 'region');
  box.style.setProperty('--tv-frame', T.tv.frame);
  box.style.setProperty('--tv-screen', `${T.tv.screenPx}px`);
  box.style.setProperty('--tv-left', `${T.tv.leftPx}px`);
  box.style.setProperty('--tv-bottom', `${T.tv.bottomPx}px`);
  const screen = make('div', 'tv-screen');
  const holder = make('div', 'tv-player'); // YouTube replaces this with its iframe
  screen.appendChild(holder);
  box.append(screen);
  root.appendChild(box);
  return { box, holder };
}

/** Builds the TV. `enabled` is false in test builds. */
export function createTv(root: HTMLElement, audio: TvAudio, enabled = T.tv.enabled && import.meta.env.MODE !== 'test'): Tv {
  const { box, holder } = buildBox(root);

  let status: 'idle' | 'loading' | 'ready' | 'failed' = 'idle';
  let player: YtPlayer | null = null;
  let playerReady = false;
  let current: string | null = null; // the CD whose video is loaded
  let playing = false;
  let volume = -1;
  const failed = new Set<string>(); // videos that won't play here
  let externalKey = '';

  /** Tells the audio which CDs the TV covers (only when that changes). */
  function setExternal(cds: string[]): void {
    const key = cds.join(',');
    if (key === externalKey) return;
    externalKey = key;
    audio.external(cds);
  }

  function covered(): string[] {
    const usable = status === 'loading' || status === 'ready';
    const narrow = document.documentElement.classList.contains('is-narrow');
    return usable && !narrow ? Object.keys(VIDEOS).filter((cd) => !failed.has(cd)) : [];
  }

  function fail(): void {
    if (status !== 'loading') return;
    status = 'failed';
    setExternal([]); // every CD back to its stand-in
  }

  /** YouTube arrived (even after the timeout: then it takes over from the stand-ins). */
  function start(api: YtApi, want: TvWant): void {
    if (status === 'ready') return;
    status = 'ready';
    const video = VIDEOS[want.cd];
    if (!video) return;
    current = want.cd;
    playing = false; // follow() presses play once the player is ready and the TV is on screen
    player = new api.Player(holder, {
      width: T.tv.screenPx,
      height: T.tv.screenPx,
      videoId: video.id,
      playerVars: { start: video.startSec, autoplay: 0, controls: 0, disablekb: 1, fs: 0, iv_load_policy: 3, playsinline: 1, rel: 0, origin: location.origin },
      events: {
        onReady: () => {
          playerReady = true;
        },
        onError: () => {
          if (current) failed.add(current); // e.g. embedding blocked: this CD plays its stand-in
          setExternal(covered());
        },
        onStateChange: (e: { data: number }) => {
          if (e.data === ENDED && current) restart(current);
        },
      },
    });
  }

  function restart(cd: string): void {
    player?.seekTo(VIDEOS[cd]?.startSec ?? 0, true);
    player?.playVideo();
  }

  /** Plays, switches, loops or pauses the video to match what the music wants. */
  function follow(want: TvWant | null): void {
    if (!player || !playerReady) return;
    if (!want) {
      if (playing) player.pauseVideo();
      playing = false;
      return;
    }
    const video = VIDEOS[want.cd];
    if (!video) return;
    if (want.cd !== current) {
      player.loadVideoById({ videoId: video.id, startSeconds: video.startSec });
      current = want.cd;
      playing = true;
    } else if (!playing) {
      player.playVideo();
      playing = true;
    } else if (video.lengthSec > 0 && player.getCurrentTime() > video.startSec + video.lengthSec) {
      restart(want.cd);
    }
    if (want.volume !== volume) {
      player.setVolume(want.volume);
      volume = want.volume;
    }
  }

  return {
    update() {
      if (!enabled) return;
      let want = tvWant(audio.nowPlaying(), audio.isMuted(), performance.now() / 1000);
      if (want && !covered().includes(want.cd) && status !== 'idle') want = null; // its stand-in plays instead
      if (want && status === 'idle' && !document.documentElement.classList.contains('is-narrow')) {
        status = 'loading';
        const first = want;
        loadApi((api) => start(api, first), fail);
      }
      setExternal(covered());
      follow(want);
      box.hidden = !want || status !== 'ready';
      const name = `Now playing: ${want ? VIDEOS[want.cd]?.credit ?? '' : ''}`;
      if (box.getAttribute('aria-label') !== name) box.setAttribute('aria-label', name);
    },
  };
}
