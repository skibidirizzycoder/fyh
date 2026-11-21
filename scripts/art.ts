// art.ts — `npm run art`: makes the images listed in docs/art/images.json and saves them to
// public/textures/<name>.png (shrunk to 512 px), for the game to use as textures.
// Two ways to make them, on a developer's machine only (nothing here reaches the game):
//   - Codex CLI (default): uses your ChatGPT sign-in (`codex login`). No API key needed.
//   - OpenAI API: used when OPENAI_API_KEY is set in .env. Read via process.env, never printed.
//   npm run art                 make every missing image
//   npm run art -- cover_mira   make just these (missing) ones
// Only missing images are made: delete a file to make it again.

import { execFile, execFileSync } from 'node:child_process';
import { appendFileSync, copyFileSync, existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

interface ImageSpec { name: string; size: string; prompt: string; background?: 'transparent' | 'opaque' }
interface ImageList { style: string; images: ImageSpec[] }

const LIST = 'docs/art/images.json';
const OUT = 'public/textures';
const MAX_SIDE = 512; // textures are shrunk to this many pixels (small downloads)
const AT_ONCE = 4; // images made at the same time
const SHAPES: Record<string, string> = { '1024x1024': 'square', '1536x1024': 'landscape 3:2', '1024x1536': 'portrait 2:3' };
const run = promisify(execFile);

/** Removes anything that looks like a secret key from a message before it is shown. */
function redact(text: string): string {
  return text.replace(/sk-[A-Za-z0-9_\-*.]+/g, 'sk-[hidden]');
}

/** The full prompt for one image. */
function promptFor(spec: ImageSpec, style: string): string {
  const shape = SHAPES[spec.size] ?? spec.size;
  const alpha = spec.background === 'transparent' ? ' Transparent background.' : '';
  return `${style}${alpha} Shape: ${shape}.\n\n${spec.prompt}`;
}

/** Makes one image with the Codex CLI (ChatGPT sign-in) and copies its PNG to `path`. */
async function viaCodex(spec: ImageSpec, style: string, path: string): Promise<void> {
  const ask = `Use your image generation tool to make exactly one image, then reply only DONE.\n\n${promptFor(spec, style)}`;
  const cwd = mkdtempSync(join(tmpdir(), 'art-'));
  const { stdout } = await run('codex', ['exec', '--json', '--skip-git-repo-check', '-s', 'read-only', '-C', cwd, ask], { maxBuffer: 64 * 1024 * 1024 });
  const thread = /"thread_id"\s*:\s*"([^"]+)"/.exec(stdout)?.[1];
  const dir = thread ? join(homedir(), '.codex', 'generated_images', thread) : '';
  const png = dir && existsSync(dir) ? readdirSync(dir).find((f) => f.endsWith('.png')) : undefined;
  if (!png) throw new Error(`${spec.name}: Codex made no image (is \`codex login\` done?)`);
  copyFileSync(join(dir, png), path);
}

/** Makes one image with the OpenAI API and writes its PNG to `path`. */
async function viaApi(spec: ImageSpec, style: string, path: string, key: string): Promise<void> {
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: process.env.OPENAI_IMAGE_MODEL ?? 'gpt-image-2', prompt: promptFor(spec, style), size: spec.size, n: 1,
      quality: process.env.OPENAI_IMAGE_QUALITY ?? 'medium', background: spec.background ?? 'opaque', output_format: 'png',
    }),
  });
  const body = (await res.json()) as { data?: { b64_json?: string }[]; error?: { message?: string } };
  const b64 = body.data?.[0]?.b64_json;
  if (!res.ok || !b64) throw new Error(`${spec.name}: ${res.status} ${redact(body.error?.message ?? 'no image returned')}`);
  writeFileSync(path, Buffer.from(b64, 'base64'));
}

/** Shrinks an image so its longest side is MAX_SIDE (macOS `sips`; skipped where it doesn't exist). */
function shrink(path: string): void {
  try {
    execFileSync('sips', ['-Z', String(MAX_SIDE), path], { stdio: 'ignore' });
  } catch {
    console.log(`art: couldn't shrink ${path} (no sips); it stays full size.`);
  }
}

/** Runs `jobs` with at most AT_ONCE at a time. Returns the errors. */
async function inBatches(jobs: (() => Promise<void>)[]): Promise<unknown[]> {
  const errors: unknown[] = [];
  for (let i = 0; i < jobs.length; i += AT_ONCE) {
    const results = await Promise.allSettled(jobs.slice(i, i + AT_ONCE).map((job) => job()));
    results.forEach((r) => { if (r.status === 'rejected') errors.push(r.reason); });
  }
  return errors;
}

async function main(): Promise<void> {
  if (existsSync('.env')) process.loadEnvFile('.env');
  const key = process.env.OPENAI_API_KEY ?? '';
  const how = key ? 'the OpenAI API' : 'Codex CLI (ChatGPT sign-in)';
  const list = JSON.parse(readFileSync(LIST, 'utf8')) as ImageList;
  const wanted = process.argv.slice(2);
  const todo = list.images.filter((i) => (wanted.length === 0 || wanted.includes(i.name)) && !existsSync(`${OUT}/${i.name}.png`));
  console.log(`art: making ${todo.length} image(s) with ${how}, ${AT_ONCE} at a time (about 45 s each)...`);
  const errors = await inBatches(todo.map((spec) => async () => {
    const path = `${OUT}/${spec.name}.png`;
    if (key) await viaApi(spec, list.style, path, key);
    else await viaCodex(spec, list.style, path);
    shrink(path);
    appendFileSync(`${OUT}/CREDITS.md`, `- \`${spec.name}.png\`: AI-generated with OpenAI GPT Image (via ${how}); prompt in \`${LIST}\`.\n`);
    console.log(`art: ${path}`);
  }));
  errors.forEach((e) => console.error(`art: FAILED ${redact(String(e))}`));
  if (errors.length > 0) process.exit(1);
}

main().catch((e: unknown) => {
  console.error(`art: ${redact(String(e))}`);
  process.exit(1);
});
