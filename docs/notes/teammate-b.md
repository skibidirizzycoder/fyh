# Teammate B: sound + DJ K-Bit — FINISHED

**Status (2026-11-21): done. `feat/sound-kbit` is ready to merge.** `npm run gate` passes on the branch
(124 unit tests, smoke `"ok":true`). Every task in `docs/prompts/04-teammate-b-sound-and-dj-kbit.md` is done.

## What I built

**Sound** (`src/audio/`, the `audio` section of `src/tuning.ts`): everything is generated with Web Audio, no sound files.
- A cue for every event: keypad `beep`, select `blip`, `flip-open` / `flip-close` clacks, travel `whoosh`,
  action `chime`, locked `nope`, reputation `fanfare` (waits 0.7 s so it doesn't land on the whoosh).
- An **original** 2-bar polyphonic `ringtone` (A minor, Am-F-C-G, up to 4 notes at once, about 3.4 s).
  It plays when `kbit_ring_bus_stop` is done (`T.audio.ringtoneActions`).
- Era background: 2004 = low hum + warm noise + vinyl crackle; today = quieter, clean air.
  It crossfades on `travel`. Measured: 2004 bed RMS 0.025 vs today 0.005.
- The AudioContext starts on `game-start`; `mute` (M) mutes; `lastCue()` works even when muted.
  Web Audio failures go quiet (`failed()`), never a console error.

**DJ K-Bit** (`src/story/cds/kbit.json`, `src/world/props/kbit.ts`, the `kbit` section of `tuning.ts`):
- Moment `ringtone`, "5 December 2004": a bus stop shelter on the left pavement, a queue of four people,
  the bus stop sign (`kbit_bus_stop`) and K-Bit in neon headphones holding his phone (`kbit_phone`).
  Everything is inside z = -4..1 (unit-tested), so the pitch is short.
- Step 1: beam the track by infrared. Step 2 (needs step 1): let it ring at the bus stop. The queue
  gets their flip phones out and the ringtone plays. Dialogue, the `today` line and the offline newspaper are written.

**Checks**: `scripts/checks/audio.ts` (whoosh, nope, chime, flip-open, beep, flip-close, M mute/unmute),
`scripts/checks/kbit.ts` (locked first, walkTo both steps, ringtone, queue phones, CD fixed, `gold_kbit` today),
`tests/audio.test.ts`, `tests/kbit.test.ts`.

## Smoke line (last run)

```
{"ok":true,"headings":4,"pitchSec":27,"drawCalls":19,"frames":2196,"team":{"phone":{"items":4},"static":{},"audio":{"cues":6,"muteToggles":2},"kbit":{"walkFrames":110}},...}
```
Screenshots I looked at: `kbit-arrive.png`, `kbit-ringing.png`, `present.png` (two gold discs).

## For Claude (merging)

- `STATUS.md` still says sound is "currently silent". Please update it when you merge.
- The prompt's update note mentions "polish ideas below", but there is no such section. Possible polish for K-Bit's
  moment, if there is time: a timetable panel and "BUS" band on the stop, a bigger phone for K-Bit,
  and a separate infrared "beam" sound for step 1.
