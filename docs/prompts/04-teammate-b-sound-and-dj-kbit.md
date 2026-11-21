# Prompt for Teammate B: sound + DJ K-Bit

**How to use:** first do "Before you start" yourself. Then paste everything under
"The prompt" into your AI agent (JetBrains Air or any other).

> **Update (foundation merged):** your first two commits (all sound + the K-Bit moment) are merged
> into `main` with the foundation, and everything passes. Run `git pull origin main` on your branch
> before your next commit. One change in your files: in `tests/kbit.test.ts`, "the 2004 street" is
> now `PROPS` **without** a `moments` field, because `PROPS` now also contains every moment's props.
> Still to do: `scripts/checks/audio.ts` + `kbit.ts` (they exist with TODOs), a `"today"` line in
> `kbit.json`'s `cd`, and the polish ideas below.

## Before you start (you, not the agent)

1. Clone and set up (about 10 minutes):
   ```sh
   git clone https://github.com/skibidirizzycoder/fyh.git && cd fyh
   npm install
   npx playwright install chromium
   npm run gate        # must end with a JSON line containing "ok":true
   ```
2. Read `docs/PLAN.md` (5 minutes). Your part is "Teammate B".
3. Check that `git log --oneline -5` shows **"Foundation: CD moments"**. If not, `git pull` and wait.
4. Make your branch: `git switch -c feat/sound-kbit`
5. Try the game: `npm run dev`, open the link, press Enter, then Q, Down twice, E. You are in
   "5 December 2004". The magenta blocks are YOUR placeholder props. The game is silent: that's YOUR part.

---

## The prompt

You are working on "Flip Phone", a small Three.js + TypeScript game for a hackathon (Track 2:
Retro Remix). Read `AGENTS.md` and follow it exactly, then read `docs/PLAN.md`. I am
**Teammate B**. Only edit the files PLAN.md lists for Teammate B. If you need a change anywhere
else, stop and tell me what and why instead of editing it.

Work in small steps. After each step: `npm run check`, then `npm run smoke`, look at the
screenshots in `artifacts/`, then commit with a clear message. Never start the next step on untested work.

### What already exists (do not rebuild it)

- `src/core/events.ts` (Claude's): the game announces `game-start`, `travel`, `action-done`,
  `action-locked`, `phone-open`, `phone-close`, `phone-move`, `phone-select`, `reputation` and
  `mute` (the M key). Read the file for what each one carries.
- `src/audio/` (yours): your sound, already merged. `main.ts` calls `createAudio(events, { target: window })`,
  and the debug API reads `lastCue()` and `isMuted()`, so keep those two.
  Cue names the checks use: `whoosh` (travel), `chime` (action done), `ringtone` (the actions in
  `T.audio.ringtoneActions`), `nope` (locked), `flip-open`, `flip-close`, `beep` (menu move), `blip` (select), `fanfare` (reputation).
- `src/story/cds/kbit.json` + `src/world/props/kbit.ts` (yours): PLACEHOLDER story and magenta props.
- `scripts/checks/audio.ts` + `kbit.ts` (yours): basic checks that already pass, with TODOs.
  Use the helpers in `scripts/checks/tools.ts` (`restart`, `tap`, `travel`, `walkTo`, `interact`,
  `state`, `screenshot`, `expect`).
- `src/tuning.ts` has your sections: `audio` (with `masterVolume`) and `kbit`. Put every number there.

### Task 1: all sound, made in code (`src/audio/`)

No sound files: generate everything with the Web Audio API (oscillators, gain envelopes,
filtered noise). That avoids licensing problems. Never copy a real phone brand's ringtone;
write an **original** melody.
- Play a real sound for every cue above. Make the **polyphonic ringtone** the star: 3-4 notes at
  once, very 2004, about 3 seconds.
- Era background sound: 2004 = soft lo-fi hum with a little crackle; today = quieter and cleaner.
  Switch it on `travel` (the event says the era). This makes the eras differ in a third way.
- Browsers only allow sound after a key press: create or resume the `AudioContext` on the
  `game-start` event (Enter on the title), never at page load.
- M mutes and unmutes everything. (The game also emits `mute` and `game-start` events, if you'd
  rather listen to those than to the keyboard; then `__game.press('KeyM')` works in tests too.)
- Keep `lastCue()` working, even when muted. Headless Chrome in the smoke test plays no real
  sound; we test which cue was triggered. A console **error** fails the smoke test, so catch audio failures.

Extend `scripts/checks/audio.ts`: after `travel`, `lastCue` is `whoosh`; a locked action gives
`nope`; a done action gives `chime`; opening the phone gives `flip-open`; M mutes and unmutes.

### Task 2: DJ K-Bit (`src/story/cds/kbit.json`, `src/world/props/kbit.ts`)

Moment `ringtone`, "5 December 2004". DJ K-Bit's electronic track is "too weird for 2004". It's
the ringtone craze: everyone at the bus stop has a flip phone. **This CD is first in the pitch
demo**, so make it the best-looking moment.
- **Props** (all `eras: PAST, moments: M`, like the placeholders): a bus stop shelter (interactable
  `kbit_bus_stop`), a queue of people (simple cylinders or boxes), and DJ K-Bit with headphones
  holding a phone (interactable `kbit_phone`). Use `standOn()` / `mountOn()` from `props/helpers.ts`
  so touching surfaces keep a gap: `npm run check` fails on z-fighting. The player starts at
  x=0, z=3 facing the shop (−z); keep everything between z=−4 and z=1 so the pitch stays short.
- **Story:** replace every PLACEHOLDER text: `situation`, `today`, both actions' `line` and
  `lockedLine` (short and funny: "Is that... a ringtone? Where can I GET that?"), and the `offline`
  newspaper text. 1) beam the track from K-Bit's phone to yours by infrared; 2) let it ring at the
  busy bus stop (requires step 1). Step 2 plays the ringtone.
- Extend `scripts/checks/kbit.ts`: `travel(page, 'ringtone')`; `interact(page, 'kbit_bus_stop')`
  must be `{ ok: false, reason: 'locked' }`; `walkTo` both objects in order (`r.ok` must be true);
  `lastCue` is `ringtone`; `travel(page, 'present')`; `visibleMeshes` includes `gold_kbit`.
- The smoke JSON line has `pitchSec`: the demo played by hand. It must stay under 45.

### When you're done

`npm run gate` passes on your branch. Then `git push -u origin HEAD` and tell the team
"feat/sound-kbit is ready". Write a short report: what you built, the smoke JSON line, and
which screenshots you looked at.
