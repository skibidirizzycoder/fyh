# Prompt for Teammate B, task 2: the CD music (real songs, 2004 → today remix)

**How to use:** do "Before you start" yourself, then paste "The prompt" into your agent.

## Before you start (you, not the agent)

1. `git switch feat/sound-kbit && git pull origin main` (your sound + K-Bit and Zac's phone are merged).
2. **Pick the songs by ear, with the team.** Open `docs/music-shortlist.md`, listen for 30 seconds
   to each candidate on its track page, and choose one per CD (the lead has the final say).
3. Download the 3 files through their track pages (see the shortlist for how). Cut the best
   **30–45 seconds** of each (Audacity is free), export MP3 at 128 kbps (**≤ 1 MB each**) and save as
   `public/music/mira.mp3`, `public/music/static.mp3` and `public/music/kbit.mp3`.

---

## The prompt

You are working on "Flip Phone" (read `AGENTS.md`, `docs/PLAN.md`, `docs/music-shortlist.md`).
I am **Teammate B**, the sound owner. My sound effects and DJ K-Bit are done and merged. New task:
**each CD gets its real song**, and the game makes the theme audible: in 2004 you hear the raw,
broken or ignored version; once the CD is fixed, today plays it back as a **modern remix**.

**My files for this task:** `src/audio/**` (add e.g. `src/audio/music.ts`), `public/music/**`
(the 3 MP3s + `CREDITS.md`), the `audio` section of `src/tuning.ts`, `scripts/checks/music.ts`
(a stub exists and already runs in smoke) and `tests/music*.test.ts`. Don't edit other files. If
you need a change elsewhere, write it in `docs/notes/teammate-b.md` under "Requests for Claude".

### What to build

- **Credits first:** `public/music/CREDITS.md` gets the exact credit line for each chosen song
  (from the shortlist), ending "Trimmed and filtered for this game." The README already links to it.
- **Config** in `T.audio.music`: per CD id (`mira`, `static`, `kbit`): `file` (`'music/mira.mp3'`, a
  relative path), `gain`, `bpm`, and any filter numbers. No numbers in code.
- **Loading:** fetch and `decodeAudioData` after `game-start`. If anything fails (missing file,
  decode error), stay silent and never log a console error: the smoke test fails on errors.
- **In 2004**, in a CD's moment (the `travel` event has `moment`; listen to `action-done`):
  - *Mira (`open_mic`)*: silent until `mira_play_cd` is done. Then her song plays from the
    listening post, "2004 style": low-pass filtered (~2.5 kHz), mono, a little crackle.
  - *The Static (`street_gig`)*: their song plays but **cuts out** every second or two (the dying
    amp) until `static_plug_amp`. Then it plays steadily; after `static_give_mic` the filter opens
    up and it gets louder. Zac is building these two actions; keep those ids.
  - *DJ K-Bit (`ringtone`)*: keep your code ringtone as his 2004 sound. Optional: faint, tinny
    leakage of his track from his headphones before you beam it.
- **Today**: the shop plays only the **fixed** CDs' songs, as the modern remix: clean (no filter),
  full volume range, plus a simple code-made beat on top (kick + hi-hat at the song's `bpm`).
  The most recently fixed CD plays first; crossfade between them. 0 fixed = silence, and the music
  gets louder and fuller as reputation rises (the `reputation` event, level 1–3).
- **Mixing for the pitch:** the music sits under the dialogue. Duck it under the whoosh, chime and
  ringtone, so the presenter can talk over it. M mutes it too.
- **For tests:** add `nowPlaying(): string` to what `createAudio` returns. The debug API shows it
  as `state().audio.music`. Use values like `"mira:2004"`, `"static:2004-broken"`, `"static:2004"`,
  `"mira:today"` and `""` for none. It must work in headless Chrome, where nothing is audible.
- **Checks** (`scripts/checks/music.ts`, helpers in `scripts/checks/tools.ts`): `restart`; travel to
  `street_gig` → `static:2004-broken`; interact `static_cable_reel` → `static:2004`; fix Mira
  (`travel` + `interact`), travel to `present` → `mira:today`. Unit-test the pure parts (which song
  plays when) in `tests/music.test.ts`.
- Until Zac merges The Static, `static_cable_reel` is a magenta placeholder that already works.

### When you're done

`npm run gate` passes, and `pitchSec` in the smoke line stays under 45. Push and tell the team
"feat/sound-kbit is ready" with the smoke JSON line, which songs you picked, and which
screenshots you looked at. Update `docs/notes/teammate-b.md`.
