# Prompt for Teammate A: the flip phone's look + The Static

**How to use:** first do "Before you start" yourself. Then paste everything under
"The prompt" into your AI agent (JetBrains Air or any other).

## Before you start (you, not the agent)

1. Clone and set up (about 10 minutes):
   ```sh
   git clone https://github.com/skibidirizzycoder/fyh.git && cd fyh
   npm install
   npx playwright install chromium
   npm run gate        # must end with a JSON line containing "ok":true
   ```
2. Read `docs/PLAN.md` (5 minutes). Your part is "Teammate A".
3. Check that `git log --oneline -5` shows **"Foundation: CD moments"**. If not, `git pull` and wait.
4. Make your branch: `git switch -c feat/phone-static`
5. Try the game: `npm run dev`, open the link, press Enter, then Q. The plain grey box in the
   bottom-right is YOUR placeholder phone. The magenta blocks in "2 July 2004" are YOUR placeholder props.

---

## The prompt

You are working on "Flip Phone", a small Three.js + TypeScript game for a hackathon (Track 2:
Retro Remix). Read `AGENTS.md` and follow it exactly, then read `docs/PLAN.md`. I am
**Teammate A**. Only edit the files PLAN.md lists for Teammate A. If you need a change anywhere
else, stop and tell me what and why instead of editing it.

Work in small steps. After each step: `npm run check`, then `npm run smoke`, look at the
screenshots in `artifacts/`, then commit with a clear message. Never start the next step on untested work.

### What already exists (do not rebuild it)

- `src/phone/state.ts` (Claude's, do not edit): the phone's logic. Q opens/closes, W/S or the
  arrow keys move, E or Enter chooses. Its `PhoneState` is
  `{ open, index, items: [{ target, date, label, fixed }], here }`.
- `src/phone/view.ts` + `phone.css` (yours): a working PLACEHOLDER. `createPhoneView(root)` returns
  `{ render(phone) }`, and `render` is called **every frame**. Only touch the page when something changed.
- `src/story/cds/static.json` + `src/world/props/static.ts` (yours): PLACEHOLDER story and magenta props.
- `scripts/checks/phone.ts` + `static.ts` (yours): basic checks that already pass, with TODOs.
  Use the helpers in `scripts/checks/tools.ts` (`restart`, `tap`, `travel`, `walkTo`, `interact`,
  `state`, `measureContrast`, `screenshot`, `expect`).
- `src/tuning.ts` has your sections: `phone` (with `flipSec`) and `static`. Put every number there.

### Task 1: the flip phone's look (`src/phone/view.ts`, `src/phone/phone.css`)

Make it look and feel like a real **2004 flip phone**, so the judges say "that's faithful":
- Drawn with HTML/CSS (no image files): silver or dark-blue shell, a hinge, and a keypad with 0-9, * and #.
- Opening and closing with a flip animation (`T.phone.flipSec`, about 0.25 s).
- A small LCD screen: pale green background, dark pixel-style text (a monospace font is fine),
  a signal-bar icon and a battery icon at the top.
- The menu lists each moment (date + artist) and "Back to today". The selected row is inverted
  (dark background, light text). Fixed CDs (`fixed: true`) show a small ★.
- Keep it in the bottom-right, at most about 300 px wide, and **clear of** `#dialogue` (bottom
  centre) and `#card` (top right) at a 1280×720 window.
- Text contrast must be at least 4.5:1. The smoke test measures it on real pixels.
- The root element keeps `id="phone"`. When closed it must be really hidden (`hidden` or
  `display: none`) once the closing animation is over.
- **Gotcha:** tests pause the game and step it by hand, but CSS animations run in real time. In your
  check, after closing, wait with `await page.locator('#phone').waitFor({ state: 'hidden' })`
  instead of checking at once.

Extend `scripts/checks/phone.ts`: open with Q, move with ArrowDown, check the selected row
looks selected, check a fixed CD shows ★ (fix one first with `travel` + `interact`), measure
`#phone` contrast, take `screenshot(page, 'phone')`, close and wait until hidden.

### Task 2: The Static (`src/story/cds/static.json`, `src/world/props/static.ts`)

Moment `street_gig`, "2 July 2004". The Static are playing on the street outside the shop, but
their amp keeps cutting out.
- **Props** (all `eras: PAST, moments: M`, like the placeholders): a small stage (low box), an amp,
  the cable reel next to it (interactable `static_cable_reel`), a drum kit (a few cylinders), a mic
  stand (interactable `static_mic`), maybe a hand-painted banner. Use `standOn()` / `mountOn()` from
  `props/helpers.ts` so touching surfaces keep a gap: `npm run check` fails on z-fighting.
  The player starts at x=0, z=3 facing the shop (−z); keep the stage between z=−4 and z=1.
- **Story:** replace every PLACEHOLDER text: `situation`, `today`, both actions' `line` and
  `lockedLine` (short and funny), and the `offline` newspaper text.
  1) plug the cable reel into the shop's outdoor socket; 2) hand them the mic (requires step 1).
- Extend `scripts/checks/static.ts`: `travel(page, 'street_gig')`; `interact(page, 'static_mic')`
  must be `{ ok: false, reason: 'locked' }`; `walkTo` both objects in order (`r.ok` must be true);
  `travel(page, 'present')`; `visibleMeshes` must include `gold_static`. Screenshot the moment.

### When you're done

`npm run gate` passes on your branch. Then `git push -u origin HEAD` and tell the team
"feat/phone-static is ready". Write a short report: what you built, the smoke JSON line, and
which screenshots you looked at.
