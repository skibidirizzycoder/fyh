// phone.ts — smoke checks for the flip phone's look. Owner: Teammate A.
// The basics below work with the placeholder phone. Add the rest from your prompt
// (docs/prompts/03-teammate-a-phone-and-the-static.md).

import type { Page } from 'playwright';
import { expect, measureContrast, restart, screenshot, tap } from './tools.ts';

export async function checkPhone(page: Page): Promise<Record<string, unknown>> {
  await restart(page);
  let s = await tap(page, 'KeyQ');
  expect(s.phone.open && (await page.locator('#phone').isVisible()), 'Q did not open the phone');
  s = await tap(page, 'ArrowDown');
  expect(s.phone.index === 1, `ArrowDown did not move the selection (index ${s.phone.index})`);
  await measureContrast(page, '#phone', 'phone');
  await screenshot(page, 'phone');
  s = await tap(page, 'KeyQ');
  expect(!s.phone.open && !(await page.locator('#phone').isVisible()), 'Q did not close the phone');
  // TODO(Teammate A): check the flip animation, the fixed-CD star, the selected row style...
  return { items: s.phone.items.length };
}
