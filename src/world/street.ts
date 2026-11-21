// street.ts — the details that make the shared street look like a real high street: the shop
// front (frame, awning, fascia, door), the flat above it, the neighbours' shops, windows and roof
// lines, the kerb and the road, a lamp head, a bench back, and the parts of the 2004 car, payphone,
// TV and noticeboard and of today's charger, scooter and planter.
// Along the street (T.areas), from its start (bollards across the road, a corner building) past the
// shop: the bus stop (newsagent, pub, post box, a tree; DJ K-Bit's stop in 2004, a modern shelter
// today), then the square (town hall, clock tower, memorial, trees; The Static play there in 2004),
// and a terrace of shops across the road all the way.
// The moments' props are moved into their areas by areas.ts; everything here stays clear of them.
// Everything here is decoration (`decor: true`): build.ts merges it into one mesh per set of eras, the story
// never shows or hides it, and nothing here glows or gets a marker.
// Boxes are given by their corners ([x0, x1], [y0, y1], [z0, z1]). Touching faces keep a gap of at
// least T.world.surfaceGap, or one part sinks into the other (no z-fighting).
// The teammates' anchors stay where they were: payphone (5, -1), old_car (5, 3.5), bench (-2, 0),
// noticeboard (3.6, 0.5), lamp_post (-3.5, -3), the shop wall, door and window.

import { T, type Era } from '../tuning.ts';
import type { Prop } from './layout.ts';
import { BOARD_FRONT, BOTH, GAP, NOW, PAST, WALL_FRONT_Z, mountOn } from './props/helpers.ts';

type Span = readonly [number, number];
type Color = Prop['color'];

const S = T.street;

// --- shared measurements (layout.ts uses the car and scooter ones for old_car and scooter) ---
export const CAR = { x: 5, z: 3.5, length: 3.6, width: 1.7, bottom: 0.3, height: 0.7 } as const; // old_car is the lower body
export const SCOOTER = { x: 5, z: 3.5, length: 1.4, width: 0.4, bottom: 0.3, height: 0.32 } as const; // scooter is the deck

const GROUND_X: Span = [T.world.groundCenterX - T.world.groundWidth / 2, T.world.groundCenterX + T.world.groundWidth / 2]; // walkable
const STREET_X: Span = [-30, 56]; // road, kerbs and pavements run on past both ends of the walkable ground
const KERB_Z: Span = [2.34, 2.56]; // pavement behind the kerb (towards the shop), road in front
const ROAD_FAR = 8.4; // the road's far edge, under the far kerb...
const FAR_KERB_Z: Span = [8.3, 8.52];
const FAR_PAVEMENT: Span = [8.45, 12.4]; // ...and the pavement across the road (its top is under the kerb's)
const TERRACE_FRONT = 12; // the terrace across the road faces -Z; the camera never gets this far (5.65 + 4.5)
const BUS_FRONT = -2.7; // the bus stop's buildings are set back behind K-Bit's news box (z >= -2.43)
const BUS_BOX = { x: [11, 17], z: [2.85, 4.9] } as const; // the yellow box on the road at K-Bit's bus stop
const HALL = { x: [23.6, 32.4], top: 7.5 } as const; // the town hall: its front is the shop's (WALL_FRONT_Z)...
const TOWER = { x: [32.3, 35.1], front: -4.75, back: -7.8, top: 12.5 } as const; // ...the clock tower stands a little forward
const SIGN_ASPECT = S.signTexturePx[0] / S.signTexturePx[1]; // labels are painted on a canvas this shape

// The name boards of the town hall and the pub (layout.ts makes them labelled props, like the shop sign).
export const HALL_SIGN = { pos: [28, 6.45, mountOn(WALL_FRONT_Z, 0.1)], size: [4.4, 4.4 / SIGN_ASPECT, 0.1] } as const;
export const PUB_SIGN = { pos: [15.2, 2.78, mountOn(BUS_FRONT + 0.1, 0.1)], size: [3.2, 3.2 / SIGN_ASPECT, 0.1] } as const;
const KERB_TOP = 0.09; // under T.collide.stepHeight, so the player steps up onto the pavement
const ROAD_TOP = 0.035; // just above the ground, so wheels standing at y = GAP sink a little into it
const LINE_Y: Span = [ROAD_TOP + GAP, ROAD_TOP + GAP + 0.01]; // road paint

const WINDOW_X: Span = [-3, 0]; // the shop window: window_display (2004), boarded/lit_window (today)
const WINDOW_Y: Span = [0.52, 2.32];
const DOOR_X: Span = [1.9, 3.1]; // shop_door
const UPPER_FRONT = -5.14; // the flat above the shop is set back behind the shop front...
const UPPER_TOP = 6.6; // ...and is taller than both neighbours
const LEFT = { x: [-8, -5], top: 5.02, front: -2 } as const; // left_building
const RIGHT = { x: [5, 8], top: 6.02, front: -2 } as const; // right_building
const RIGHT_ROWS: readonly Span[] = [[3.2, 4.2], [4.6, 5.6]]; // its two floors of windows
const FAR_FRONT = -2.2; // buildings beyond the ground's ends
const LAMP = { x: -3.5, z: -3, top: 4.02 } as const; // lamp_post
const BENCH = { x: [-3, -1], top: 0.52, back: -0.3 } as const; // bench

/** Middle of a span. */
function mid(s: Span): number {
  return (s[0] + s[1]) / 2;
}

/** A span of `size` centred on `c`. */
function around(c: number, size: number): Span {
  return [c - size / 2, c + size / 2];
}

/** A decoration box filling the space between two corners. */
function slab(id: string, eras: readonly Era[], x: Span, y: Span, z: Span, color: Color): Prop {
  return { id, shape: 'box', eras, decor: true, pos: [mid(x), mid(y), mid(z)], size: [x[1] - x[0], y[1] - y[0], z[1] - z[0]], color };
}

/** A decoration cylinder filling a box: standing up, or lying along x or z (`axis`). */
function rod(id: string, eras: readonly Era[], x: Span, y: Span, z: Span, color: Color, axis?: 'x' | 'z'): Prop {
  return { ...slab(id, eras, x, y, z, color), shape: 'cylinder', ...(axis ? { axis } : {}) };
}

/** The span from `a` to `b` metres out from a wall whose front is at `front`, facing +Z (dir 1) or -Z (dir -1). */
function out(front: number, a: number, b: number, dir: 1 | -1 = 1): Span {
  return dir > 0 ? [front + a, front + b] : [front - b, front - a];
}

/** A sash window on a wall facing +Z or -Z (front face at `front`): frame, dark glass, meeting rail, sill, lintel. */
function sashWindow(id: string, x: number, y: Span, front: number, width: number, dir: 1 | -1 = 1): Prop[] {
  const w = width / 2;
  const railY = mid(y);
  return [
    slab(`${id}_frame`, BOTH, [x - w, x + w], y, out(front, GAP, 0.07, dir), S.windowFrame),
    slab(`${id}_glass`, BOTH, [x - w + 0.1, x + w - 0.1], [y[0] + 0.1, y[1] - 0.1], out(front, 0.09, 0.12, dir), S.glass),
    slab(`${id}_rail`, BOTH, [x - w + 0.08, x + w - 0.08], [railY - 0.03, railY + 0.03], out(front, 0.14, 0.16, dir), S.windowFrame),
    slab(`${id}_sill`, BOTH, [x - w - 0.08, x + w + 0.08], [y[0] - 0.12, y[0] - GAP], out(front, -0.06, 0.14, dir), S.stone),
    slab(`${id}_lintel`, BOTH, [x - w - 0.05, x + w + 0.05], [y[1] + GAP, y[1] + 0.14], out(front, -0.06, 0.08, dir), S.stone),
  ];
}

/** Sash windows in rows (`rows`) and columns (`columns`, their centres) on one wall. */
function windowGrid(id: string, rows: readonly Span[], columns: readonly number[], front: number, dir: 1 | -1 = 1): Prop[] {
  return rows.flatMap((y, r) => columns.flatMap((x, c) => sashWindow(`${id}_window_${r + 1}_${c + 1}`, x, y, front, 0.9, dir)));
}

/** The i-th entry of a palette, going round. */
function pick(palette: readonly Color[], i: number): Color {
  return palette[i % palette.length] ?? S.stone;
}

/** A chimney stack with two pots, standing on a roof whose top is at `roof`. */
function chimney(id: string, x: Span, roof: number, z: Span): Prop[] {
  const top = roof + 1;
  return [
    slab(id, BOTH, x, [roof - 0.07, top], z, S.chimney), // sunk a little into the roof
    ...[0.3, 0.7].map((f, i) => rod(`${id}_pot_${i + 1}`, BOTH, around(x[0] + f * (x[1] - x[0]), 0.16), [top + GAP, top + 0.3], around(mid(z), 0.16), S.chimneyPot)),
  ];
}

/** The road, both kerbs, road paint, the pavement across the road, and this side's pavement past the ground's ends. */
function road(): Prop[] {
  const first = Math.ceil((STREET_X[0] + 0.6) / 2.4);
  const dashes = Array.from({ length: Math.floor((STREET_X[1] - 0.6) / 2.4) - first + 1 }, (_, i) => (first + i) * 2.4);
  const kerbX: Span = [STREET_X[0] + 0.1, STREET_X[1] - 0.1]; // kerbs and pavements stop short of the road's ends,
  const pavementX: Span = [STREET_X[0] + 0.2, STREET_X[1] - 0.2]; // so their end faces never meet
  return [
    slab('street_road', BOTH, STREET_X, [-0.08, ROAD_TOP], [mid(KERB_Z), ROAD_FAR], S.road),
    slab('street_kerb', BOTH, kerbX, [-0.05, KERB_TOP], KERB_Z, S.kerb),
    slab('street_kerb_far', BOTH, kerbX, [-0.05, KERB_TOP], FAR_KERB_Z, S.kerb),
    slab('street_pavement_far', BOTH, pavementX, [-0.2, KERB_TOP - 0.03], FAR_PAVEMENT, S.pavement),
    slab('street_pavement_left', BOTH, [pavementX[0], GROUND_X[0] + 0.15], [-0.2, -0.015], [-6.5, 2.5], S.pavement),
    slab('street_pavement_right', BOTH, [GROUND_X[1] - 0.15, pavementX[1]], [-0.2, -0.015], [-6.5, 2.5], S.pavement),
    ...bollards(),
    ...yellowLines(),
    ...busBox(),
    ...dashes.map((x, i) => slab(`street_dash_${i + 1}`, BOTH, around(x, 1.2), LINE_Y, [5.25, 5.37], S.roadLine)),
  ];
}

/** Bollards across the street where it starts (just past the walkable ground's end): the high street begins here. */
function bollards(): Prop[] {
  const x = around(GROUND_X[0] - 0.3, 0.2);
  return Array.from({ length: 8 }, (_, i) => -1.9 + i * 1.4).flatMap((z, i) => [
    rod(`bollard_${i + 1}`, BOTH, x, [-0.03, 0.9], around(z, 0.2), S.lamp),
    rod(`bollard_${i + 1}_band`, BOTH, around(mid(x), 0.22), [0.7, 0.78], around(z, 0.22), S.stone),
  ]);
}

/** Double yellow lines along the kerb, broken by the bus stop's box. */
function yellowLines(): Prop[] {
  const runs: Span[] = [[STREET_X[0], BUS_BOX.x[0] - 0.3], [BUS_BOX.x[1] + 0.3, STREET_X[1]]];
  const lines: Span[] = [[2.6, 2.65], [2.71, 2.76]];
  return runs.flatMap((x, r) => lines.map((z, i) => slab(`street_yellow_${r + 1}_${i + 1}`, BOTH, x, LINE_Y, z, S.yellowLine)));
}

/** The yellow box painted on the road where the bus pulls in (its corners stay open, so no two strips overlap). */
function busBox(): Prop[] {
  const [x0, x1] = BUS_BOX.x;
  const [z0, z1] = BUS_BOX.z;
  return [
    slab('bus_box_back', BOTH, BUS_BOX.x, LINE_Y, [z0, z0 + 0.1], S.busBox),
    slab('bus_box_front', BOTH, BUS_BOX.x, LINE_Y, [z1 - 0.1, z1], S.busBox),
    slab('bus_box_end_l', BOTH, [x0, x0 + 0.1], LINE_Y, [z0 + 0.12, z1 - 0.12], S.busBox),
    slab('bus_box_end_r', BOTH, [x1 - 0.1, x1], LINE_Y, [z0 + 0.12, z1 - 0.12], S.busBox),
  ];
}

/** The shop front: pilasters and consoles, fascia and cornice, window frame and awning, door frame. */
function shopFront(): Prop[] {
  const W = WALL_FRONT_Z;
  const [WX, WY] = [WINDOW_X, WINDOW_Y];
  const stripes = Array.from({ length: 11 }, (_, i) => mid(WINDOW_X) + (i - 5) * 0.32);
  return [
    // Pilasters up each side, with a plinth at the foot and a console under the cornice.
    ...[-1, 1].flatMap((side) => [
      slab(`shop_pilaster_${side < 0 ? 'l' : 'r'}`, BOTH, side < 0 ? [-4.05, -3.89] : [3.89, 4.05], [-0.05, 2.98], [W - 0.08, W + 0.16], S.woodwork),
      slab(`shop_plinth_${side < 0 ? 'l' : 'r'}`, BOTH, side < 0 ? [-4.08, -3.86] : [3.86, 4.08], [-0.07, 0.3], [W - 0.1, W + 0.2], S.woodwork),
      slab(`shop_console_${side < 0 ? 'l' : 'r'}`, BOTH, side < 0 ? [-4.08, -3.86] : [3.86, 4.08], [3.0, 3.92], [W - 0.12, W + 0.2], S.woodwork),
    ]),
    // The fascia board behind the shop's name, and the cornice on top.
    slab('shop_fascia', BOTH, [-3.95, 3.95], [2.94, 3.84], [W - 0.1, W + 0.08], S.woodwork),
    slab('shop_cornice', BOTH, [-4.1, 4.1], [3.86, 4.08], [W - 0.2, W + 0.22], S.woodwork),
    // The window frame: jambs just outside the window's edges and a sill. No head: Mira's string lights
    // hang just above the window, and the awning frames the top.
    slab('shop_jamb_l', BOTH, [WX[0] - 0.14, WX[0] - GAP], [WY[0] - 0.1, WY[1] + GAP], [W - 0.06, W + 0.16], S.woodwork),
    slab('shop_jamb_r', BOTH, [WX[1] + GAP, WX[1] + 0.16], [WY[0] - 0.1, WY[1] + GAP], [W - 0.06, W + 0.16], S.woodwork),
    slab('shop_sill', BOTH, [WX[0] - 0.25, WX[1] + 0.25], [WY[0] - 0.2, WY[0] - 0.06], [W - 0.1, W + 0.26], S.woodwork),
    slab('shop_stallriser', BOTH, [WX[0] - 0.12, WX[1] + 0.12], [-0.05, WY[0] - 0.22], [W - 0.06, W + 0.1], S.stallriser),
    // A striped awning over the window: two sloping steps, a front valance and its stripes.
    slab('shop_awning_back', BOTH, [-3.35, 0.35], [2.86, 2.92], [W - 0.06, W + 0.6], S.awning),
    slab('shop_awning_front', BOTH, [-3.35, 0.35], [2.78, 2.84], [W + 0.58, W + 1.14], S.awning),
    slab('shop_valance', BOTH, [-3.37, 0.37], [2.62, 2.8], [W + 1.12, W + 1.16], S.awning),
    ...stripes.map((x, i) => slab(`shop_stripe_${i + 1}`, BOTH, around(x, 0.16), [2.64, 2.78], [W + 1.18, W + 1.19], S.awningStripe)),
    // The door frame (narrow, clear of today's gold-disc frames at x < 1.74), and in 2004 a brass
    // knob and letterbox (today the door is boarded up, then a plain modern door).
    slab('shop_door_jamb_l', BOTH, [DOOR_X[0] - 0.12, DOOR_X[0] - 0.04], [-0.05, 2.3], [W - 0.06, W + 0.16], S.woodwork),
    slab('shop_door_jamb_r', BOTH, [DOOR_X[1] + 0.04, DOOR_X[1] + 0.12], [-0.05, 2.3], [W - 0.06, W + 0.16], S.woodwork),
    slab('shop_door_head', BOTH, [DOOR_X[0] - 0.14, DOOR_X[1] + 0.14], [2.28, 2.38], [W - 0.08, W + 0.18], S.woodwork),
    slab('shop_door_knob', PAST, [2.02, 2.1], [1.0, 1.08], [W + 0.14, W + 0.18], S.brass),
    slab('shop_letterbox', PAST, [2.3, 2.7], [0.84, 0.9], [W + 0.14, W + 0.155], S.brass),
  ];
}

/** The flat above the shop: brick, three sash windows, a parapet and a chimney. */
function shopUpper(): Prop[] {
  return [
    slab('shop_upper', BOTH, [-3.9, 3.9], [3.9, UPPER_TOP], [-5.95, UPPER_FRONT], S.upperWall),
    ...[-2.6, 0, 2.6].flatMap((x, i) => sashWindow(`shop_upper_window_${i + 1}`, x, [4.4, 5.8], UPPER_FRONT, 1)),
    slab('shop_parapet', BOTH, [-4, 4], [6.5, 6.75], [-6.05, -5], S.stone),
    ...chimney('shop_chimney', [2.3, 2.9], UPPER_TOP, [-5.8, -5.3]),
  ];
}

/** Low garden walls at the back of the gaps between the shop and its neighbours (the sky shows above them). */
function alleys(): Prop[] {
  return [
    slab('alley_wall_l', BOTH, [-5.1, -3.95], [-0.05, 0.8], [-5.9, -5.7], S.alleyWall),
    slab('alley_wall_r', BOTH, [3.95, 5.1], [-0.05, 0.8], [-5.9, -5.7], S.alleyWall),
  ];
}

/** The left neighbour: open in 2004 (window and door), shuttered today; windows and a roof line above. */
function leftNeighbour(): Prop[] {
  const f = LEFT.front;
  return [
    slab('left_fascia', BOTH, [-7.85, -5.15], [2.55, 3.0], [f - 0.06, f + 0.14], S.leftShop),
    slab('left_shop_glass', PAST, [-7.6, -6.0], [0.55, 2.35], [f + GAP, f + 0.06], S.glass),
    slab('left_shop_riser', PAST, [-7.6, -6.0], [-0.05, 0.5], [f + GAP, f + 0.08], S.leftShop),
    slab('left_shop_door', PAST, [-5.8, -5.25], [-0.05, 2.2], [f + GAP, f + 0.08], S.leftShop),
    slab('left_shutter', NOW, [-7.7, -5.2], [-0.05, 2.45], [f + GAP, f + 0.07], S.shutter),
    ...[-7.2, -5.8].flatMap((x, i) => sashWindow(`left_window_${i + 1}`, x, [3.3, 4.4], f, 0.9)),
    slab('left_cornice', BOTH, [LEFT.x[0] - 0.1, LEFT.x[1] + 0.1], [LEFT.top - 0.12, LEFT.top + 0.1], [-6.05, f + 0.15], S.stone),
    ...chimney('left_chimney', [-7.5, -6.9], LEFT.top, [-5.2, -4.6]),
  ];
}

/** The right neighbour: a shop with a door, a big window and a fascia; two floors of windows above. */
function rightNeighbour(): Prop[] {
  const f = RIGHT.front;
  return [
    slab('right_fascia', BOTH, [5.15, 7.85], [2.5, 2.95], [f - 0.06, f + 0.14], S.rightShop),
    slab('right_shop_door', BOTH, [5.25, 5.85], [-0.05, 2.2], [f + GAP, f + 0.08], S.rightShop),
    slab('right_shop_glass', BOTH, [6.05, 7.7], [0.55, 2.3], [f + GAP, f + 0.06], S.glass),
    slab('right_shop_riser', BOTH, [6.05, 7.7], [-0.05, 0.47], [f + GAP, f + 0.08], S.rightShop),
    ...RIGHT_ROWS.flatMap((y, row) => [5.8, 7.2].flatMap((x, i) => sashWindow(`right_window_${row + 1}_${i + 1}`, x, y, f, 0.9))),
    slab('right_cornice', BOTH, [RIGHT.x[0] - 0.1, RIGHT.x[1] + 0.1], [RIGHT.top - 0.12, RIGHT.top + 0.12], [-6.05, f + 0.15], S.stone),
    ...chimney('right_chimney', [6.9, 7.5], RIGHT.top, [-5.2, -4.6]),
  ];
}

/** A building beyond the edge of the walkable ground, so the street carries on out of sight. */
function farBuilding(id: string, x: Span, top: number, color: Color, rows: readonly Span[], columns: readonly number[]): Prop[] {
  const f = FAR_FRONT;
  const inner: Span = [x[0] + 0.6, x[1] - 0.6];
  return [
    slab(id, BOTH, x, [-0.12, top], [-6.2, f], color),
    slab(`${id}_glass`, BOTH, inner, [0.55, 2.35], [f + GAP, f + 0.06], S.glass),
    slab(`${id}_fascia`, BOTH, [inner[0] - 0.3, inner[1] + 0.3], [2.55, 3.0], [f - 0.06, f + 0.14], S.farShop),
    ...rows.flatMap((y, row) => columns.flatMap((cx, i) => sashWindow(`${id}_window_${row + 1}_${i + 1}`, cx, y, f, 0.9))),
    slab(`${id}_cornice`, BOTH, [x[0] - 0.1, x[1] + 0.1], [top - 0.12, top + 0.12], [-6.3, f + 0.15], S.stone),
  ];
}

/** The lamp post's base, arm, lamp head and finial. */
function lamp(): Prop[] {
  return [
    rod('lamp_base', BOTH, around(LAMP.x, 0.34), [-0.05, 0.55], around(LAMP.z, 0.34), S.lamp),
    rod('lamp_arm', BOTH, around(LAMP.x, 0.08), [3.82, 3.9], [LAMP.z, LAMP.z + 0.75], S.lamp, 'z'),
    slab('lamp_head', BOTH, around(LAMP.x, 0.32), [3.66, 3.86], [LAMP.z + 0.5, LAMP.z + 0.9], S.lamp),
    slab('lamp_glass', BOTH, around(LAMP.x, 0.2), [3.56, 3.64], [LAMP.z + 0.55, LAMP.z + 0.85], S.lampGlass),
    rod('lamp_finial', BOTH, around(LAMP.x, 0.12), [LAMP.top + GAP, LAMP.top + 0.18], around(LAMP.z, 0.12), S.lamp),
  ];
}

/** A backrest a little behind the bench, on two thin supports. It stays out of the bench's own spot
 *  (the player's radius around its centre), so the bench alone decides where you can stand. */
function benchBack(): Prop[] {
  const b = BENCH.back;
  return [
    slab('bench_back', BOTH, [BENCH.x[0] + 0.05, BENCH.x[1] - 0.05], [BENCH.top + 0.12, BENCH.top + 0.48], [b - 0.14, b - 0.06], S.bench),
    ...[BENCH.x[0] + 0.19, BENCH.x[1] - 0.19].map((x, i) =>
      slab(`bench_support_${i + 1}`, BOTH, around(x, 0.08), [BENCH.top - 0.04, BENCH.top + 0.16], [b - 0.11, b + GAP], S.bench)),
  ];
}

/** The 2004 car: wheels under the body (old_car), a cabin with windows, bumpers and lights. */
function car(): Prop[] {
  const C = S.car;
  const x0 = CAR.x - CAR.length / 2;
  const x1 = CAR.x + CAR.length / 2;
  const z0 = CAR.z - CAR.width / 2;
  const z1 = CAR.z + CAR.width / 2;
  const top = CAR.bottom + CAR.height;
  const sides: Span[] = [[z0 - GAP, z0 + 0.25], [z1 - 0.25, z1 + GAP]]; // tyres stand just proud of the body's sides
  const lights: Span[] = [[z0 + 0.13, z0 + 0.37], [z1 - 0.37, z1 - 0.13]];
  return [
    ...[x0 + 0.75, x1 - 0.75].flatMap((x, i) => sides.map((z, j) => rod(`car_wheel_${i * 2 + j + 1}`, PAST, around(x, 0.62), [GAP, GAP + 0.62], z, C.tyre, 'z'))),
    slab('car_cabin', PAST, [x0 + 0.55, x1 - 0.95], [top - 0.05, top + 0.52], [z0 + 0.15, z1 - 0.15], C.body),
    slab('car_glass', PAST, [x0 + 0.52, x1 - 0.92], [top + 0.06, top + 0.42], [z0 + 0.13, z1 - 0.13], C.glass),
    slab('car_pillar', PAST, [x0 + 1.55, x0 + 1.67], [top + 0.04, top + 0.44], [z0 + 0.11, z1 - 0.11], C.body),
    slab('car_bumper_front', PAST, [x1 - 0.04, x1 + 0.1], [CAR.bottom + 0.02, CAR.bottom + 0.16], [z0 + 0.03, z1 - 0.03], C.chrome),
    slab('car_bumper_rear', PAST, [x0 - 0.1, x0 + 0.04], [CAR.bottom + 0.02, CAR.bottom + 0.16], [z0 + 0.03, z1 - 0.03], C.chrome),
    ...lights.map((z, i) => slab(`car_headlight_${i + 1}`, PAST, [x1 - 0.03, x1 + 0.04], [0.68, 0.82], z, C.headlight)),
    ...lights.map((z, i) => slab(`car_taillight_${i + 1}`, PAST, [x0 - 0.04, x0 + 0.03], [0.68, 0.82], z, C.taillight)),
  ];
}

/** The 2004 payphone's hood, keypad panel and handset (the payphone is 0.6 x 1.8 x 0.4 at (5, -1)). */
function payphone(): Prop[] {
  const P = S.payphone;
  return [
    slab('payphone_hood', PAST, [4.62, 5.38], [1.84, 1.94], [-1.28, -0.72], P.hood),
    slab('payphone_panel', PAST, [4.82, 5.18], [0.95, 1.55], [-0.8 + GAP, -0.75], P.panel),
    slab('payphone_handset', PAST, [5.3 + GAP, 5.38], [1.1, 1.45], [-1.05, -0.95], P.handset),
  ];
}

/** Today's EV charger: a cap, a glowing screen and the cable holster (the charger is 0.5 x 1.6 x 0.4 at (5, -1)). */
function charger(): Prop[] {
  const C = S.charger;
  return [
    slab('charger_cap', NOW, [4.7, 5.3], [1.64, 1.7], [-1.25, -0.75], C.holster),
    slab('charger_screen', NOW, [4.85, 5.15], [1.15, 1.42], [-0.8 + GAP, -0.76], C.screen),
    slab('charger_holster', NOW, [5.25 + GAP, 5.35], [0.75, 1.05], [-1.06, -0.94], C.holster),
  ];
}

/** Today's scooter: two wheels under the deck (scooter), a seat, the steering column and handlebar. */
function scooter(): Prop[] {
  const C = S.scooter;
  const top = SCOOTER.bottom + SCOOTER.height;
  const z = around(SCOOTER.z, 0.12);
  return [
    ...[SCOOTER.x - 0.4, SCOOTER.x + 0.4].map((x, i) => rod(`scooter_wheel_${i + 1}`, NOW, around(x, 0.5), [GAP, GAP + 0.5], z, C.tyre, 'z')),
    slab('scooter_seat', NOW, [SCOOTER.x - 0.5, SCOOTER.x + 0.1], [top + GAP, top + 0.14], around(SCOOTER.z, 0.28), C.seat),
    slab('scooter_column', NOW, [SCOOTER.x + 0.42, SCOOTER.x + 0.5], [0.5, 1.12], around(SCOOTER.z, 0.08), C.bar),
    slab('scooter_bar', NOW, [SCOOTER.x + 0.4, SCOOTER.x + 0.52], [1.1, 1.16], around(SCOOTER.z, 0.6), C.bar),
  ];
}

/** A clipped hedge in today's planter (the planter is 1.6 x 0.6 x 0.6 at (-2, -4.3), top at 0.62):
 *  three uneven blocks rooted inside it, each a little deeper or shallower than the next. */
function planterHedge(): Prop[] {
  const blocks: [Span, Span, Span][] = [
    [[-2.72, -2.18], [0.5, 0.98], [-4.5, -4.1]],
    [[-2.2, -1.78], [0.53, 1.08], [-4.52, -4.08]],
    [[-1.8, -1.28], [0.56, 0.94], [-4.48, -4.12]],
  ];
  return blocks.map(([x, y, z], i) => slab(`planter_hedge_${i + 1}`, NOW, x, y, z, S.plants));
}

/** The 2004 TV's screen, and papers and a little roof on the noticeboard (Mira's flyer spot, x 3.4..3.8, stays free). */
function pastBits(): Prop[] {
  const z: Span = [BOARD_FRONT + GAP, BOARD_FRONT + GAP + 0.015];
  const papers: [Span, Span][] = [[[3.0, 3.3], [1.3, 1.7]], [[3.9, 4.2], [1.2, 1.5]], [[3.92, 4.18], [1.62, 1.9]], [[3.05, 3.32], [0.75, 1.05]]];
  return [
    slab('tv_screen', PAST, [-3.42, -2.98], [0.1, 0.44], [-4.05 + GAP, -4.01], S.tvScreen),
    ...papers.map(([x, y], i) => slab(`notice_paper_${i + 1}`, PAST, x, y, z, S.notices[i % S.notices.length] ?? S.roadLine)),
    slab('notice_roof', PAST, [2.85, 4.35], [2.04, 2.12], [0.38, 0.66], S.lamp),
  ];
}

/** The square's back: a small corner building next to the right neighbour, and the town hall. */
function square(): Prop[] {
  const F = WALL_FRONT_Z; // The Static's socket is mounted on this wall at x 30.5..30.7, its cable runs out from it
  return [
    slab('square_corner', BOTH, [22.05, 23.7], [-0.14, 5.5], [-8.5, F - 0.1], S.farRight),
    ...sashWindow('square_corner_window', 22.85, [3.3, 4.4], F - 0.1, 0.8),
    slab('square_corner_cornice', BOTH, [22.08, 23.58], [5.38, 5.6], [-8.6, F - 0.05], S.stone),
    slab('hall', BOTH, HALL.x, [-0.12, HALL.top], [-9, F], S.hall),
    // The door under a pediment on two columns, behind The Static's stage.
    slab('hall_door', BOTH, [27.2, 28.8], [-0.05, 3.0], out(F, GAP, 0.08), S.hallDoor),
    slab('hall_column_l', BOTH, [26.92, 27.14], [-0.05, 3.3], out(F, -0.06, 0.24), S.stone),
    slab('hall_column_r', BOTH, [28.86, 29.08], [-0.05, 3.3], out(F, -0.06, 0.24), S.stone),
    slab('hall_door_pediment', BOTH, [26.82, 29.18], [3.32, 3.6], out(F, -0.08, 0.28), S.stone),
    // Tall windows either side of the door (clear of the socket), four above, the cornice and a pediment on the roof line.
    ...[25.1, 30.9].flatMap((x, i) => sashWindow(`hall_window_${i + 1}`, x, [1.0, 2.6], F, 1)),
    ...[24.6, 26.8, 29.2, 31.4].flatMap((x, i) => sashWindow(`hall_upper_window_${i + 1}`, x, [4.0, 5.6], F, 1)),
    slab('hall_cornice', BOTH, [HALL.x[0] - 0.1, HALL.x[1] + 0.1], [6.9, 7.15], [-9.1, F + 0.2], S.stone),
    slab('hall_pediment', BOTH, [26.2, 29.8], [7.17, 8.2], [-5.6, F + 0.1], S.hall),
    slab('hall_pediment_top', BOTH, [27.2, 28.8], [8.22, 8.7], [-5.5, F + 0.05], S.stone),
  ];
}

/** The centre of the clock face on the tower's front, for the hands in life.ts. */
export const CLOCK = { x: (TOWER.x[0] + TOWER.x[1]) / 2, y: 10.6, front: TOWER.front + 0.06 } as const;

/** The clock tower at the end of the square: a landmark you can see from the whole street. */
function clockTower(): Prop[] {
  const f = TOWER.front;
  const z = mid([TOWER.back, TOWER.front]);
  const TOWER_MID = mid(TOWER.x);
  const band = (id: string, y: Span): Prop => slab(id, BOTH, [TOWER.x[0] - 0.08, TOWER.x[1] + 0.08], y, [TOWER.back - 0.08, f + 0.08], S.stone);
  return [
    slab('clock_tower', BOTH, TOWER.x, [-0.16, TOWER.top], [TOWER.back, f], S.hall),
    slab('clock_tower_door', BOTH, [33.3, 34.1], [-0.05, 2.4], out(f, GAP, 0.08), S.hallDoor),
    band('clock_tower_band_1', [3.0, 3.2]),
    band('clock_tower_band_2', [7.6, 7.8]),
    ...[33.0, 34.4].map((x, i) => slab(`clock_tower_louvre_${i + 1}`, BOTH, around(x, 0.6), [8.2, 9.3], out(f, GAP, 0.05), S.hallDoor)),
    rod('clock_face', BOTH, around(TOWER_MID, 1.6), around(10.6, 1.6), out(f, GAP, 0.06), S.clockFace, 'z'),
    // The hands turn to each scene's time, so they live in life.ts (CLOCK), not here.
    // A stepped lead roof and a spire.
    slab('clock_tower_roof_1', BOTH, [TOWER.x[0] - 0.08, TOWER.x[1] + 0.08], [TOWER.top - 0.05, TOWER.top + 0.3], [TOWER.back - 0.08, f + 0.08], S.towerRoof),
    slab('clock_tower_roof_2', BOTH, around(TOWER_MID, 2.2), [TOWER.top + 0.32, TOWER.top + 0.9], around(z, 2.45), S.towerRoof),
    slab('clock_tower_roof_3', BOTH, around(TOWER_MID, 1.2), [TOWER.top + 0.92, TOWER.top + 1.6], around(z, 1.45), S.towerRoof),
    rod('clock_tower_spire', BOTH, around(TOWER_MID, 0.12), [TOWER.top + 1.62, TOWER.top + 2.9], around(z, 0.12), S.towerRoof),
  ];
}

/** A war memorial in the square: steps, a plinth with a wreath, a stone shaft. */
function memorial(): Prop[] {
  const [x, z] = [33.2, -1.4];
  return [
    slab('memorial_step', BOTH, around(x, 1.6), [-0.05, 0.3], around(z, 1.6), S.memorial),
    slab('memorial_plinth', BOTH, around(x, 0.9), [0.32, 1.3], around(z, 0.9), S.memorial),
    rod('memorial_wreath', BOTH, around(x, 0.4), around(0.85, 0.4), [z + 0.45 + GAP, z + 0.5], S.wreath, 'z'),
    slab('memorial_shaft', BOTH, around(x, 0.5), [1.32, 3.9], around(z, 0.5), S.memorial),
    slab('memorial_cap', BOTH, around(x, 0.64), [3.92, 4.1], around(z, 0.64), S.memorial),
  ];
}

const PUB_WINDOWS: readonly Span[] = [[12.85, 14.45], [15.95, 17.55]]; // either side of the pub's door

/** The bus stop's buildings, set back: a newsagent next to the right neighbour, the pub, a corner house. */
function busStopRow(): Prop[] {
  const F = BUS_FRONT;
  return [
    slab('newsagent', BOTH, [8.05, 12.4], [-0.12, 6.2], [-6.2, F], S.leftBuilding),
    slab('newsagent_glass', BOTH, [9.2, 11.7], [0.55, 2.35], out(F, GAP, 0.06), S.glass),
    slab('newsagent_riser', BOTH, [9.2, 11.7], [-0.05, 0.5], out(F, GAP, 0.08), S.newsagent),
    slab('newsagent_door', BOTH, [8.4, 8.95], [-0.05, 2.2], out(F, GAP, 0.08), S.newsagent),
    slab('newsagent_fascia', BOTH, [8.2, 12.25], [2.55, 3.0], out(F, -0.06, 0.14), S.newsagent),
    ...windowGrid('newsagent', [[3.5, 4.6]], [9.1, 11.4], F),
    slab('newsagent_cornice', BOTH, [8.05 + GAP, 12.4 - GAP], [6.08, 6.32], [-6.3, F + 0.15], S.stone),
    // The pub: a painted ground floor with its name board (layout.ts), two windows and a door; rooms above.
    slab('pub', BOTH, [12.45, 17.9], [-0.12, 7.4], [-6.4, F], S.pubWall),
    slab('pub_front', BOTH, [12.6, 17.75], [-0.05, 3.1], out(F, GAP, 0.1), S.pubFront),
    ...PUB_WINDOWS.map((x, i) => slab(`pub_window_${i + 1}`, BOTH, x, [0.8, 2.4], out(F, 0.12, 0.16), S.glass)),
    slab('pub_door', BOTH, [14.9, 15.5], [-0.05, 2.3], out(F, 0.12, 0.16), S.hallDoor),
    ...windowGrid('pub', [[3.6, 4.7], [5.3, 6.4]], [13.5, 15.2, 16.9], F),
    slab('pub_cornice', BOTH, [12.45 + GAP, 17.9 - GAP], [7.28, 7.52], [-6.5, F + 0.15], S.stone),
    ...chimney('pub_chimney', [16.0, 16.6], 7.4, [-5.6, -5.0]),
    // A corner house where the bus stop meets the square.
    slab('corner_house', BOTH, [17.95, 22.0], [-0.12, 5.6], [-6.2, F], S.farLeft),
    slab('corner_house_glass', BOTH, [18.6, 21.3], [0.55, 2.35], out(F, GAP, 0.06), S.glass),
    slab('corner_house_fascia', BOTH, [18.3, 21.6], [2.55, 3.0], out(F, -0.06, 0.14), S.farShop),
    ...windowGrid('corner_house', [[3.4, 4.5]], [19.0, 21.0], F),
    slab('corner_house_cornice', BOTH, [17.95 + GAP, 22.0 - GAP], [5.48, 5.72], [-6.3, F + 0.15], S.stone),
  ];
}

/** Where the street starts: a corner building past the left neighbour (the bollards are in road()). */
function startCorner(): Prop[] {
  const F = BUS_FRONT;
  return [
    slab('start_corner', BOTH, [-12.4, -8.05], [-0.12, 6.2], [-6.2, F], S.rightBuilding),
    slab('start_corner_glass', BOTH, [-11.7, -8.75], [0.55, 2.35], out(F, GAP, 0.06), S.glass),
    slab('start_corner_fascia', BOTH, [-12.0, -8.45], [2.55, 3.0], out(F, -0.06, 0.14), S.farShop),
    ...windowGrid('start_corner', [[3.5, 4.6]], [-11.2, -9.2], F),
    slab('start_corner_cornice', BOTH, [-12.4 + GAP, -8.05 - GAP], [6.08, 6.32], [-6.3, F + 0.15], S.stone),
  ];
}

/** Buildings across both far ends of the road, so the street closes off in the fog instead of in sky. */
function streetEnds(): Prop[] {
  const ends: [string, Span][] = [['street_end_left', [STREET_X[0] - 6, STREET_X[0] - 0.2]], ['street_end_right', [STREET_X[1] + 0.2, STREET_X[1] + 6]]];
  return ends.flatMap(([id, x]) => [
    slab(id, BOTH, x, [-0.25, 9], [-8, 18], S.farLeft),
    slab(`${id}_cornice`, BOTH, [x[0] - 0.1, x[1] + 0.1], [8.88, 9.12], [-8.1, 18.1], S.stone),
  ]);
}

/** Window centres every 1.6 m across a wall from x0 to x1, a metre in from each end. */
function columnsAcross(x0: number, x1: number): number[] {
  const n = Math.floor((x1 - x0 - 2) / 1.6) + 1;
  return Array.from({ length: n }, (_, i) => x0 + 1 + i * 1.6);
}

/** A red pillar box by the kerb at the bus stop. */
function postBox(): Prop[] {
  const [x, z] = [17.4, 1.7];
  return [
    rod('post_box', BOTH, around(x, 0.45), [-0.05, 1.25], around(z, 0.45), S.postBox),
    rod('post_box_cap', BOTH, around(x, 0.52), [1.27, 1.37], around(z, 0.52), S.postBox),
    slab('post_box_slot', BOTH, around(x, 0.24), [1.0, 1.05], [z + 0.225 - 0.01, z + 0.25], S.clockHands),
  ];
}

/** Today's bus shelter where K-Bit's 2004 stop stands (they never share a scene): glass, posts, roof, a bench, the stop's flag. */
function todayShelter(): Prop[] {
  const C = S.shelter;
  const back = -0.62;
  return [
    ...[11.6, 14.4].map((x, i) => rod(`shelter_post_${i + 1}`, NOW, around(x, 0.1), [-0.05, 2.3], around(back, 0.1), C.frame)),
    slab('shelter_glass', NOW, [11.68, 14.32], [0.15, 2.2], around(back, 0.04), C.glass),
    slab('shelter_roof', NOW, [11.4, 14.6], [2.32, 2.42], [-0.95, 0.55], C.roof),
    slab('shelter_bench', NOW, [12.4, 13.6], [0.45, 0.52], [back + 0.06, back + 0.36], C.frame),
    slab('shelter_bench_leg', NOW, around(13, 0.08), [-0.05, 0.43], around(back + 0.21, 0.08), C.frame),
    rod('bus_flag_pole', NOW, around(15, 0.08), [-0.05, 2.7], around(0.9, 0.08), C.frame),
    slab('bus_flag', NOW, [14.7, 15.3], [2.1, 2.6], [0.96, 1.0], C.flag),
  ];
}

/** A street tree: a trunk and three stacked blocks of leaves (all above head height, so you walk under them). */
function tree(id: string, x: number, z: number): Prop[] {
  return [
    rod(`${id}_trunk`, BOTH, around(x, 0.3), [-0.05, 2.6], around(z, 0.3), S.trunk),
    slab(`${id}_leaves_1`, BOTH, [x - 1.0, x + 1.0], [2.4, 3.8], [z - 0.9, z + 0.9], S.leaves),
    slab(`${id}_leaves_2`, BOTH, [x - 0.7, x + 0.8], [3.75, 4.8], [z - 0.65, z + 0.75], S.leaves),
    slab(`${id}_leaves_3`, BOTH, [x - 0.35, x + 0.4], [4.75, 5.4], [z - 0.3, z + 0.35], S.leaves),
  ];
}

/** A street lamp at the kerb: base, post, an arm over the road, the lamp head and a finial. */
function streetLamp(id: string, x: number, z: number): Prop[] {
  return [
    rod(`${id}_base`, BOTH, around(x, 0.3), [-0.05, 0.5], around(z, 0.3), S.lamp),
    rod(`${id}_post`, BOTH, around(x, 0.16), [0.48, 4.0], around(z, 0.16), S.lamp),
    rod(`${id}_arm`, BOTH, around(x, 0.08), [3.82, 3.9], [z, z + 0.75], S.lamp, 'z'),
    slab(`${id}_head`, BOTH, around(x, 0.32), [3.66, 3.86], [z + 0.5, z + 0.9], S.lamp),
    slab(`${id}_glass`, BOTH, around(x, 0.2), [3.56, 3.64], [z + 0.55, z + 0.85], S.lampGlass),
    rod(`${id}_finial`, BOTH, around(x, 0.12), [4.02, 4.18], around(z, 0.12), S.lamp),
  ];
}

// The terrace across the road: x span and roof height of each building (neighbours differ in height).
const TERRACE: readonly { x: Span; top: number }[] = [
  { x: [-30, -22.05], top: 6.5 }, { x: [-22, -15.05], top: 8.2 }, { x: [-15, -8.55], top: 6.0 },
  { x: [-8.5, -1.05], top: 7.0 }, { x: [-1, 6.45], top: 9.0 }, { x: [6.5, 13.45], top: 6.5 },
  { x: [13.5, 20.45], top: 7.6 }, { x: [20.5, 28.45], top: 5.8 }, { x: [28.5, 35.45], top: 7.0 },
  { x: [35.5, 42.45], top: 8.2 }, { x: [42.5, 49.45], top: 6.0 }, { x: [49.5, 56], top: 7.0 },
];
const TERRACE_ROWS: readonly Span[] = [[3.4, 4.5], [5.1, 6.2], [6.8, 7.9]]; // floors of windows, as many as fit

/** One building across the road, facing the shop (-Z): a shop window and fascia, floors of windows, a cornice. */
function terraceBuilding(i: number, x: Span, top: number): Prop[] {
  const f = TERRACE_FRONT;
  const id = `terrace_${i + 1}`;
  const inner: Span = [x[0] + 0.6, x[1] - 0.6];
  const n = Math.max(1, Math.floor((x[1] - x[0] - 1.2) / 1.6));
  const columns = Array.from({ length: n }, (_, c) => x[0] + ((x[1] - x[0]) * (c + 0.5)) / n);
  return [
    slab(id, BOTH, x, [-0.12, top], [f, f + 5], pick(S.terrace, i)),
    slab(`${id}_glass`, BOTH, inner, [0.55, 2.35], out(f, GAP, 0.06, -1), S.glass),
    slab(`${id}_fascia`, BOTH, [inner[0] - 0.3, inner[1] + 0.3], [2.55, 3.0], out(f, -0.06, 0.14, -1), pick(S.terraceShop, i)),
    ...windowGrid(id, TERRACE_ROWS.filter((y) => y[1] + 0.6 <= top), columns, f, -1),
    slab(`${id}_cornice`, BOTH, [x[0] - 0.1, x[1] + 0.1], [top - 0.12, top + 0.12], [f - 0.15, f + 5.1], S.stone),
  ];
}

/** The whole terrace across the road. */
function terrace(): Prop[] {
  return TERRACE.flatMap((b, i) => terraceBuilding(i, b.x, b.top));
}

/** Every street detail. */
export const STREET_DETAIL: readonly Prop[] = [
  ...road(),
  ...shopFront(),
  ...shopUpper(),
  ...alleys(),
  ...leftNeighbour(),
  ...rightNeighbour(),
  ...farBuilding('far_left', [-30, -12.45], 7, S.farLeft, [[3.6, 4.7], [5.3, 6.4]], columnsAcross(-30, -12.45)),
  ...farBuilding('far_right', [35.25, 56], 5.2, S.farRight, [[3.3, 4.4]], columnsAcross(35.25, 56)),
  ...startCorner(),
  ...streetEnds(),
  ...square(),
  ...clockTower(),
  ...memorial(),
  ...busStopRow(),
  ...postBox(),
  ...todayShelter(),
  ...tree('square_tree_1', 24.3, -3.6),
  ...tree('square_tree_2', 34.6, 1),
  ...tree('bus_tree', 19.8, -0.6),
  ...streetLamp('lamp_bus', 9.4, 1.9),
  ...streetLamp('lamp_square', 23.4, 1.9),
  ...terrace(),
  ...lamp(),
  ...benchBack(),
  ...car(),
  ...payphone(),
  ...charger(),
  ...scooter(),
  ...planterHedge(),
  ...pastBits(),
];
