# STATUS.md — handoff

*Update this (about 200 words) at the end of every session.*

**Last updated:** 2026-11-21, harness setup.

**State:** `npm run gate` passes. 52 unit tests; the smoke test plays the full demo on the
production bundle, measures text contrast and draw calls, and writes
`artifacts/2004.png`, `artifacts/present.png` and `artifacts/smoke.json`.

**What exists:** a third-person tank controller (W/S/A/D, E to use, Q for the flip phone),
one street-corner layout with 2004 and present variants (props, sky, lighting, a colour-grade,
grain and vignette post filter), a story that lives in data (`src/story/content.json`):
take the CD, play it at the listening post, pin the flyer. These three actions make the
present-day record shop open, and a "Because you..." card lists the causes. There is a
title, play and ending scene, and `window.__game` in dev and test builds.

**Known gaps / next ideas:**
- No sound yet (a third way for the eras to differ).
- The player walks through props (it is only clamped to the ground).
- The avatar's nose is hidden from the default camera angle; facing is shown by the camera.
- The demo story is a placeholder. Replace `content.json` and the props in `layout.ts`.

**Next session:** read `AGENTS.md`, run `npm run gate`, pick one task with
`docs/task-template.md`.
