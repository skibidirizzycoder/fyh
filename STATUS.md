# STATUS.md — handoff

*Update this (about 200 words) at the end of every session.*

**Last updated:** 2026-11-21, foundation for the CD plan (`docs/PLAN.md`).

**State:** `npm run gate` passes with 98 unit tests. Smoke plays the pitch route (DJ K-Bit, then
Mira) with real key presses and times it (28.5 s of play, max 45), fixes The Static, reaches the
ending, then runs the teammates' checks in `scripts/checks/`. It fakes `/api/headline`, checks the
3 s offline edition, the live paper and the cache, and writes screenshots to `artifacts/`.

**What exists:** a third-person controller and one street corner. The flip phone (Q) travels to
three 2004 moments, one per unpopular CD, or back to today. Each CD is fixed in 2 steps; today then
shows its gold disc and the shop's reputation (open → busy → landmark plaque), a "Because you..."
card in the order you did things, and a newspaper. Story: `src/story/content.json` + `cds/*.json`,
combined by `content.ts`. Props per CD: `src/world/props/`. Events (`src/core/events.ts`) drive the
sound stub. **Placeholders (magenta, "PLACEHOLDER" text):** The Static and DJ K-Bit (teammates
replace them), the phone's look (Teammate A), and sound (Teammate B: currently silent).
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
- Placeholders above, until the teammates' branches are merged.
- The player walks through props.
- GitHub Pages has no endpoint, so the paper is always the offline edition there.

**Now (hackathon day):** teammates build on `feat/phone-static` and `feat/sound-kbit` from the
prompts in `docs/prompts/03-*` and `04-*` (Teammate B's sound + K-Bit v1 is merged). Next for the
director: run `docs/prompts/05-agentic-workflow.md` (measure, lanes, ownership hook, diff review,
contracts), then polish Mira's moment and today's shop, then merge.

**Next session:** read `AGENTS.md`, run `npm run gate`, run `npm run snowflake:ping` if `.env` is set.
