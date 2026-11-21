// phone.ts — smoke checks for the flip phone's look. Owner: Teammate A.
// Proves, on the production build:
//   closed  the folded phone shows the time and date where you are (live clock today), readable,
//           clear of #dialogue / #card / #era
//   open    the flip runs for T.phone.flipSec; the phone sits bottom-right under 300 px wide, clear of
//           #dialogue and #card; the selected row is inverted with a blinking cursor; only fixed CDs
//           show a star; the LCD text is readable (measured on pixels)
//   travel  choosing a moment shows "Connecting..." + the destination with the bars filling, then
//           static, then the phone folds shut showing the new place's date and 2004 time

import type { Locator, Page } from 'playwright';
import { T } from '../../src/tuning.ts';
import { expect, interact, measureContrast, phoneTo, restart, screenshot, step, tap, travel } from './tools.ts';

const MAX_WIDTH_PX = 300; // from the prompt: "at most about 300 px wide"
const POLL_MS = 20; // the travel looks last T.phone.connectSec / staticSec of real time

interface Box { x: number; y: number; width: number; height: number }

/** True when two boxes overlap (touching edges do not count). */
function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

/** The phone's data-state: closed | opening | open | connecting | static | closing. */
function phoneState(page: Page): Promise<string | undefined> {
  return page.evaluate(() => document.getElementById('phone')?.dataset.state);
}

/** Waits (real time) until the phone shows one of these looks; says which wait failed. */
async function waitForLook(page: Page, looks: readonly string[], when: string): Promise<void> {
  try {
    await page.waitForFunction((l) => l.includes(document.getElementById('phone')?.dataset.state ?? ''), looks, { polling: POLL_MS, timeout: 5000 });
  } catch {
    expect(false, `${when}: the phone never showed ${looks.join(' or ')} (it is "${await phoneState(page)}")`);
  }
}

/**
 * Records every look the phone shows from now on, in the page itself. Short looks (static lasts
 * T.phone.staticSec) can come and go between two checks on a slow machine; the record never misses one.
 */
async function recordLooks(page: Page): Promise<void> {
  await page.evaluate(() => {
    const el = document.getElementById('phone');
    if (!el) throw new Error('#phone is missing');
    const w = window as unknown as { phoneLooks: string[] };
    w.phoneLooks = [el.dataset.state ?? ''];
    // Changes made in one go arrive as one batch: each record's old value is the look before it.
    new MutationObserver((records) => {
      records.slice(1).forEach((r) => w.phoneLooks.push(r.oldValue ?? ''));
      w.phoneLooks.push(el.dataset.state ?? '');
    }).observe(el, { attributes: true, attributeFilter: ['data-state'], attributeOldValue: true });
  });
}

/** The looks recorded since recordLooks(), with repeats removed. */
async function recordedLooks(page: Page): Promise<string[]> {
  const looks = await page.evaluate(() => (window as unknown as { phoneLooks?: string[] }).phoneLooks ?? []);
  return looks.filter((l, i) => l !== looks[i - 1]);
}

/** "#1f2a14" -> "rgb(31, 42, 20)", the way getComputedStyle reports colours. */
function rgb(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}

/** Background colour of each menu row, in order. */
function rowBackgrounds(rows: Locator): Promise<string[]> {
  return rows.evaluateAll((els) => els.map((e) => getComputedStyle(e).backgroundColor));
}

/** Fails if `box` overlaps any of these HUD panels while they are visible. */
async function expectClear(page: Page, box: Box, selectors: readonly string[], what: string): Promise<void> {
  for (const selector of selectors) {
    const other = page.locator(selector);
    const otherBox = (await other.isVisible()) ? await other.boundingBox() : null;
    expect(!otherBox || !overlaps(box, otherBox), `${what} overlaps ${selector}`);
  }
}

/** The closed phone: outer screen text, place and contrast. Returns its box. */
async function checkFolded(page: Page, time: RegExp, date: string, when: string): Promise<Box> {
  expect((await phoneState(page)) === 'closed', `${when}: phone is "${await phoneState(page)}", not closed`);
  const folded = page.locator('#phone .phone-folded');
  expect(await folded.isVisible(), `${when}: the folded phone is not visible`);
  const shown = { time: (await page.locator('.phone-outer-time').textContent()) ?? '', date: (await page.locator('.phone-outer-date').textContent()) ?? '' };
  expect(time.test(shown.time) && shown.date === date, `${when}: outer screen shows ${JSON.stringify(shown)}, expected ${time} / "${date}"`);
  const box = await folded.boundingBox();
  expect(box !== null, `${when}: folded phone has no size`);
  return box ?? { x: 0, y: 0, width: 0, height: 0 };
}

export async function checkPhone(page: Page): Promise<Record<string, unknown>> {
  await restart(page);

  // Closed, today: a live clock and today's date on the outer screen.
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const foldedBox = await checkFolded(page, /^\d\d:\d\d$/, today, 'today');
  await measureContrast(page, '#phone .phone-outer', 'phoneOuter');

  // Fix The Static, so its row must show a star; its line leaves #dialogue on screen.
  await travel(page, 'street_gig');
  expect((await interact(page, 'static_cable_reel')).ok, 'could not plug in the amp');
  expect((await interact(page, 'static_mic')).ok, 'could not hand over the mic');
  await expectClear(page, foldedBox, ['#dialogue', '#card', '#era'], 'the folded phone');

  // Open: the flip starts at once and lasts T.phone.flipSec.
  let s = await tap(page, 'KeyQ');
  const phone = page.locator('#phone');
  expect(s.phone.open && (await page.locator('#phone .phone-body').isVisible()), 'Q did not open the phone');
  expect((await phoneState(page)) === 'opening', `no flip animation on open (state ${await phoneState(page)})`);
  const flip = await page.locator('#phone .phone-lid').evaluate((e) => getComputedStyle(e).animationDuration);
  expect(flip === `${T.phone.flipSec}s`, `lid flip lasts ${flip}, expected ${T.phone.flipSec}s`);
  await waitForLook(page, ['open'], 'after opening');

  // Place and size: bottom-right, narrow, clear of the dialogue and the card.
  const box = await phone.boundingBox();
  const view = page.viewportSize();
  expect(box !== null && view !== null, 'phone or viewport has no size');
  if (!box || !view) return {};
  expect(box.width <= MAX_WIDTH_PX, `phone is ${box.width} px wide (max ${MAX_WIDTH_PX})`);
  expect(box.x > view.width / 2 && box.y + box.height > view.height / 2, 'phone is not in the bottom-right');
  expect(box.x + box.width <= view.width && box.y >= 0, 'phone runs off the screen');
  expect(s.dialogue !== '' && (await page.locator('#dialogue').isVisible()), 'no dialogue on screen to test against');
  await expectClear(page, box, ['#dialogue', '#card'], 'the open phone');

  // One row per menu item; the selected row is inverted (ink background) with a blinking cursor.
  const rows = page.locator('#phone .phone-row');
  expect((await rows.count()) === s.phone.items.length, `phone shows ${await rows.count()} rows, expected ${s.phone.items.length}`);
  s = await tap(page, 'ArrowDown');
  expect(s.phone.index === 1, `ArrowDown did not move the selection (index ${s.phone.index})`);
  const selected = await rows.evaluateAll((els) => els.map((e) => e.getAttribute('aria-selected') === 'true'));
  expect(selected.join() === s.phone.items.map((_, i) => i === 1).join(), `selected rows ${selected.join()} do not match index 1`);
  const backgrounds = await rowBackgrounds(rows);
  const ink = rgb(T.phone.lcdInk);
  expect(backgrounds[1] === ink, `selected row background ${backgrounds[1]}, expected ${ink}`);
  expect(backgrounds.filter((b) => b === ink).length === 1, `more than one row looks selected: ${backgrounds.join(' | ')}`);
  const cursor = await page.locator('#phone .phone-row.is-selected .phone-row-label').evaluate((e) => {
    const c = getComputedStyle(e, '::before');
    return { content: c.content, animation: c.animationName, sec: c.animationDuration };
  });
  expect(cursor.content === '">"' && cursor.animation === 'phone-blink' && cursor.sec === `${T.phone.blinkSec}s`, `selected row cursor: ${JSON.stringify(cursor)}`);

  // Stars: exactly the fixed CDs (only The Static so far).
  const starred = await rows.evaluateAll((els) =>
    els.filter((e) => e.querySelector('.phone-star')).map((e) => (e as HTMLElement).dataset.target));
  expect(starred.join() === 'street_gig', `stars on [${starred.join()}], expected [street_gig]`);

  await measureContrast(page, '#phone .phone-lcd', 'phone');
  await screenshot(page, 'phone');

  // Close with Q: the flip plays, then only the folded phone is left (still in 2 July 2004).
  s = await tap(page, 'KeyQ');
  expect(!s.phone.open, 'Q did not close the phone');
  expect((await phoneState(page)) === 'closing', `no flip animation on close (state ${await phoneState(page)})`);
  await waitForLook(page, ['closed'], 'after closing');
  await checkFolded(page, new RegExp(`^${T.phone.momentTimes.street_gig ?? ''}$`), '2 Jul 2004', 'closed in 2 July 2004');

  // Travel with the phone: Connecting... (bars filling) → static → folded, showing the new place.
  await recordLooks(page);
  s = await phoneTo(page, 'open_mic');
  expect(s.moment === 'open_mic', `the phone did not take us to open_mic (${s.moment})`);
  const connectText = (await page.locator('#phone .phone-connect').textContent()) ?? '';
  expect(connectText.includes('Connecting') && connectText.includes('14 March 2004'), `connecting screen says "${connectText}"`);
  if ((await phoneState(page)) === 'connecting') await screenshot(page, 'phone-connecting'); // best effort: it lasts T.phone.connectSec
  await waitForLook(page, ['closed'], 'after travelling with the phone');
  const looks = await recordedLooks(page);
  const trip = looks.slice(looks.indexOf('connecting') - 1);
  expect(['opening', 'open'].includes(trip[0] ?? '') && trip.slice(1).join('>') === 'connecting>static>closing>closed', `phone looks while travelling: ${looks.join('>')}`);
  await step(page, 1);
  await checkFolded(page, new RegExp(`^${T.phone.momentTimes.open_mic ?? ''}$`), '14 Mar 2004', 'after travelling to 14 March 2004');

  return { items: s.phone.items.length, widthPx: Math.round(box.width), flipSec: T.phone.flipSec, starred, travel: looks.join('>') };
}
