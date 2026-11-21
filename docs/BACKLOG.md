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

## Teammate A: `feat/phone-static`

Two sessions: A3 in one, A4 in the other.

- [x] A1. The flip phone's look
- [x] A2. The Static's street gig
- [ ] **A3. Mira's open mic (14 March 2004).** You now own `src/story/cds/mira.json`,
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

## Teammate B: `feat/sound-kbit`

Two sessions: B3 in one, B4 in the other. B5 comes after B3 (both touch `src/audio/`).

- [x] B1. All sound effects, made in code
- [x] B2. DJ K-Bit's bus stop
- [ ] **B3. The CD music**: `docs/prompts/06-teammate-b-cd-music.md`. **Don't wait for a song
  pick:** if the team hasn't chosen, use the ★ picks in `docs/music-shortlist.md` (anyone can swap a
  file later). ccMixter files download with the track page as the `Referer` (e.g. `curl -e <page> -o …`).
  No trimming tool? Commit the full MP3 and play a 30–45 s section (`start` and `length` in `T.audio.music`).
- [ ] **B4. Today's shop at each reputation level.** You now own `src/world/props/today.ts`, the
  `"reputation"` entries in `src/story/content.json` (only those) and `scripts/checks/today.ts`.
  - Level 0: boarded up and dark.
  - Level 1: open, with a lit window, the open sign, one customer and music from inside.
  - Level 2: busy, with posters of the fixed CDs' artists in the window and a queue of 3–4 people.
  - Level 3: a landmark, with the blue plaque, a crowd and a neon "HOLLOW RECORDS" sign.
  - Gold discs framed by the door, one per fixed CD.
  Add new props freely, but keep the ids above. Checks: today at levels 0–3 (fix CDs quickly with
  `travel` + `interact`), screenshots `today-0` to `today-3`.
- [ ] **B5. K-Bit polish** (from your notes): a timetable panel and a "BUS" band on the stop, a
  bigger phone for K-Bit, and an infrared "beam" sound for step 1.

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
- ~~C3. The rest of `docs/prompts/05-agentic-workflow.md`~~ **Cut:** `ship` already enforces
  ownership and the gate. We build the game instead.
- [ ] C4. Deploy each checkpoint to Netlify, so the team plays it in a browser (needs `netlify login` from the lead).
