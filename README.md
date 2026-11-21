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

Controls: **W/S** walk, **A/D** turn, **E** or click to use, **Q** flip the phone (change era), **Enter** start.

## The loop

This project uses a "game dev harness": small verified steps, where done means *shown working*.

| Command | What it does |
|---|---|
| `npm run check` | `tsc --noEmit`, ESLint and Vitest unit tests |
| `npm run smoke` | builds production, serves it with `vite preview` and plays the demo in headless Chromium |
| `npm run gate` | check, then smoke |

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

**Netlify:** *Add new site → Import from Git*, build command `npm run build`, publish directory `dist`.
Or drag the `dist/` folder onto the Netlify dashboard.

Run `npm run gate` before every deploy.

## Credits

All geometry is made in code. There are no third-party models or sounds yet.
Only CC0 or CC-BY assets may be added; list CC-BY credits here (title, author, licence, link).
