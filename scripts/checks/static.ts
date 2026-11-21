// static.ts — smoke checks for The Static's moment. Owner: Teammate A.
// The basics below work with the placeholder props. Add the rest from your prompt.

import type { Page } from 'playwright';
import { expect, screenshot, restart, travel } from './tools.ts';

export async function checkStatic(page: Page): Promise<Record<string, unknown>> {
  await restart(page);
  const s = await travel(page, 'street_gig');
  expect(s.moment === 'street_gig', 'could not travel to street_gig');
  expect(s.visibleMeshes.includes('static_mic'), 'the mic stand is not in the street gig');
  await screenshot(page, 'static-arrive'); // moment-street_gig.png (after the fix) is smoke's
  // TODO(Teammate A): mic locked before the amp, do both actions with walkTo(), travel to
  // 'present', assert gold_static is in visibleMeshes.
  return {};
}
