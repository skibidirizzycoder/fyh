// ship.ts — `npm run ship`: put your lane's finished work on main yourself, safely.
// No permission needed: the gate is the permission. In order, it:
//   1. merges origin/main into your branch (so you test what main WILL be),
//   2. refuses files outside your lane (scripts/lanes.ts),
//   3. runs `npm run gate` (check + smoke on the production build),
//   4. pushes your branch, then fast-forwards main to it. Never forced: if main moved meanwhile,
//      it starts again from step 1 by itself (up to 3 tries).
//   5. tags main as the next checkpoint, so everyone can play it (`npm run checkpoint:play`).

import { execSync } from 'node:child_process';
import { laneForBranch, outsideLane, type Lane } from './lanes.ts';
import { tagCheckpoint } from './tag.ts';

/** Runs a command, showing its output. Throws if it fails. */
function run(cmd: string): void {
  execSync(cmd, { stdio: 'inherit' });
}

/** Runs a command and returns what it printed. */
function read(cmd: string): string {
  return execSync(cmd, { encoding: 'utf8' }).trim();
}

/** Stops with a plain explanation. */
function stop(message: string): never {
  console.error(`\nship: STOPPED. ${message}`);
  process.exit(1);
}

/** Merges the latest main into this branch, or stops on a conflict. */
function mergeMain(): void {
  run('git fetch origin');
  try {
    run('git merge --no-edit origin/main');
  } catch {
    try {
      run('git merge --abort');
    } catch {
      // no merge in progress
    }
    stop('merging main into your branch conflicted. Run `git merge origin/main`, fix the conflicts, commit, then ship again.');
  }
}

const TRIES = 3;

/** One try: merge main, check the lane, gate, push. Returns the changed files, or null if main moved. */
function attempt(lane: Lane): string[] | null {
  mergeMain();
  const changed = read('git diff --name-only origin/main...HEAD').split('\n').filter(Boolean);
  if (changed.length === 0) stop('nothing to ship: main already has all of your work.');
  const outside = outsideLane(lane, changed);
  if (outside.length > 0) {
    stop(`these files are outside your lane (${lane.name}):\n  ${outside.join('\n  ')}\nUndo those changes and write what you need under "Requests" in your notes.`);
  }
  try {
    run('npm run gate');
  } catch {
    stop('the gate failed (see above). Fix it, commit, then ship again. main was not touched.');
  }
  run('git push origin HEAD');
  try {
    run('git push origin HEAD:main');
  } catch {
    return null; // someone shipped while our gate ran
  }
  return changed;
}

function main(): void {
  const branch = read('git rev-parse --abbrev-ref HEAD');
  const lane = laneForBranch(branch);
  if (!lane) stop(`"${branch}" is not a lane branch (see scripts/lanes.ts).`);
  if (read('git status --porcelain') !== '') stop('commit (or stash) your changes first.');
  let changed: string[] | null = null;
  for (let i = 1; i <= TRIES && !changed; i++) {
    if (i > 1) console.log(`\nship: main moved while the gate ran. Try ${i} of ${TRIES}...`);
    changed = attempt(lane);
  }
  if (!changed) stop(`main kept moving (${TRIES} tries). Run \`npm run ship\` again in a minute.`);
  const tag = tagCheckpoint(`${lane.name} shipped: ${read('git log -1 --format=%s')}`);
  console.log(`\nship: DONE. main now has your ${changed.length} changed files (${lane.name})${tag ? `, tagged ${tag}` : ''}.`);
  console.log('Take your next task from docs/BACKLOG.md. Play everyone\'s work: npm run checkpoint:play');
}

main();
