// layout.ts — the ONE layout of the location: a street corner outside a record shop.
// Each prop says which eras it exists in, and (for 2004) optionally which moments.
// Props are boxes or cylinders described by their centre and size (metres). Ground top is at y = 0.
// Props for each CD's moment live in src/world/props/<cd>.ts; today's shop in props/today.ts.
// The street's details (shop front, neighbours, kerb, car parts...) live in street.ts.

import { T, type Era } from '../tuning.ts';
import { BOTH, DOOR_DEPTH, NOW, PAST, WALL_FRONT_Z, mountOn, standOn } from './props/helpers.ts';
import { KBIT_PROPS } from './props/kbit.ts';
import { PROPS_MIRA } from './props/mira.ts';
import { PROPS_STATIC } from './props/static.ts';
import { PROPS_TODAY } from './props/today.ts';
import { CAR, SCOOTER, STREET_DETAIL } from './street.ts';

export type Shape = 'box' | 'cylinder';

export interface Prop {
  id: string;
  shape: Shape;
  eras: readonly Era[];
  moments?: readonly string[]; // 2004 only: the moments it appears in (missing = every 2004 moment)
  pos: readonly [number, number, number]; // centre
  size: readonly [number, number, number]; // width (x), height (y), depth (z); cylinder: diameter, height, diameter
  color: string | Readonly<Record<Era, string>>;
  interactable?: boolean; // gets a marker and highlight; must be used by a story action
  startsHidden?: boolean; // only appears when a story effect shows it
  decor?: boolean; // street decoration: drawn merged with other decor of its eras; the story never shows or hides it
  axis?: 'x' | 'z'; // cylinder only: lies along this axis instead of standing up (size stays width, height, depth)
  label?: string; // box only: text painted on its front (+Z) face
  // An image on the prop (anyone may use these in their props file):
  //   texture: a path under public/, e.g. 'textures/cover_mira.png' (relative, so any base path works);
  //            one path for every era, or one per era like `color` ({ '2004': '...' } = 2004 only).
  //   textureRepeat: [u, v] tiles the image u x v times across EVERY face (brick, pavement).
  //            Without it the image covers the FRONT face (+Z, towards the street) once, stretched
  //            to fit (covers, posters, windows), so match the face's shape to the image's.
  // The image is mixed with `color` (T.cel.textureMixFront / textureMixTiled), so pick an era colour
  // close to the image's. Not for `decor` props (they are merged into one mesh without textures).
  // The file must exist: tests/materials.test.ts fails for a missing one (the browser would log a
  // 404). If it still fails to load in the game, the prop just keeps its plain colour.
  texture?: string | Readonly<Partial<Record<Era, string>>>;
  textureRepeat?: readonly [number, number];
}

export const GROUND: Prop = {
  id: 'ground',
  shape: 'box',
  eras: BOTH,
  pos: [0, -T.world.groundThickness / 2, 0],
  size: [T.world.groundWidth, T.world.groundThickness, T.world.groundDepth],
  color: T.street.pavement,
  texture: 'textures/pavement.png',
  textureRepeat: [8, 6], // 2 m paving tiles
};

const S = T.street;

/** The street itself: the same in every moment. */
const STREET: readonly Prop[] = [
  // --- shared: the same street in both eras ---
  { id: 'shop_wall', shape: 'box', eras: BOTH, pos: [0, standOn(0, 4), -5.5], size: [8, 4, 1], color: S.shopWall,
    texture: { '2004': 'textures/brick_2004.png' }, textureRepeat: [4, 2] }, // bare brick in 2004; painted over today
  { id: 'shop_sign', shape: 'box', eras: BOTH, pos: [0, 3.4, mountOn(WALL_FRONT_Z, 0.1)], size: [6.4, 0.66, 0.1], color: S.sign, label: S.signText },
  { id: 'shop_door', shape: 'box', eras: BOTH, pos: [2.5, standOn(0, 2.2), mountOn(WALL_FRONT_Z, DOOR_DEPTH)], size: [1.2, 2.2, DOOR_DEPTH], color: S.door },
  { id: 'left_building', shape: 'box', eras: BOTH, pos: [-6.5, standOn(0, 5), -4], size: [3, 5, 4], color: S.leftBuilding },
  { id: 'right_building', shape: 'box', eras: BOTH, pos: [6.5, standOn(0, 6), -4], size: [3, 6, 4], color: S.rightBuilding },
  { id: 'lamp_post', shape: 'cylinder', eras: BOTH, pos: [-3.5, standOn(0, 4), -3], size: [0.2, 4, 0.2], color: S.lamp },
  { id: 'bench', shape: 'box', eras: BOTH, pos: [-2, standOn(0, 0.5), 0], size: [2, 0.5, 0.6], color: S.bench },

  // --- 2004, every moment ---
  { id: 'window_display', shape: 'box', eras: PAST, pos: [-1.5, standOn(0, 1.8) + 0.5, mountOn(WALL_FRONT_Z, 0.1)], size: [3, 1.8, 0.1], color: '#c8963c', texture: 'textures/window_2004.png' },
  { id: 'crt_tv', shape: 'box', eras: PAST, pos: [-3.2, standOn(0, 0.5), -4.3], size: [0.6, 0.5, 0.5], color: '#3c3c3c' },
  { id: 'payphone', shape: 'box', eras: PAST, pos: [5, standOn(0, 1.8), -1], size: [0.6, 1.8, 0.4], color: S.payphone.body },
  { id: 'old_car', shape: 'box', eras: PAST, pos: [CAR.x, CAR.bottom + CAR.height / 2, CAR.z], size: [CAR.length, CAR.height, CAR.width], color: S.car.body },
  { id: 'noticeboard', shape: 'box', eras: PAST, pos: [3.6, standOn(0, 2), 0.5], size: [1.4, 2, 0.15], color: '#a87a4a', texture: 'textures/poster_open_mic.png' },

  // --- today, always ---
  { id: 'ev_charger', shape: 'box', eras: NOW, pos: [5, standOn(0, 1.6), -1], size: [0.5, 1.6, 0.4], color: S.charger.body },
  { id: 'planter', shape: 'box', eras: NOW, pos: [-2, standOn(0, 0.6), -4.3], size: [1.6, 0.6, 0.6], color: S.planter },
  { id: 'scooter', shape: 'box', eras: NOW, pos: [SCOOTER.x, SCOOTER.bottom + SCOOTER.height / 2, SCOOTER.z], size: [SCOOTER.length, SCOOTER.height, SCOOTER.width], color: S.scooter.body },

  // --- the details: shop front, neighbours, kerb and road, car parts... (street.ts) ---
  ...STREET_DETAIL,
];

/** Every prop in the game. */
export const PROPS: readonly Prop[] = [...STREET, ...PROPS_MIRA, ...PROPS_STATIC, ...KBIT_PROPS, ...PROPS_TODAY];

/** Colour of a prop in an era. */
export function propColor(prop: Prop, era: Era): string {
  return typeof prop.color === 'string' ? prop.color : prop.color[era];
}

/** The image a prop shows in an era (a path under public/), or null for none. */
export function propTexture(prop: Prop, era: Era): string | null {
  if (prop.texture === undefined) return null;
  return typeof prop.texture === 'string' ? prop.texture : prop.texture[era] ?? null;
}

/** True when a prop exists in this era and moment (ignoring story effects). */
export function inScene(p: Prop, era: Era, moment: string | null): boolean {
  if (!p.eras.includes(era)) return false;
  return !p.moments || (era === '2004' && moment !== null && p.moments.includes(moment));
}

/** Props visible in an era and moment, given story overrides. */
export function visibleProps(era: Era, moment: string | null, shown: ReadonlySet<string>, hidden: ReadonlySet<string>): Prop[] {
  return [GROUND, ...PROPS].filter((p) => {
    if (!inScene(p, era, moment) || hidden.has(p.id)) return false;
    return !p.startsHidden || shown.has(p.id);
  });
}
