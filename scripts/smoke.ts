// smoke.ts — builds the game and plays the demo in headless Chromium.
//
// 1. Builds the shipped production build (dist/) and a test build (dist-test/).
//    The test build is the same production bundle plus window.__game.
// 2. Serves both with `vite preview`.
// 3. Shipped build: must load with no errors and must NOT expose window.__game.
// 4. Test build: plays the story through window.__game, measuring as it goes.
// The newspaper endpoint is faked in the browser, and the server's Snowflake
// variables are blanked, so the smoke test never touches the network.
// Any console error, page error, outside network request or missed state change fails the run.
// Writes artifacts/2004.png, artifacts/present.png and one JSON line.

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium, type BrowserContext, type Page } from 'playwright';
import { build, preview, type PreviewServer } from 'vite';
import { measureTextContrast } from '../src/core/contrast.ts';
import type { Snapshot } from '../src/debug.ts';
import contentJson from '../src/story/content.json' with { type: 'json' };
import { T } from '../src/tuning.ts';

const PROD = { outDir: 'dist', port: 4173 };
const TEST = { outDir: 'dist-test', port: 4174 };
const STEP = 1 / T.loop.stepsPerSecond;
const started = Date.now();
const contrast: Record<string, number> = {};
const content = contentJson;

// Blank the secrets BEFORE Vite loads .env (existing variables win), so even a
// request that slipped past the browser mock could not reach Snowflake.
process.env.SNOWFLAKE_ACCOUNT = '';
process.env.SNOWFLAKE_TOKEN = '';

/** The fake /api/headline: "ok" answers at once, "slow" answers after the game's timeout. */
const MOCK_PAPER = { headline: 'Smoke Gazette: Corner Shop Saved', article: 'This article is a test fixture. It never came from Snowflake.' };
const api = { mode: 'ok' as 'ok' | 'slow', calls: [] as unknown[] };

/** Routes every /api/headline request in the browser to the fake. */
async function mockNewsApi(context: BrowserContext): Promise<void> {
  await context.route('**/api/headline', async (route) => {
    api.calls.push(route.request().postDataJSON());
    if (api.mode === 'slow') await new Promise((r) => setTimeout(r, T.news.timeoutMs + 1500));
    await route.fulfill({ json: MOCK_PAPER }).catch(() => undefined); // the page may have given up already
  });
}

/** Fails the run if the page requests anything outside localhost. */
function blockOutsideNetwork(context: BrowserContext, errors: string[]): void {
  context.on('request', (r) => {
    const url = new URL(r.url());
    if (url.protocol.startsWith('http') && url.hostname !== 'localhost') errors.push(`network call to ${url.host}`);
  });
}

/** Throws (failing the smoke run) when a condition is false. */
function expect(ok: boolean, message: string): void {
  if (!ok) throw new Error(message);
}

/** Builds one variant: mode "production" (shipped) or "test" (with the debug API). */
async function buildVariant(mode: string, outDir: string): Promise<void> {
  await build({ mode, logLevel: 'warn', build: { outDir, emptyOutDir: true } });
}

/** Serves a build folder on a fixed port. */
async function serve(outDir: string, port: number): Promise<PreviewServer> {
  return preview({ logLevel: 'warn', build: { outDir }, preview: { port, strictPort: true } });
}

/** Fails if the shipped JavaScript mentions the debug API. */
function assertNoDebugApiShipped(): void {
  const dir = `${PROD.outDir}/assets`;
  const leaked = readdirSync(dir).filter((f) => f.endsWith('.js') && readFileSync(`${dir}/${f}`, 'utf8').includes('__game'));
  expect(leaked.length === 0, `window.__game leaked into the production build: ${leaked.join(', ')}`);
}

/** Records every console error and page error on a page. */
function watchErrors(page: Page, errors: string[], label: string): void {
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`[${label}] console: ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push(`[${label}] page: ${e.message}`));
}

/**
 * Runs `fn` inside the page and returns its result. `fn` reads window.__game?.…,
 * so it returns undefined when the debug API is missing: that fails the run.
 */
async function inPage<R, A>(page: Page, fn: (arg: A) => R | undefined, arg: A): Promise<R> {
  // (The cast only quiets Playwright's very generic evaluate() types.)
  const result = (await page.evaluate(fn as (arg: unknown) => unknown, arg)) as R | undefined;
  expect(result !== undefined, 'window.__game is missing in the test build');
  return result as R;
}

const state = (page: Page): Promise<Snapshot> => inPage(page, () => window.__game?.state(), null);
const step = (page: Page, n: number): Promise<Snapshot> => inPage(page, (n) => window.__game?.step(n), n);
const placePlayer = (page: Page, x: number, z: number, yawDeg: number): Promise<Snapshot> =>
  inPage(page, (a) => window.__game?.placePlayer(a.x, a.z, a.yawDeg), { x, z, yawDeg });

/** Holds a key for n fixed steps, releases it, steps once more and returns the state. */
function hold(page: Page, code: string, n: number): Promise<Snapshot> {
  return inPage(page, (a) => {
    const g = window.__game;
    if (!g) return undefined;
    g.press(a.code);
    g.step(a.n);
    g.release(a.code);
    return g.step(1);
  }, { code, n });
}

/** Waits (real time) until the newspaper is printed, then returns the state. */
async function waitForNews(page: Page): Promise<Snapshot> {
  await page.waitForFunction(() => window.__game?.state().news.status === 'ready', null, { timeout: T.news.timeoutMs + 3000 });
  return state(page);
}

/** Measures text contrast of an element from a screenshot of the rendered page. */
async function measureContrast(page: Page, selector: string, name: string): Promise<void> {
  const box = await page.locator(selector).boundingBox();
  expect(box !== null, `${selector} is not on screen`);
  if (!box) return;
  const png = await page.screenshot({ clip: box, animations: 'disabled' });
  const pixels = await page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const g = c.getContext('2d');
    if (!g) throw new Error('2D canvas unavailable for contrast check');
    g.drawImage(img, 0, 0);
    return Array.from(g.getImageData(0, 0, c.width, c.height).data);
  }, png.toString('base64'));
  const m = measureTextContrast(pixels);
  contrast[name] = Math.round(m.ratio * 100) / 100;
  expect(m.ratio >= T.ui.minContrast, `${name} text contrast ${m.ratio.toFixed(2)} < ${T.ui.minContrast}`);
}

/** The shipped build loads cleanly and hides the debug API. */
async function checkShippedBuild(page: Page): Promise<void> {
  await page.goto(`http://localhost:${PROD.port}/`);
  await page.locator('canvas').waitFor();
  await page.locator('#title').waitFor();
  expect(await page.evaluate(() => window.__game === undefined), 'window.__game exists in the shipped build');
  expect((await page.locator('#fallback').count()) === 0, 'shipped build showed the fallback message');
}

/** Proves W moves exactly speed*time along the facing at several headings. */
async function checkHeadings(page: Page): Promise<number> {
  const frames = 30;
  const yaws = [0, 90, 180, -90];
  for (const yaw of yaws) {
    const before = await placePlayer(page, 0, 0, yaw);
    const after = await hold(page, 'KeyW', frames);
    const expected = T.player.speed * frames * STEP;
    const dx = after.player.x - before.player.x;
    const dz = after.player.z - before.player.z;
    const f = before.player.facing;
    expect(Math.abs(dx - f.x * expected) < 1e-6 && Math.abs(dz - f.z * expected) < 1e-6,
      `yaw ${yaw}: moved (${dx.toFixed(3)}, ${dz.toFixed(3)}), expected (${(f.x * expected).toFixed(3)}, ${(f.z * expected).toFixed(3)})`);
    const m = after.player.measuredFacing;
    expect(m.x * f.x + m.z * f.z > 0.999, `yaw ${yaw}: avatar nose points (${m.x.toFixed(2)}, ${m.z.toFixed(2)}), not along facing`);
    const c = after.camera.forward;
    const len = Math.hypot(c.x, c.z);
    expect((c.x * f.x + c.z * f.z) / len > 0.999, `yaw ${yaw}: camera does not look along the player's facing`);
  }
  return yaws.length;
}

/** Plays the 2004 part: three actions in snowball order. */
async function play2004(page: Page): Promise<void> {
  let s = await inPage(page, () => window.__game?.setEra('2004'), null);
  expect(s.era === '2004', 'era did not switch to 2004');
  expect(s.visibleMeshes.includes('cd') && !s.visibleMeshes.includes('ev_charger'), '2004 props are wrong');

  // Real input path: stand in front of the CD, check it is targeted, press E.
  await placePlayer(page, -2, 1.5, 0); // CD is on the bench at (-2, 0); yaw 0 faces -Z
  s = await step(page, 1);
  expect(s.target === 'cd', `expected target "cd", got "${s.target}"`);
  s = await hold(page, 'KeyE', 1);
  expect(s.flags.join() === 'take_cd', `pressing E did not take the CD (flags: ${s.flags.join()})`);

  // The snowball: the noticeboard is locked until the CD has been played.
  const locked = await inPage(page, () => window.__game?.interact('noticeboard'), null);
  expect(!locked.ok && locked.reason === 'locked', 'noticeboard was not locked before playing the CD');
  for (const id of ['listening_post', 'noticeboard']) {
    const r = await inPage(page, (id) => window.__game?.interact(id), id);
    expect(r.ok, `interact("${id}") failed: ${JSON.stringify(r)}`);
  }
  s = await step(page, 1);
  expect(s.flags.join() === 'take_cd,play_cd,pin_flyer', `wrong flags: ${s.flags.join()}`);
  expect(s.visibleMeshes.includes('flyer') && !s.visibleMeshes.includes('cd'), '2004 effects not shown');
  expect(!s.present.shop_saved || s.era === '2004', 'present changed while still in 2004');
  await measureContrast(page, '#era', 'era2004');
  await measureContrast(page, '#dialogue', 'dialogue2004');
  await page.screenshot({ path: 'artifacts/2004.png' });
}

/** The endpoint is too slow: after exactly the timeout, the offline edition appears. */
async function checkOfflineEdition(page: Page): Promise<number> {
  api.mode = 'slow';
  await inPage(page, () => window.__game?.setEra('2004'), null);
  await inPage(page, () => window.__game?.setEra('present'), null);
  const s = await waitForNews(page);
  const n = s.news;
  expect(n.status === 'ready' && n.offline && n.reason === 'timeout', `expected offline edition after a timeout, got ${JSON.stringify(n)}`);
  expect(n.status === 'ready' && n.headline === content.news.offline.default.headline, 'offline edition is not the content.json text');
  const ms = n.status === 'ready' ? Math.round(n.ms) : -1;
  expect(ms >= T.news.timeoutMs && ms < T.news.timeoutMs + 500, `offline edition after ${ms} ms, expected ~${T.news.timeoutMs}`);
  expect(await page.locator('#news-offline').isVisible(), '"offline edition" label not shown');
  await measureContrast(page, '#news', 'newsOffline');
  api.mode = 'ok';
  return ms;
}

/** Back to the present: the change happened and the card says why. */
async function playPresent(page: Page): Promise<Snapshot> {
  await placePlayer(page, 0, 3, 0);
  await inPage(page, () => window.__game?.setEra('present'), null);
  await waitForNews(page);
  const s = await step(page, 1);
  expect(s.era === 'present', 'era did not switch to present');
  expect(s.present.shop_saved === true, 'present-day change "shop_saved" did not happen');
  expect(s.card.visible && s.card.causes.join() === 'take_cd,play_cd,pin_flyer', `card wrong: ${JSON.stringify(s.card)}`);
  expect(s.visibleMeshes.includes('open_sign') && s.visibleMeshes.includes('lit_window'), 'open shop not shown');
  expect(!s.visibleMeshes.includes('boarded_window'), 'boarded window still shown');
  expect(s.news.status === 'ready' && !s.news.offline && s.news.headline === MOCK_PAPER.headline, `newspaper wrong: ${JSON.stringify(s.news)}`);
  expect(JSON.stringify(api.calls.at(-1)) === JSON.stringify({ flags: s.flags }), `endpoint got ${JSON.stringify(api.calls.at(-1))}`);
  expect(!(await page.locator('#news-offline').isVisible()), '"offline edition" label shown for a live paper');
  expect(s.drawCalls > 0 && s.drawCalls <= T.limits.maxDrawCalls, `draw calls ${s.drawCalls} (max ${T.limits.maxDrawCalls})`);
  await measureContrast(page, '#era', 'eraPresent');
  await measureContrast(page, '#card', 'card');
  await measureContrast(page, '#dialogue', 'dialoguePresent');
  await measureContrast(page, '#news', 'news');
  await page.screenshot({ path: 'artifacts/present.png' });
  await checkNewsCache(page);
  return s;
}

/** Same flags again: the paper comes from the cache, with no new request. */
async function checkNewsCache(page: Page): Promise<void> {
  const callsBefore = api.calls.length;
  await inPage(page, () => window.__game?.setEra('2004'), null);
  const s = await inPage(page, () => window.__game?.setEra('present'), null);
  expect(s.news.status === 'ready' && s.news.cached, `expected a cached paper, got ${JSON.stringify(s.news)}`);
  expect(api.calls.length === callsBefore, 'same flag set asked the endpoint again (cache miss)');
}

/** Waits (in game frames) for the ending scene. */
async function reachEnding(page: Page): Promise<number> {
  const limit = Math.ceil(T.timing.endingDelaySec * T.loop.stepsPerSecond) + 2;
  const s = await step(page, limit);
  expect(s.scene === 'ending', `no ending after ${limit} frames (scene: ${s.scene})`);
  await measureContrast(page, '#ending', 'ending');
  return s.frame;
}

/** Plays the whole demo in the test build. */
async function playTestBuild(page: Page): Promise<Record<string, unknown>> {
  await page.goto(`http://localhost:${TEST.port}/`);
  await page.waitForFunction(() => window.__game !== undefined);
  await page.evaluate(() => window.__game?.pause());
  await measureContrast(page, '#title', 'title');
  let s = await state(page);
  expect(s.scene === 'title', `expected title scene, got ${s.scene}`);
  s = await hold(page, 'Enter', 1);
  expect(s.scene === 'play' && s.era === 'present', `Enter did not start play in the present (${s.scene}/${s.era})`);
  const headings = await checkHeadings(page);
  const offlineMs = await checkOfflineEdition(page);
  await play2004(page);
  const present = await playPresent(page);
  const frames = await reachEnding(page);
  const news = { headline: present.news.status === 'ready' ? present.news.headline : '', apiCalls: api.calls.length, offlineMs };
  return { headings, drawCalls: present.drawCalls, frames, flags: present.flags, present: present.present, news };
}

/** Runs everything and prints one JSON line. */
async function main(): Promise<void> {
  mkdirSync('artifacts', { recursive: true });
  const errors: string[] = [];
  const servers: PreviewServer[] = [];
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  let result: Record<string, unknown>;
  try {
    await buildVariant('production', PROD.outDir);
    await buildVariant('test', TEST.outDir);
    assertNoDebugApiShipped();
    servers.push(await serve(PROD.outDir, PROD.port), await serve(TEST.outDir, TEST.port));
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    await mockNewsApi(context);
    blockOutsideNetwork(context, errors);
    const prodPage = await context.newPage();
    watchErrors(prodPage, errors, 'shipped');
    await checkShippedBuild(prodPage);
    const testPage = await context.newPage();
    watchErrors(testPage, errors, 'test');
    const played = await playTestBuild(testPage);
    expect(errors.length === 0, errors.join(' | '));
    result = { ok: true, ...played, contrast, ms: Date.now() - started };
  } catch (e) {
    result = { ok: false, error: e instanceof Error ? e.message : String(e), errors, contrast, ms: Date.now() - started };
  } finally {
    await browser.close();
    await Promise.all(servers.map((s) => s.close()));
  }
  const line = JSON.stringify(result);
  writeFileSync('artifacts/smoke.json', `${line}\n`);
  console.log(line);
  process.exit(result.ok ? 0 : 1);
}

void main();
