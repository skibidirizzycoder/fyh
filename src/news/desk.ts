// desk.ts — fetches today's newspaper from /api/headline in the browser.
// - Replies are cached by flag set, so the same timeline never asks twice.
// - On error or after T.news.timeoutMs, it shows the pre-written text from
//   content.json, marked as the "offline edition". Failures are not cached.
// - The server answers 200 { offline: true, reason } when Snowflake is unavailable, so the
//   browser logs no error; a build without the endpoint (`api: false`) never asks at all.
// The game never waits for this: it runs on its own, outside the fixed-step loop.

import { flagKey, offlineNews } from '../story/news.ts';
import type { Flags } from '../story/timeline.ts';
import type { Article, StoryContent } from '../story/types.ts';
import { T } from '../tuning.ts';
import { parseArticle } from './article.ts';

export type NewsState =
  | { status: 'idle' }
  | { status: 'loading'; key: string }
  | { status: 'ready'; key: string; headline: string; article: string; offline: boolean; cached: boolean; reason: string; ms: number };

export interface NewsDesk {
  /** Starts printing the paper for these flags. */
  request(flags: Flags): void;
  /** Hides the paper (e.g. back on the title screen). The cache is kept. */
  clear(): void;
  current(): NewsState;
  /** How many network requests have been made (for tests). */
  requestCount(): number;
}

export interface DeskOptions {
  content: StoryContent;
  fetchFn?: typeof fetch; // tests pass a fake
  timeoutMs?: number;
  endpoint?: string;
  api?: boolean; // false: this build has no /api/headline (a static host): print the offline edition at once
  now?: () => number; // clock in ms
}

/** Why a 200 reply had no paper: the server's own "offline" reason, else "bad reply". */
function offlineReason(body: unknown): string {
  const reply = body as { offline?: unknown; reason?: unknown } | null;
  return reply?.offline === true ? `server offline: ${String(reply.reason ?? '')}` : 'bad reply';
}

/** Creates the news desk. */
export function createNewsDesk(opts: DeskOptions): NewsDesk {
  const fetchFn = opts.fetchFn ?? ((input, init) => fetch(input, init));
  const timeoutMs = opts.timeoutMs ?? T.news.timeoutMs;
  const now = opts.now ?? (() => performance.now());
  const cache = new Map<string, Article>();
  let state: NewsState = { status: 'idle' };
  let requests = 0;

  /** Sets a finished paper, unless a newer request has started since. */
  function finish(key: string, paper: Article, offline: boolean, cached: boolean, reason: string, ms: number): void {
    if (state.status === 'idle' || state.key !== key) return; // stale reply: ignore it
    state = { status: 'ready', key, ...paper, offline, cached, reason, ms };
  }

  async function fetchPaper(flags: Flags, key: string): Promise<void> {
    const started = now();
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), timeoutMs);
    requests++;
    try {
      const res = await fetchFn(opts.endpoint ?? T.news.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flags }),
        signal: abort.signal,
      });
      const body: unknown = res.ok ? await res.json() : null;
      const paper = parseArticle(body);
      if (!paper) throw new Error(res.ok ? offlineReason(body) : `HTTP ${res.status}`);
      cache.set(key, paper);
      finish(key, paper, false, false, '', now() - started);
    } catch (e) {
      const reason = abort.signal.aborted ? 'timeout' : e instanceof Error ? e.message : String(e);
      finish(key, offlineNews(opts.content, flags), true, false, reason, now() - started);
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    request(flags) {
      const key = flagKey(flags);
      const hit = cache.get(key);
      state = { status: 'loading', key };
      if (hit) finish(key, hit, false, true, '', 0);
      else if (opts.api === false) finish(key, offlineNews(opts.content, flags), true, false, 'no-api', 0);
      else void fetchPaper([...flags], key);
    },
    clear() {
      state = { status: 'idle' };
    },
    current: () => state,
    requestCount: () => requests,
  };
}
