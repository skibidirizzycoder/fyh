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

**Hackathon rules** (opening ceremony, slide 27). Everyone, and every agent, follow these:
1. **Build with JetBrains Air (required).** Run your agents through Air (IntelliJ IDEA 2026.3 or the
   Air app: Claude, Codex and Junie are built in). Take a screenshot of Air in use for the submission.
2. Teams of up to 3 people. 3. **All project work happens today** (hacking started 11:00): no code
   from before the event, only credited libraries and assets. 4. Any language, framework or API.
5. MLH Code of Conduct. **Submit at mlh.link/first-year-hack**: team, project name, repo (public)
   and demo (https://flip-phone-2004-8a09.netlify.app). Draft by 17:30, hard deadline 18:00; late
   entries aren't judged. Judging at 18:10. Track 2 looks for "Reinventive" and "Surprising + Faithful".

**Now (hackathon day, 15:00):** all three CDs, the CD music (real songs, 2004 raw -> today remix),
each moment's look and sound, today's shop by reputation, and collisions are on `main`. Live:
https://flip-phone-2004-8a09.netlify.app (updated by `npm run checkpoint`). Teammates ship themselves
and take tasks from `docs/BACKLOG.md`, now including the Messenger "M" tasks
(`docs/reference-messenger.md`). AI images: only Claude makes them (`npm run art`); ask under
"Art requests" in your notes. Research in progress: `docs/research/abeto-techniques.md` (how
Messenger gets its look), which adds world-lane tasks W1-W5 below. Director next: the street and
player look (C5), props that show textures (C6), toon look (M-C1). No pitch work yet.

**World lane (director): techniques from the Messenger research** (`docs/research/abeto-techniques.md`).
Ranked by look per hour. **Not started: the lead picks which to build.**
- [ ] W1. Ink outlines: two-target post pass (depth/normal/prop-ID edges, noise breakup) inside `post.ts`, 0 extra draw calls, 8-bit info target for SwiftShader (~4h)
- [ ] W2. Cel shading: two-tone Lambert via `onBeforeCompile` with hue-shifted HSV shadow tone + one 1024² PCF sun shadow following the player (~2h)
- [ ] W3. Palette atlas: 16×16 nearest palette texture per era, prop UVs to swatches, one shared material, merge static street into 1–3 draws (~3h)
- [ ] W4. Sky and fog: inside-out sphere with hard-stepped noise clouds per era (1 draw) + FogExp2 or near/far fog colours (~1.5h)
- [ ] W5. LUT grade: 32³ per-era `Data3DTexture` sampled in `post.ts`, replacing the tint/saturation maths, keep grain and vignette (~1.5h)
- Ready on a branch, not merged: `director/retro` (2004 drawn at ~240–270 lines, 4×4 Bayer dither, 24 colour levels; today unchanged).

**Claims (free tasks):**
- F1 street life, DJ K-Bit's bus stop (`src/world/props/kbit.ts`): Teammate B, done 15:00 (bin, newspaper box, pigeons, a dog).
- F2 playtest `checkpoint-11` (real key presses, headless Chrome; no sound): Teammate B, done 15:40. Bugs below.

**Bugs** (F2 playtest of `checkpoint-11`: whole game in the order Static → K-Bit → Mira, ending, play again):
1. **(Fixed in C7: `fixedSituation`.)** **Revisiting a fixed moment shows the "before" line.** Fix The Static, go today, then Q → The Static. The
   line still says "their battery amp keeps dying mid-chorus", but the amp is plugged in and the band is live.
   Same for any fixed CD. (Claude: `travelLines.past` could have an "after" version.)
2. **(Fixed in C7: 200 `{ offline }`, `VITE_NEWS_API=off`.)** **Console error on the newspaper:** `npm run checkpoint:play`, fix a CD, go today → `/api/headline` answers
   500 (Snowflake refuses the trial account) and the browser logs "Failed to load resource: 500". The game
   falls back to the offline edition correctly; only the console error is wrong (a 200/204 with
   "offline" would be quiet).
3. **(Fixed in C7.)** **E does nothing, silently,** with nothing in front of you or at an object you already used. So
   `notHereLine` and `alreadyDoneLine` can never show when playing (only via the debug API).
4. **Phone-size screen (390×844):** the open phone covers the dialogue, and the newspaper covers the card
   Low priority: the game needs a keyboard anyway.
5. **(Teammate B; the `title` event exists since C7)** After the ending, "Press Enter to play again" goes to the title, which
   still plays the last game's music until Enter. Music resets on `game-start`; a `title` event would let it
   stop on the title.
Worked: Space/Enter start, Q/E ignored on the title, the phone list wraps, no walking with the phone open,
walls stop you, second steps first give the right "not yet" line, mute survives travel, reputation 1→2→3
with the right card and paper, the ending after 3 s, play again resets flags, CDs and the shop.

**Next session:** read `AGENTS.md`, run `npm run gate`, run `npm run snowflake:ping` if `.env` is set.
