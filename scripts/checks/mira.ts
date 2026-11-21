// mira.ts — smoke checks for Mira's open-mic moment. Owner: Teammate A.
// Proves, on the production build: the open mic starts flat (Mira waiting, listeners on their
// phones), the listening post is locked until you have her CD and says why, both steps work by
// walking there with real keys, playing the CD swaps the whole scene (Mira at the mic, the crowd
// gathered, phones away, flyer up), and today gets Mira's gold disc.

import type { Page } from 'playwright';
import mira from '../../src/story/cds/mira.json' with { type: 'json' };
import { MIRA_PLAY_HIDES, MIRA_PLAY_SHOWS } from '../../src/world/props/mira.ts';
import { expect, interact, restart, screenshot, state, travel, walkTo } from './tools.ts';

/** Fails unless every id is visible (or, with `visible` false, none is). */
function expectMeshes(meshes: readonly string[], ids: readonly string[], visible: boolean, when: string): void {
  const wrong = ids.filter((id) => meshes.includes(id) !== visible);
  expect(wrong.length === 0, `${when}: ${wrong.join(', ')} should ${visible ? '' : 'not '}be visible`);
}

export async function checkMira(page: Page): Promise<Record<string, unknown>> {
  await restart(page);
  let s = await travel(page, 'open_mic');
  expect(s.moment === 'open_mic', 'could not travel to open_mic');
  expectMeshes(s.visibleMeshes, ['mira_cd', 'listening_post', 'mira_mic_stand', 'mira_lights_wire', ...MIRA_PLAY_HIDES], true, 'on arrival');
  expectMeshes(s.visibleMeshes, MIRA_PLAY_SHOWS, false, 'on arrival');
  await screenshot(page, 'mira-arrive');

  // The listening post is locked until you have her CD, and says why.
  const locked = await interact(page, 'listening_post');
  expect(!locked.ok && locked.reason === 'locked', `listening post before the CD: ${JSON.stringify(locked)}, expected locked`);
  s = await state(page);
  const lockedLine = mira.actions[1]?.lockedLine ?? '';
  expect(lockedLine !== '' && s.dialogue === lockedLine, `locked listening post said "${s.dialogue}"`);

  // Step 1: walk to the bench and pick up the CD.
  const take = await walkTo(page, 'mira_cd');
  expect(take.ok && take.state.flags.includes('mira_take_cd'), 'could not walk to the CD and pick it up');
  expectMeshes(take.state.visibleMeshes, ['mira_cd'], false, 'after picking up the CD');
  expectMeshes(take.state.visibleMeshes, MIRA_PLAY_HIDES, true, 'after picking up the CD');

  // Step 2: walk to the listening post and play it. The whole scene swaps; the CD is fixed.
  const play = await walkTo(page, 'listening_post');
  expect(play.ok && play.state.flags.includes('mira_play_cd'), 'could not walk to the listening post and play the CD');
  expectMeshes(play.state.visibleMeshes, MIRA_PLAY_SHOWS, true, 'after playing the CD');
  expectMeshes(play.state.visibleMeshes, MIRA_PLAY_HIDES, false, 'after playing the CD');
  expect(play.state.fixedCds.includes('mira'), `Mira is not fixed (fixed: ${play.state.fixedCds.join()})`);
  await screenshot(page, 'mira-fixed');

  // Today: Mira's gold disc is on the wall.
  s = await travel(page, 'present');
  expect(s.visibleMeshes.includes('gold_mira'), 'no gold disc for Mira today');

  return { walkFrames: [take.frames, play.frames] };
}
