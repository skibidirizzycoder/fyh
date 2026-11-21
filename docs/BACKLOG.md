# BACKLOG: what to build next (never wait)

## How it works

1. **Finished a task? Ship it yourself:** `npm run ship` (on your branch, with everything committed).
   It merges `main` into your branch, refuses files outside your lane (`scripts/lanes.ts`), runs the
   full gate and then fast-forwards `main`. **No permission needed: the gate is the permission.**
   If it stops, it tells you exactly why and `main` is untouched.
2. **Then take your next task below, straight away.** Don't wait for a reply or a merge.
3. **Want to play everyone's work together?** `npm run checkpoint:play` builds the newest *tested*
   checkpoint in a separate folder and serves it at http://localhost:4300. Your branch isn't touched.
   Every successful ship tags a checkpoint by itself.
4. **Queue empty?** Take a Free task (put your name next to it in `STATUS.md` first) and tell the lead.
   Your agent can run the whole queue by itself: `docs/prompts/08-autonomous-lane.md`.
   **Run two sessions at once (recommended).** Your next two tasks touch different files, so a
   second agent builds one while the first builds the other. Give it its own folder and branch:
   ```sh
   git fetch origin
   git worktree add ../fyh-2 -b feat/<your-lane>-2 origin/main   # e.g. feat/phone-static-2
   cd ../fyh-2 && npm ci
   ```
   Then paste prompt 08 there with `Only task: A4` (or `B4`) at the end. Smoke picks free ports, so
   both sessions can run the gate at the same time, and `ship` accepts the branch.
5. **Keep these ids.** Other people's tests and the smoke run use them: `mira_take_cd`,
   `mira_play_cd`, `mira_cd`, `listening_post`, `static_plug_amp`, `static_give_mic`,
   `static_cable_reel`, `static_mic`, `kbit_*` actions, `rep_open`, `rep_busy`, `rep_landmark`,
   `boarded_window`, `lit_window`, `open_sign`, `rep_posters`, `rep_plaque`, `gold_mira`,
   `gold_static`, `gold_kbit`, and the HUD element ids (`#title`, `#era`, `#prompt`, `#dialogue`,
   `#card`, `#news`, `#news-offline`, `#ending`, `#phone`).
6. No pitch work yet. We build first.
7. **Reference: `docs/reference-messenger.md`** (Messenger by Abeto). Play it for 10 minutes first,
   then do your "M" tasks below. We learn its principles; we never copy its art.
8. **AI images: only Claude makes them** (GPT Image via Codex). Need one? Add it to your notes under
   "Art requests" (name, shape, one sentence). It appears in `public/textures/`. Ready now:
   `cover_mira`, `cover_static`, `cover_kbit`, `window_2004`, `window_today`, `poster_open_mic`,
   `poster_gig`, `brick_2004`, `pavement` (`.png`, 512 px).

## Round 3 (from 16:00): the CD player is the time machine, a bigger map, smoother play

**From 17:00 (the lead): features and improvements first, bugs later.** Build new things (A7-A9,
B11-B13 and anything that makes the game look or feel better). Write any bug you notice in STATUS
under "Bugs" and keep going; we fix them all together at the end. Skip B9 and the playtest until then.

**The lead's design:** you travel in time by **putting a CD into a CD player** (outside the shop
today). When you've fixed a CD, the **flip phone** shows it (★) and takes you home or back to a moment
you've already fixed. The phone is your progress list and your way home; the CD player is the way in.
The map grows like Messenger's: the shop, **the square** (The Static) and **the bus stop** (K-Bit)
are separate areas you walk between. New events from Claude's side (use them as soon as they're on
`main`; until then build against the event names): `cd-insert {cd}`, `title`, `area {id, title}`.
Rows the phone can't go to yet come with `locked: true` on the phone item.

## Teammate A: `feat/phone-static`

**Next, in this order:**
- [ ] **A7. The phone as progress + way home:** locked rows ("Put the CD in the player") greyed out and
  skipped, ★ on fixed ones, "Back to today" first when you're in the past. Checks in `phone.ts`.
- [ ] **A8. Travel transition:** on `cd-insert`, a ~1 s full-screen effect over the canvas: the view
  spins/blurs like a disc, then flashes into the date ("14 March 2004"). HTML/CSS in `src/ui/`.
- [ ] **A9. Area titles like Messenger:** on `area`, the title pops in letter by letter over 1.5 s,
  holds 4 s, shrinks out in 0.35 s (`docs/reference-messenger.md`). Not over the dialogue.
- [ ] Then A6, M-A3, M-A2 below, and bug 4 (STATUS) last.

Two sessions: A4 in one, A5 in the other.

- [x] A1. The flip phone's look
- [x] A2. The Static's street gig
- [x] **A3. Mira's open mic (14 March 2004).** You now own `src/story/cds/mira.json`,
  `src/world/props/mira.ts` and `scripts/checks/mira.ts`. Make it an open mic night outside the
  shop: a mic and small amp by the window, string lights, a few bored listeners who turn round (or
  appear) after step 2, and Mira with a guitar. Rewrite the text in your voice (`situation`, lines,
  `today`, offline paper). Checks: arrive, step 2 locked first, `walkTo` both, the listeners
  change, `gold_mira` today, screenshot `mira-fixed`.
- [ ] **A4. The screens.** You now own `src/ui/**` and `index.html` (its styles):
  - the title as a 2004 phone boot screen ("Hollow Records", three dusty CDs, press Enter);
  - the "Because you..." card and the newspaper as a 2000s tabloid front page;
  - the ending as a wall of gold discs.
  Keep the element ids above and contrast ≥ 4.5. Make two title variants side by side in one
  screenshot and let the team pick. Checks in `scripts/checks/ui.ts`: contrast of each screen and
  screenshots of the title and the ending.

- [ ] **A5. The phone feels alive.** In your phone files: while travelling, the LCD shows
  "Connecting..." with the signal bars filling, then a burst of static before you arrive; the
  closed phone shows a small outer screen with the date and time where you are; the selected row
  blinks like a 2004 menu. Checks in `scripts/checks/phone.ts` (read `data-state`, screenshot it).
- [ ] **A6. The Static after the fix:** the crowd you show with `static_give_mic` gets bigger and
  closer (more people, some with their arms up), plus a dropped set list and a tip jar. Your props only.
- [ ] **M-A1. Title like Messenger's:** the live 3D street behind a chunky "FLIP PHONE" logo that tilts
  a little with the mouse, and one big "PRESS START" button (ask Claude for the logo art). Fold into A4.
- [ ] **M-A2. Hand-made UI:** card, newspaper, dialogue box and ending on off-white paper with thick
  dark outlines, slightly rotated, chunky type. Our own colours. Fold into A4.
- [ ] **M-A3. Checklist + payoff:** the phone shows the three CDs with ticks (what's left), and when a
  CD is fixed, ♪/♥ bubbles pop over that moment's crowd/queue for a second (HTML over the canvas is fine).

## Teammate B: `feat/sound-kbit`

**Next, in this order:**
- [ ] **B7. The CD player's sounds** on `cd-insert`: tray opens, disc clicks in, spin-up whir, then
  the time whoosh. This is the "Old Tech" moment, so make it satisfying.
- [ ] **B8. The "remaster" sting** when you come back to today after a fix: a tape rewind, then the
  remix comes in crisp.
- [ ] **B9. Bug 5:** music stops on the title (use the `title` event).
- [ ] **B10. The music choice is yours now:** `docs/music-shortlist.md` and `public/music/**`. Listen,
  swap any song by ear, and keep `public/music/CREDITS.md` exact.
- [ ] **B11. Ambience per area** of the bigger map (on `area`), crossfaded like Messenger's.
- [ ] **B12.** When props get the `texture` field (Claude's W2): the AI CD covers on today's gold
  discs and the posters in today's window (`today.ts`, images in `public/textures/`).
- [ ] **B13. The ending:** the wall of gold discs plays a short medley of the three remixes.
- [ ] Then F2 again: playtest the newest checkpoint and log bugs in STATUS.

Two sessions: B3/B5/B6 in one (they all touch `src/audio/`), B4 in the other.

- [x] B1. All sound effects, made in code
- [x] B2. DJ K-Bit's bus stop
- [x] **B3. The CD music**: code merged; **the MP3s are still missing, so it's silent. Don't wait for a song
  pick:** if the team hasn't chosen, use the ★ picks in `docs/music-shortlist.md` (anyone can swap a
  file later). ccMixter files download with the track page as the `Referer` (e.g. `curl -e <page> -o …`).
  No trimming tool? Commit the full MP3 and play a 30–45 s section (`start` and `length` in `T.audio.music`).
- [x] **B4. Today's shop at each reputation level.** You now own `src/world/props/today.ts`, the
  `"reputation"` entries in `src/story/content.json` (only those) and `scripts/checks/today.ts`.
  - Level 0: boarded up and dark.
  - Level 1: open, with a lit window, the open sign, one customer and music from inside.
  - Level 2: busy, with posters of the fixed CDs' artists in the window and a queue of 3–4 people.
  - Level 3: a landmark, with the blue plaque, a crowd and a neon "HOLLOW RECORDS" sign.
  - Gold discs framed by the door, one per fixed CD.
  Add new props freely, but keep the ids above. Checks: today at levels 0–3 (fix CDs quickly with
  `travel` + `interact`), screenshots `today-0` to `today-3`.
- [x] **B5. K-Bit polish** (from your notes): a timetable panel and a "BUS" band on the stop, a
  bigger phone for K-Bit, and an infrared "beam" sound for step 1.

- [x] **B6. Each moment sounds like its time and place**: open mic = evening pub murmur and
  clinking glasses; street gig = busy summer street and a distant ice-cream van; ringtone = December
  wind, traffic and a bus pulling in; today = quieter, modern traffic. In `src/audio/`, driven by the
  `travel` event (it has `moment`). Checks in `scripts/checks/audio.ts`.
- [ ] **M-B1. Every action makes a sound** (see the sound list in `docs/reference-messenger.md`):
  footsteps while walking (2–4 variants, a little random pitch), phone key clicks, a "paper" sound
  when the card and the newspaper open, a soft whoosh when the camera moves in for dialogue.
- [ ] **M-B2. Voice blips:** while a dialogue line shows, short blips like a voice (Animal Crossing
  style), a different pitch per speaker (Mira, the band, K-Bit, the owner). Listen to the `dialogue`
  events; ask Claude if you need the speaker in the event.

## Free (anyone: claim it in STATUS.md first)

- [ ] F1. **Street life:** decoration that makes your own moment feel alive (pigeons, bins, a bike,
  a dog), in your CD's props file. Decoration never glows or gets a marker.
- [ ] F2. **Playtest a checkpoint** (`npm run checkpoint:play`) from start to end. Write each bug
  in `STATUS.md` under "Bugs", with the steps to reproduce it.

## Claude (director)

- [x] Foundation, merges, used objects stop glowing, `ship` + checkpoints
- [x] C1. Each moment gets its own look (evening / summer afternoon / December dusk), measured in smoke
- [x] C2. The player can't walk through props (collisions). *Helper agent, branch `director/collisions`.*
- [ ] C5. The shared street and the player look like a real place and a real person (shop front,
  neighbouring buildings, kerb; a low-poly person instead of the cylinder). *Helper agent, `director/street`.*
- [ ] C6. Props can show AI textures (`texture` field: covers, posters, shop windows, brick, pavement). *With W2.*
- [ ] C7. The CD player is the time machine; the phone shows progress and goes home; smoother movement;
  events `cd-insert` and `title`; bugs 1–3 from the playtest. *Helper agent, `director/cdplayer`.*
- [ ] C8. A bigger map with areas (shop, the square, the bus stop), the `area` event, a smoother
  camera. *The street agent, after C5.*
- [x] W-retro: 2004 drawn like a 2004 game, a bit more pixelated (look branch). W1 outlines and W2 cel
  shading: helper agents, merging as they pass.
- [ ] M-C1. Toon look: 2–3 tone shading + dark ink outlines, a calm palette per era/moment, floating
  particles (dust in 2004, snow in December). Decide together with the retro-render test (`director/retro`).
- [ ] M-C2. The camera eases closer when someone talks, then back; a short push-in when a CD is fixed.
- ~~C3. The rest of `docs/prompts/05-agentic-workflow.md`~~ **Cut:** `ship` already enforces
  ownership and the gate. We build the game instead.
- [x] C4. `npm run checkpoint` deploys to https://flip-phone-2004-8a09.netlify.app (ships don't: free-plan credits).
