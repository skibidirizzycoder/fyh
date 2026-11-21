# Local songs (never committed, never deployed)

The three CDs are covers of real, copyrighted songs. For a local demo, put your own legally obtained
copies here, named exactly:

| File | Song | Played from (`T.audio.music.cds.<cd>.real`) |
|---|---|---|
| `mira.mp3` | "Lose Yourself" (Eminem) | 0:00, about 39 s |
| `static.mp3` | "Sweet Child O' Mine" (Guns N' Roses) | 0:00, about 40 s |
| `kbit.mp3` | "Despacito" (Luis Fonsi ft. Daddy Yankee) | 0:00, about 40 s |

Then `npm run dev` (or a local build) plays them, muffled in the past and clean today like the
stand-ins. Change `startSec` / `lengthSec` in `src/tuning.ts` to pick another part of a song.

Everything in this folder except this README is git-ignored. **Never deploy a build made with these
files** (`npm run checkpoint` refuses to while any are here). Without them the game plays the
Creative Commons stand-ins in `public/music/`.
