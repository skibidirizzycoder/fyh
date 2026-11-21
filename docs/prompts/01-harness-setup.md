# Prompt 1: harness setup

This is the prompt that created this project and its "game dev harness".
It is copied here word for word, so teammates can see how the project was set up,
or paste it into their own agent (e.g. in JetBrains Air) to start a similar project.

You do **not** need to run it again to work on this repo. Clone the repo, follow
`README.md` (Setup), and read `AGENTS.md`.

---

Set up this project as a small 3D story game with a "game dev harness": a way of working where you (the agent) make small verified steps, "done" means shown working, scripts refuse bad work instead of relying on rules, and every bug becomes a lesson. Keep it simple enough for first-year students to understand.

Game concept: "something old into something modern". The player wants to change something in the present day. An old object (a 2000s flip phone) takes them back to 2004, where small actions snowball through cause and effect to change the present. One small location exists in two eras: 2004 and the present.

1. Project: Vite + TypeScript (strict) + Three.js, no other engine. Create:
   - src/core/loop.ts: fixed-timestep loop
   - src/core/input.ts: keyboard and mouse input map
   - a scene manager: title, play, ending
   - src/tuning.ts: the one place for every gameplay number, colour and timing
   - src/world/: builds the one location from one layout, with an era variant for 2004 and the present (different props, colour grade and a post filter: 2004 warm and grainy, present clean and cool)
   - a simple third-person or click-to-interact controller; objects you can interact with highlight when targeted, and E interacts
   - src/story/timeline.ts: past actions are flags; present-day state is a pure function of those flags (no hidden state); some actions require earlier ones (the snowball)
   - src/story/content.json: actions, requirements, effects and short dialogue lines, so the story is data, not code
   - an on-screen "because you..." card showing which past actions caused each change in the present
   - demo content: 3 past actions that chain into 1 present-day change, easy to replace
   - window.__game: a debug API, only in dev and test builds, to read state and flags, set the era, interact with an object by id, step N frames, and read the camera and player position and facing

2. Scripts in package.json:
   - "check": tsc --noEmit, eslint (flat config with typescript-eslint) and vitest run, with unit tests for timeline.ts (requirements, the snowball order, the present-state function) and content.json validation (every requirement and effect refers to an existing id)
   - "smoke": build, run vite preview, then a Playwright headless Chromium script (WebGL through SwiftShader) that plays the demo through window.__game: do the 3 past actions in order, switch to the present, and assert the present-day change happened. It fails on any console or page error, saves artifacts/2004.png and artifacts/present.png, and writes a one-line JSON result. It must test the production build.
   - "gate": check, then smoke

3. Guards: .githooks/pre-commit runs "npm run check" and blocks the commit on failure; "npm prepare" sets git core.hooksPath to .githooks.

4. AGENTS.md (under 120 lines) with these rules, and .junie/guidelines.md plus CLAUDE.md pointing to it:
   - One focused task at a time. After each: npm run check, npm run smoke, look at the artifacts screenshots, then commit. Never stack tasks on untested code.
   - Done means smoke passes on the production build, not "it compiles".
   - Measure, don't eyeball: prove positions, directions and timings with numbers from window.__game.
   - Three.js forward is -Z. Use one source of truth for facing, and check imported models face the right way by measuring.
   - No z-fighting: never put two surfaces in the same plane where they overlap; keep a gap of at least 0.01 units or remove the hidden face.
   - The two eras must differ in at least two ways (colour grade, filter, props, sound), so the player always knows when they are. Anything the player can interact with stands out from the decoration.
   - Text contrast at least 4.5:1, measured on rendered pixels.
   - Story lives in content.json; every gameplay number lives in tuning.ts.
   - Dispose geometries, materials and textures you remove; keep draw calls low; reuse materials.
   - Only CC0 or CC-BY models and sounds (credit CC-BY in README); never use other people's code.
   - Verify the shipped build, not just the dev server. Never retry a flaky test until it passes; find the cause.
   - Every bug fixed adds one line to LESSONS.md (bug, cause, rule), plus a test when possible.
   - Small functions, comments say what the code does, no secrets in the repo, commit after each working step.

5. Docs: README.md (setup: npm install, npx playwright install chromium, run dev; the loop; deploying dist/ to GitHub Pages or Netlify), LESSONS.md seeded with the rules above as one-liners, docs/task-template.md (goal, files, done-check, report), and STATUS.md (a 200-word handoff for when a session restarts).

Done when "npm run gate" passes and the pre-commit hook blocks a deliberate type error (show it, then revert). Pin exact dependency versions. Report the file tree, the test count and the smoke JSON line.
