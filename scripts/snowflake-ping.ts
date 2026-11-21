// snowflake-ping.ts — MANUAL check that the real Snowflake Cortex API works.
// Not part of `npm run gate` (gate never touches the network).
// Runs the same /api/headline handler the game uses, with all 3 past actions done.
// Prints the headline. Never prints SNOWFLAKE_ACCOUNT or SNOWFLAKE_TOKEN.

import { existsSync } from 'node:fs';
import { handleHeadline } from '../server/headline.ts';
import { T } from '../src/tuning.ts';

/** Prints a one-line JSON result and exits. */
function finish(result: Record<string, unknown>): never {
  console.log(JSON.stringify(result));
  process.exit(result.ok ? 0 : 1);
}

async function main(): Promise<void> {
  if (!existsSync('.env')) finish({ ok: false, error: 'no .env file: copy .env.example to .env and fill it in' });
  process.loadEnvFile('.env');
  if (!process.env.SNOWFLAKE_ACCOUNT || !process.env.SNOWFLAKE_TOKEN) {
    finish({ ok: false, error: 'SNOWFLAKE_ACCOUNT and SNOWFLAKE_TOKEN must both be set in .env' });
  }
  const started = Date.now();
  const req = new Request('http://localhost/api/headline', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ flags: ['mira_take_cd', 'mira_play_cd'] }), // Mira's CD fixed
  });
  const res = await handleHeadline(req, { timeoutMs: T.news.pingTimeoutMs });
  const body = (await res.json()) as Record<string, unknown>; // already redacted by the handler
  const ms = Date.now() - started;
  const slow = ms > T.news.timeoutMs ? `slower than the game's ${T.news.timeoutMs} ms timeout: players will see the offline edition` : undefined;
  finish({ ok: res.ok && body.offline !== true, status: res.status, ms, ...body, ...(slow ? { warning: slow } : {}) }); // offline: Snowflake said no
}

void main();
