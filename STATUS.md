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

**Blocked on credentials:** `.env` has empty `SNOWFLAKE_ACCOUNT` and `SNOWFLAKE_TOKEN`.
`npm run snowflake:ping` has not yet returned a real headline. Fill in `.env`, run it, and
check `ms`: real calls over 3 s will always show the offline edition.

**Known gaps:**
- No sound.
- The player walks through props.
- GitHub Pages has no endpoint, so the paper is always the offline edition there.

**Next session:** read `AGENTS.md`, run `npm run gate`, run `npm run snowflake:ping` if `.env` is set.
