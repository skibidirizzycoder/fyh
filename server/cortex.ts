// cortex.ts — calls Snowflake Cortex's REST "complete" endpoint. SERVER ONLY.
// Docs: https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-rest-api
// The token is sent as a Bearer token and never leaves the server.

export interface CortexOptions {
  account: string; // e.g. "myorg-myaccount" or a full "...snowflakecomputing.com" host
  token: string; // programmatic access token (PAT), OAuth token or key-pair JWT
  tokenType: string; // PROGRAMMATIC_ACCESS_TOKEN, OAUTH or KEYPAIR_JWT
  model: string;
  prompt: string;
  maxTokens: number;
  temperature: number;
  timeoutMs: number;
  fetchFn: typeof fetch; // passed in so tests can use a fake
}

/** A failed Cortex call, with the HTTP status (0 = no response, e.g. timeout). */
export class CortexError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** The complete-endpoint URL for an account identifier or host. */
export function cortexUrl(account: string): string {
  const host = account.includes('.') ? account.replace(/^https?:\/\//, '').replace(/\/.*$/, '') : `${account}.snowflakecomputing.com`;
  return `https://${host}/api/v2/cortex/inference:complete`;
}

/** Asks Cortex to complete `prompt` and returns the generated text. */
export async function completeText(o: CortexOptions): Promise<string> {
  let res: Response;
  try {
    res = await o.fetchFn(cortexUrl(o.account), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${o.token}`,
        'X-Snowflake-Authorization-Token-Type': o.tokenType,
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        model: o.model,
        messages: [{ role: 'user', content: o.prompt }],
        max_tokens: o.maxTokens,
        temperature: o.temperature,
        stream: false,
      }),
      signal: AbortSignal.timeout(o.timeoutMs),
    });
  } catch (e) {
    const timedOut = e instanceof Error && e.name === 'TimeoutError';
    throw new CortexError(0, timedOut ? `no reply within ${o.timeoutMs} ms` : `network error: ${String(e)}`);
  }
  const body = await res.text();
  if (!res.ok) throw new CortexError(res.status, `Cortex said ${res.status}: ${body.slice(0, 300)}`);
  return readCompletion(body);
}

/**
 * Pulls the generated text out of a Cortex reply. Handles a plain JSON reply
 * and a server-sent-events stream ("data: {...}" lines), which Cortex may send.
 */
export function readCompletion(body: string): string {
  const trimmed = body.trim();
  if (!trimmed.startsWith('data:')) return choiceText(JSON.parse(trimmed));
  return trimmed
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim())
    .filter((data) => data && data !== '[DONE]')
    .map((data) => choiceText(JSON.parse(data)))
    .join('');
}

/** Text of the first choice: `message.content` (JSON) or `delta.content` (stream). */
function choiceText(reply: unknown): string {
  const choice = (reply as { choices?: { message?: { content?: unknown }; delta?: { content?: unknown } }[] }).choices?.[0];
  const text = choice?.message?.content ?? choice?.delta?.content;
  return typeof text === 'string' ? text : '';
}
