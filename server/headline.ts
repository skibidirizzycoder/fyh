// headline.ts — the /api/headline endpoint. SERVER ONLY.
// The browser sends the timeline flags; the server checks them, builds the
// prompt from the story (never from browser text), asks Cortex, and returns
// { headline, article }. The Snowflake token stays here.
// When Snowflake can't write the paper (not set up, refused, timed out, a bad reply) it answers
// 200 { offline: true, reason } so the browser prints the offline edition without logging an error.
// Only a bad request from the browser (wrong method, impossible flags) is an HTTP error.
// Used by the Vite dev/preview server (vite.config.ts), the Netlify Function
// (netlify/functions/headline.ts) and `npm run snowflake:ping`.

import { content } from '../src/story/content.ts';
import { extractJson, parseArticle } from '../src/news/article.ts';
import { newsPrompt } from '../src/story/news.ts';
import { replayFlags } from '../src/story/timeline.ts';
import { T } from '../src/tuning.ts';
import { CortexError, completeText } from './cortex.ts';


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

/** "Snowflake can't write the paper now": the browser shows the offline edition. Reason text is redacted. */
function offline(reason: string): Response {
  return json(200, { offline: true, reason: redact(reason) });
}

/** Handles POST /api/headline with body { flags: string[] }. */
export async function handleHeadline(req: Request, opts: HandlerOptions = {}): Promise<Response> {
  if (req.method !== 'POST') return json(405, { error: 'use POST' });
  const body: unknown = await req.json().catch(() => null);
  const flags = replayFlags(content, (body as { flags?: unknown } | null)?.flags);
  if (!flags) return json(400, { error: 'flags must be known action ids in an order that can happen' });
  const secrets = readSecrets();
  if (!secrets.account || !secrets.token) return offline('server is missing SNOWFLAKE_ACCOUNT or SNOWFLAKE_TOKEN (see README)');
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
    if (!article) return offline(`model reply was not { headline, article } JSON: ${text.slice(0, 200)}`);
    return json(200, article);
  } catch (e) {
    const what = e instanceof CortexError && e.status === 0 ? 'Snowflake timed out' : 'Snowflake refused';
    return offline(`${what}: ${e instanceof Error ? e.message : String(e)}`);
  }
}
