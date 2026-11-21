# LESSONS.md

One line per lesson: `- <bug> — cause: <cause> — rule: <rule>`.
Every fixed bug adds a line here (and a test when possible). Newest at the bottom.

## Seed rules (from AGENTS.md)

- Stacked untested changes — cause: skipped the loop — rule: one task, then check, smoke, look at screenshots, commit.
- "Works" but broken in the browser — cause: only compiled — rule: done means smoke passes on the production build.
- Guessed a position or direction wrong — cause: eyeballed it — rule: measure with numbers from window.__game.
- Character walks backwards — cause: mixed forward conventions — rule: Three.js forward is -Z; facing.ts is the one source of truth; test several headings.
- Imported model faces the wrong way — cause: assumed its forward — rule: measure its facing before using it.
- Flickering surfaces — cause: z-fighting (two faces in one plane) — rule: keep a gap of at least 0.01 or remove the hidden face.
- Player can't tell which era they are in — cause: eras differ in one way only — rule: differ in two or more (grade, filter, props, sound).
- Player can't find what to use — cause: interactables look like decoration — rule: interactables get marker + highlight; decoration never does.
- Unreadable text — cause: trusted the colour set in code — rule: contrast at least 4.5:1, measured on rendered pixels.
- Story change needed a code change — cause: story in code — rule: story lives in content.json.
- Same number tuned in three places — cause: magic numbers — rule: every gameplay number lives in tuning.ts.
- Memory grows each era switch — cause: removed objects never disposed — rule: dispose geometries, materials and textures; reuse materials.
- Licence trouble — cause: unknown asset source — rule: only CC0 / CC-BY assets, credit CC-BY in README; never copy others' code.
- Dev server fine, shipped build broken — cause: only tested dev — rule: verify the shipped build.
- Test passed on the third try — cause: hidden timing bug — rule: never retry flaky tests; find the cause.
- Silent placeholder shipped — cause: fallback said nothing — rule: a fallback says on screen why it ran.
- Big tangled commit — cause: no small steps — rule: small functions, clear comments, no secrets, commit each working step.

## Project lessons

- Vitest crashed at start-up ("reading 'url'") — cause: a Vite plugin hook written as `(s) => s.middlewares.use(...)` returned the app, and Vite treats a returned function as a post-hook — rule: write Vite hooks with block bodies that return nothing.
- Smoke screenshot timed out after `walkTo` — cause: it drew every simulated frame inside one `page.evaluate`, and software WebGL queued hundreds of frames of GPU work — rule: in multi-frame debug helpers, simulate with `game.update()` and draw once at the end.
- The player walked through every prop — cause: movement was only clamped to the street's edges — rule: every move goes through `moveTo` (src/player/collide.ts) with the scene's visible props, and `tests/collide.test.ts` walks to every interactable in every scene at every story step.
- Coming back to a fixed moment said it was still broken — cause: the arrival line always used the "before" situation — rule: text that describes a state reads that state (`situationOf`, `fixedSituation`); tests/cdplayer.test.ts revisits a fixed moment.
- The browser logged "Failed to load resource: 500" for the newspaper — cause: the server answered an expected outage (no Snowflake) with an HTTP error — rule: an expected "not available" is a 200 `{ offline: true, reason }`; a build without the endpoint (`VITE_NEWS_API=off`) never asks.
- E did nothing, silently, with nothing in front — cause: the key was only handled when something was targeted — rule: every key press gets visible feedback (`notHereLine`, `alreadyDoneLine`); tests/cdplayer.test.ts presses E at nothing and at a used object.
- Smoke screenshots timed out after turning on MSAA — cause: SwiftShader (software GPU) draws 4x MSAA about 3 times slower, and a busy machine passed the 120 s wait — rule: software GPUs get no MSAA (`msaaLimit` in src/world/post.ts); measure screenshot time before adding per-pixel cost.
