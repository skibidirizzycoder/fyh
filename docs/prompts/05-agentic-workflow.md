# Prompt 05: the agentic workflow (parallel lanes) for Flip Phone

**Who runs it:** the **director** session (Claude, on `main`). Paste everything under "The prompt".
**Teammates don't run it.** Your first message is at the bottom of this file. You can start now.

This is our team harness prompt, rewritten for this repo as it is today. The game, the gate
and the Snowflake newspaper already exist. This prompt **adds** the workflow on top:
`measure`, lanes, ownership checks, diff review and a shared contracts file.

---

## The prompt

You are the **director** of "Flip Phone", a 3D story game for a hackathon (Track 2: Retro
Remix, theme "something old into something modern"). Read `AGENTS.md`, `docs/PLAN.md` and
`STATUS.md` first. Then add the team workflow below to the **existing** repo. Do the parts in
order. After each part, run `npm run gate` and commit once it passes. Don't stop to ask me. If
something needs me (an account, a token, a login), note it in `STATUS.md` and carry on.

### Already done: do NOT rebuild

| Original harness asks for | Where it already is (keep it) |
|---|---|
| Skeleton: loop, input, scenes, tuning | `src/core/{loop,input,scenes}.ts`, `src/tuning.ts` |
| One place built twice (2004 warm + grain, today clean + cool) | `src/world/layout.ts`, `src/world/props/*.ts`, `src/world/post.ts` |
| Controls | W/S walk, A/D turn, E use, Q flip phone, M mute. **No mouse look**: keep it as is |
| Timeline, flags, `presentState`, requirements | `src/story/timeline.ts` (pure), story text in `content.json` + `cds/*.json` |
| "3 actions → 1 change" demo | Grown into the **CD plan** (`docs/PLAN.md`): 3 CDs × 2 steps → gold discs + reputation levels |
| "Because you..." card, ending | `src/ui/hud.ts`, `src/game.ts` |
| `window.__game` (`getFlags`, `setEra`, ...) | Different names, **keep them**: `state()`, `travel(to)`, `walkTo(id)`, `phoneTo(to)`, `interact(id)`, `restart()`, `step(n)`. Teammates' checks use them |
| check / smoke / gate, pre-commit hook, vitest | Done: 122 tests; smoke plays the pitch with real keys (`pitchSec`) |
| `.env`, Snowflake Cortex, cache, 3 s timeout, offline edition, mocks, `snowflake:ping` | Done as `POST /api/headline` (`server/headline.ts`, `server/cortex.ts`), served by a Vite plugin in dev/preview and a **Netlify Function** in production (no separate Node server). The trial account blocks Cortex, so the demo shows the offline edition (`STATUS.md`) |
| AGENTS.md, CLAUDE.md, .junie, README, LESSONS, STATUS, task template | Exist; update them in Part 3, don't rewrite them |
| Lanes `world` / `story` / `ai` | We split by **person**, not by layer: see Part 5. Two lane branches already exist and are pushed |

### Part 1: game-dev skills

- `mkdir -p .claude/skills && cp -R ~/Documents/Boblox/.claude/skills/{game-feel,game-ui-ux,LICENSE-gamedev-skills.txt,THIRD_PARTY.md} .claude/skills/`
  Only these. **Not** the `roblox-*` skills. If the folder is missing on this machine, note it in `STATUS.md`.
- Credit them in `README.md` (Credits), following their `THIRD_PARTY.md`.

### Part 2: measure

- Smoke also saves **HUD-free** shots, `artifacts/scene-2004.png` and `artifacts/scene-present.png`
  (hide the overlays for that one screenshot). Why: the HUD is light text on purpose, and the cream
  newspaper would count as near-white.
- `npm run measure` (`scripts/measure.ts`, run with `node` like smoke; decode PNGs with `pngjs`,
  pinned exact, dev dependency). It prints, for each scene shot: mean brightness, near-white %
  (all channels ≥ `T.measure.nearWhiteLevel`) and warmth (mean red − mean blue). It also prints the
  text contrast smoke measured on rendered pixels (`artifacts/smoke.json` → `contrast`; the regions
  are listed in `T.measure.textRegions`).
- Fail if any listed text region is missing or under 4.5:1, if near-white is over 2%, or if 2004
  is not warmer than today (the eras must differ measurably).
- All thresholds go in a new `measure` section of `src/tuning.ts`.
- `gate` = `check && smoke && measure`.

### Part 3: rules and docs

- `CLAUDE.md` contains only `@AGENTS.md`. `.junie/guidelines.md` keeps pointing to `AGENTS.md`.
- `AGENTS.md`: keep it **under 120 lines** (tighten wording to make room). Add these two sections:
  - **Team workflow:** plan anything over about an hour in 5 lines first, and have a second session
    critique it. Before merging a big change, a *different* agent reviews the diff
    (`scripts/review-diff.sh`) and you fix what it confirms; keep working while it runs. When the
    look matters, put two variants side by side in one screenshot and let the team pick.
  - **Parallel lanes:** work only in your lane's branch and owned paths (`docs/LANES.md`). Need
    something outside them? Write it in `STATUS.md` under "Requests for <owner>" and take your next
    task. Cross-lane types live in `src/contracts.ts` (director only; then lanes run `lane:sync`).
    Small commits; `lane:merge` whenever a piece works end to end, at least hourly. `main` always
    passes the gate. Never sit idle: if blocked, say so in `STATUS.md` and take the next task.
  - Also update: the loop (gate now includes measure), "Where things live" (story = `content.json`
    + `cds/`, props per CD, events, phone, audio, contracts, `LANES.md`), and LESSONS lines as
    "what happened — cause — the check that now prevents it".
- `STATUS.md`: one section per lane (director, phone-static, sound-kbit), each at most 10 lines:
  doing, done, blocked, requests. Keep the Snowflake blocker in the director's section.
- `README.md`: add the lane commands, `npm run measure` and controls (Q phone, M mute).

### Part 4: contracts

- `src/contracts.ts`: **type-only re-exports** of everything that crosses lanes: `GameEvents` and
  `Events` (`src/core/events.ts`), `PhoneState` and `PhoneItem` (`src/phone/state.ts`), `CdFile`,
  `Cd`, `PastAction` and `Article` (`src/story/types.ts`), `Prop` (`src/world/layout.ts`),
  `Snapshot` and `WalkResult` (`src/debug.ts`), and the `GameAudio` surface the engine uses
  (`lastCue`, `isMuted`).
- Our event names are `travel`, `action-done`, `action-locked`, `phone-*`, `reputation`,
  `game-start` and `mute` (they replace "action / flagsChanged / eraChanged"). Ids stay strings:
  the story validator and tests guard them.
- New code in lanes imports shared types from `src/contracts.ts`. Do **not** rewrite existing
  imports in teammates' files (it would cause merge conflicts). Only the director edits contracts.

### Part 5: parallel lanes

`docs/LANES.md` is the single source of truth for who owns what (the scripts parse its table):

| lane | person | branch | owns | dev port |
|---|---|---|---|---|
| director | Claude + the team lead | `main` | everything not owned below, incl. `src/main.ts`, `src/game.ts`, `src/core/**`, `src/contracts.ts`, `src/debug.ts`, `src/phone/state.ts`, `src/story/**`, `src/world/**`, `src/ui/**`, `src/news/**`, `server/**`, `netlify/**`, `scripts/**`, `tests/**`, `package*.json`, `docs/**` | 5173 |
| phone-static | Teammate A | `feat/phone-static` | `src/phone/view.ts`, `src/phone/phone.css`, `src/story/cds/static.json`, `src/world/props/static.ts`, `scripts/checks/phone.ts`, `scripts/checks/static.ts`, `tests/phone*.test.ts`, `tests/static*.test.ts`, `docs/notes/teammate-a.md` | 5174 |
| sound-kbit | Teammate B | `feat/sound-kbit` | `src/audio/**`, `src/story/cds/kbit.json`, `src/world/props/kbit.ts`, `scripts/checks/audio.ts`, `scripts/checks/kbit.ts`, `tests/audio*.test.ts`, `tests/kbit*.test.ts`, `docs/notes/teammate-b.md` | 5175 |

Shared by everyone: `src/tuning.ts` (edit **only your own sections**; review checks this) and
`STATUS.md` (only your own section). Dev server on a lane's port: `npm run dev -- --port 5174`.

- `scripts/check-ownership.mjs`, run from `.githooks/pre-commit` before `npm run check`: on a lane
  branch, refuse a commit that stages files outside that lane's paths (plus the shared files),
  and name each file. On `main` or an unknown branch it does nothing. **Skip it while a merge is
  in progress** (`.git/MERGE_HEAD` exists): merging `main` in brings other lanes' files.
- `scripts/lane.sh` and the npm scripts `lane:new`, `lane:sync`, `lane:merge`, `lane:status`:
  - `new <name>`: for an *extra* agent session on the same machine:
    `git worktree add ../fyh-<name> <branch>` (track `origin/<branch>` if it exists, else branch
    from `main`), run `npm ci` there, print the folder and `npm run dev -- --port <port>`.
  - `sync <name>`: on the lane branch: `git fetch`, then **merge** `origin/main` into it (not
    rebase: lane branches are pushed and shared, and a rebase would need a force-push), run
    `npm run gate`, then `git push`.
  - `merge <name>`: run `sync`; only if the gate passed, `git push origin <branch>:main`. That is
    fast-forward only (git refuses anything else without force). List the merged commits. If `main`
    moved meanwhile, sync again. Never force-push, and never merge on a failing gate. Any lane may
    run it; it works from the lane's own checkout without switching to `main`.
  - `status`: for each lane: branch, commits ahead/behind `origin/main`, the last gate result
    (`artifacts/smoke.json`, ok + time) and uncommitted files.
- `scripts/review-diff.sh <name>`: writes `git diff origin/main...origin/<branch>` to
  `artifacts/review-<name>.diff` and prints: "Review this diff for bugs. List file:line, the bug
  and an input that triggers it. Don't edit."
- Run `npm run gate` on `main`, commit and push `main`. Do **not** recreate the existing lane
  branches. Only run `lane:new` if the lead wants extra sessions on this machine.

### Finish: report in at most 25 lines

1. Each part: its status and gate result, plus the paths of the screenshots you looked at.
2. What only the humans can do:
   - a Snowflake account that allows Cortex (a mentor's, or upgrade with a card);
   - add teammates as GitHub collaborators;
   - make the repo public before 18:00;
   - `netlify login` for the deploy.
3. For each lane: its branch or folder, its dev command, and its first message (below).

---

## First messages (paste into your agent session)

Until `npm run lane:merge` exists, push your branch and tell the director it is ready instead.
Pull first: `git pull origin main`.

**phone-static (Teammate A):**
> You are the phone-static lane. Read AGENTS.md, docs/LANES.md (once it exists), docs/PLAN.md,
> docs/prompts/03-teammate-a-phone-and-the-static.md and STATUS.md. Work only in your owned paths.
> Goal: the 2004 flip phone's look (shell, hinge, keypad, green LCD, flip animation, inverted
> selected row, ★ for fixed CDs) and The Static's street gig (stage, amp, cable reel, drum kit, mic
> stand; 2 steps; all PLACEHOLDER text replaced). Done when: `npm run gate` passes, the TODOs in
> scripts/checks/phone.ts and static.ts are checks, and artifacts/phone.png and
> moment-street_gig.png show it. Loop: task, gate, commit; run `npm run lane:merge phone-static`
> each time a piece works end to end. Keep your STATUS.md section current.

**sound-kbit (Teammate B):**
> You are the sound-kbit lane. Read AGENTS.md, docs/LANES.md (once it exists), docs/PLAN.md,
> docs/prompts/04-teammate-b-sound-and-dj-kbit.md and STATUS.md. Work only in your owned paths.
> Goal: finish sound and DJ K-Bit. The TODOs in scripts/checks/audio.ts and kbit.ts become real
> checks, kbit.json gets a "today" line, the bus stop sign is easy to find from the start spot, and
> the ringtone is the best 3 seconds of the pitch. Done when: `npm run gate` passes, `pitchSec`
> stays under 45, and artifacts/moment-ringtone.png shows the queue holding up their phones after
> the ring. Loop: task, gate, commit; run `npm run lane:merge sound-kbit` each time a piece works end
> to end. Keep your STATUS.md section current.

**director (Claude):** after this prompt: Mira's open-mic moment polish, today's shop at each
reputation level, merging, deploy (Netlify), the pitch run-through. Freeze at 16:15 (docs/PLAN.md).
