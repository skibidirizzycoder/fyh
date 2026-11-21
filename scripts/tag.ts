// tag.ts — tags the current commit as the next checkpoint and pushes the tag.
// Used by `npm run ship` (every successful ship is a checkpoint) and `npm run checkpoint`.

import { execSync } from 'node:child_process';

/** Checkpoint tags, newest first. */
export function checkpoints(): string[] {
  return execSync('git tag --list "checkpoint-*" --sort=-v:refname', { encoding: 'utf8' }).split('\n').filter(Boolean);
}

/** Tags HEAD as checkpoint-N and pushes it. Retries once if someone else took N. Returns the tag. */
export function tagCheckpoint(note: string): string | null {
  execSync('git fetch origin --tags --quiet', { stdio: 'inherit' });
  for (let attempt = 0; attempt < 2; attempt++) {
    const tag = `checkpoint-${checkpoints().length + 1}`;
    try {
      execSync(`git tag -a ${tag} -m "${tag}: ${note.replace(/"/g, "'")}"`, { stdio: 'inherit' });
      execSync(`git push origin ${tag}`, { stdio: 'inherit' });
      return tag;
    } catch {
      execSync(`git tag -d ${tag}`, { stdio: 'ignore' }); // someone else shipped at the same moment
      execSync('git fetch origin --tags --quiet', { stdio: 'inherit' });
    }
  }
  return null;
}
