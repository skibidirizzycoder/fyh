# Teammate B: sound, music, DJ K-Bit, today's shop

**Status (2026-11-21, 17:05): B7, B9 done; the demo's K-Bit moment reworked for 2017 (below).**

**Earlier status (15:20):** B1–B6, F1 shipped; M-B1/M-B2 sounds built and shipped, waiting on four events
from Claude to be heard (below).** Last gate: 195 unit tests, smoke `"ok":true`, `pitchSec` 26.8.

## Done

- **B1 Sound effects** (`src/audio/`): every cue made in code with Web Audio: `beep`, `blip`, `flip-open`,
  `flip-close`, `whoosh`, `chime`, `nope`, `fanfare` (waits 0.7 s for the whoosh), `beam` (K-Bit's infrared
  handshake) and an **original** 4-voice polyphonic `ringtone`. Era background: 2004 hum + crackle, today
  quieter and clean. Starts on `game-start`, M mutes, failures go quiet (no console errors).
- **B2 DJ K-Bit** (`ringtone`, 5 December 2004): bus stop shelter, a queue whose flip phones come out when
  yours rings, K-Bit in neon headphones. Beam the track (`kbit_phone`), then let it ring (`kbit_bus_stop`).
- **B3 CD music**: real songs, 2004 raw → today remix. The ★ picks from `docs/music-shortlist.md` (the backlog
  said not to wait for a vote): Mira = "Deflated & Alone (acoustic)", The Static = "Teenager" by The Crypts!,
  K-Bit = "Enthusiast" by Tours. Credits in `public/music/CREDITS.md`; licences re-checked on each track page.
  Clips cut at MP3 frame boundaries (no re-encoding): 40 / 40 / 24 s, 800 / 995 / 960 KB, the loudest
  stretch, starting on a detected beat. 2004 = low-passed and mono; The Static cut out until the amp is
  plugged in and open up with the mic; Mira silent until her CD is played; K-Bit leaks from his headphones
  until the beam. Today = fixed CDs only, most recent first, rotating every 30 s, clean stereo, louder with
  reputation, ducked under whoosh/chime/ringtone/beam. Verified in the test build: nothing loads before
  Enter, then all three load (200 audio/mpeg) and decode with no console errors.
- **B4 Today's shop**: level 0 boards on the window and door, three empty frames by the door; 1 lit window,
  open sign, a customer; 2 posters in the window and a queue of four; 3 blue plaque, neon HOLLOW RECORDS,
  a crowd. Each gold disc sits in its frame. Draw calls today by level: 19 / 21 / 29 / 37 (max 60).
- **B5 K-Bit polish**: "BUS" band and timetable on the stop, bigger phone for K-Bit, `beam` sound.
- **B6 Soundscapes**: open mic = pub murmur + clinking glasses; street gig = summer traffic, chatter and a
  distant ice-cream van (original jingle); ringtone = December wind, traffic and a bus pulling in (air-brake
  hiss) when you arrive; today = quieter modern traffic. Measured mix RMS: today 0.010, plain 2004 0.025,
  open mic 0.034, street gig 0.040, ringtone 0.046 (0.054 with the bus).

- **F1 street life** at the bus stop: a bin, a newspaper box, pigeons (two on the roof), a dog with the queue.
  Draw calls on arrival: 42 (max 60). The walk to K-Bit is unchanged.
- **F2 playtest** of `checkpoint-11` (real key presses in headless Chrome, whole game in a new order, ending,
  play again, phone-size screen): 5 bugs written in `STATUS.md` under "Bugs". Sound not checked (can't hear).
- **M-B1 every action makes a sound** (`src/audio/feel.ts`, `feel-player.ts`): footsteps (4 variants, ±12 %
  pitch, one every 0.32 s while walking), a plastic key click under every phone beep/blip (**live now**), a paper
  rustle when the card or newspaper opens, a soft rising/falling whoosh when the camera moves in/out.
- **M-B2 voice blips**: one blip per syllable while a line shows (max 24, ~2 s), same line = same tune; a pitch
  and wave per speaker: Mira (high, soft), the band (mid, buzzy), K-Bit (highest, buzzy), the owner (low, soft).
  The speaker comes from the event, or else from the moment (open mic = Mira, street gig = band, ringtone = K-Bit,
  today = owner). Measured peaks: footstep 0.07, voice 0.08, paper 0.11, zoom 0.05 (beep 0.13, whoosh 0.21).
  Feel sounds never become `lastCue`, so they can't hide the story sounds from the checks.

## Needs a human (by ear)

- **The remix beat is off** (`beat: 0` per CD in `T.audio.music.cds`). Tempo was measured, not heard, and the
  detector was unsure (Mira 68 vs 157 bpm scored the same; K-Bit 160–164 tied; The Static 104.5, with 197 close).
  Someone should play today with a fixed CD, set the right `bpm`, set `beat: 1`, and check it's in time.
- **Swap any song** you don't like: keep the file name, update `public/music/CREDITS.md` and the `bpm`.

## The demo's K-Bit moment, reworked (13 January 2017, on top of the lead's Despacito change)

Same two key presses, about 30 s, a clear before and after:
1. **Arrival:** the whole queue is heads-down, scrolling dark phones. K-Bit's remix has 0 plays and leaks
   from his headphones (`kbit:2004-leak`).
2. **"Accept K-Bit's AirDrop"** (`kbit_phone`): K-Bit speaks ("Finally, someone who looks up! Accept it.").
   An original swoosh + two-note "received" ping (cue `beam`, `T.kbit.beamSec` 0.83 s); the leak stops.
3. **"Join the queue"** (`kbit_bus_stop`): K-Bit rings you from the kerb. The ringtone spreads phone to phone
   (one beat apart). Every phone goes UP over their heads, Shazam-blue (`kbit_shazam_1..4` swap in for
   `kbit_queue_phone_1..4`), and then **the remix itself plays from the phones** (`kbit:2004-live`).
   **The bus pulls in** as the ringtones end (`T.kbit.busAtSec`), and nobody gets on.
4. **Today:** "It started with one bus queue reaching for Shazam..." plus the gold disc and the remix.

Checked: `scripts/checks/kbit.ts` asserts heads-down → phones up, leak → live; screenshots `kbit-arrive.png`,
`kbit-ringing.png`; draw calls 46 (max 60); the pitch is still 26.8 s. Tests: `tests/kbit-spread.test.ts`.

### For Teammate A (please pass on): two phone screens and the bubbles for this scene
Both can start from `action-done` with these actionIds; the timings are in `T.kbit`.
1. On `kbit_beam_track`: an AirDrop-style sheet on the LCD, "DJ K-Bit would like to share 'Despacito
   (K-Bit Remix)'" → accepted → "Ringtone set ✓", over `T.kbit.beamSec`.
2. On `kbit_ring_bus_stop`: "K-Bit calling..." with a shake (he rings you). For this CD, one ♪ bubble per
   queue person, left to right, bubble i at `(i + 1) * T.kbit.spread.gapSec`, then a ♥.

### For Claude
An optional per-prop show delay (e.g. `showDelaySec`), so the 4 raised phones go up one by one with their
ringtones. Until then they go up together.

## Requests for Claude

- **Please emit these four events** (add them to `GameEvents`; the shapes are in `src/audio/feel-player.ts`,
  `FeelEvents`, and audio already listens for them, so nothing else is needed):
  - `footstep: {}` each time the player has walked `T.audio.feel.step.strideM` (0.9 m), counted in fixed
    steps. (Changed from `walk: { moving }`: a timer in audio kept stepping while the game was paused.)
  - `dialogue: { line: string; speaker?: string }` from `say()` when a line appears. `speaker` is optional
    (`mira` / `band` / `kbit` / `owner`); without it, the moment decides.
  - `panel: { name: 'card' | 'news'; open: boolean }` when the card or the newspaper appears / goes (paper).
  - `camera-zoom: { zoomIn: boolean }` when the dialogue camera eases in / back out.
  Once they're in `GameEvents`, delete the `FeelEvents` cast in `audio.ts` and `subscribeFeel` types itself.
- **B9 is ready for the `title` event** (announced in BACKLOG round 3): audio fades the last game's music out
  on it (`src/audio/upcoming.ts`, test in `tests/audio-cdplayer.test.ts`). It works as soon as the game sends it.
- **`LESSONS.md` (not in my lane; `scripts/lanes.ts` doesn't let teammates add to it), please add:**
  - A voice played NaN notes for speaker "toString" — cause: `name in obj` also finds Object.prototype keys — rule: look up ids with `Object.hasOwn`.
  - Wind clicked every 8 s at the bus stop — cause: generated loops end where they don't begin — rule: crossfade a generated loop's tail into its start (`seamless()`), and test the seam.
  - Footsteps kept going while the game was paused — cause: a real-time `setInterval` in audio — rule: sounds that follow gameplay are driven by game events in fixed steps, never by audio timers.
- **`debug.ts`: please also show `audio.feel`** (`audio.feel()`, the last few feel sounds) so a smoke check
  can walk and see `step`, talk and see `voice:kbit`.

- **`debug.ts`: please show `audio.ambience`** in `state()`, read from `audio.soundscape()` (same duck-typed
  way as `nowPlaying()`). `scripts/checks/audio.ts` then asserts each moment's soundscape; until then it
  reports "not exposed by the debug API yet" instead of failing.
- `STATUS.md` still says sound is "currently silent". `docs/BACKLOG.md`: B3–B6 can be ticked.

## Checks

`scripts/checks/audio.ts`, `kbit.ts`, `music.ts`, `today.ts`; `tests/audio.test.ts`, `audio-feel.test.ts`, `audio-soundscape.test.ts`,
`kbit.test.ts`, `music.test.ts`, `today.test.ts`.

## Smoke line (last run)

```
{"ok":true,"pitchSec":26.7,"drawCalls":29,...,"team":{...,"audio":{"cues":7,"muteToggles":2,"soundscapes":"not exposed by the debug API yet"},"kbit":{"walkFrames":89},"music":{"music":"mira:today"},"today":{"drawCalls":[19,21,29,37]}},...}
```
Screenshots I looked at: `kbit-arrive.png`, `kbit-ringing.png`, `today-0.png` to `today-3.png`.
