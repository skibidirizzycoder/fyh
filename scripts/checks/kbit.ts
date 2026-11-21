// kbit.ts — smoke checks for DJ K-Bit's moment. Owner: Teammate B.
// The basics below work with the placeholder props. Add the rest from your prompt.

import type { Page } from 'playwright';
import { expect, restart, screenshot, travel } from './tools.ts';

export async function checkKbit(page: Page): Promise<Record<string, unknown>> {
  await restart(page);
  const s = await travel(page, 'ringtone');
  expect(s.moment === 'ringtone', 'could not travel to ringtone');
  expect(s.visibleMeshes.includes('kbit_bus_stop'), 'the bus stop is not in the ringtone moment');
  await screenshot(page, 'kbit-arrive'); // moment-ringtone.png (after the fix) is smoke's
  // TODO(Teammate B): bus stop locked first, both actions with walkTo(), lastCue "ringtone",
  // travel to 'present', assert gold_kbit is in visibleMeshes.
  return {};
}
