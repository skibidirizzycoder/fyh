// static.ts — smoke checks for The Static's moment. Owner: Teammate A.
// Proves, on the production build: the gig starts broken (red amp light, no cable, no crowd),
// the mic is locked until the amp is plugged in, both steps work by walking there with real
// keys, each step shows/hides the right props (the mic shows the whole payoff: a packed crowd, some
// with arms up, a dropped set list and a tip jar), and today gets The Static's gold disc.

import type { Page } from 'playwright';
import staticCd from '../../src/story/cds/static.json' with { type: 'json' };
import { STATIC_FIX_SHOWS } from '../../src/world/props/static.ts';
import { expect, interact, restart, screenshot, state, travel, walkTo } from './tools.ts';

const CABLE = ['static_cable_run', 'static_cable_lead'];
const CROWD = STATIC_FIX_SHOWS; // crowd, set list and tip jar

/** Fails unless every id is visible (or, with `visible` false, none is). */
function expectMeshes(meshes: readonly string[], ids: readonly string[], visible: boolean, when: string): void {
  const wrong = ids.filter((id) => meshes.includes(id) !== visible);
  expect(wrong.length === 0, `${when}: ${wrong.join(', ')} should ${visible ? '' : 'not '}be visible`);
}

export async function checkStatic(page: Page): Promise<Record<string, unknown>> {
  await restart(page);
  let s = await travel(page, 'street_gig');
  expect(s.moment === 'street_gig', 'could not travel to street_gig');
  expectMeshes(s.visibleMeshes, ['static_stage', 'static_amp', 'static_amp_dead', 'static_cable_reel', 'static_mic', 'static_banner'], true, 'on arrival');
  expectMeshes(s.visibleMeshes, ['static_amp_live', ...CABLE, ...CROWD], false, 'on arrival');
  await screenshot(page, 'static-arrive'); // moment-street_gig.png (after the fix) is smoke's

  // The mic is locked until the amp has power, and says why.
  const locked = await interact(page, 'static_mic');
  expect(!locked.ok && locked.reason === 'locked', `mic before amp: ${JSON.stringify(locked)}, expected locked`);
  const lockedLine = staticCd.actions[1]?.lockedLine ?? '';
  s = await state(page);
  expect(lockedLine !== '' && s.dialogue === lockedLine, `locked mic said "${s.dialogue}"`);

  // Step 1: walk to the reel and plug it in. Cable appears, amp light turns green.
  const plug = await walkTo(page, 'static_cable_reel');
  expect(plug.ok, 'could not reach the cable reel');
  expect(plug.state.flags.includes('static_plug_amp'), 'plugging in the amp set no flag');
  expectMeshes(plug.state.visibleMeshes, ['static_amp_live', ...CABLE], true, 'after plugging in');
  expectMeshes(plug.state.visibleMeshes, ['static_amp_dead', ...CROWD], false, 'after plugging in');

  // Step 2: walk to the mic stand and hand over the mic. The crowd stops to watch; the CD is fixed.
  const mic = await walkTo(page, 'static_mic');
  expect(mic.ok, 'could not reach the mic stand');
  expect(mic.state.flags.includes('static_give_mic'), 'handing over the mic set no flag');
  expectMeshes(mic.state.visibleMeshes, CROWD, true, 'after the mic');
  expect(mic.state.fixedCds.includes('static'), `The Static is not fixed (fixed: ${mic.state.fixedCds.join()})`);
  await screenshot(page, 'static-fixed');

  // Today: The Static's gold disc is on the wall.
  s = await travel(page, 'present');
  expect(s.visibleMeshes.includes('gold_static'), 'no gold disc for The Static today');

  return { walkFrames: [plug.frames, mic.frames], payoffProps: CROWD.length };
}
