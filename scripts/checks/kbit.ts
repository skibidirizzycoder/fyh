// kbit.ts — smoke checks for DJ K-Bit's moment. Owner: Teammate B.
// Plays the moment like a player: walk to each object and press E, in order.

import type { Page } from 'playwright';
import { T } from '../../src/tuning.ts';
import { expect, interact, restart, screenshot, state, travel, walkTo, type Check } from './tools.ts';

export const checkKbit: Check = async (page: Page) => {
  await restart(page);
  let s = await travel(page, 'ringtone');
  expect(s.moment === 'ringtone', 'could not travel to ringtone');
  expect(s.visibleMeshes.includes('kbit_bus_stop'), 'the bus stop is not in the ringtone moment');
  expect(s.visibleMeshes.includes('kbit_queue_phone_1'), 'on arrival the queue should be looking down at their phones');
  expect(!s.visibleMeshes.includes('kbit_shazam_1'), 'the raised Shazam phones should wait for your ringtone');
  expect(s.audio.music === 'kbit:2004-leak', `K-Bit's remix should leak from his headphones, got "${s.audio.music}"`);
  await screenshot(page, 'kbit-arrive'); // moment-ringtone.png (after the fix) is smoke's
  const arriveDrawCalls = s.drawCalls;
  expect(arriveDrawCalls <= T.limits.maxDrawCalls, `the bus stop needs ${arriveDrawCalls} draw calls, max ${T.limits.maxDrawCalls}`);

  const locked = await interact(page, 'kbit_bus_stop');
  expect(!locked.ok && locked.reason === 'locked', `the bus stop should be locked first, got ${JSON.stringify(locked)}`);

  const beam = await walkTo(page, 'kbit_phone');
  expect(beam.ok, `could not beam the track from K-Bit's phone: ${JSON.stringify(beam)}`);
  const ring = await walkTo(page, 'kbit_bus_stop');
  expect(ring.ok, `could not let it ring at the bus stop: ${JSON.stringify(ring)}`);
  s = await state(page);
  expect(s.audio.lastCue === 'ringtone', `the bus stop should play the ringtone, got "${s.audio.lastCue}"`);
  expect(s.visibleMeshes.includes('kbit_shazam_1') && !s.visibleMeshes.includes('kbit_queue_phone_1'), 'the queue did not hold their phones up');
  expect(s.audio.music === 'kbit:2004-live', `after the ring the remix should play from every phone, got "${s.audio.music}"`);
  expect(s.fixedCds.includes('kbit'), 'K-Bit\'s CD is not fixed after both steps');
  await screenshot(page, 'kbit-ringing');

  s = await travel(page, 'present');
  expect(s.visibleMeshes.includes('gold_kbit'), 'K-Bit\'s gold disc is not on the wall today');
  return { walkFrames: beam.frames + ring.frames, drawCalls: arriveDrawCalls };
};
