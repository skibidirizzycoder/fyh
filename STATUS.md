# STATUS.md — handoff

*Update this (about 200 words) at the end of every session.*

**Last updated:** 2026-11-21, Snowflake newspaper added.

**State:** `npm run gate` passes with 84 unit tests. Smoke plays the full demo on the production
bundle, fakes `/api/headline`, checks the 3 s offline edition, the live paper and the cache,
and writes `artifacts/2004.png`, `artifacts/present.png` and `artifacts/smoke.json`.

**What exists:** a third-person controller, one street corner in 2004 and present variants
(props, grade, grain), and a story in data (`content.json`): CD → listening post → flyer opens
the record shop, with a "Because you..." card. A newspaper is shown on every return to the present.
`server/headline.ts` turns the flags into facts, asks Snowflake Cortex and returns
`{ headline, article }`. It runs in Vite dev/preview and as a Netlify Function.

**Blocked on the Snowflake account (not the code):** `.env` is filled in and the token works
(the user has a network policy for this IP). But it is a **trial account**, and every LLM route
is refused: `inference:complete` and `/v1/chat/completions` return 403 "account is not allowed
to access this endpoint", legacy `SNOWFLAKE.CORTEX.COMPLETE` is blocked for new accounts, and
`AI_COMPLETE` is "not available for trial accounts". Once the account is upgraded, run
`npm run snowflake:ping`. New accounts may need the server switched from the legacy
`inference:complete` endpoint to `AI_COMPLETE` (SQL API) or `/v1/chat/completions`.

**Known gaps:**
- No sound.
- The player walks through props.
- GitHub Pages has no endpoint, so the paper is always the offline edition there.

**Next session:** read `AGENTS.md`, run `npm run gate`, run `npm run snowflake:ping` if `.env` is set.
