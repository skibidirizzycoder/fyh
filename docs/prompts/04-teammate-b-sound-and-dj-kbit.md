# Prompt for Teammate B: sound + DJ K-Bit

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
2. Read `docs/PLAN.md` (5 minutes). Your part is "Teammate B".
3. Wait for the commit **"Foundation: CD moments"** on `main` (check with `git pull` then `git log --oneline -5`).
   Meanwhile, hum a ringtone and think about what a 2004 bus stop looks like.
4. Make your branch: `git switch -c feat/sound-kbit`

---

## The prompt

You are working on "Flip Phone", a small Three.js + TypeScript game for a hackathon (Track 2:
Retro Remix). Read `AGENTS.md` and follow it exactly, then read `docs/PLAN.md`. I am
**Teammate B**. Only edit the files PLAN.md lists for Teammate B. If you need a change anywhere
else, stop and tell me what and why instead of editing it.

Work in small steps. After each step: `npm run check`, then `npm run smoke`, look at
`artifacts/*.png`, then commit with a clear message. Never start the next step on untested work.

### Task 1: all sound, made in code (`src/audio/`)

No sound files: generate everything with the Web Audio API (oscillators, gain envelopes,
filtered noise). That avoids licensing problems. Never copy a real phone brand's ringtone;
write an **original** melody. Every number (volumes, notes, lengths) goes in the `audio`
section of `src/tuning.ts`.
- `createAudio(events)` already exists as a silent stub in `src/audio/audio.ts`. Fill it in.
  It listens to events from `src/core/events.ts` and never edits `game.ts`.
- Sounds: keypad beep (`phone-move`), select blip (`phone-select`), flip open/close clack,
  a **polyphonic ringtone** (3-4 notes at once, very 2004), a time-travel "whoosh" (`travel`),
  a happy chime (`action-done`), a dull "nope" (`action-locked`), a little fanfare (`reputation`).
- Era background sound: 2004 = soft lo-fi hum with a little crackle; today = quieter and cleaner.
  It changes on `travel`. This makes the eras differ in a third way.
- Browsers only allow sound after a key press: start or resume the `AudioContext` on the first
  `start` (Enter) press.
- **M** mutes and unmutes.
- For tests, `lastCue()` must return the name of the last sound played (e.g. `"ringtone"`).
  `__game.state().audio.lastCue` shows it.
- Add checks to `scripts/checks/audio.ts`: travel to a moment and assert `lastCue` is `"whoosh"`,
  then do an action and assert it is `"chime"`. Headless Chrome plays no real audio; that's fine,
  we test which cue was triggered.

### Task 2: DJ K-Bit (`src/story/cds/kbit.json`, `src/world/props/kbit.ts`)

Moment `ringtone`, "5 December 2004". DJ K-Bit's electronic track is "too weird for 2004". It's
the ringtone craze: everyone at the bus stop has a flip phone.
- **Props** (2004, `moments: ['ringtone']`): a bus stop shelter, a queue of people (simple
  capsules or boxes), and DJ K-Bit with headphones (interactable: `kbit_phone`, K-Bit's phone);
  the bus stop is interactable as `kbit_bus_stop`. Keep a 0.02 gap between touching surfaces.
- **Actions:** 1) beam the track from K-Bit's phone to yours by infrared; 2) let it ring at the
  busy bus stop (requires step 1). When step 2 is done, the ringtone must play. Write short,
  funny dialogue ("Is that... a ringtone? Where can I GET that?").
- **Offline newspaper** text for when K-Bit is fixed.
- Add checks to `scripts/checks/kbit.ts`: travel to `ringtone`, check the bus stop is locked first,
  do both actions, assert `lastCue` is `"ringtone"`, travel to today and assert K-Bit's gold disc is visible.

### When you're done

`npm run gate` passes on your branch. Then `git push -u origin HEAD` and tell the team
"feat/sound-kbit is ready". Write a short report: what you built, the smoke JSON line, and
which screenshots you looked at.
