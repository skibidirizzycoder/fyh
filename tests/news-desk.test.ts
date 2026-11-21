// news-desk.test.ts — browser news desk: cache by flag set, 3 s timeout, offline fallback.
// The endpoint is a fake fetch, so no test touches the network.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { content } from '../src/story/content.ts';
import { createNewsDesk } from '../src/news/desk.ts';
import { offlineNews } from '../src/story/news.ts';
import { T } from '../src/tuning.ts';

const ALL = ['mira_take_cd', 'mira_play_cd']; // Mira's CD, fixed
const PAPER = { headline: 'Mock Headline', article: 'Mock article. Two sentences.' };

/** A fake fetch that answers with a JSON body and status. */
function answer(body: unknown, status = 200) {
  return vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => new Response(JSON.stringify(body), { status }));
}

/** A fake fetch that never answers, except by rejecting when aborted. */
function hang() {
  return vi.fn((_url: string | URL | Request, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
  }));
}

/** Lets pending promises run. */
const settle = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('news desk', () => {
  it('shows the server paper and sends only the flags', async () => {
    const fetchFn = answer(PAPER);
    const desk = createNewsDesk({ content, fetchFn });
    desk.request(ALL);
    expect(desk.current().status).toBe('loading');
    await settle();
    expect(desk.current()).toMatchObject({ status: 'ready', ...PAPER, offline: false });
    const init = fetchFn.mock.calls[0]?.[1];
    expect(JSON.parse(String(init?.body))).toEqual({ flags: ALL });
  });

  it('caches by flag set: the same flags never ask twice', async () => {
    const fetchFn = answer(PAPER);
    const desk = createNewsDesk({ content, fetchFn });
    desk.request(ALL);
    await settle();
    desk.request([...ALL].reverse());
    expect(desk.current()).toMatchObject({ status: 'ready', cached: true, headline: PAPER.headline });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    desk.request(['mira_take_cd']);
    await settle();
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('on a server error, prints the offline edition from content.json (and does not cache it)', async () => {
    const fetchFn = answer({ error: 'boom' }, 502);
    const desk = createNewsDesk({ content, fetchFn });
    desk.request(ALL);
    await settle();
    expect(desk.current()).toMatchObject({ status: 'ready', ...offlineNews(content, ALL), offline: true, reason: 'HTTP 502' });
    desk.request(ALL);
    await settle();
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('on a bad reply shape, prints the offline edition', async () => {
    const desk = createNewsDesk({ content, fetchFn: answer({ nope: true }) });
    desk.request([]);
    await settle();
    expect(desk.current()).toMatchObject({ offline: true, ...content.news.offline.default });
  });

  it(`gives up after exactly ${T.news.timeoutMs} ms`, async () => {
    const desk = createNewsDesk({ content, fetchFn: hang(), now: () => Date.now() });
    desk.request([]);
    await vi.advanceTimersByTimeAsync(T.news.timeoutMs - 1);
    expect(desk.current().status).toBe('loading');
    await vi.advanceTimersByTimeAsync(1);
    expect(desk.current()).toMatchObject({ status: 'ready', offline: true, reason: 'timeout', ms: T.news.timeoutMs });
  });

  it('ignores a late reply for an older flag set', async () => {
    let release: (r: Response) => void = () => undefined;
    const slow = vi.fn(() => new Promise<Response>((resolve) => { release = resolve; }));
    const desk = createNewsDesk({ content, fetchFn: slow });
    desk.request([]);
    desk.clear();
    release(new Response(JSON.stringify(PAPER)));
    await settle();
    expect(desk.current().status).toBe('idle');
  });
});
