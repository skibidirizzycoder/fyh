// areas.ts — the high street's three areas (the bus stop, the shop, the square) and where each
// 2004 moment happens. Teammates lay out a moment's props around the shop (x near 0) in their own
// files; placed() moves them along the street into their moment's area. Everything that needs a
// prop's position in the world (drawing, collisions, paths, targets, the z-fight test) gets props
// through visibleProps() or placed(), so the raw data in PROPS never changes.

import { T } from '../tuning.ts';
import type { Prop } from './layout.ts';

export type Area = (typeof T.areas.list)[number];

const BY_MOMENT: Readonly<Record<string, string>> = T.areas.moments;

/** The area with this id (unknown ids get the home area, the shop). */
export function areaById(id: string): Area {
  return T.areas.list.find((a) => a.id === id) ?? home();
}

/** The area where every visit starts. */
function home(): Area {
  const found = T.areas.list.find((a) => a.id === T.areas.home);
  if (!found) throw new Error(`T.areas.home "${T.areas.home}" is not in T.areas.list`);
  return found;
}

/** The area a 2004 moment happens in (moments not listed in T.areas.moments happen at the shop). */
export function areaOfMoment(moment: string): Area {
  return areaById(BY_MOMENT[moment] ?? T.areas.home);
}

/** How far along x a prop is moved: its moment's area's shift, or 0 for street and today props. */
export function shiftOf(prop: Prop): number {
  const moment = prop.moments?.[0];
  return moment === undefined ? 0 : areaOfMoment(moment).shiftX;
}

/** A prop's centre in the world: its raw centre, moved into its moment's area. */
export function placedPos(prop: Prop): readonly [number, number, number] {
  const [x, y, z] = prop.pos;
  return [x + shiftOf(prop), y, z];
}

/** The prop as it stands in the world (the same object when it does not move). */
export function placed(prop: Prop): Prop {
  return shiftOf(prop) === 0 ? prop : { ...prop, pos: placedPos(prop) };
}

/**
 * The area the player is in at `x`. Between two areas' spans the player stays in `current`, so
 * walking along a boundary does not flicker between titles. With no current area, the nearest one.
 */
export function areaAt(x: number, current: string | null): Area {
  const inside = T.areas.list.find((a) => x >= a.x[0] && x <= a.x[1]);
  if (inside) return inside;
  if (current !== null) return areaById(current);
  const gap = (a: Area): number => Math.min(Math.abs(x - a.x[0]), Math.abs(x - a.x[1]));
  return T.areas.list.reduce((best, a) => (gap(a) < gap(best) ? a : best));
}
