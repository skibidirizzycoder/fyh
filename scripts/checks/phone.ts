// phone.ts — smoke checks for the flip phone's look. Owner: Teammate A.
// Proves, on the production build: the flip animation runs for T.phone.flipSec, the phone
// sits bottom-right under 300 px wide and clear of #dialogue and #card, the selected row
// is inverted, only fixed CDs show a star, the LCD text is readable (measured on pixels),
// and the phone is really hidden once the closing flip is over.

import type { Locator, Page } from 'playwright';
import { T } from '../../src/tuning.ts';
import { expect, interact, measureContrast, restart, screenshot, tap, travel } from './tools.ts';

const MAX_WIDTH_PX = 300; // from the prompt: "at most about 300 px wide"

interface Box { x: number; y: number; width: number; height: number }

/** True when two boxes overlap (touching edges do not count). */
function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

/** The phone's data-state: "opening" | "open" | "closing" | "closed". */
function phoneState(page: Page): Promise<string | undefined> {
  return page.evaluate(() => document.getElementById('phone')?.dataset.state);
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

export async function checkPhone(page: Page): Promise<Record<string, unknown>> {
  await restart(page);

  // Fix The Static first, so its row must show a star; its line leaves #dialogue on screen.
  await travel(page, 'street_gig');
  expect((await interact(page, 'static_cable_reel')).ok, 'could not plug in the amp');
  expect((await interact(page, 'static_mic')).ok, 'could not hand over the mic');

  // Open: the flip starts at once and lasts T.phone.flipSec.
  let s = await tap(page, 'KeyQ');
  const phone = page.locator('#phone');
  expect(s.phone.open && (await phone.isVisible()), 'Q did not open the phone');
  expect((await phoneState(page)) === 'opening', `no flip animation on open (state ${await phoneState(page)})`);
  const flip = await page.locator('#phone .phone-lid').evaluate((e) => getComputedStyle(e).animationDuration);
  expect(flip === `${T.phone.flipSec}s`, `lid flip lasts ${flip}, expected ${T.phone.flipSec}s`);
  await page.waitForFunction(() => document.getElementById('phone')?.dataset.state === 'open');

  // Place and size: bottom-right, narrow, clear of the dialogue and the card.
  const box = await phone.boundingBox();
  const view = page.viewportSize();
  expect(box !== null && view !== null, 'phone or viewport has no size');
  if (!box || !view) return {};
  expect(box.width <= MAX_WIDTH_PX, `phone is ${box.width} px wide (max ${MAX_WIDTH_PX})`);
  expect(box.x > view.width / 2 && box.y + box.height > view.height / 2, 'phone is not in the bottom-right');
  expect(box.x + box.width <= view.width && box.y >= 0, 'phone runs off the screen');
  expect(s.dialogue !== '' && (await page.locator('#dialogue').isVisible()), 'no dialogue on screen to test against');
  for (const selector of ['#dialogue', '#card']) {
    const other = page.locator(selector);
    const otherBox = (await other.isVisible()) ? await other.boundingBox() : null;
    expect(!otherBox || !overlaps(box, otherBox), `phone overlaps ${selector}`);
  }

  // One row per menu item; the selected row is inverted (ink background), the others are not.
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

  // Stars: exactly the fixed CDs (only The Static so far).
  const starred = await rows.evaluateAll((els) =>
    els.filter((e) => e.querySelector('.phone-star')).map((e) => (e as HTMLElement).dataset.target));
  expect(starred.join() === 'street_gig', `stars on [${starred.join()}], expected [street_gig]`);

  await measureContrast(page, '#phone .phone-lcd', 'phone');
  await screenshot(page, 'phone');

  // Close: the flip plays, then the phone is really hidden.
  s = await tap(page, 'KeyQ');
  expect(!s.phone.open, 'Q did not close the phone');
  expect((await phoneState(page)) === 'closing', `no flip animation on close (state ${await phoneState(page)})`);
  await phone.waitFor({ state: 'hidden' });
  expect((await phoneState(page)) === 'closed', 'phone did not finish closing');

  return { items: s.phone.items.length, widthPx: Math.round(box.width), flipSec: T.phone.flipSec, starred };
}
