# Prompt 08: run your lane by itself (paste once, the agent works through your queue)

**How to use:** on your lane branch, with `main` merged in (`git fetch && git merge origin/main`),
paste "The prompt" into your agent and change `<LANE>` to `phone-static` (Teammate A) or
`sound-kbit` (Teammate B). Check in on it now and then; it doesn't need you to keep going.

**Second session** (its own folder and branch, see `docs/BACKLOG.md` step 4): paste the same prompt
and add a last line `Only task: A4` (or `B4`). That session builds and ships just that task, then
takes Free tasks. Tell the first session to skip it: add `Skip: A4`.

---

## The prompt

You are the **<LANE>** lane of "Flip Phone", a 3D story game for a hackathon. Read `AGENTS.md`,
`docs/LANES.md`, `docs/BACKLOG.md` and your notes in `docs/notes/` first. Your files are listed
for your lane in `scripts/lanes.ts`. Only edit those, plus your own sections of `src/tuning.ts`
and `STATUS.md`.

Work through your queue in `docs/BACKLOG.md` **on your own, top to bottom, without stopping to ask**:

1. Take the first task in your section that your notes don't mark as done (respect `Only task:` and
   `Skip:` lines at the end of this prompt). If the task points to a prompt in `docs/prompts/`,
   follow that prompt.
2. Build it in small steps. After each step: `npm run check`, then `npm run smoke`, look at the
   screenshots in `artifacts/`, and commit with a clear message.
3. When the task works end to end: `npm run ship`. If it stops, read why, fix it, ship again.
   (It merges `main`, checks your files, runs the gate, updates `main` and tags a checkpoint.)
4. In your notes (`docs/notes/`), mark the task done with the smoke JSON line and the screenshots you
   looked at. Add anything you need from someone else under "Requests". Commit it (the next ship
   carries it).
5. Go back to step 1. When your section is empty, take a Free task (claim it in your `STATUS.md`
   section first). When those are gone too, ship, then stop and report what you built.

Rules:
- Never wait for a reply. If you are blocked (you need a file outside your lane, an account or a
  decision), write it under "Requests" and move on to the next task.
- Never edit files outside your lane to make a check pass. Never force-push. Never commit `.env`.
- Keep the ids listed in `docs/BACKLOG.md`: other people's tests use them.
- If `npm run ship` says main moved, just run it again. If merging main conflicts, fix only the
  conflicts in your own files; if a conflict is in someone else's file, take their version.
