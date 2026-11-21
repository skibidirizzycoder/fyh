# Teammate B: sound, music, DJ K-Bit, today's shop

**Status (2026-11-21, 14:30):** B1, B2, B4 and B5 are done and shipped. B3 (CD music) is finished in
code and shipped, but it is **silent until the songs are picked** (see "Waiting on a human" below).
Last gate on `feat/sound-kbit`: 158 unit tests, smoke `"ok":true`.

## Done

- **B1 Sound effects** (`src/audio/`): every cue made in code with Web Audio: `beep`, `blip`, `flip-open`,
  `flip-close`, `whoosh`, `chime`, `nope`, `fanfare` (waits 0.7 s for the whoosh), `beam` (K-Bit's infrared
  handshake) and an **original** 4-voice polyphonic `ringtone`. Era background: 2004 hum + crackle, today
  quieter and clean. Starts on `game-start`, M mutes, failures go quiet (no console errors).
- **B2 DJ K-Bit** (`ringtone`, 5 December 2004): bus stop shelter, a queue whose flip phones come out when
  yours rings, K-Bit in neon headphones. Beam the track (`kbit_phone`), then let it ring (`kbit_bus_stop`).
- **B5 K-Bit polish**: "BUS" band and timetable on the stop, bigger phone for K-Bit, `beam` sound.
- **B4 Today's shop** (`props/today.ts`, the `reputation` entries of `content.json`): level 0 boards on the
  window and door with three empty frames by the door; 1 lit window, open sign, a customer; 2 posters in the
  window and a queue of four; 3 blue plaque, neon HOLLOW RECORDS, a crowd. Each gold disc sits in its frame.
  Draw calls today by level: 19 / 21 / 29 / 37 (max 60).
- **B3 CD music, code** (`music-rules.ts`, `music-state.ts`, `music-director.ts`, `music.ts`, `beat.ts`):
  2004 = low-passed and mono; The Static cut in and out until `static_plug_amp` and open up after
  `static_give_mic`; Mira silent until `mira_play_cd`; K-Bit's track leaks from his headphones until the beam.
  Today = the fixed CDs only, most recent first, rotating every 30 s, clean stereo + a code beat locked to whole
  bars; louder and fuller with reputation; ducks under whoosh/chime/ringtone/beam. `nowPlaying()` →
  `state().audio.music`. Measured with a fake song in Chromium: 2004 brightness 0.32 vs today 1.40; the
  dying-amp gate swings 0.051 ↔ 0.004 RMS about every 0.8 s.

## Waiting on a human (B3)

Claude can't listen, so the songs need a person (the lead has the final say), from `docs/music-shortlist.md`:
1. Pick one song per CD by ear.
2. Cut the best 30–45 s, MP3 128 kbps, ≤ 1 MB: `public/music/mira.mp3`, `static.mp3`, `kbit.mp3`.
3. Then the agent: set each `file` in `T.audio.music.cds` (e.g. `'music/mira.mp3'`), the song's `bpm` and
   `beatOffsetSec`, and write `public/music/CREDITS.md`. Until a `file` is set, that CD is silent on purpose:
   a missing file would 404 in the console and fail smoke (`tests/music.test.ts` checks every set file exists).

## Checks

`scripts/checks/audio.ts`, `kbit.ts`, `music.ts`, `today.ts`; `tests/audio.test.ts`, `kbit.test.ts`,
`music.test.ts`, `today.test.ts`.

## Smoke line (last run)

```
{"ok":true,"headings":4,"pitchSec":26.7,"drawCalls":29,...,"team":{...,"audio":{"cues":7,"muteToggles":2},"kbit":{"walkFrames":89},"music":{"music":"mira:today"},"today":{"drawCalls":[19,21,29,37]}},...}
```
Screenshots I looked at: `kbit-arrive.png`, `kbit-ringing.png`, `today-0.png` to `today-3.png`.

## Requests for Claude

- `STATUS.md` still says sound is "currently silent". Please update it.
- `docs/BACKLOG.md`: B4 and B5 can be ticked; B3 waits on the songs (above).
