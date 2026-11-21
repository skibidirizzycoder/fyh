// layout.ts — the ONE layout of the location: a street corner outside a record shop.
// Each prop says which eras it exists in. Props are boxes or cylinders
// described by their centre and size (metres). Ground top is at y = 0.
// Helpers below keep a gap between touching surfaces so nothing z-fights.

import { T, type Era } from '../tuning.ts';

export type Shape = 'box' | 'cylinder';

export interface Prop {
  id: string;
  shape: Shape;
  eras: readonly Era[];
  pos: readonly [number, number, number]; // centre
  size: readonly [number, number, number]; // width (x), height (y), depth (z); cylinder: diameter, height, diameter
  color: string | Readonly<Record<Era, string>>;
  interactable?: boolean; // gets a marker and highlight; must be used by a story action
  startsHidden?: boolean; // only appears when a story effect shows it
}

const GAP = T.world.surfaceGap;
const BOTH: readonly Era[] = ['2004', 'present'];
const PAST: readonly Era[] = ['2004'];
const NOW: readonly Era[] = ['present'];

const WALL_FRONT_Z = -5; // front face of the shop wall
const DOOR_DEPTH = 0.1;

/** Centre y for something of height h standing on top of a surface at height `top`. */
function standOn(top: number, h: number): number {
  return top + GAP + h / 2;
}

/** Centre z for something of depth d mounted on the front of a surface whose front is at z. */
function mountOn(frontZ: number, d: number): number {
  return frontZ + GAP + d / 2;
}

const benchTop = standOn(0, 0.5) + 0.25;
const postTop = standOn(0, 1.3) + 0.65;
const boardFront = 0.5 + 0.075;
const doorFront = mountOn(WALL_FRONT_Z, DOOR_DEPTH) + DOOR_DEPTH / 2;

export const GROUND: Prop = {
  id: 'ground',
  shape: 'box',
  eras: BOTH,
  pos: [0, -T.world.groundThickness / 2, 0],
  size: [T.world.groundWidth, T.world.groundThickness, T.world.groundDepth],
  color: { '2004': '#6b6259', present: '#55595e' },
};

export const PROPS: readonly Prop[] = [
  // --- shared: the same street in both eras ---
  { id: 'shop_wall', shape: 'box', eras: BOTH, pos: [0, standOn(0, 4), -5.5], size: [8, 4, 1], color: { '2004': '#7a4a3a', present: '#5d5f66' } },
  { id: 'shop_sign', shape: 'box', eras: BOTH, pos: [0, 3.4, mountOn(WALL_FRONT_Z, 0.1)], size: [4, 0.6, 0.1], color: { '2004': '#3a2a20', present: '#2b2d33' } },
  { id: 'shop_door', shape: 'box', eras: BOTH, pos: [2.5, standOn(0, 2.2), mountOn(WALL_FRONT_Z, DOOR_DEPTH)], size: [1.2, 2.2, DOOR_DEPTH], color: { '2004': '#4a3022', present: '#33363d' } },
  { id: 'left_building', shape: 'box', eras: BOTH, pos: [-6.5, standOn(0, 5), -4], size: [3, 5, 4], color: { '2004': '#8a6a50', present: '#7b8087' } },
  { id: 'right_building', shape: 'box', eras: BOTH, pos: [6.5, standOn(0, 6), -4], size: [3, 6, 4], color: { '2004': '#6e5a4a', present: '#8d939a' } },
  { id: 'lamp_post', shape: 'cylinder', eras: BOTH, pos: [-3.5, standOn(0, 4), -3], size: [0.2, 4, 0.2], color: '#2a2a2a' },
  { id: 'bench', shape: 'box', eras: BOTH, pos: [-2, standOn(0, 0.5), 0], size: [2, 0.5, 0.6], color: { '2004': '#6a4a2a', present: '#4a4f57' } },

  // --- 2004 only ---
  { id: 'window_display', shape: 'box', eras: PAST, pos: [-1.5, standOn(0, 1.8) + 0.5, mountOn(WALL_FRONT_Z, 0.1)], size: [3, 1.8, 0.1], color: '#c8963c' },
  { id: 'crt_tv', shape: 'box', eras: PAST, pos: [-3.2, standOn(0, 0.5), -4.3], size: [0.6, 0.5, 0.5], color: '#3c3c3c' },
  { id: 'payphone', shape: 'box', eras: PAST, pos: [5, standOn(0, 1.8), -1], size: [0.6, 1.8, 0.4], color: '#7a7f3a' },
  { id: 'old_car', shape: 'box', eras: PAST, pos: [5, standOn(0, 1.3), 3.5], size: [3.6, 1.3, 1.7], color: '#4a6b8a' },
  { id: 'cd', shape: 'box', eras: PAST, pos: [-2, standOn(benchTop, 0.03), 0], size: [0.3, 0.03, 0.3], color: '#d0d8e0', interactable: true },
  { id: 'listening_post', shape: 'box', eras: PAST, pos: [1.2, standOn(0, 1.3), -4.2], size: [0.6, 1.3, 0.6], color: '#8a3fb0', interactable: true },
  { id: 'owner_flyer_stack', shape: 'box', eras: PAST, pos: [1.2, standOn(postTop, 0.08), -4.2], size: [0.3, 0.08, 0.2], color: '#ff5fa2', startsHidden: true },
  { id: 'noticeboard', shape: 'box', eras: PAST, pos: [3.6, standOn(0, 2), 0.5], size: [1.4, 2, 0.15], color: '#a87a4a', interactable: true },
  { id: 'flyer', shape: 'box', eras: PAST, pos: [3.6, 1.3, mountOn(boardFront, 0.02)], size: [0.4, 0.55, 0.02], color: '#ff5fa2', startsHidden: true },

  // --- present only ---
  { id: 'boarded_window', shape: 'box', eras: NOW, pos: [-1.5, standOn(0, 1.8) + 0.5, mountOn(WALL_FRONT_Z, 0.1)], size: [3, 1.8, 0.1], color: '#7d6a50' },
  { id: 'lit_window', shape: 'box', eras: NOW, pos: [-1.5, standOn(0, 1.8) + 0.5, mountOn(WALL_FRONT_Z, 0.1)], size: [3, 1.8, 0.1], color: '#9fe0ff', startsHidden: true },
  { id: 'open_sign', shape: 'box', eras: NOW, pos: [2.5, 1.6, mountOn(doorFront, 0.05)], size: [0.9, 0.35, 0.05], color: '#ff3b6b', startsHidden: true },
  { id: 'ev_charger', shape: 'box', eras: NOW, pos: [5, standOn(0, 1.6), -1], size: [0.5, 1.6, 0.4], color: '#e8eef2' },
  { id: 'planter', shape: 'box', eras: NOW, pos: [-2, standOn(0, 0.6), -4.3], size: [1.6, 0.6, 0.6], color: '#3f7f5a' },
  { id: 'scooter', shape: 'box', eras: NOW, pos: [5, standOn(0, 1), 3.5], size: [1.4, 1, 0.4], color: '#2dd4bf' },
];

/** Colour of a prop in an era. */
export function propColor(prop: Prop, era: Era): string {
  return typeof prop.color === 'string' ? prop.color : prop.color[era];
}

/** Props that exist in an era and are visible given story overrides. */
export function visibleProps(era: Era, shown: ReadonlySet<string>, hidden: ReadonlySet<string>): Prop[] {
  return [GROUND, ...PROPS].filter((p) => {
    if (!p.eras.includes(era) || hidden.has(p.id)) return false;
    return !p.startsHidden || shown.has(p.id);
  });
}
