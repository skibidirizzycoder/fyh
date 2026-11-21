// checkpoint.ts — tested builds everyone can play while new work lands on top.
//   npm run checkpoint                  director, on main: gate it, tag it checkpoint-N, push the tag
//   npm run checkpoint:play [-- <tag>]  anyone: build that checkpoint (default: the newest) in a
//                                       separate folder (../<repo>-checkpoint) and serve it on port 4300,
//                                       also on the local network (others on the same Wi-Fi can open it).
// `npm run checkpoint` also deploys the gated build to Netlify, if this folder is linked (.netlify/,
// made by the lead's `netlify login` + first deploy). Ships never deploy: the free plan has ~20
// production deploys a month (15 of 300 credits each).
// Every `npm run ship` also tags a checkpoint. checkpoint:play never touches your own branch or files,
// and the checkpoint folder has no .env, so the newspaper is always the offline edition there.

import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { checkpoints, tagCheckpoint } from './tag.ts';

const PORT = 4300;
const NETLIFY = 'npx -y netlify-cli@27.20.1';

/** Deploys the gated production build (dist/) to the linked Netlify site. Skips if not linked. */
function deployLive(tag: string): void {
  if (!existsSync('.netlify/state.json')) {
    console.log('checkpoint: no Netlify link here (.netlify/state.json), so no live deploy.');
    return;
  }
  try {
    run(`${NETLIFY} deploy --prod --no-build --dir dist --message ${tag}`);
  } catch {
    console.log('checkpoint: the Netlify deploy failed (the tag is still pushed). Try: npx netlify-cli status');
  }
}

function run(cmd: string, cwd?: string): void {
  execSync(cmd, { stdio: 'inherit', cwd });
}

function read(cmd: string): string {
  return execSync(cmd, { encoding: 'utf8' }).trim();
}

function stop(message: string): never {
  console.error(`\ncheckpoint: STOPPED. ${message}`);
  process.exit(1);
}

/** Director: merge origin/main into main, gate it, push it and tag it. Retries if main moves meanwhile. */
function make(): void {
  if (read('git rev-parse --abbrev-ref HEAD') !== 'main') stop('run this on main.');
  if (read('git status --porcelain') !== '') stop('commit your changes first.');
  for (let attempt = 1; attempt <= 3; attempt++) {
    run('git fetch origin --tags');
    try {
      run('git merge --no-edit origin/main');
    } catch {
      stop('merging origin/main conflicted. Fix the conflicts, commit, then run it again.');
    }
    run('npm run gate');
    try {
      run('git push origin main');
    } catch {
      console.log(`\ncheckpoint: main moved while the gate ran. Try ${attempt + 1} of 3...`);
      continue;
    }
    const smoke = JSON.parse(readFileSync('artifacts/smoke.json', 'utf8')) as { pitchSec?: number };
    const tag = tagCheckpoint(`${read('git log -1 --format=%s')} (gate ok, pitchSec ${smoke.pitchSec ?? '?'})`);
    if (!tag) stop('could not push a checkpoint tag. Try again.');
    deployLive(tag);
    console.log(`\ncheckpoint: ${tag} is on GitHub. Everyone can play it with: npm run checkpoint:play`);
    return;
  }
  stop('main kept moving (3 tries). Run it again in a minute.');
}

/** Anyone: build a checkpoint in its own folder and serve it. */
function play(wanted: string | undefined): void {
  run('git fetch origin --tags');
  const tag = wanted ?? checkpoints()[0];
  if (!tag) stop('there is no checkpoint yet. Ask the director to run `npm run checkpoint`.');
  const root = read('git rev-parse --show-toplevel');
  const dir = resolve(root, '..', `${basename(root)}-checkpoint`);
  if (existsSync(dir)) run(`git -C "${dir}" checkout --detach ${tag}`);
  else run(`git worktree add --detach "${dir}" ${tag}`);
  run('npm ci', dir);
  run('npm run build', dir);
  console.log(`\ncheckpoint: playing ${tag} at http://localhost:${PORT}/ (Ctrl+C to stop)`);
  run(`npm run preview -- --port ${PORT} --strictPort --host`, dir); // --host: also on the local network
}

const [command, arg] = process.argv.slice(2);
if (command === 'make') make();
else if (command === 'play') play(arg);
else stop('usage: node scripts/checkpoint.ts make | play [tag]');
