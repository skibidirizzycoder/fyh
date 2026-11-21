# Teammate B: sound, music, DJ K-Bit, today's shop

**Status (2026-11-21, 14:50): B1–B6 are all done and shipped.** Last gate on `feat/sound-kbit`:
170 unit tests, smoke `"ok":true`, `pitchSec` 26.7. Two small things need a human or Claude (below).

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

## Needs a human (by ear)

- **The remix beat is off** (`beat: 0` per CD in `T.audio.music.cds`). Tempo was measured, not heard, and the
  detector was unsure (Mira 68 vs 157 bpm scored the same; K-Bit 160–164 tied; The Static 104.5, with 197 close).
  Someone should play today with a fixed CD, set the right `bpm`, set `beat: 1`, and check it's in time.
- **Swap any song** you don't like: keep the file name, update `public/music/CREDITS.md` and the `bpm`.

## Requests for Claude

- **`debug.ts`: please show `audio.ambience`** in `state()`, read from `audio.soundscape()` (same duck-typed
  way as `nowPlaying()`). `scripts/checks/audio.ts` then asserts each moment's soundscape; until then it
  reports "not exposed by the debug API yet" instead of failing.
- `STATUS.md` still says sound is "currently silent". `docs/BACKLOG.md`: B3–B6 can be ticked.

## Checks

`scripts/checks/audio.ts`, `kbit.ts`, `music.ts`, `today.ts`; `tests/audio.test.ts`, `audio-soundscape.test.ts`,
`kbit.test.ts`, `music.test.ts`, `today.test.ts`.

## Smoke line (last run)

```
{"ok":true,"pitchSec":26.7,"drawCalls":29,...,"team":{...,"audio":{"cues":7,"muteToggles":2,"soundscapes":"not exposed by the debug API yet"},"kbit":{"walkFrames":89},"music":{"music":"mira:today"},"today":{"drawCalls":[19,21,29,37]}},...}
```
Screenshots I looked at: `kbit-arrive.png`, `kbit-ringing.png`, `today-0.png` to `today-3.png`.
