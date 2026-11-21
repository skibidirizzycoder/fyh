// headline.ts — the /api/headline endpoint. SERVER ONLY.
// The browser sends the timeline flags; the server checks them, builds the
// prompt from the story (never from browser text), asks Cortex, and returns
// { headline, article }. The Snowflake token stays here.
// Used by the Vite dev/preview server (vite.config.ts), the Netlify Function
// (netlify/functions/headline.ts) and `npm run snowflake:ping`.

import contentJson from '../src/story/content.json' with { type: 'json' };
import { extractJson, parseArticle } from '../src/news/article.ts';
import { newsPrompt } from '../src/story/news.ts';
import { replayFlags } from '../src/story/timeline.ts';
import type { StoryContent } from '../src/story/types.ts';
import { T } from '../src/tuning.ts';
import { CortexError, completeText } from './cortex.ts';

const content: StoryContent = contentJson;

/**
 * Reads the Snowflake settings from process.env, the ONLY place they come from.
 * (Locally, .env is loaded into process.env first; on Netlify, the dashboard sets it.)
 * Never print or log these values.
 */
function readSecrets(): { account: string; token: string; model: string; tokenType: string } {
  return {
    account: process.env.SNOWFLAKE_ACCOUNT ?? '',
    token: process.env.SNOWFLAKE_TOKEN ?? '',
    model: process.env.SNOWFLAKE_MODEL || T.news.model, // optional
    tokenType: process.env.SNOWFLAKE_TOKEN_TYPE || 'PROGRAMMATIC_ACCESS_TOKEN', // optional
  };
}

/** Removes the account and token from text before it leaves the server. */
export function redact(text: string): string {
  const { account, token } = readSecrets();
  return [token, account].filter((v) => v.length > 0).reduce((t, v) => t.split(v).join('***'), text);
}

export interface HandlerOptions {
  fetchFn?: typeof fetch; // tests pass a fake
  timeoutMs?: number; // the ping script waits longer
}

/** Builds a JSON response. */
function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

/** Handles POST /api/headline with body { flags: string[] }. */
export async function handleHeadline(req: Request, opts: HandlerOptions = {}): Promise<Response> {
  if (req.method !== 'POST') return json(405, { error: 'use POST' });
  const body: unknown = await req.json().catch(() => null);
  const flags = replayFlags(content, (body as { flags?: unknown } | null)?.flags);
  if (!flags) return json(400, { error: 'flags must be known action ids in an order that can happen' });
  const secrets = readSecrets();
  if (!secrets.account || !secrets.token) {
    return json(500, { error: 'server is missing SNOWFLAKE_ACCOUNT or SNOWFLAKE_TOKEN (see README)' });
  }
  try {
    const text = await completeText({
      ...secrets,
      prompt: newsPrompt(content, flags),
      maxTokens: T.news.maxTokens,
      temperature: T.news.temperature,
      timeoutMs: opts.timeoutMs ?? T.news.serverTimeoutMs,
      fetchFn: opts.fetchFn ?? fetch,
    });
    const article = parseArticle(extractJson(text));
    if (!article) return json(502, { error: 'model reply was not { headline, article } JSON', reply: redact(text.slice(0, 200)) });
    return json(200, article);
  } catch (e) {
    const status = e instanceof CortexError && e.status === 0 ? 504 : 502;
    return json(status, { error: redact(e instanceof Error ? e.message : String(e)) });
  }
}
