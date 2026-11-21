// kbit.ts — props for DJ K-Bit's moment: "5 December 2004: the ringtone craze". Owner: Teammate B.
// PLACEHOLDERS (magenta). Replace them with the real bus stop, queue of people and DJ K-Bit.
// The two interactable ids must match src/story/cds/kbit.json.

import type { Prop } from '../layout.ts';
import { PAST, PLACEHOLDER_COLOR, standOn } from './helpers.ts';

const M = ['ringtone'];

export const PROPS_KBIT: readonly Prop[] = [
  { id: 'kbit_phone', shape: 'box', eras: PAST, moments: M, pos: [-4.5, standOn(0, 1.6), 1], size: [0.4, 1.6, 0.4], color: PLACEHOLDER_COLOR, interactable: true },
  { id: 'kbit_bus_stop', shape: 'box', eras: PAST, moments: M, pos: [1.5, standOn(0, 2.4), -2.5], size: [1.6, 2.4, 0.5], color: PLACEHOLDER_COLOR, interactable: true },
];
