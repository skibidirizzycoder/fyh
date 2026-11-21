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
sound. Merged from teammates: all sound made in code + DJ K-Bit's bus stop (Teammate B), and the
silver flip phone with a green LCD (Teammate A). **Still a placeholder:** The Static (magenta).
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
- GitHub Pages has no endpoint, so the paper is always the offline edition there.

**Now (hackathon day):** all three CDs are real and merged (The Static from Teammate A). Teammates
ship themselves (`npm run ship`, which also tags a checkpoint) and take tasks from `docs/BACKLOG.md`:
A = Mira's moment, then the screens; B = the CD music (`docs/prompts/06-*`), then today's shop.
Director: moment looks, collisions, the rest of `docs/prompts/05-*`, Netlify deploy. No pitch work yet.

**Claims (free tasks):**
- F1 street life, DJ K-Bit's bus stop (`src/world/props/kbit.ts`): Teammate B, done 15:00 (bin, newspaper box, pigeons, a dog).
- F2 playtest `checkpoint-11` (real key presses, headless Chrome; no sound): Teammate B, done 15:40. Bugs below.

**Bugs** (F2 playtest of `checkpoint-11`: whole game in the order Static → K-Bit → Mira, ending, play again):
1. **Revisiting a fixed moment shows the "before" line.** Fix The Static, go today, then Q → The Static. The
   line still says "their battery amp keeps dying mid-chorus", but the amp is plugged in and the band is live.
   Same for any fixed CD. (Claude: `travelLines.past` could have an "after" version.)
2. **Console error on the newspaper:** `npm run checkpoint:play`, fix a CD, go today → `/api/headline` answers
   500 (Snowflake refuses the trial account) and the browser logs "Failed to load resource: 500". The game
   falls back to the offline edition correctly; only the console error is wrong (a 200/204 with
   "offline" would be quiet).
3. **E does nothing, silently,** with nothing in front of you or at an object you already used. So
   `notHereLine` and `alreadyDoneLine` can never show when playing (only via the debug API).
4. **Phone-size screen (390×844):** the open phone covers the dialogue, and the newspaper covers the card
   Low priority: the game needs a keyboard anyway.
5. **(Teammate B, needs an event)** After the ending, "Press Enter to play again" goes to the title, which
   still plays the last game's music until Enter. Music resets on `game-start`; a `title` event would let it
   stop on the title.
Worked: Space/Enter start, Q/E ignored on the title, the phone list wraps, no walking with the phone open,
walls stop you, second steps first give the right "not yet" line, mute survives travel, reputation 1→2→3
with the right card and paper, the ending after 3 s, play again resets flags, CDs and the shop.

**Next session:** read `AGENTS.md`, run `npm run gate`, run `npm run snowflake:ping` if `.env` is set.
