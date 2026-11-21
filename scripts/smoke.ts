// smoke.ts — builds the game and plays the demo in headless Chromium.
//
// 1. Builds the shipped production build (dist/) and a test build (dist-test/).
//    The test build is the same production bundle plus window.__game.
// 2. Serves both with `vite preview`.
// 3. Shipped build: must load with no errors and must NOT expose window.__game.
// 4. Test build: proves walking follows the facing and that solid props stop the player,
//    plays the pitch route with REAL key presses (phone menu, walking, E), times it,
//    fixes the remaining CDs, reaches the ending, then runs each teammate's checks
//    (scripts/checks/*.ts).
// The newspaper endpoint is faked in the browser, and the server's Snowflake
// variables are blanked, so the smoke test never touches the network.
// Any console error, page error, outside network request or missed state change fails the run.
// Writes screenshots to artifacts/ (2004.png, present.png, moment-*.png, ...) and one JSON line.

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { chromium, type BrowserContext, type Page } from 'playwright';
import { build, preview, type PreviewServer } from 'vite';
import type { Snapshot } from '../src/debug.ts';
import { content } from '../src/story/content.ts';
import { T } from '../src/tuning.ts';
import { PROPS } from '../src/world/layout.ts';
import { checkAudio } from './checks/audio.ts';
import { checkKbit } from './checks/kbit.ts';
import { checkMira } from './checks/mira.ts';
import { checkMusic } from './checks/music.ts';
import { checkPhone } from './checks/phone.ts';
import { checkStatic } from './checks/static.ts';
import { checkTodayShop } from './checks/today.ts';
import { checkUi } from './checks/ui.ts';
import {
  contrast, expect, hold, interact, measureContrast, phoneTo, placePlayer, restart, sceneMean, screenshot,
  state, step, travel, waitForNews, walkTo, type Check,
} from './checks/tools.ts';

// Ports are picked free at start, so several agents can run smoke on one machine at once.
const PROD = { outDir: 'dist', port: 0 };
const TEST = { outDir: 'dist-test', port: 0 };
const STEP = 1 / T.loop.stepsPerSecond;
const READ_FRAMES = Math.round(T.pitch.readSec * T.loop.stepsPerSecond);
const started = Date.now();
const TEAM_CHECKS: Record<string, Check> = {
  phone: checkPhone, static: checkStatic, mira: checkMira, ui: checkUi, // Teammate A
  audio: checkAudio, kbit: checkKbit, music: checkMusic, today: checkTodayShop, // Teammate B
};

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

/** Builds one variant: mode "production" (shipped) or "test" (with the debug API). */
async function buildVariant(mode: string, outDir: string): Promise<void> {
  await build({ mode, logLevel: 'warn', build: { outDir, emptyOutDir: true } });
}

/** A port nobody is listening on right now. */
async function freePort(): Promise<number> {
  return new Promise((done, fail) => {
    const probe = createServer();
    probe.once('error', fail);
    probe.listen(0, 'localhost', () => {
      const address = probe.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      probe.close(() => done(port));
    });
  });
}

/** Serves a build folder on a given port. */
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
  const frames = 30; // 1.5 m: the start spot is that clear of props in every direction (today)
  const yaws = [0, 90, 180, -90];
  for (const yaw of yaws) {
    const before = await placePlayer(page, T.player.startX, T.player.startZ, yaw);
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

/** Real keys: the shop wall stops the player one radius in front of it, and walking at it at an angle slides along it. */
async function checkCollisions(page: Page): Promise<{ stopZ: number; slideX: number }> {
  const wall = PROPS.find((p) => p.id === 'shop_wall');
  expect(wall !== undefined, 'no shop_wall prop');
  if (!wall) return { stopZ: 0, slideX: 0 };
  const stopAt = wall.pos[2] + wall.size[2] / 2 + T.player.radius;
  const x = 1; // between the shop window and the door: only the wall itself is in the way
  await placePlayer(page, x, stopAt + 1, 0); // 1 m in front, facing the wall
  const head = await hold(page, 'KeyW', T.loop.stepsPerSecond); // 1 s = 3 m of walking
  expect(Math.abs(head.player.z - stopAt) < 1e-6 && Math.abs(head.player.x - x) < 1e-6,
    `walking into the shop wall: player at (${head.player.x.toFixed(3)}, ${head.player.z.toFixed(3)}), expected (${x}, ${stopAt.toFixed(3)})`);
  const frames = 10; // 0.35 m of sliding: stays clear of the door
  const slid = await hold(page, 'KeyW', frames); // still facing the wall: nothing moves
  expect(Math.abs(slid.player.z - stopAt) < 1e-6, 'the player went into the wall');
  await placePlayer(page, x, stopAt, -45); // facing the wall and +X (towards the door)
  const angled = await hold(page, 'KeyW', frames);
  const expectedX = x + Math.SQRT1_2 * T.player.speed * frames * STEP;
  expect(Math.abs(angled.player.z - stopAt) < 1e-6 && Math.abs(angled.player.x - expectedX) < 1e-6,
    `sliding along the shop wall: player at (${angled.player.x.toFixed(3)}, ${angled.player.z.toFixed(3)}), expected (${expectedX.toFixed(3)}, ${stopAt.toFixed(3)})`);
  return { stopZ: Math.round(head.player.z * 1000) / 1000, slideX: Math.round((angled.player.x - x) * 1000) / 1000 };
}

/** The endpoint is too slow: after exactly the timeout, the offline edition appears. */
async function checkOfflineEdition(page: Page): Promise<number> {
  api.mode = 'slow';
  await travel(page, content.cds[0]?.moment ?? '');
  await travel(page, 'present');
  const s = await waitForNews(page);
  const n = s.news;
  expect(n.status === 'ready' && n.offline && n.reason === 'timeout', `expected offline edition after a timeout, got ${JSON.stringify(n)}`);
  expect(n.status === 'ready' && n.headline === content.news.offline.default?.headline, 'offline edition is not the content.json text');
  const ms = n.status === 'ready' ? Math.round(n.ms) : -1;
  expect(ms >= T.news.timeoutMs && ms < T.news.timeoutMs + 500, `offline edition after ${ms} ms, expected ~${T.news.timeoutMs}`);
  expect(await page.locator('#news-offline').isVisible(), '"offline edition" label not shown');
  await measureContrast(page, '#news', 'newsOffline');
  api.mode = 'ok';
  return ms;
}

/** Real input: fixes one CD in its moment (phone there, walk to each object, E). Returns frames used. */
async function fixCdByHand(page: Page, cdId: string, first: boolean): Promise<number> {
  const cd = content.cds.find((c) => c.id === cdId);
  const actions = content.actions.filter((a) => a.cd === cdId);
  expect(cd !== undefined && actions.length > 0, `unknown CD "${cdId}"`);
  if (!cd) return 0;
  const startFrame = (await state(page)).frame;
  let s = await phoneTo(page, cd.moment);
  expect(s.era === '2004' && s.moment === cd.moment, `phone did not take us to ${cd.moment} (${s.era}/${s.moment})`);
  expect(!s.visibleMeshes.includes('ev_charger'), `${cd.moment}: today's props are showing`);
  await step(page, READ_FRAMES);
  if (first) {
    await measureContrast(page, '#era', 'era2004');
    await measureContrast(page, '#dialogue', 'dialogue2004');
    await screenshot(page, '2004');
  }
  const last = actions.at(-1);
  if (last && actions.length > 1) {
    const locked = await interact(page, last.objectId);
    expect(!locked.ok && locked.reason === 'locked', `${last.id} was not locked before the earlier steps`);
  }
  for (const a of actions) {
    const r = await walkTo(page, a.objectId);
    expect(r.ok && r.state.flags.includes(a.id), `could not walk to "${a.objectId}" and do "${a.id}" (target ${r.state.target}, flags ${r.state.flags.join()})`);
    await step(page, READ_FRAMES);
  }
  s = await state(page);
  expect(s.fixedCds.includes(cdId), `${cdId} is not fixed after all its actions`);
  await screenshot(page, `moment-${cd.moment}`);
  return s.frame - startFrame;
}

/** Real input: phone back to today; the CD's gold disc and the new reputation show. Returns frames used. */
async function returnToday(page: Page, cdId: string, level: number): Promise<{ frames: number; s: Snapshot }> {
  const before = (await state(page)).frame;
  await phoneTo(page, 'present');
  await waitForNews(page); // real time; the game is paused, so no frames pass
  let s = await step(page, READ_FRAMES);
  expect(s.era === 'present' && s.moment === null, 'phone did not bring us back to today');
  expect(s.visibleMeshes.includes(`gold_${cdId}`), `no gold disc for ${cdId} today`);
  expect(s.reputation === level, `reputation ${s.reputation}, expected ${level}`);
  expect(s.card.visible && s.card.changes.includes(`gold_${cdId}`), `card does not explain ${cdId}: ${JSON.stringify(s.card)}`);
  expect(s.drawCalls > 0 && s.drawCalls <= T.limits.maxDrawCalls, `draw calls ${s.drawCalls} (max ${T.limits.maxDrawCalls})`);
  s = await state(page);
  return { frames: s.frame - before, s };
}

/** The pitch demo, played by hand and timed in game frames. */
async function playPitchRoute(page: Page): Promise<{ sec: number; s: Snapshot }> {
  let s = await restart(page);
  expect(s.visibleMeshes.includes('boarded_window') && s.reputation === 0, 'today does not start boarded up');
  let frames = READ_FRAMES; // the intro line
  await step(page, READ_FRAMES);
  const route = T.pitch.route.map((m) => content.cds.find((c) => c.moment === m)?.id ?? m);
  for (const [i, cdId] of route.entries()) {
    frames += await fixCdByHand(page, cdId, i === 0);
    const back = await returnToday(page, cdId, i + 1);
    frames += back.frames;
    s = back.s;
  }
  const sec = Math.round((frames / T.loop.stepsPerSecond) * 10) / 10;
  expect(sec <= T.pitch.maxAutopilotSec, `the pitch route takes ${sec} s of play, max ${T.pitch.maxAutopilotSec} s`);
  return { sec, s };
}

/** After the pitch: live paper, cache, contrast and the today screenshot. */
async function checkToday(page: Page, s: Snapshot): Promise<void> {
  expect(s.news.status === 'ready' && !s.news.offline && s.news.headline === MOCK_PAPER.headline, `newspaper wrong: ${JSON.stringify(s.news)}`);
  expect(JSON.stringify(api.calls.at(-1)) === JSON.stringify({ flags: s.flags }), `endpoint got ${JSON.stringify(api.calls.at(-1))}`);
  expect(!(await page.locator('#news-offline').isVisible()), '"offline edition" label shown for a live paper');
  expect(!s.visibleMeshes.includes('boarded_window') && s.visibleMeshes.includes('open_sign'), 'the shop is not open today');
  await measureContrast(page, '#era', 'eraPresent');
  await measureContrast(page, '#card', 'card');
  await measureContrast(page, '#news', 'news');
  await screenshot(page, 'present');
  // Same flags again: the paper comes from the cache, with no new request.
  const callsBefore = api.calls.length;
  await travel(page, content.cds[0]?.moment ?? '');
  const again = await travel(page, 'present');
  expect(again.news.status === 'ready' && again.news.cached, `expected a cached paper, got ${JSON.stringify(again.news)}`);
  expect(api.calls.length === callsBefore, 'same flag set asked the endpoint again (cache miss)');
}

/** Fixes every CD the pitch skipped, then waits (in game frames) for the ending. */
async function finishGame(page: Page): Promise<number> {
  const route: readonly string[] = T.pitch.route;
  const left = content.cds.filter((c) => !route.includes(c.moment));
  for (const cd of left) {
    await travel(page, cd.moment);
    for (const a of content.actions.filter((x) => x.cd === cd.id)) {
      const r = await walkTo(page, a.objectId);
      expect(r.ok && r.state.flags.includes(a.id), `could not do "${a.id}"`);
    }
  }
  let s = await travel(page, 'present');
  expect(s.reputation === content.cds.length && s.present[content.endingChange] === true, `not every CD fixed: ${s.fixedCds.join()}`);
  expect(s.visibleMeshes.includes('rep_plaque'), 'no blue plaque at the top reputation');
  await step(page, 1);
  await screenshot(page, 'landmark');
  const limit = Math.ceil(T.timing.endingDelaySec * T.loop.stepsPerSecond) + 2;
  s = await step(page, limit);
  expect(s.scene === 'ending', `no ending after ${limit} frames (scene: ${s.scene})`);
  await measureContrast(page, '#ending', 'ending');
  return s.frame;
}

/** Each scene (today + every moment) must look measurably different on rendered pixels. */
async function checkLooks(page: Page): Promise<Record<string, number[]>> {
  await restart(page);
  const means: Record<string, [number, number, number]> = {};
  for (const to of ['present', ...content.cds.map((c) => c.moment)]) {
    await travel(page, to);
    await step(page, 1);
    means[to] = await sceneMean(page);
  }
  const names = Object.keys(means);
  for (const [i, a] of names.entries()) {
    for (const b of names.slice(i + 1)) {
      const black: [number, number, number] = [0, 0, 0];
      const [x, y] = [means[a] ?? black, means[b] ?? black];
      const dist = Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
      expect(dist >= T.limits.minLookDistance, `${a} and ${b} look too alike (colour distance ${dist.toFixed(1)}, min ${T.limits.minLookDistance})`);
    }
  }
  const warmth = (c: number[]): number => (c[0] ?? 0) - (c[2] ?? 0);
  for (const m of content.cds.map((c) => c.moment)) {
    expect(warmth(means[m] ?? []) > warmth(means.present ?? []), `${m} is not warmer than today`);
  }
  return means;
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
  await measureContrast(page, '#dialogue', 'dialoguePresent');
  const headings = await checkHeadings(page);
  const collisions = await checkCollisions(page);
  const offlineMs = await checkOfflineEdition(page);
  const pitch = await playPitchRoute(page);
  await checkToday(page, pitch.s);
  const frames = await finishGame(page);
  const looks = await checkLooks(page);
  const team: Record<string, unknown> = {};
  for (const [name, check] of Object.entries(TEAM_CHECKS)) {
    try {
      team[name] = await check(page);
    } catch (e) {
      throw new Error(`checks/${name}.ts: ${e instanceof Error ? e.message : String(e)}`, { cause: e });
    }
  }
  const news = { headline: pitch.s.news.status === 'ready' ? pitch.s.news.headline : '', apiCalls: api.calls.length, offlineMs };
  return { headings, collisions, pitchSec: pitch.sec, drawCalls: pitch.s.drawCalls, frames, flags: pitch.s.flags, news, looks, team };
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
    PROD.port = await freePort();
    TEST.port = await freePort();
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
