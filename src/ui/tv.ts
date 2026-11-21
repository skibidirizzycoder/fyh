// tv.ts — the shop TV: plays each CD's real song from its official YouTube video.
// The song is the reward: in a CD's moment the TV stays off until that moment's objective is done (its
// final action, e.g. The Static get your mic), then plays the song from its chorus. Every time travel
// hides it again; today it stays off. YouTube's embed rules: while it plays, the player stays visible
// (at least 200 x 200 px) and nothing covers it, so it sits bottom-left, clear of the dialogue; hidden,
// it is paused. Nothing is fetched until the first song is wanted. If YouTube doesn't load within
// T.tv.apiTimeoutSec, or a video won't play, that CD falls back to its Creative Commons stand-in
// (audio.external()); if YouTube turns up later, the TV takes over again.
// Off in test builds (smoke allows no network) and on narrow screens (no room).

import './tv.css';
import { T } from '../tuning.ts';

/** The audio module, as far as the TV needs it. */
export interface TvAudio {
  isMuted(): boolean;
  /** CDs the TV covers (their built-in song stays silent), and whether it is playing one now. */
  external(cds: readonly string[], playing: boolean): void;
}

/** Where you are and what you've done (the game state). */
export interface TvWorld {
  era: string;
  moment: string | null;
  flags: readonly string[];
}

/** A CD as the TV needs it: its moment and the action that completes it. */
export interface TvCd {
  id: string;
  moment: string;
  finalAction: string;
}

export interface Tv {
  /** Follows the game; call once per frame. */
  update(world: TvWorld): void;
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

/** What the TV plays: the song of the moment you're in, once its objective is done; else nothing (hidden). */
export function tvWant(world: TvWorld, cds: readonly TvCd[], muted: boolean): TvWant | null {
  if (world.era === 'present' || !world.moment) return null;
  const cd = cds.find((c) => c.moment === world.moment);
  if (!cd || !VIDEOS[cd.id] || !world.flags.includes(cd.finalAction)) return null;
  return { cd: cd.id, volume: muted ? 0 : T.tv.volume };
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

/** Builds the TV for these CDs. `enabled` is false in test builds. */
export function createTv(root: HTMLElement, audio: TvAudio, cds: readonly TvCd[], enabled = T.tv.enabled && import.meta.env.MODE !== 'test'): Tv {
  const { box, holder } = buildBox(root);

  let status: 'idle' | 'loading' | 'ready' | 'failed' = 'idle';
  let player: YtPlayer | null = null;
  let playerReady = false;
  let current: string | null = null; // the CD whose video is loaded
  let playing = false;
  let volume = -1;
  const failed = new Set<string>(); // videos that won't play here
  let externalKey = '';

  /** Tells the audio which CDs the TV covers and whether one plays now (only when that changes). */
  function setExternal(covers: string[], on = false): void {
    const key = `${covers.join(',')}|${on}`;
    if (key === externalKey) return;
    externalKey = key;
    audio.external(covers, on);
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

  /** Plays, switches, loops or pauses the video to match what the game wants. */
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
      restart(want.cd); // back on: from the chorus again
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
    update(world) {
      if (!enabled) return;
      let want = tvWant(world, cds, audio.isMuted());
      if (want && !covered().includes(want.cd) && status !== 'idle') want = null; // its stand-in plays instead
      if (want && status === 'idle' && !document.documentElement.classList.contains('is-narrow')) {
        status = 'loading';
        const first = want;
        loadApi((api) => start(api, first), fail);
      }
      follow(want);
      box.hidden = !want || status !== 'ready';
      setExternal(covered(), !box.hidden && playerReady);
      const name = `Now playing: ${want ? VIDEOS[want.cd]?.credit ?? '' : ''}`;
      if (box.getAttribute('aria-label') !== name) box.setAttribute('aria-label', name);
    },
  };
}
