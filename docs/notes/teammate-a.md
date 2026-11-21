# Teammate A — phone-static lane notes

Branch: `feat/phone-static`. Owned paths: see `docs/prompts/05-agentic-workflow.md` (Part 5).

## Status (2026-11-21, 16:45)

**Done and on `main`:** A1-A6, the review fixes, M-A1/M-A2/M-A3 (`checkpoint-21`).
**Shipping now:** the songs rework, our lane (the lead's request): Mira covers "Lose Yourself"
(battle night, 13 December 2002), The Static cover "Sweet Child O' Mine" (street gig, 6 August
1988). The rest (K-Bit → "Despacito", 14 July 2017; the shop closed in 2019; local real songs) is in
the `feat/songs` pull request, because those files are Teammate B's and Claude's.
**Queue:** A7-A9 (Round 3) once C7/C8 land (`cd-insert`, `area`, `locked` rows).

**Live site check (15:15, real keys, production has no debug API):** https://flip-phone-2004-8a09.netlify.app
loads and plays (title, Enter, phone, travel to 14 March 2004 and back, no script errors), but it
serves an older build (no A4 screens, no A5 phone) and `/api/headline` returns 500 "server is
missing SNOWFLAKE_ACCOUNT or SNOWFLAKE_TOKEN", so the paper there is always the offline edition.

**Screenshots checked:** `artifacts/title.png` (logo leaning towards the mouse over the live street,
boot screen, PRESS START), `artifacts/bubbles.png` (♪/♥ bubbles over The Static's crowd),
`artifacts/tabloid.png` (paper UI), `artifacts/phone.png` (checklist), `artifacts/ending.png`
(frames hung by hand, paper captions), `artifacts/narrow-today.png` and `artifacts/narrow-phone.png` (390x844:
nothing overlaps), `artifacts/static-fixed.png` (packed crowd, arms up, set list by the mic),
`artifacts/phone-connecting.png` ("Connecting..." + "14 March 2004", bars
filling), `artifacts/mira-arrive.png` (the folded phone bottom-right: 19:30, 14 Mar 2004, "Q: open"),
`artifacts/title.png` (green LCD boot screen, centred, boot bar filling),
`artifacts/title-variants.png` (both looks side by side), `artifacts/tabloid.png` (red-top paper and
"Because you..." card with EXCLUSIVE sticker), `artifacts/ending.png` (wall of three framed gold discs).

**Team decision needed:** the title look. `artifacts/title-variants.png` shows both; switch with
`T.screens.titleVariant` (`'lcd'` green mono, the default, matches the phone; or `'colour'` blue screen).

## Art requests

- **`logo_flip_phone`** (transparent cut-out, landscape, about 1024x384): the words FLIP PHONE in chunky,
  hand-drawn capital letters, off-white fill with a thick dark ink outline and a hard drop shadow,
  "PHONE" in warm yellow, a tiny silver flip phone tucked into the "O". No other text. It replaces the
  CSS logo in `.title-logo` (`src/ui/hud.ts` `titleScreen`).

## Requests for the director

- **Bubbles over the right people (M-A3):** `hud.render(game)` has no camera, so the ♪/♥ bubbles pop
  in a band across the middle of the screen (where the crowd is when you fix a CD, facing it). If
  `main.ts` passed the camera (`hud.render(game, camera)`), I can pin each bubble over a person
  that the fixing step shows (project their prop positions).

- **Netlify:** the live site is behind `main` (no A4/A5): it needs `npm run checkpoint` from your
  linked folder. Its `/api/headline` returns 500 because `SNOWFLAKE_ACCOUNT`/`SNOWFLAKE_TOKEN` are
  not set under Site settings → Environment variables (the game falls back to the offline paper).
  Netlify also draws a "Powered by Netlify" badge in the bottom-right corner; the folded phone now
  sits 64 px up to stay clear of it.

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

## Task 6: The Static after the fix (A6)

- **The payoff** (`static_give_mic` shows `STATIC_FIX_SHOWS`, 33 props): the crowd grows from 3 to 8,
  packed round both sides of the stage, each with a head; four have both arms up (above their
  heads). An aisle (x 0..1.6) from the start to the mic stays clear, and there is room between
  people for a player a person appears on to be pushed out (`tests/collide.test.ts`).
- **A dropped set list** on the stage by the mic (white sheet, red title, three lines of songs) and a
  **tip jar** at the front of the stage beside the mic (glass, lid, a fiver poking out, a label).
  Decoration only: no marker, no glow. Colours in `T.static`.
- **Checks:** `tests/static.test.ts` (step 2 shows exactly the exported list, crowd size and raised
  arms, the aisle, only the reel and mic are interactable, inside the street, no z-fighting or
  overlap except the amp light pair that swaps); `scripts/checks/static.ts` checks every payoff prop.

## Task M-A3: checklist + payoff

- **Checklist:** the phone menu is a checklist: a tick box before each CD (ticked once fixed, drawn in
  CSS with `currentColor`, so it inverts on the selected row) and "1/3" by the TIME TRAVEL title.
  Replaces the star.
- **Payoff:** fixing a CD pops `T.screens.bubbles.count` (8) ♪/♥ speech bubbles (off-white, thick ink
  outline) across the middle of the screen; each pops, floats up and fades in `sec` (1.2 s), with
  a stagger. Seeded positions, so screenshots are stable. Only a new fix pops them: travelling,
  restarting or the ending never do. `#bubbles` sits above the world and below the phone.
- **Checks:** `scripts/checks/phone.ts` (one box per CD, ticks only on fixed CDs, "1/3"),
  `scripts/checks/ui.ts` `checkBubbles` (count after a fix, clear of the dialogue, gone after the
  burst, none on travel; screenshot `bubbles`).

## Task M-A2: hand-made UI

- **Look:** the era badge, prompt, dialogue, card, paper and the ending's captions are off-white paper
  (`T.screens.paper`) with a thick ink outline (`outlinePx`), a hard offset shadow, chunky type
  (`chunkyFont`) and a slight tilt (era -2°, prompt 1°, dialogue -0.6°, card 1.5°, paper -1.2°,
  gold frames ±2°). 2004's era badge is older, yellower paper; the prompt is a yellow sticky note.
  The tabloid red tops stay.
- **Dialogue width:** at most `dialogueMaxPx` (720 px), so even a three-line line stays clear of the
  open phone in the bottom-right.
- **Cleanup:** dropped CSS variables nothing read (`--panel`, `--accent`, `--text-dim`, `--paper`,
  `--ink`, the era badge colours, `--tabloid-paper`) and `T.screens.tabloidPaper`.

## Task M-A1: title like Messenger's

- **Live street:** the title no longer covers the world: the 3D street (today, boarded up) shows
  through a shade (`T.screens.titleShade`, darker at the edges).
- **Logo:** a chunky "FLIP PHONE" in CSS for now (off-white and yellow, thick ink outline, hard
  shadow) that sways slowly and leans up to `logoTiltDeg` (10°) towards the mouse. The AI logo is
  in Art requests.
- **One button:** a big yellow PRESS START. A click starts the game the way Enter does (it sends an
  Enter press; the input layer keeps presses until the next step) and does not also count as a
  click in the world. Enter and Space still work. The boot screen (A4) stays as the shop's panel,
  without its own "Press Enter" line.
- **Checks:** `scripts/checks/ui.ts` checks the button (text, contrast) and the tilt (mouse
  top-left vs bottom-right), and starts the game by clicking it.

## The songs (lead's request, 16:30)

- **Mapping (song themes → moments, each in its song's year):** Mira covers "Lose Yourself" at a
  battle night (13 December 2002: one shot, frozen at the mic); The Static cover "Sweet Child O'
  Mine" at their street gig (6 August 1988: the amp dies mid-riff); DJ K-Bit's "Despacito" remix
  at the bus stop (14 July 2017: AirDrop it, the queue reaches for Shazam). The performers stay our
  own characters; the original artists are only named.
- **The real recordings are never committed:** the `feat/songs` branch plays your own copies from
  `src/audio/local-songs/<cd>.mp3` (git-ignored) when present; otherwise the Creative Commons
  stand-ins in `public/music/`. GitHub and the Netlify site never get the copyrighted audio.
- Moment ids (`open_mic`, `street_gig`, `ringtone`) and every prop/action id are unchanged. Dates in
  checks now come from the story files (`scripts/checks/phone.ts`); `shortDate` moved to
  `src/ui/dates.ts` so Node checks can import it without CSS.

## The shop TV (lead's request, 2026-11-21)

- The real songs now play from their **official YouTube videos** on a small "shop TV" (`src/ui/tv.ts`,
  `T.tv`): Lose Yourself (EminemMusic), Sweet Child O' Mine (GunsNRosesVEVO), Despacito (LuisFonsiVEVO).
  The TV follows the music rules (`audio.nowPlaying()`): volume by mode, the broken amp cuts in and out.
- YouTube's embed rules: the player is never hidden or covered (200 x 200, z-index above everything,
  no tilt), so the TV shows only while a song plays and pauses otherwise. Not shown on narrow screens.
- No network until a song is wanted; off in test builds (smoke blocks outside network). If YouTube
  fails or times out (`T.tv.apiTimeoutSec`), or a video won't embed, that CD plays its CC stand-in
  (`audio.external()` in Teammate B's audio silences the built-in song only while the TV covers it).
- Each video starts at its first chorus (Lose Yourself 1:38, Sweet Child O' Mine 0:59, Despacito 1:21),
  found from the videos' own lyric captions and LRCLIB timings; checked in a real browser. At the end it
  goes back to the chorus. The TV is the bare 200 x 200 player (YouTube's minimum), no caption.
- Background under the songs: the era bed and soundscape duck to `T.audio.ambience.underMusic` (0.3)
  whenever a song is wanted; crackle/hiss/hum, footsteps and dialogue blips are quieter; TV volume
  85 in the past, 40 for K-Bit's leak (lead: "a lot of noise working against the music").
