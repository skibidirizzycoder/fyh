# Prompt for Teammate A, task 2: The Static's street gig

**How to use:** do "Before you start" yourself, then paste "The prompt" into your agent.

## Before you start (you, not the agent)

1. `git switch feat/phone-static && git pull origin main` (your phone is merged into `main`. It looks great).
2. Your draft text and prop plan are in `docs/notes/teammate-a.md`. The agent will use them.

---

## The prompt

You are working on "Flip Phone" (read `AGENTS.md`, `docs/PLAN.md`, then Task 2 of
`docs/prompts/03-teammate-a-phone-and-the-static.md`). I am **Teammate A**. The flip phone's look
is done and merged. New task: **build The Static's moment** (`street_gig`, "2 July 2004"), using the
draft text and prop plan in `docs/notes/teammate-a.md`.

**My files:** `src/story/cds/static.json`, `src/world/props/static.ts`, `scripts/checks/static.ts`,
`tests/static*.test.ts`, the `static` section of `src/tuning.ts`, `docs/notes/teammate-a.md`.
Don't edit other files. If you need a change elsewhere, write it under "Requests for Claude" in your notes.

### What to build

- **Story** (`static.json`): replace every PLACEHOLDER with the draft text from the notes:
  `situation`, both actions' `line` / `lockedLine` / `label` / `prompt`, and the `offline` paper.
  Add a `"today"` line (one sentence: what's different today, e.g. a cult indie band).
  **Keep the action ids `static_plug_amp` and `static_give_mic` and the object ids
  `static_cable_reel` and `static_mic`.** Shiv's music listens for those two actions: before the
  amp is plugged in, the band's real song cuts out; after the mic, it gets louder.
- **Props** (`static.ts`), all `eras: PAST, moments: ['street_gig']`: a low stage, an amp on it,
  the cable reel beside the stage (interactable), a drum kit (kick + 2 toms), the mic stand
  (interactable) and a "THE STATIC" banner. Use `standOn()` / `mountOn()` from `props/helpers.ts`.
  Put every colour in the `static` section of `src/tuning.ts`.
- **Where:** the player starts at x=0, z=3 facing −z. Keep everything between z=−4 and z=1. Stay
  clear of the 2004 street props that every moment shares: the payphone (x=5, z=−1), the old car
  (x=5, z=3.5), the bench (x=−2, z=0), the noticeboard (x=3.6, z=0.5) and the lamp post
  (x=−3.5, z=−3). `npm run check` fails on z-fighting in any scene.
- **Make the fix visible:** add a small crowd (3–4 cylinders, `startsHidden: true`) that
  `static_give_mic` shows, like K-Bit's queue pulling out their phones.
- **Checks** (`scripts/checks/static.ts`): `travel(page, 'street_gig')`; `interact(page,
  'static_mic')` is `{ ok: false, reason: 'locked' }`; `walkTo` the cable reel, then the mic
  (`r.ok` must be true); the crowd is in `visibleMeshes`; `screenshot(page, 'static-fixed')`;
  `travel(page, 'present')` and `gold_static` is in `visibleMeshes`.
- Optional unit tests (`tests/static.test.ts`), like `tests/kbit.test.ts`: ids, moment, the
  requirement chain, props inside the street.

### When you're done

`npm run gate` passes. Look at `artifacts/moment-street_gig.png` (after the fix) and
`static-fixed.png`. Push and tell the team "feat/phone-static is ready" with the smoke JSON line.
Update `docs/notes/teammate-a.md`.
