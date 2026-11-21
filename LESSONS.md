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
