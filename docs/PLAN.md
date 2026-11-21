# PLAN.md — Hollow Records: the CD plan

*First Year Hack, Track 2: Retro Remix ("Old Tech, New Tricks"). Draft by 17:30, hard deadline 18:00.*

## The idea (one breath)

Your record shop, **Hollow Records**, has been boarded up since 2004. Behind the counter sit
**3 dusty, unpopular CDs**. Your old **flip phone** can take you back to the 2004 moment each
artist almost made it. Fix each moment in **2 small steps** and, back in today, that CD becomes a
**gold disc** on the wall. The more CDs you fix, the more famous the shop: open → busy → a landmark.
The "Because you..." card and the newspaper explain what you changed.

## The 3 CDs

| CD | 2004 moment (phone menu) | The problem | Step 1 | Step 2 | Owner |
|---|---|---|---|---|---|
| **Mira**, "first songs" | 14 March 2004: open mic | Nobody has heard her | Pick up her dropped CD (bench) | Play it at the listening post: the owner books her | Claude |
| **The Static**, "Feedback Summer" | 2 July 2004: street gig | The amp keeps cutting out | Plug the amp's cable reel into the shop's outdoor socket | Hand them the shop's microphone | Teammate A |
| **DJ K-Bit**, "Polyphonic" | 5 December 2004: the ringtone craze | "Too weird for 2004" | Beam the track to your flip phone by infrared from K-Bit's phone | Let it ring at the busy bus stop until everyone asks what it is | Teammate B |

**Today, by number of CDs fixed:** 0 = boarded up, 1 = open again, 2 = busy (posters, people),
3 = landmark (blue plaque: *"Where the 2004 sound was discovered"*). Each fixed CD = a gold disc in the window.

## The 2-minute pitch (gameplay must fit in about 60 seconds)

| Time | What happens |
|---|---|
| 0:00–0:15 | Hook: "Your old flip phone can save your shop." The boarded shop, 3 dusty CDs. |
| 0:15–0:45 | Flip the phone → "5 Dec 2004" → fix DJ K-Bit live (the ringtone moment). |
| 0:45–1:05 | Flip back: gold disc, the shop opens, "Because you..." card. |
| 1:05–1:25 | Quick second CD. |
| 1:25–1:35 | Shop gets busier, newspaper headline. |
| 1:35–2:00 | How it's built: retro remix, tested harness, Snowflake-ready newspaper. |

The smoke test checks that the demo route fits in time (measured, not guessed).

## Who owns what (only edit YOUR files)

| Person | Builds | Owns these files |
|---|---|---|
| **Claude** | The engine: moments (several 2004 scenes), phone logic, reputation levels, events, Mira's CD, today's reputation props (gold discs, posters, plaque), the pitch-length test, merging, deploying | everything not listed below, including `src/core/`, `src/game.ts`, `src/main.ts`, `src/debug.ts`, `src/phone/state.ts`, `src/story/` (except the two CD files below), `src/world/` (except the two props files below), `src/ui/`, `server/`, `scripts/smoke.ts`, `scripts/checks/tools.ts`, the other sections of `src/tuning.ts` |
| **Teammate A** | The **flip phone's look** (opening animation, green pixel screen, menu) + **The Static** CD | `src/phone/view.ts`, `src/phone/phone.css`, `src/story/cds/static.json`, `src/world/props/static.ts`, `scripts/checks/phone.ts`, `scripts/checks/static.ts`, the `phone` and `static` sections of `src/tuning.ts`, new `tests/phone-*.test.ts` files |
| **Teammate B** | **All sound** (made in code: ringtone, keypad beeps, era background, chimes) + **DJ K-Bit** CD + **the CD music** (real CC-BY songs, 2004 → today remix) | `src/audio/*`, `public/music/**`, `src/story/cds/kbit.json`, `src/world/props/kbit.ts`, `scripts/checks/audio.ts`, `scripts/checks/kbit.ts`, `scripts/checks/music.ts`, the `audio` and `kbit` sections of `src/tuning.ts`, new `tests/audio-*.test.ts` / `tests/music*.test.ts` files |

Need a change in someone else's file? Ask them (or Claude) instead of editing it.
Your files already exist and work: placeholders are **magenta** and their text starts with **PLACEHOLDER**.
Replace them. Keep the ids (`static_cable_reel`, ...) or change them in your JSON and props file together.

## Shared formats (the "contracts")

The **foundation commit** ("Foundation: CD moments") is on `main`: every file above exists as a
working stub and `npm run gate` passes. Pull it before you write code.

**A CD's story** (`src/story/cds/<id>.json`):
```json
{
  "cd": { "id": "static", "artist": "The Static", "title": "Feedback Summer",
          "moment": "street_gig", "date": "2 July 2004",
          "situation": "One sentence: what is going wrong in this moment.",
          "today": "One sentence: what is different today once this CD is fixed." },
  "actions": [
    { "id": "static_plug_amp", "objectId": "static_cable_reel",
      "label": "plugged The Static's amp into the shop", "prompt": "Plug in the amp",
      "requires": [], "line": "Dialogue when it works.", "lockedLine": "",
      "effects": { "show": [], "hide": [] } },
    { "id": "static_give_mic", "...": "same fields; requires: [\"static_plug_amp\"]" }
  ],
  "offline": { "headline": "Newspaper headline if this CD is fixed", "article": "2 sentences." }
}
```
The engine makes the gold disc and reputation changes for you. Your CD is "fixed" when its last action is done.
Actions happen in the CD's moment (you can leave out `"moment"`). Text shows as-is, so keep lines short.

**A CD's props** (`src/world/props/<id>.ts`): export an array of props, like `src/world/layout.ts`,
each with `eras: ['2004']` and `moments: ['street_gig']`. Interactable props need `interactable: true`
and must be used by one of your actions. `npm run check` refuses bad ids and z-fighting.

**Events you can listen to** (`src/core/events.ts`): `travel` (to a moment or today), `action-done`,
`action-locked`, `phone-open`, `phone-close`, `phone-move`, `phone-select`, `reputation` (new level).
Sound plays on these; it never edits `game.ts`.

**Phone view** (`src/phone/view.ts`): gets a `PhoneState` every frame (open or closed, the list of
moments, which is selected, which are fixed) and draws it. Claude's `state.ts` handles the keys.

**Smoke checks** (`scripts/checks/<yours>.ts`): use the helpers in `scripts/checks/tools.ts`:
`restart`, `travel(page, 'street_gig')`, `walkTo(page, 'static_mic')` (real keys), `phoneTo`,
`interact`, `tap(page, 'KeyQ')`, `state`, `measureContrast`, `screenshot`, `expect`.
Each returns `__game.state()`: `moment`, `flags`, `fixedCds`, `visibleMeshes`, `phone`, `audio.lastCue`, ...

## Timeline

| When | What |
|---|---|
| now–13:45 | Everyone: set up (`README.md` → For teammates). Claude: foundation commit (done). |
| 13:45–16:15 | Build on your own branch. Pull `main` every hour. |
| ~14:30 | Mira's CD works end to end: from here on we always have a demo. |
| 16:15 | **Feature freeze.** Push your branch; Claude merges, runs `npm run gate`, deploys. |
| 16:45 | Repo public, demo recorded, submission drafted. |
| 17:30 | Draft submitted. 18:00 hard deadline. |

**Safety net:** if a CD isn't working by 16:15, we ship without it. Two CDs still demo well.

**Team workflow** (lanes, ownership check, diff review, measure): `docs/prompts/05-agentic-workflow.md`.
Each teammate's first message to their agent is at the bottom of that file.

## Git, step by step

```sh
git switch -c feat/phone-static      # Teammate A  (Teammate B: feat/sound-kbit)
# ...work, then after each small working step:
npm run check                        # the commit hook also runs this
git add -A && git commit -m "What you did"
git push -u origin HEAD              # first time; later just: git push
git pull origin main                 # every hour, to get everyone else's work
```
When your part works (`npm run gate` passes on your branch), tell Claude to merge it.
