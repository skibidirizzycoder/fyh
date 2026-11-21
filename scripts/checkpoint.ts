// checkpoint.ts — tested builds everyone can play while new work lands on top.
//   npm run checkpoint                  director, on main: gate it, tag it checkpoint-N, push the tag
//   npm run checkpoint:play [-- <tag>]  anyone: build that checkpoint (default: the newest) in a
//                                       separate folder (../<repo>-checkpoint) and serve it on port 4300,
//                                       also on the local network (others on the same Wi-Fi can open it).
// Every `npm run ship` also tags a checkpoint. checkpoint:play never touches your own branch or files,
// and the checkpoint folder has no .env, so the newspaper is always the offline edition there.

import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { checkpoints, tagCheckpoint } from './tag.ts';

const PORT = 4300;

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

/** Director: gate main and tag it as the next checkpoint. */
function make(): void {
  if (read('git rev-parse --abbrev-ref HEAD') !== 'main') stop('run this on main.');
  if (read('git status --porcelain') !== '') stop('commit your changes first.');
  run('git fetch origin --tags');
  run('git merge --ff-only origin/main');
  run('npm run gate');
  const smoke = JSON.parse(readFileSync('artifacts/smoke.json', 'utf8')) as { pitchSec?: number };
  run('git push origin main');
  const tag = tagCheckpoint(`${read('git log -1 --format=%s')} (gate ok, pitchSec ${smoke.pitchSec ?? '?'})`);
  if (!tag) stop('could not push a checkpoint tag. Try again.');
  console.log(`\ncheckpoint: ${tag} is on GitHub. Everyone can play it with: npm run checkpoint:play`);
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
