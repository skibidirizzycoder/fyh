// tools.ts — helpers for smoke checks (scripts/smoke.ts and scripts/checks/*.ts). Owner: Claude.
// Every helper drives the TEST build through window.__game and returns a Snapshot.
//
//   await restart(page);                    // fresh game, in today
//   await phoneTo(page, 'street_gig');      // real keys: Q, Down..., E
//   const r = await walkTo(page, 'static_mic'); expect(r.ok, 'could not reach the mic');
//   await measureContrast(page, '#phone', 'phone');
//   await screenshot(page, 'phone-open');   // saved to artifacts/phone-open.png

import type { Page } from 'playwright';
import { measureTextContrast } from '../../src/core/contrast.ts';
import type { InteractResult } from '../../src/game.ts';
import type { Snapshot, WalkResult } from '../../src/debug.ts';
import { T } from '../../src/tuning.ts';

/** A teammate's check: gets the test page, returns numbers worth printing in smoke.json. */
export type Check = (page: Page) => Promise<Record<string, unknown>>;

/** Text contrast measured so far, by name (printed in smoke.json). */
export const contrast: Record<string, number> = {};

/** Throws (failing the smoke run) when a condition is false. */
export function expect(ok: boolean, message: string): void {
  if (!ok) throw new Error(message);
}

/**
 * Runs `fn` inside the page and returns its result. `fn` reads window.__game?.…,
 * so it returns undefined when the debug API is missing: that fails the run.
 * `fn` runs in the browser: it can only use `arg`, not variables from this file.
 */
export async function inPage<R, A>(page: Page, fn: (arg: A) => R | undefined, arg: A): Promise<R> {
  // (The cast only quiets Playwright's very generic evaluate() types.)
  const result = (await page.evaluate(fn as (arg: unknown) => unknown, arg)) as R | undefined;
  expect(result !== undefined, 'window.__game is missing in the test build');
  return result as R;
}

export const state = (page: Page): Promise<Snapshot> => inPage(page, () => window.__game?.state(), null);
export const step = (page: Page, n: number): Promise<Snapshot> => inPage(page, (n) => window.__game?.step(n), n);
export const restart = (page: Page): Promise<Snapshot> => inPage(page, () => window.__game?.restart(), null);
export const travel = (page: Page, to: string): Promise<Snapshot> => inPage(page, (to) => window.__game?.travel(to), to);
export const interact = (page: Page, id: string): Promise<InteractResult> => inPage(page, (id) => window.__game?.interact(id), id);
export const phoneTo = (page: Page, to: string): Promise<Snapshot> => inPage(page, (to) => window.__game?.phoneTo(to), to);
export const walkTo = (page: Page, id: string): Promise<WalkResult> => inPage(page, (id) => window.__game?.walkTo(id), id);
export const placePlayer = (page: Page, x: number, z: number, yawDeg: number): Promise<Snapshot> =>
  inPage(page, (a) => window.__game?.placePlayer(a.x, a.z, a.yawDeg), { x, z, yawDeg });

/** Holds a key for n fixed steps, releases it, steps once more and returns the state. */
export function hold(page: Page, code: string, n: number): Promise<Snapshot> {
  return inPage(page, (a) => {
    const g = window.__game;
    if (!g) return undefined;
    g.press(a.code);
    g.step(a.n);
    g.release(a.code);
    return g.step(1);
  }, { code, n });
}

/** Presses a key for exactly one fixed step (like a quick tap). */
export function tap(page: Page, code: string): Promise<Snapshot> {
  return inPage(page, (code) => {
    const g = window.__game;
    if (!g) return undefined;
    g.press(code);
    g.step(1);
    g.release(code);
    return g.state();
  }, code);
}

/** Waits (real time) until the newspaper is printed, then returns the state. */
export async function waitForNews(page: Page): Promise<Snapshot> {
  await page.waitForFunction(() => window.__game?.state().news.status === 'ready', null, { timeout: T.news.timeoutMs + 3000 });
  return state(page);
}

/** Saves a screenshot to artifacts/<name>.png. */
export async function screenshot(page: Page, name: string): Promise<void> {
  try {
    await page.screenshot({ path: `artifacts/${name}.png` });
  } catch (e) {
    throw new Error(`screenshot "${name}" failed (a slow GPU queue? see LESSONS.md): ${String(e).split('\n')[0]}`, { cause: e });
  }
}

/** Mean colour [r, g, b] (0-255) of the 3D scene in the middle of the screen, away from the HUD panels. */
export async function sceneMean(page: Page): Promise<[number, number, number]> {
  const png = await page.screenshot({ clip: { x: 320, y: 100, width: 640, height: 400 }, animations: 'disabled' }).catch((e: unknown) => {
    throw new Error(`sceneMean screenshot failed: ${String(e).split('\n')[0]}`, { cause: e });
  });
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const g = c.getContext('2d');
    if (!g) throw new Error('2D canvas unavailable for sceneMean');
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    const sum = [0, 0, 0];
    for (let i = 0; i < d.length; i += 4) for (let k = 0; k < 3; k++) sum[k] = (sum[k] ?? 0) + (d[i + k] ?? 0);
    const n = d.length / 4;
    return sum.map((v) => Math.round(v / n)) as [number, number, number];
  }, png.toString('base64'));
}

/** Measures text contrast of an element from a screenshot of the rendered page. Fails below the minimum. */
export async function measureContrast(page: Page, selector: string, name: string): Promise<void> {
  const box = await page.locator(selector).boundingBox();
  expect(box !== null, `${selector} is not on screen`);
  if (!box) return;
  const png = await page.screenshot({ clip: box, animations: 'disabled' }).catch((e: unknown) => {
    throw new Error(`contrast "${name}" (${selector}) screenshot failed: ${String(e).split('\n')[0]}`, { cause: e });
  });
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
