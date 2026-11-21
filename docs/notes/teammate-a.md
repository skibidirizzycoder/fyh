# Teammate A — phone-static lane notes

Branch: `feat/phone-static`. Owned paths: see `docs/prompts/05-agentic-workflow.md` (Part 5).

## Status (2026-11-21)

**Done:** both tasks from `docs/prompts/03-teammate-a-phone-and-the-static.md`. `npm run gate`
passes: 122 unit tests, smoke `"ok":true`, `pitchSec` 26.8, max draw calls 19, phone LCD contrast 10.45:1.
Team block in smoke.json:
`"phone":{"items":4,"widthPx":220,"flipSec":0.25,"starred":["street_gig"]},"static":{"walkFrames":[89,2]}`.

**Ready to merge:** yes. Branch is merged with `main` at `145f38f`.

**Screenshots checked:** `artifacts/phone.png` (phone open in 2 July 2004, The Static row selected
with ★ and ◄, clear of the dialogue), `artifacts/static-arrive.png` (stage, band, red amp light,
reel and mic markers), `artifacts/static-fixed.png` (green amp light, cable, crowd either side).

## Requests for the director

- `src/ui/hud.ts`: after an action is done, its prompt still shows (e.g. "E — Hand over the shop's
  mic" stays up once the mic is handed over). Hide the prompt, or show `alreadyDoneLine`, when the
  targeted object's action is already in the flags.
- `npm install` on Windows rewrites `package-lock.json` (drops about 32 lines of other-platform
  optional packages). I never commit it; teammates on Windows should use `npm ci`.

## Task 1: the phone's look

- **Shell:** silver clamshell (chosen by Teammate A). Brushed-silver gradient lid and base, dark
  hinge, nav ring with OK and up/down arrows, green call and red end keys, a 0-9 * # keypad with
  letters. 220 px wide, bottom-right, 104 px up so it never covers `#dialogue`; scaled to 0.8 in
  windows shorter than 680 px.
- **LCD:** pale green with dark text, signal bars, where you are now, battery, "TIME TRAVEL", one
  row per moment (artist over date), "Back to today", soft keys "E: Go" / "Q: Close". The selected
  row is inverted; fixed CDs show ★; the moment you are in shows ◄. The LCD uses only two colours,
  so its measured contrast is the contrast of that pair.
- **Flip:** the lid swings open around the hinge while the phone rises, for `T.phone.flipSec`;
  closing plays it backwards, then sets `hidden`. `#phone[data-state]` is
  opening / open / closing / closed. Reduced-motion users get no animation.
- All numbers and colours: `T.phone` in `src/tuning.ts`.

## Task 2: The Static (2 July 2004, `street_gig`)

- **Props** (`src/world/props/static.ts`, colours in `T.static`): stage, singer and guitarist (with
  guitar), kick, snare and cymbal, a banner on two poles, the amp with a red light, an orange cable
  reel (`static_cable_reel`), the shop's outdoor socket and the mic stand (`static_mic`).
- **Step 1, plug in the amp:** shows the cable from socket to reel; the amp light turns green.
- **Step 2, hand over the mic** (locked until step 1): a crowd of three appears either side of the stage.
- **Text:** all placeholders replaced in `src/story/cds/static.json`, including the offline paper:
  "Plugged-In Street Gig Makes The Static Stars".
