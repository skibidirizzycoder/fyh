# AGENTS.md — how to work on this game

This is the single rulebook for every coding agent (Claude, Junie, ...) and every human.
`CLAUDE.md` and `.junie/guidelines.md` only point here.

**Flip Phone** is a small 3D story game (Vite + TypeScript strict + Three.js, no engine).
A 2000s flip phone takes the player from today back to 2004. Small past actions
snowball and change the present.

## The loop (every task)

1. Pick **one** focused task. Write it down with `docs/task-template.md`.
2. Make the change, keeping it small.
3. `npm run check`: types, lint and unit tests.
4. `npm run smoke`: builds the production bundle and plays it in headless Chromium.
5. **Look at** `artifacts/2004.png` and `artifacts/present.png`. Do they show what you meant?
6. Commit. The pre-commit hook re-runs `npm run check` and blocks the commit if it fails.

Never start the next task on top of untested code. `npm run gate` = check + smoke.

## What "done" means

- Done means `npm run smoke` passes **on the production build**, not "it compiles".
- Verify the shipped build, not just the dev server.
- Report with numbers: the smoke JSON line, the test count and what you looked at in the screenshots.

## Measure, don't eyeball

- Prove positions, directions and timings with numbers from `window.__game`
  (`state()`, `step(n)`, `placePlayer()`, `setEra()`, `interact(id)`, `press/release`).
- Use `pause()` and `step(n)` so results are exact and repeatable. Never measure with real time.
- Never retry a flaky test until it passes. Find the cause; flakiness *is* the bug.

## Direction and facing

- Three.js forward is **-Z**. Yaw 0 faces -Z; positive yaw turns left.
- `src/core/facing.ts` is the one source of truth. Movement, the avatar's nose and the camera all use it.
- Prove directional changes at several headings (smoke checks 0, 90, 180, -90).
- Imported models: measure which way they face (`measuredFacing`) before trusting them.

## Rendering

- No z-fighting: never put two surfaces in the same plane where they overlap.
  Keep a gap of at least 0.01 (`T.world.surfaceGap`) or remove the hidden face.
  `tests/zfight.test.ts` checks every era at every story step.
- Dispose geometries, materials and textures you remove. Keep draw calls low
  (smoke fails above `T.limits.maxDrawCalls`). Reuse materials; share geometry.

## Readability for the player

- The two eras differ in at least two ways (colour grade, post filter, props, sound),
  so the player always knows *when* they are. Today they differ in grade, grain, props and the badge.
- Anything you can interact with stands out from decoration: bobbing marker + highlight glow.
  Decoration never gets either.
- Text contrast at least 4.5:1, **measured on rendered pixels** (smoke does this), not the colour you set.
- A fallback or placeholder must say plainly on screen why it ran (see `showFallback`).

## Where things live

| What | Where |
|---|---|
| Every gameplay number, colour and timing | `src/tuning.ts` |
| The story (actions, requirements, effects, dialogue) | `src/story/content.json` |
| The location layout (one layout, era variants) | `src/world/layout.ts` |
| Past flags → present state (pure functions) | `src/story/timeline.ts` |
| Story validation | `src/story/validate.ts` |
| Scenes (title, play, ending) and game rules | `src/game.ts` |
| Debug API (dev and test builds only) | `src/debug.ts` |
| Smoke test | `scripts/smoke.ts` |
| Newspaper endpoint (server only) | `server/headline.ts`, `server/cortex.ts` |
| Newspaper in the browser (cache, timeout, offline) | `src/news/desk.ts` |

- Story lives in `content.json`; every gameplay number lives in `tuning.ts`. No magic numbers in code.
- The present is a **pure function** of past flags. No hidden state.

## Network, secrets and the LLM

- `npm run gate` never calls the network. Fake every endpoint (inject `fetchFn` in unit tests,
  `context.route` in smoke). Real APIs get their own manual script (`npm run snowflake:ping`).
- Secrets live only in `.env` (gitignored) and reach code only via `process.env`, on the server.
  Never print, log or return them; redact error text. The browser never sees a key.
- The LLM only writes text. Story truth comes from `timeline.ts`; the server builds prompts from
  facts and never forwards browser text. Show LLM text with `textContent`, never `innerHTML`.
- Every network feature has a timeout and a plain on-screen fallback (e.g. "offline edition").

## Assets and code

- Only CC0 or CC-BY models and sounds. Credit CC-BY in `README.md` (Credits).
- Never paste other people's code into the project. Libraries via npm are fine.
- Pin exact dependency versions (`npm install --save-exact`).
- No secrets in the repo.

## Style

- Small functions. A comment says what the code does.
- One task, one commit. Commit after each working step.

## Bugs become lessons

Every bug you fix adds **one line** to `LESSONS.md`:
`- <bug> — cause: <cause> — rule: <rule>` and a test that would have caught it when possible.

## When a session restarts

Read `STATUS.md` first, then update it (about 200 words) before you stop.
