# Teammate A — phone-static lane notes

Branch: `feat/phone-static`. Owned paths: see `docs/prompts/05-agentic-workflow.md` (Part 5).

## Status (2026-11-21, 14:40)

**Done and on `main`:** A1 (the phone's look), A2 (The Static).
**Done, shipping now:** A3 (Mira's open mic). `npm run gate` passes: 139 unit tests (10 new in
`tests/mira.test.ts`), smoke `"ok":true`, `pitchSec` 26.7, draw calls 19, phone contrast 10.45.
Team block: `"mira":{"walkFrames":[43,103]}`.
**Next:** A4, the screens (title boot screen, tabloid card + newspaper, wall of gold discs).

**Screenshots checked:** `artifacts/mira-arrive.png` (Mira waiting by the lamp post with her
guitar, string lights over the window, three listeners on glowing phones on the right),
`artifacts/mira-fixed.png` and `artifacts/moment-open_mic.png` (Mira at the mic, the crowd round
her, phones gone; she is not hidden from the pitch camera).

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

## Task 3: Mira's open mic (14 March 2004, `open_mic`)

- **Props** (`src/world/props/mira.ts`, colours in `T.mira`): her dropped CD on the bench
  (`mira_cd`), the listening post with its OPEN MIC board (`listening_post`), a mic stand and a
  small amp in front of the window, string lights over the window, Mira with an acoustic guitar,
  three bored listeners holding glowing phones.
- **Step 1, pick up the CD:** the CD goes.
- **Step 2, play it at the listening post** (locked until step 1): Mira moves from the lamp post to
  the mic, the phones go away and the listeners gather round her, and her flyer goes up.
  `MIRA_PLAY_SHOWS` / `MIRA_PLAY_HIDES` in `mira.ts` are the one list; a unit test keeps
  `mira.json` equal to them.
- **Text:** rewritten in `src/story/cds/mira.json`; paper: "The Open Mic Nobody Was Watching".

## Task 2: The Static (2 July 2004, `street_gig`)

- **Props** (`src/world/props/static.ts`, colours in `T.static`): stage, singer and guitarist (with
  guitar), kick, snare and cymbal, a banner on two poles, the amp with a red light, an orange cable
  reel (`static_cable_reel`), the shop's outdoor socket and the mic stand (`static_mic`).
- **Step 1, plug in the amp:** shows the cable from socket to reel; the amp light turns green.
- **Step 2, hand over the mic** (locked until step 1): a crowd of three appears either side of the stage.
- **Text:** all placeholders replaced in `src/story/cds/static.json`, including the offline paper:
  "Plugged-In Street Gig Makes The Static Stars".
