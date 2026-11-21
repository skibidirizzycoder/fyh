# Prompt for Teammate A: the flip phone's look + The Static

**How to use:** first do "Before you start" yourself. Then paste everything under
"The prompt" into your AI agent in JetBrains Air.

## Before you start (you, not the agent)

1. Clone and set up (about 10 minutes):
   ```sh
   git clone https://github.com/skibidirizzycoder/fyh.git && cd fyh
   npm install
   npx playwright install chromium
   npm run gate        # must end with a JSON line containing "ok":true
   ```
2. Read `docs/PLAN.md` (5 minutes). Your part is "Teammate A".
3. Wait for the commit **"Foundation: CD moments"** on `main` (check with `git pull` then `git log --oneline -5`).
   Meanwhile, sketch what the phone should look like and what The Static's gig looks like.
4. Make your branch: `git switch -c feat/phone-static`

---

## The prompt

You are working on "Flip Phone", a small Three.js + TypeScript game for a hackathon (Track 2:
Retro Remix). Read `AGENTS.md` and follow it exactly, then read `docs/PLAN.md`. I am
**Teammate A**. Only edit the files PLAN.md lists for Teammate A. If you need a change anywhere
else, stop and tell me what and why instead of editing it.

Work in small steps. After each step: `npm run check`, then `npm run smoke`, look at
`artifacts/*.png`, then commit with a clear message. Never start the next step on untested work.

### Task 1: the flip phone's look (`src/phone/view.ts`, `src/phone/phone.css`)

The phone logic already exists in `src/phone/state.ts` (do not edit it). Each frame,
`view.ts` gets a `PhoneState` and must draw it. Make it look and feel like a real **2004 flip phone**,
so the judges say "that's faithful":
- A phone shape in the bottom-right of the screen, drawn with HTML/CSS (no image files needed):
  silver or dark-blue shell, a hinge, and a keypad with 0-9, * and #.
- Opening and closing with a flip animation (about 0.25 s, the time lives in the `phone` section of `src/tuning.ts`).
- A small LCD screen: pale green background, dark pixel-style text (a monospace font is fine),
  a signal-bar icon and a battery icon at the top.
- The menu lists the 2004 moments (date + artist) and "Back to today". The selected row is inverted
  (dark background, light text). Fixed CDs show a small ★.
- Text contrast must be at least 4.5:1. The smoke test measures it on real pixels.
- Give the phone's root element `id="phone"` so tests can find it.

Add checks to `scripts/checks/phone.ts`: open the phone with Q (`__game.press('KeyQ')`, `step(1)`,
`release`), assert `#phone` is visible, move down with ArrowDown, assert the selection moved (read it
from `__game.state()`), and measure `#phone` contrast. Close it again and assert it is hidden.

### Task 2: The Static (`src/story/cds/static.json`, `src/world/props/static.ts`)

Moment `street_gig`, "2 July 2004". The Static are playing on the street outside the shop, but
their amp keeps cutting out.
- **Props** (2004, `moments: ['street_gig']`): a small stage (low box), an amp (interactable:
  `static_cable_reel` is the cable reel next to it), a drum kit (a few cylinders), a mic stand
  (interactable: `static_mic`), maybe a hand-painted banner. Use boxes and cylinders like
  `src/world/layout.ts`. Keep a 0.02 gap between touching surfaces (`npm run check` fails on z-fighting).
- **Actions:** 1) plug the cable reel into the shop's outdoor socket; 2) hand them the mic
  (requires step 1). Write short, funny dialogue lines and `lockedLine`s.
- **Offline newspaper** text for when The Static is fixed.
- Add checks to `scripts/checks/static.ts`: travel to `street_gig`, check the mic is locked before
  the amp, do both actions, travel to today and assert The Static's gold disc is visible.

### When you're done

`npm run gate` passes on your branch. Then `git push -u origin HEAD` and tell the team
"feat/phone-static is ready". Write a short report: what you built, the smoke JSON line, and
which screenshots you looked at.
