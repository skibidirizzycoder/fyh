# Teammate A — phone-static lane notes

Branch: `feat/phone-static`. Owned paths: see `docs/prompts/05-agentic-workflow.md` (Part 5).

## Status (2026-11-21, 15:15)

**Done and on `main`:** A1 (phone), A2 (The Static), A3 (Mira's open mic), A4 (the screens, `checkpoint-10`).
**Done, shipping now:** A5 (the phone feels alive). Smoke `"ok":true`; the phone check records
`closed>opening>connecting>static>closing>closed` while travelling; outer screen contrast 12.65:1.
**Queue:** A6 (The Static after the fix), then M-A1/M-A2/M-A3.

**Screenshots checked:** `artifacts/phone-connecting.png` ("Connecting..." + "14 March 2004", bars
filling), `artifacts/mira-arrive.png` (the folded phone bottom-right: 19:30, 14 Mar 2004, "Q: open"),
`artifacts/title.png` (green LCD boot screen, centred, boot bar filling),
`artifacts/title-variants.png` (both looks side by side), `artifacts/tabloid.png` (red-top paper and
"Because you..." card with EXCLUSIVE sticker), `artifacts/ending.png` (wall of three framed gold discs).

**Team decision needed:** the title look. `artifacts/title-variants.png` shows both; switch with
`T.screens.titleVariant` (`'lcd'` green mono, the default, matches the phone; or `'colour'` blue screen).

## Requests for the director

- Smoke takes about 3 minutes on this laptop now (it was about 1 minute this morning); my UI check
  is about 35 s of that. If the gate is too slow for shipping, `measureContrast` could sample fewer
  pixels: it sends every pixel of the box from the browser as a JSON array.
- `tools.ts` `waitForNews` polls on animation frames; `checks/ui.ts` uses its own 100 ms timer poll
  (`waitForPaper`) after one run where the paper was ready but the wait never saw it. Consider the
  same in `waitForNews`.
- Windows: use `npm ci`, not `npm install` (it rewrites `package-lock.json`).

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

## Task 4: the screens (`src/ui/hud.ts`, `src/ui/hud.css`, `index.html`)

- **Title:** a 2004 phone booting up: signal, clock, battery, "FLIP PHONE", "HOLLOW RECORDS",
  "Closed since 2004", one dusty CD per CD (artist names from the CD files), a stepped boot bar,
  blinking "Press Enter", the controls. Two looks: `lcd` (the phone's green LCD) and `colour`.
- **"Because you...":** a tabloid inside story: white page, red header, EXCLUSIVE sticker, red numbers.
- **Newspaper:** a red-top front page: THE CORNER GAZETTE masthead with a price, huge uppercase
  headline, article, "offline edition" label. Still `textContent` only (LLM text is untrusted).
- **Ending:** "GOLD" over a wall of framed gold discs (artist + title), then the closing line.
- All HUD styles moved from `index.html` into `src/ui/hud.css`; colours and timings in `T.screens`.
- Element ids unchanged: `#title`, `#era`, `#prompt`, `#dialogue`, `#card`, `#news`,
  `#news-offline`, `#ending`.

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

## Task 5: the phone feels alive (A5)

- **Travelling:** choosing a moment shows "Connecting...", the destination date and five signal bars
  filling one after another (`T.phone.connectSec`), then a burst of LCD static (`T.phone.staticSec`),
  then the lid flips shut. `#phone[data-state]` goes `connecting` → `static` → `closing` → `closed`.
  The game has already arrived; the phone is catching up, so the travel itself is not slower.
- **Closed phone:** a small folded phone stays bottom-right with a blue-backlit outer screen: a live
  clock and today's date in the present, the moment's own time in 2004 (`T.phone.momentTimes`:
  open mic 19:30, street gig 15:10, ringtone 16:45) and the short date ("14 Mar 2004"). Hidden on the
  title and ending screens.
- **Menu:** the selected row has a blinking ">" cursor (`T.phone.blinkSec`), like a 2004 menu. The
  row's colours stay put, so the LCD contrast is unchanged.
- **Checks:** `scripts/checks/phone.ts` checks the outer screen today and in 2004 (text and contrast),
  that it never overlaps `#dialogue`/`#card`/`#era`, the cursor, and the whole travel sequence. Short
  looks are recorded in the page with a MutationObserver: on a slow machine a 0.35 s look can come
  and go while a screenshot is saved. Unit tests: `tests/phone-view.test.ts` (outer screen text).
