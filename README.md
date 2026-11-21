# Flip Phone

*Something old, into something modern.*

A First Year Hack project (KCL Tech), Track 2: Retro Remix, "Old Tech, New Tricks".

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

### For teammates

```sh
git clone https://github.com/skibidirizzycoder/fyh.git && cd fyh
npm install                        # installs the pre-commit hook too
npx playwright install chromium
cp .env.example .env               # optional: Snowflake values (never commit .env)
npm run gate                       # should pass before you change anything
```

Then read [AGENTS.md](AGENTS.md) (the rules) and [STATUS.md](STATUS.md) (where we are).
On Windows, use `npm ci` rather than `npm install`, so `package-lock.json` stays unchanged.

**Team flow:** work on your lane branch, then:

| Command | What it does |
|---|---|
| `npm run ship` | Merges `main` into your branch, refuses files outside your lane ([scripts/lanes.ts](scripts/lanes.ts)), runs the gate, fast-forwards `main` and tags a checkpoint. No permission needed: the gate is the permission |
| `npm run checkpoint:play` | Builds the newest checkpoint in `../<repo>-checkpoint` and serves it at http://localhost:4300 (and on the local network). Your branch is untouched |
| `npm run checkpoint` | Director: gate `main`, tag it and deploy it to the live site (https://flip-phone-2004-8a09.netlify.app) |

What to build next: [docs/BACKLOG.md](docs/BACKLOG.md).
The prompts that built this project are in [docs/prompts/](docs/prompts/). Read them to see
how the harness was set up, or reuse them with your own agent.

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
3. `npm run smoke`: then **look at** the screenshots in `artifacts/` (`2004.png`, `present.png`, `moment-*.png`, ...).
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
__game.restart()                    // fresh game, today
__game.travel('open_mic')           // shortcut: straight to a 2004 moment (or 'present')
__game.interact('mira_cd')          // shortcut: { ok: true, actionId: 'mira_take_cd' }
__game.phoneTo('ringtone')          // real keys: Q, Down..., E
__game.walkTo('kbit_phone')         // real keys: turn and walk there, then press E
__game.placePlayer(0, 3, 90)        // x, z, yaw in degrees
__game.state()                      // scene, era, moment, flags, phone, audio, card, drawCalls...
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
scripts/       smoke test, snowflake:ping
docs/prompts/  the prompts that set up this project
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
`/api/headline` there, so players always get the offline edition. Build those with
`VITE_NEWS_API=off npm run build`: the browser then never asks for the missing endpoint (no 404 in the console).
Where the endpoint exists but Snowflake can't answer, it replies 200 `{ offline: true, reason }`, so that is quiet too.

Run `npm run gate` before every deploy.

## Credits

All geometry and sound effects are made in code. Music by other artists (CC BY) is credited in
[public/music/CREDITS.md](public/music/CREDITS.md) once it is added.
Only CC0 or CC-BY assets may be added; list each one's title, author, licence and link.
