// static.ts — props for The Static's moment: "2 July 2004: street gig". Owner: Teammate A.
// PLACEHOLDERS (magenta). Replace them with the real stage, amp, drum kit and mic stand.
// The two interactable ids must match src/story/cds/static.json.

import type { Prop } from '../layout.ts';
import { PAST, PLACEHOLDER_COLOR, standOn } from './helpers.ts';

const M = ['street_gig'];

export const PROPS_STATIC: readonly Prop[] = [
  { id: 'static_cable_reel', shape: 'box', eras: PAST, moments: M, pos: [3.2, standOn(0, 0.3), -3.4], size: [0.4, 0.3, 0.4], color: PLACEHOLDER_COLOR, interactable: true },
  { id: 'static_mic', shape: 'cylinder', eras: PAST, moments: M, pos: [0.5, standOn(0, 1.5), -1.5], size: [0.15, 1.5, 0.15], color: PLACEHOLDER_COLOR, interactable: true },
];
