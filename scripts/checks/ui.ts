// ui.ts — smoke checks for the title, card, newspaper and ending screens. Owner: Teammate A.
// Proves, on the production build:
//   title   a fresh page starts on the title over the live street: the logo leans towards the mouse,
//           the shop's boot screen (chosen look, one dusty CD per CD), and the PRESS START button
//           starts play; both boot looks are drawn side by side for the team to pick
//           (artifacts/title-variants.png); each look's text lines and the button are readable
//   tabloid with a CD fixed today, the card and the paper are tabloid pages whose red headers,
//           headline and lists are readable
//   ending  with every CD fixed, the ending is a wall with one gold disc per CD, readable captions
//   bubbles fixing a CD pops T.screens.bubbles.count ♪/♥ bubbles in the middle of the screen (clear
//           of the dialogue) that are gone again after the burst; travelling or restarting pops none
//   narrow  in a phone-size window (390x844) the era, folded phone, card + paper, prompt and dialogue
//           never overlap, and the open phone takes the papers' place without covering the dialogue
// Contrast is measured on rendered pixels of single text lines/blocks (cheap, and it isolates the
// weakest pairs, e.g. yellow on the colour screen's blue).

import type { Page } from 'playwright';
import { content } from '../../src/story/content.ts';
import { T } from '../../src/tuning.ts';
import type { Snapshot } from '../../src/debug.ts';
import { expect, interact, measureContrast, restart, screenshot, state, step, tap, travel } from './tools.ts';

/** Upper bound for waits on the page: same conditions, but a busy machine (several agents' smoke runs) can take long. */
const BUSY_WAIT_MS = 30_000;

const VARIANTS = ['lcd', 'colour'] as const;
const BOOT_LINES = ['.boot-shop', '.boot-shop-sub', '.boot-keys']; // biggest to smallest text
const POLL_MS = 100;
const NARROW = { width: 390, height: 844 }; // a phone in portrait (F2 playtest, bug 4)

interface Box { x: number; y: number; width: number; height: number }

/** Fixes one CD directly (no walking: the other checks prove walking works). */
async function fixCd(page: Page, cdId: string): Promise<void> {
  const cd = content.cds.find((c) => c.id === cdId);
  expect(cd !== undefined, `unknown CD ${cdId}`);
  await travel(page, cd?.moment ?? '');
  for (const a of content.actions.filter((x) => x.cd === cdId)) {
    const r = await interact(page, a.objectId);
    expect(r.ok, `could not do ${a.id}: ${JSON.stringify(r)}`);
  }
}

/**
 * Waits (real time) for the paper to be printed. Polls on a timer, not on animation frames, so a
 * reply that lands after the first look is still seen. On timeout it says what the desk was doing.
 */
async function waitForPaper(page: Page): Promise<Snapshot> {
  try {
    await page.waitForFunction(() => window.__game?.state().news.status === 'ready', null, { polling: POLL_MS, timeout: T.news.timeoutMs + 3000 });
  } catch {
    const why = await page.evaluate(() => ({ news: window.__game?.state().news, visibility: document.visibilityState }));
    expect(false, `the paper was never printed: ${JSON.stringify(why)}`);
  }
  return state(page);
}

/** Fails if any two of these elements overlap while visible. */
async function expectApart(page: Page, selectors: readonly string[], when: string): Promise<number> {
  const shown: { selector: string; box: Box }[] = [];
  for (const selector of selectors) {
    const el = page.locator(selector);
    const box = (await el.isVisible()) ? await el.boundingBox() : null;
    if (box) shown.push({ selector, box });
  }
  for (const [i, a] of shown.entries()) {
    for (const b of shown.slice(i + 1)) {
      const apart = a.box.x + a.box.width <= b.box.x || b.box.x + b.box.width <= a.box.x
        || a.box.y + a.box.height <= b.box.y || b.box.y + b.box.height <= a.box.y;
      expect(apart, `${when}: ${a.selector} overlaps ${b.selector}`);
    }
  }
  return shown.length;
}

/** Fixing a CD pops ♪/♥ bubbles for about a second; nothing else does. */
async function checkBubbles(page: Page): Promise<number> {
  const B = T.screens.bubbles;
  const bubbles = page.locator('#bubbles .bubble');
  await restart(page);
  await travel(page, 'street_gig');
  expect((await bubbles.count()) === 0, 'bubbles before anything was fixed');
  await fixCd(page, 'static');
  try {
    await page.waitForFunction((n) => document.querySelectorAll('#bubbles .bubble').length === n, B.count, { polling: POLL_MS, timeout: BUSY_WAIT_MS });
  } catch {
    expect(false, `fixing The Static popped ${await bubbles.count()} bubbles, expected ${B.count}`);
  }
  const clash = await page.evaluate(() => {
    const d = document.getElementById('dialogue')?.getBoundingClientRect();
    if (!d || d.width === 0) return null;
    return Array.from(document.querySelectorAll('#bubbles .bubble')).some((b) => {
      const r = b.getBoundingClientRect();
      return r.left < d.right && d.left < r.right && r.top < d.bottom && d.top < r.bottom;
    });
  });
  expect(clash !== true, 'a bubble covers the dialogue');
  // Freeze the burst mid-pop for the picture: a slow machine can take longer than the burst to screenshot.
  await page.evaluate(() => {
    for (const a of document.getAnimations()) {
      const target = (a.effect as KeyframeEffect | null)?.target;
      if (!(target instanceof HTMLElement) || !target.classList.contains('bubble')) continue;
      const timing = a.effect?.getTiming();
      a.pause();
      a.currentTime = Number(timing?.delay ?? 0) + Number(timing?.duration ?? 0) * 0.35;
    }
  });
  await screenshot(page, 'bubbles');
  await page.evaluate(() => {
    for (const a of document.getAnimations()) {
      const target = (a.effect as KeyframeEffect | null)?.target;
      if (target instanceof HTMLElement && target.classList.contains('bubble')) a.play();
    }
  });
  try {
    await page.waitForFunction(() => document.querySelectorAll('#bubbles .bubble').length === 0, null, { polling: POLL_MS, timeout: (B.sec + B.staggerSec) * 1000 + BUSY_WAIT_MS });
  } catch {
    expect(false, 'the bubbles never went away');
  }
  await travel(page, 'present');
  await step(page, 1);
  expect((await bubbles.count()) === 0, 'travelling with a CD already fixed popped bubbles again');
  return B.count;
}

/** Waits (real time) until the phone shows this look. */
async function waitForPhone(page: Page, look: string): Promise<void> {
  await page.waitForFunction((l) => document.getElementById('phone')?.dataset.state === l, look, { polling: POLL_MS, timeout: BUSY_WAIT_MS });
}

/** A phone-size window: today with the card and the paper, then with the phone open. */
async function checkNarrow(page: Page): Promise<number> {
  const wide = page.viewportSize();
  await page.setViewportSize(NARROW);
  try {
    await page.waitForFunction(() => document.documentElement.classList.contains('is-narrow'), null, { polling: POLL_MS, timeout: BUSY_WAIT_MS });
    await restart(page);
    await fixCd(page, 'mira');
    await travel(page, 'present');
    await waitForPaper(page);
    await step(page, 1);
    expect((await page.locator('#card').isVisible()) && (await page.locator('#news').isVisible()), 'narrow: the card or the paper is not shown');
    const panels = await expectApart(page, ['#era', '#phone .phone-folded', '#today-papers', '#prompt', '#dialogue'], 'narrow, today');
    await expectApart(page, ['#card', '#news'], 'narrow, today');
    await screenshot(page, 'narrow-today');

    await tap(page, 'KeyQ');
    await waitForPhone(page, 'open');
    expect(!(await page.locator('#news').isVisible()), 'narrow: the paper still shows under the open phone');
    await expectApart(page, ['#era', '#phone', '#prompt', '#dialogue'], 'narrow, phone open');
    await screenshot(page, 'narrow-phone');
    await tap(page, 'KeyQ');
    await waitForPhone(page, 'closed');
    return panels;
  } finally {
    if (wide) await page.setViewportSize(wide);
  }
}

/** Draws every title look side by side in a temporary layer, measures and screenshots them. */
async function titleVariants(page: Page): Promise<void> {
  await page.evaluate((variants) => {
    const source = document.querySelector('#title .boot');
    if (!source) throw new Error('#title .boot is missing');
    const layer = document.createElement('div');
    layer.id = 'title-variants';
    layer.style.cssText = 'position:fixed;inset:0;z-index:20;display:flex;gap:40px;align-items:center;justify-content:center;text-align:center;background:var(--backdrop)'; // like .screen
    for (const v of variants) {
      const copy = source.cloneNode(true) as HTMLElement;
      copy.dataset.variant = v;
      copy.id = `title-variant-${v}`;
      copy.style.width = '540px';
      layer.appendChild(copy);
    }
    document.body.appendChild(layer);
  }, [...VARIANTS]);
  for (const v of VARIANTS) {
    for (const line of BOOT_LINES) await measureContrast(page, `#title-variant-${v} ${line}`, `title-${v}${line.replace('.boot', '')}`);
  }
  await screenshot(page, 'title-variants');
  await page.evaluate(() => document.getElementById('title-variants')?.remove());
}

/** The real title screen of a freshly loaded game. */
async function checkTitle(page: Page): Promise<void> {
  await page.reload();
  await page.waitForFunction(() => window.__game !== undefined, null, { polling: POLL_MS });
  await page.evaluate(() => window.__game?.pause());
  const s = await state(page);
  expect(s.scene === 'title', `a fresh page starts on "${s.scene}", not the title`);
  const boot = page.locator('#title .boot');
  expect(await boot.isVisible(), 'the boot screen is not visible on the title');
  const variant = await boot.getAttribute('data-variant');
  expect(variant === T.screens.titleVariant, `title look is "${variant}", tuning says "${T.screens.titleVariant}"`);
  const text = (await boot.textContent()) ?? '';
  expect(text.includes('HOLLOW RECORDS'), `the boot screen is missing the shop: ${text}`);
  const start = page.locator('#title .title-start');
  expect((await start.isVisible()) && (await start.textContent()) === 'PRESS START', 'no PRESS START button on the title');
  await measureContrast(page, '#title .title-start', 'titleStart');

  // The logo leans towards the mouse: top-left tips it one way, bottom-right the other.
  const tilt = async (x: number, y: number): Promise<string> => {
    await page.mouse.move(x, y);
    return page.locator('#title .title-logo').evaluate((e) => `${e.style.getPropertyValue('--tilt-x')} ${e.style.getPropertyValue('--tilt-y')}`);
  };
  const view = page.viewportSize() ?? { width: 1280, height: 720 };
  const [topLeft, bottomRight] = [await tilt(0, 0), await tilt(view.width - 1, view.height - 1)];
  const maxTilt = `${T.screens.logoTiltDeg.toFixed(2)}deg`;
  expect(topLeft === `${maxTilt} -${maxTilt}` && bottomRight.startsWith('-'), `logo tilt: top-left "${topLeft}", bottom-right "${bottomRight}"`);
  await tilt(view.width * 0.62, view.height * 0.4); // a little off-centre for the picture
  const shelf = await page.locator('#title .boot-cd').allTextContents();
  const artists = content.cds.map((c) => c.artist);
  expect(shelf.join('|') === artists.join('|'), `dusty CDs [${shelf.join()}], expected [${artists.join()}]`);
  await screenshot(page, 'title');
  await titleVariants(page);

  await start.click({ force: true }); // force: it pulses, so it is never "stable" for Playwright
  const play = await step(page, 1);
  expect(play.scene === 'play' && !(await page.locator('#title').isVisible()), 'PRESS START did not leave the title screen');
}

/** Today with Mira fixed: the card and the paper are tabloid pages. */
async function checkTabloid(page: Page): Promise<void> {
  await restart(page);
  await fixCd(page, 'mira');
  await travel(page, 'present');
  const s = await waitForPaper(page);
  expect(s.card.visible && (await page.locator('#card').isVisible()), 'the "Because you..." card is not shown');
  expect(await page.locator('#news').isVisible(), 'the newspaper is not shown');
  const causes = await page.locator('#card-causes li').count();
  expect(causes === s.card.causes.length && causes > 0, `card lists ${causes} causes, expected ${s.card.causes.length}`);
  await measureContrast(page, '#card .tabloid-head', 'cardHead');
  await measureContrast(page, '#card ol', 'cardCauses');
  await measureContrast(page, '#card-change', 'cardChange');
  await measureContrast(page, '#news .tabloid-masthead', 'newsMasthead');
  await measureContrast(page, '#news-headline', 'newsHeadline');
  await screenshot(page, 'tabloid');
}

/** Every CD fixed: the ending is a wall with one framed gold disc per CD. */
async function checkEnding(page: Page): Promise<number> {
  for (const cd of content.cds) {
    if (!(await state(page)).fixedCds.includes(cd.id)) await fixCd(page, cd.id);
  }
  await travel(page, 'present');
  const s = await step(page, Math.ceil(T.timing.endingDelaySec * T.loop.stepsPerSecond) + 2);
  expect(s.scene === 'ending' && (await page.locator('#ending').isVisible()), `no ending screen (scene ${s.scene})`);
  const captions = await page.locator('#ending .gold-caption').allTextContents();
  const discs = await page.locator('#ending .disc-gold').count();
  expect(discs === content.cds.length, `${discs} gold discs on the wall, expected ${content.cds.length}`);
  content.cds.forEach((cd, i) => expect((captions[i] ?? '').includes(cd.artist), `disc ${i + 1} caption "${captions[i]}" is not ${cd.artist}`));
  await measureContrast(page, '#ending .ending-title', 'endingTitle');
  await measureContrast(page, '#ending .gold-frame:first-child .gold-caption', 'endingCaption');
  await measureContrast(page, '#ending .ending-text', 'endingText');
  await screenshot(page, 'ending');
  return discs;
}

export async function checkUi(page: Page): Promise<Record<string, unknown>> {
  const started = Date.now();
  await checkTitle(page);
  const bubbles = await checkBubbles(page);
  await checkTabloid(page);
  const discs = await checkEnding(page);
  const narrowPanels = await checkNarrow(page);
  await restart(page); // leave a playing game for the next check
  return { titleVariant: T.screens.titleVariant, bubbles, discs, narrowPanels, ms: Date.now() - started };
}
