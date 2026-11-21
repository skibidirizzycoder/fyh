// ui.ts — smoke checks for the title, card, newspaper and ending screens. Owner: Teammate A.
// Proves, on the production build:
//   title   a fresh page starts on the phone boot screen (chosen look, one dusty CD per CD, Enter
//           starts play); both looks are drawn side by side for the team to pick
//           (artifacts/title-variants.png); each look's text lines are readable
//   tabloid with a CD fixed today, the card and the paper are tabloid pages whose red headers,
//           headline and lists are readable
//   ending  with every CD fixed, the ending is a wall with one gold disc per CD, readable captions
// Contrast is measured on rendered pixels of single text lines/blocks (cheap, and it isolates the
// weakest pairs, e.g. yellow on the colour screen's blue).

import type { Page } from 'playwright';
import { content } from '../../src/story/content.ts';
import { T } from '../../src/tuning.ts';
import type { Snapshot } from '../../src/debug.ts';
import { expect, hold, interact, measureContrast, restart, screenshot, state, step, travel } from './tools.ts';

const VARIANTS = ['lcd', 'colour'] as const;
const BOOT_LINES = ['.boot-maker', '.boot-shop', '.boot-start', '.boot-keys']; // biggest to smallest text
const POLL_MS = 100;

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
  expect(text.includes('HOLLOW RECORDS') && text.includes('Press Enter'), `title text is missing the shop or "Press Enter": ${text}`);
  const shelf = await page.locator('#title .boot-cd').allTextContents();
  const artists = content.cds.map((c) => c.artist);
  expect(shelf.join('|') === artists.join('|'), `dusty CDs [${shelf.join()}], expected [${artists.join()}]`);
  await screenshot(page, 'title');
  await titleVariants(page);

  const play = await hold(page, 'Enter', 1);
  expect(play.scene === 'play' && !(await page.locator('#title').isVisible()), 'Enter did not leave the title screen');
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
  await checkTabloid(page);
  const discs = await checkEnding(page);
  await restart(page); // leave a playing game for the next check
  return { titleVariant: T.screens.titleVariant, discs, ms: Date.now() - started };
}
