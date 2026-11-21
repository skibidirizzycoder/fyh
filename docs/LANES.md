# LANES.md — who works where

| Lane | Person | Branch | Owns |
|---|---|---|---|
| director | Claude + the lead | `main` | everything not owned by a lane |
| phone-static | Teammate A | `feat/phone-static` | the phone's look, The Static, Mira's moment, the screens (`src/ui/`, `index.html`) |
| sound-kbit | Teammate B | `feat/sound-kbit` | all sound and music, DJ K-Bit, today's shop |

The exact file list is **`scripts/lanes.ts`**. `npm run ship` enforces it, so there is only one list.
Everyone may edit `src/tuning.ts` and `STATUS.md`, but only their own sections.

- Finished a piece: `npm run ship`. Next task: `docs/BACKLOG.md`.
- Play everyone's work: `npm run checkpoint:play` (http://localhost:4300).
- Need a change in someone else's files? Write it under "Requests" in your notes (`docs/notes/`).
