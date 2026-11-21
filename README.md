# Flip Phone

*Something old, into something modern.*

A small 3D story game. Hollow Records closed in 2004 and has been boarded up ever since.
Your old flip phone takes you back to 2004, where three small actions snowball
and change the present.

Built with Vite, TypeScript (strict) and Three.js. No game engine.

## Setup

You need Node.js 22.18 or newer (the smoke script runs TypeScript directly) and git.

```sh
npm install                        # also installs the pre-commit hook
npx playwright install chromium    # headless browser for the smoke test
npm run dev                        # play at the printed localhost URL
```

To get AI-written newspapers, fill in `.env` (see [Snowflake newspaper](#snowflake-newspaper)).
Without it, the game still works and prints the offline edition.

Controls: **W/S** walk, **A/D** turn, **E** or click to use, **Q** flip the phone (change era), **Enter** start.

## The loop

This project uses a "game dev harness": small verified steps, where done means *shown working*.

| Command | What it does |
|---|---|
| `npm run check` | `tsc --noEmit`, ESLint and Vitest unit tests |
| `npm run smoke` | builds production, serves it with `vite preview` and plays the demo in headless Chromium |
| `npm run gate` | check, then smoke |
| `npm run snowflake:ping` | **manual**: asks the real Snowflake API for one headline |

For every task:

1. One focused task (use `docs/task-template.md`).
2. `npm run check`
3. `npm run smoke`: then **look at** `artifacts/2004.png` and `artifacts/present.png`.
4. Commit. The pre-commit hook runs `npm run check` and blocks bad commits.

The smoke test fails on any console or page error, any missed state change, text
contrast below 4.5:1 (measured on rendered pixels) or too many draw calls. It
prints one JSON line and saves it to `artifacts/smoke.json`.

Rules for humans and agents are in [AGENTS.md](AGENTS.md). Fixed bugs become one-line
lessons in [LESSONS.md](LESSONS.md). [STATUS.md](STATUS.md) is the handoff note.

### The debug API

In dev (`npm run dev`) and test builds, open the browser console:

```js
__game.pause()                      // stop real time; only step() moves the game
__game.press('Enter'); __game.step(1); __game.release('Enter')
__game.setEra('2004')
__game.interact('cd')               // { ok: true, actionId: 'take_cd' }
__game.placePlayer(0, 3, 90)        // x, z, yaw in degrees
__game.state()                      // scene, era, flags, present, player, camera, drawCalls...
```

The shipped production build does not include it. The smoke test checks this.

## Snowflake newspaper

Each time you travel back to the present, a newspaper shows a headline and a short
article about *your* timeline. Snowflake Cortex writes them.

- The browser sends only the timeline flags to `/api/headline`. The **server** checks them
  (`replayFlags` in `timeline.ts`), builds the prompt from facts in the story, calls Cortex and
  returns `{ headline, article }`. The browser never sees the key or the prompt.
- The LLM only writes text. What is true in the present is still decided by `timeline.ts`.
- Replies are cached per flag set. If the server fails or takes more than 3 s, the game prints
  the pre-written text from `content.json` (`news.offline`) with an "offline edition" label.
- `npm run gate` never calls the network: unit tests use a fake `fetch`, and the smoke test
  fakes `/api/headline` in the browser, blanks the Snowflake variables and fails on any request
  that leaves localhost.

### Environment variables

Copy `.env.example` to `.env` (it is gitignored) and fill in:

| Variable | Required | What it is |
|---|---|---|
| `SNOWFLAKE_ACCOUNT` | yes | Account identifier, e.g. `myorg-myaccount` (the part before `.snowflakecomputing.com`) |
| `SNOWFLAKE_TOKEN` | yes | A programmatic access token (PAT) for a user whose role can use Cortex |
| `SNOWFLAKE_MODEL` | no | Cortex model; default `mistral-large2` (`src/tuning.ts`) |
| `SNOWFLAKE_TOKEN_TYPE` | no | `PROGRAMMATIC_ACCESS_TOKEN` (default), `OAUTH` or `KEYPAIR_JWT` |

The server reads them **only** from `process.env` and never prints them; error messages are
redacted. `npm run dev` and `vite preview` load `.env` into `process.env` (`vite.config.ts`).
Check that the real API works with:

```sh
npm run snowflake:ping   # prints one JSON line with a headline, or the reason it failed
```

## Changing the story

The story is data, in `src/story/content.json`:

- **actions**: things you do in 2004. Each uses an `objectId` (an interactable prop in
  `src/world/layout.ts`), may `require` earlier actions and has `effects` that show or hide props.
- **changes**: present-day differences. Each becomes active when its `requires` are done.

`npm run check` validates that every requirement and effect points at something that exists.
All numbers, colours and timings are in `src/tuning.ts`.

## Project layout

```
src/core/      loop, input, scene manager, facing, contrast maths
src/news/      newspaper: browser desk (cache, timeout, offline) and reply checks
server/        /api/headline handler and the Snowflake Cortex client (server only)
netlify/       Netlify Function wrapper for /api/headline
src/world/     layout (one location, two eras), mesh building, post filter, z-fight check
src/player/    controller (pure) and avatar + follow camera
src/story/     content.json, timeline (pure), validation
src/ui/        on-screen text (HTML overlay)
src/game.ts    game state and the title / play / ending scenes
src/debug.ts   window.__game (dev and test builds only)
scripts/       smoke test
tests/         unit tests
```

## Deploying

`npm run build` writes a static site to `dist/`. Paths are relative (`base: './'`), so it works in a sub-folder.

**GitHub Pages:** push the repo, then in *Settings → Pages* choose *GitHub Actions* and use the
"Static HTML" starter workflow with `npm ci && npm run build` and the upload path set to `dist`.
Or publish manually: `npx gh-pages -d dist`.

**Netlify** (recommended, because it also runs the newspaper endpoint): *Add new site → Import from Git*.
`netlify.toml` sets the build command, `dist` and `netlify/functions`. Add `SNOWFLAKE_ACCOUNT` and
`SNOWFLAKE_TOKEN` under *Site configuration → Environment variables*. Never put them in the repo.

GitHub Pages and dragging `dist/` onto Netlify serve static files only. There is no
`/api/headline` there, so players always get the offline edition.

Run `npm run gate` before every deploy.

## Credits

All geometry is made in code. There are no third-party models or sounds yet.
Only CC0 or CC-BY assets may be added; list CC-BY credits here (title, author, licence, link).
