// today.ts — smoke checks for today's shop at each reputation level. Owner: Teammate B.
// Fixes the CDs one by one (travel + interact, quick), and after each one checks today's shop
// and saves a screenshot: artifacts/today-0.png (boarded up) to today-3.png (landmark).

import type { Page } from 'playwright';
import { content } from '../../src/story/content.ts';
import { T } from '../../src/tuning.ts';
import { expect, interact, restart, screenshot, travel, type Check } from './tools.ts';

/** What must (and must not) be on screen today at each level. */
const EXPECT: readonly { level: number; shows: string[]; hides: string[] }[] = [
  { level: 0, shows: ['boarded_window', 'rep_door_boards', 'frame_mira'], hides: ['open_sign', 'rep_customer'] },
  { level: 1, shows: ['lit_window', 'open_sign', 'rep_customer'], hides: ['boarded_window', 'rep_door_boards', 'rep_queue_1'] },
  { level: 2, shows: ['rep_window_poster_1', 'rep_queue_1', 'rep_queue_4'], hides: ['rep_plaque', 'rep_crowd_1'] },
  { level: 3, shows: ['rep_plaque', 'rep_neon', 'rep_crowd_1'], hides: [] },
];

/** Does every step of a CD's moment, in order. */
async function fixCd(page: Page, cdId: string): Promise<void> {
  const cd = content.cds.find((c) => c.id === cdId);
  expect(cd !== undefined, `no CD "${cdId}"`);
  await travel(page, cd?.moment ?? '');
  for (const a of content.actions.filter((x) => x.cd === cdId)) {
    const r = await interact(page, a.objectId);
    expect(r.ok, `could not do ${a.id}: ${JSON.stringify(r)}`);
  }
}

export const checkTodayShop: Check = async (page: Page) => {
  await restart(page);
  const drawCalls: number[] = [];
  const cds = content.cds.map((c) => c.id);
  for (const want of EXPECT) {
    if (want.level > 0) await fixCd(page, cds[want.level - 1] ?? '');
    const s = await travel(page, 'present');
    expect(s.reputation === want.level, `expected reputation ${want.level}, got ${s.reputation}`);
    for (const id of want.shows) expect(s.visibleMeshes.includes(id), `level ${want.level}: ${id} should be visible`);
    for (const id of want.hides) expect(!s.visibleMeshes.includes(id), `level ${want.level}: ${id} should be hidden`);
    const golds = s.visibleMeshes.filter((m) => m.startsWith('gold_')).length;
    expect(golds === want.level, `level ${want.level}: ${golds} gold discs on the wall`);
    expect(s.drawCalls <= T.limits.maxDrawCalls, `level ${want.level}: ${s.drawCalls} draw calls`);
    drawCalls.push(s.drawCalls);
    await screenshot(page, `today-${want.level}`);
  }
  return { drawCalls };
};
