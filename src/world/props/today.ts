// today.ts — the shop today, as its reputation grows. Owner: Teammate B.
//   level 0: boarded up and dark (boards on the window AND the door), three empty frames by the door
//   level 1: open (rep_open): lit window, open sign, one customer browsing, music from inside
//   level 2: busy (rep_busy): posters in the window, a queue of four along the wall
//   level 3: landmark (rep_landmark): blue plaque, a crowd out front, a neon HOLLOW RECORDS sign
// Plus one gold disc per fixed CD, each in its own frame (content.ts shows gold_<cd>).
// The "reputation" entries in src/story/content.json show and hide these; levels add up.

import { T } from '../../tuning.ts';
import type { Prop } from '../layout.ts';
import { DOOR_FRONT, NOW, WALL_FRONT_Z, mountOn, standOn } from './helpers.ts';

const C = T.today;
const WINDOW_Y = standOn(0, 1.8) + 0.5;
const WINDOW_FRONT = mountOn(WALL_FRONT_Z, 0.1) + 0.05;
const SIGN_FRONT = mountOn(WALL_FRONT_Z, 0.1) + 0.05; // the shop sign (layout.ts) is 0.1 deep on the wall
const FRAME = [0.46, 0.46, 0.03] as const;
const FRAME_FRONT = mountOn(WALL_FRONT_Z, FRAME[2]) + FRAME[2] / 2;
const PERSON = [0.45, 1.6, 0.45] as const;

/** A framed gold disc by the door: the frame is always there, the disc appears when the CD is fixed. */
function framedDisc(cd: string, x: number): Prop[] {
  return [
    { id: `frame_${cd}`, shape: 'box', eras: NOW, pos: [x, 2.3, mountOn(WALL_FRONT_Z, FRAME[2])], size: FRAME, color: C.frame },
    { id: `gold_${cd}`, shape: 'box', eras: NOW, pos: [x, 2.3, mountOn(FRAME_FRONT, 0.04)], size: [0.36, 0.36, 0.04], color: C.gold, startsHidden: true },
  ];
}

/** A person standing at (x, z): a simple cylinder, like everyone else in the game. */
function person(id: string, x: number, z: number, color: string): Prop {
  return { id, shape: 'cylinder', eras: NOW, pos: [x, standOn(0, PERSON[1]), z], size: PERSON, color, startsHidden: true };
}

/** A poster stuck on the inside of the shop window. */
function poster(id: string, x: number, color: string): Prop {
  return { id, shape: 'box', eras: NOW, pos: [x, WINDOW_Y + 0.2, mountOn(WINDOW_FRONT, 0.02)], size: [0.55, 0.8, 0.02], color, startsHidden: true };
}

const people = (prefix: string, spots: readonly (readonly [number, number])[]): Prop[] =>
  spots.map(([x, z], i) => person(`${prefix}_${i + 1}`, x, z, C.people[i % C.people.length] ?? C.frame));

export const PROPS_TODAY: readonly Prop[] = [
  // level 0: boarded up
  { id: 'boarded_window', shape: 'box', eras: NOW, pos: [-1.5, WINDOW_Y, mountOn(WALL_FRONT_Z, 0.1)], size: [3, 1.8, 0.1], color: C.boards },
  { id: 'rep_door_boards', shape: 'box', eras: NOW, pos: [2.5, standOn(0, 2), mountOn(DOOR_FRONT, 0.04)], size: [1.1, 2, 0.04], color: C.boards },
  // level 1: open
  { id: 'lit_window', shape: 'box', eras: NOW, pos: [-1.5, WINDOW_Y, mountOn(WALL_FRONT_Z, 0.1)], size: [3, 1.8, 0.1], color: C.litWindow, startsHidden: true },
  { id: 'open_sign', shape: 'box', eras: NOW, pos: [2.5, 1.6, mountOn(DOOR_FRONT, 0.05)], size: [0.9, 0.35, 0.05], color: C.openSign, startsHidden: true },
  person('rep_customer', -0.6, -4.1, C.customer),
  // level 2: busy
  { id: 'rep_posters', shape: 'box', eras: NOW, pos: [-3.5, 1.6, mountOn(WALL_FRONT_Z, 0.02)], size: [0.7, 1.0, 0.02], color: C.posters[0], startsHidden: true },
  poster('rep_window_poster_1', -2.4, C.posters[1]),
  poster('rep_window_poster_2', -0.6, C.posters[2]),
  ...people('rep_queue', [[3.45, -4.3], [4.0, -4.3], [4.55, -4.3], [4.55, -3.7]]),
  // level 3: landmark
  { id: 'rep_plaque', shape: 'box', eras: NOW, pos: [2.5, 2.65, mountOn(WALL_FRONT_Z, 0.04)], size: [0.5, 0.5, 0.04], color: C.plaque, startsHidden: true },
  { id: 'rep_neon', shape: 'box', eras: NOW, pos: [0, 3.4, mountOn(SIGN_FRONT, 0.04)], size: [3.4, 0.3, 0.04], color: C.neon, startsHidden: true },
  ...people('rep_crowd', [[-3.0, -3.5], [-0.3, -3.2], [0.5, -3.6], [1.4, -3.3], [3.6, -3.4]]),
  // a gold disc per fixed CD, framed by the door
  ...framedDisc('mira', 0.45),
  ...framedDisc('static', 0.98),
  ...framedDisc('kbit', 1.51),
];
