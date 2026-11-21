// player.ts — the CD player outside the shop today: the time machine. Owner: Claude.
// An old silver-and-black boombox on a wooden crate by the shop door, and next to it a low
// record box with the three dusty CDs standing in a row, each in its own clear colour.
// Walk up to a CD and press E to put it in the player: you travel to its 2004 moment
// (game.ts; ids from src/story/cdplayer.ts). Once a CD is fixed, a gold copy takes its place.
// Today only. Positions are measured from the shop door (layout.ts) and keep clear of today's
// queue and crowd (props/today.ts); tests/zfight and tests/collide check every story step.

import { CD_FILES } from '../../story/content.ts';
import { cdObjectId, goldCdObjectId } from '../../story/cdplayer.ts';
import { T } from '../../tuning.ts';
import type { Prop } from '../layout.ts';
import { NOW, mountOn, standOn } from './helpers.ts';

const C = T.cdPlayer;
const Z = -2.6; // centre line of the crates, out from the shop wall (its front is at z = -5)
const DEPTH = 0.55; // both crates
const FRONT = Z + DEPTH / 2;
const CRATE = { x: 3.4, w: 0.8, h: 0.5 } as const; // under the boombox, by the shop door
const BOX = { x: 2.05, w: 1.6, h: 0.32 } as const; // the record box with the CDs, left of it (and clear of x < 1.15, see tests/collide)
const CRATE_TOP = standOn(0, CRATE.h) + CRATE.h / 2;
const BOX_TOP = standOn(0, BOX.h) + BOX.h / 2;
const BOOM = [0.72, 0.36, 0.3] as const; // the boombox: width, height, depth
const BOOM_Y = standOn(CRATE_TOP, BOOM[1]);
const BOOM_FRONT = Z + BOOM[2] / 2;
const CD = [0.26, 0.24, 0.04] as const; // a CD case standing up, facing the street
const CD_SPACING = 0.6; // far enough apart that walking up to one targets that one

/** A wooden crate with one darker slat across its front. */
function crate(id: string, x: number, w: number, h: number): Prop[] {
  return [
    { id, shape: 'box', eras: NOW, pos: [x, standOn(0, h), Z], size: [w, h, DEPTH], color: C.crate },
    { id: `${id}_slat`, shape: 'box', eras: NOW, pos: [x, standOn(0, h), mountOn(FRONT, 0.02)], size: [w - 0.1, h / 4, 0.02], color: C.crateSlat },
  ];
}

/** The boombox: body, two speaker grilles, the CD lid and handle on top, a small lit display. */
function boombox(): Prop[] {
  const x = CRATE.x;
  const top = BOOM_Y + BOOM[1] / 2;
  const grille = (id: string, dx: number): Prop => ({
    id, shape: 'box', eras: NOW, pos: [x + dx, BOOM_Y, mountOn(BOOM_FRONT, 0.02)], size: [0.22, 0.22, 0.02], color: C.grille,
  });
  return [
    { id: 'cdp_boombox', shape: 'box', eras: NOW, pos: [x, BOOM_Y, Z], size: BOOM, color: C.body },
    grille('cdp_speaker_l', -0.22),
    grille('cdp_speaker_r', 0.22),
    { id: 'cdp_display', shape: 'box', eras: NOW, pos: [x, BOOM_Y + 0.06, mountOn(BOOM_FRONT, 0.02)], size: [0.14, 0.06, 0.02], color: C.display },
    { id: 'cdp_lid', shape: 'box', eras: NOW, pos: [x, standOn(top, 0.02), Z + 0.02], size: [0.24, 0.02, 0.2], color: C.trim },
    { id: 'cdp_handle', shape: 'box', eras: NOW, pos: [x, standOn(top, 0.04), Z - BOOM[2] / 2 + 0.04], size: [0.56, 0.04, 0.04], color: C.trim },
  ];
}

/** One CD standing in the record box (interactable), and its gold copy for when it's fixed. */
function cdCase(cdId: string, x: number): Prop[] {
  const pos = [x, standOn(BOX_TOP, CD[1]), Z] as const;
  return [
    { id: cdObjectId(cdId), shape: 'box', eras: NOW, pos, size: CD, color: C.cds[cdId] ?? C.trim, interactable: true },
    { id: goldCdObjectId(cdId), shape: 'box', eras: NOW, pos, size: CD, color: C.gold, startsHidden: true },
  ];
}

/** The CDs in phone-menu order, left to right, centred on the record box. */
function cdRow(): Prop[] {
  const first = BOX.x - ((CD_FILES.length - 1) * CD_SPACING) / 2;
  return CD_FILES.flatMap((f, i) => cdCase(f.cd.id, first + i * CD_SPACING));
}

export const PROPS_PLAYER: readonly Prop[] = [
  ...crate('cdp_crate', CRATE.x, CRATE.w, CRATE.h),
  ...crate('cdp_record_box', BOX.x, BOX.w, BOX.h),
  ...boombox(),
  ...cdRow(),
];
