// today.ts — the shop today, as its reputation grows. Owner: Claude.
// boarded window -> open (1 CD fixed) -> posters (2) -> blue plaque (3), plus one gold disc per fixed CD.
// Effects in content.json / content.ts show and hide these.

import type { Prop } from '../layout.ts';
import { DOOR_FRONT, NOW, WALL_FRONT_Z, mountOn, standOn } from './helpers.ts';

const WINDOW_Y = standOn(0, 1.8) + 0.5;
const GOLD = '#ffcc33';

/** A framed gold disc on the wall between the window and the door. */
function goldDisc(cd: string, x: number): Prop {
  return { id: `gold_${cd}`, shape: 'box', eras: NOW, pos: [x, 2.3, mountOn(WALL_FRONT_Z, 0.04)], size: [0.4, 0.4, 0.04], color: GOLD, startsHidden: true };
}

export const PROPS_TODAY: readonly Prop[] = [
  { id: 'boarded_window', shape: 'box', eras: NOW, pos: [-1.5, WINDOW_Y, mountOn(WALL_FRONT_Z, 0.1)], size: [3, 1.8, 0.1], color: '#7d6a50' },
  { id: 'lit_window', shape: 'box', eras: NOW, pos: [-1.5, WINDOW_Y, mountOn(WALL_FRONT_Z, 0.1)], size: [3, 1.8, 0.1], color: '#9fe0ff', startsHidden: true },
  { id: 'open_sign', shape: 'box', eras: NOW, pos: [2.5, 1.6, mountOn(DOOR_FRONT, 0.05)], size: [0.9, 0.35, 0.05], color: '#ff3b6b', startsHidden: true },
  { id: 'rep_posters', shape: 'box', eras: NOW, pos: [-3.5, 1.6, mountOn(WALL_FRONT_Z, 0.02)], size: [0.7, 1.0, 0.02], color: '#ff9f1c', startsHidden: true },
  { id: 'rep_plaque', shape: 'box', eras: NOW, pos: [2.5, 2.65, mountOn(WALL_FRONT_Z, 0.04)], size: [0.5, 0.5, 0.04], color: '#2f6fdb', startsHidden: true },
  goldDisc('mira', 0.45),
  goldDisc('static', 0.95),
  goldDisc('kbit', 1.45),
];
