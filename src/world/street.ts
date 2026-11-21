// street.ts — the details that make the shared street look like a real high street: the shop
// front (frame, awning, fascia, door), the flat above it, the neighbours' shops, windows and roof
// lines, the kerb and the road, a lamp head, a bench back, and the parts of the 2004 car, payphone,
// TV and noticeboard and of today's charger, scooter and planter.
// Everything here is decoration (`decor: true`): build.ts merges it into one mesh per set of eras, the story
// never shows or hides it, and nothing here glows or gets a marker.
// Boxes are given by their corners ([x0, x1], [y0, y1], [z0, z1]). Touching faces keep a gap of at
// least T.world.surfaceGap, or one part sinks into the other (no z-fighting).
// The teammates' anchors stay where they were: payphone (5, -1), old_car (5, 3.5), bench (-2, 0),
// noticeboard (3.6, 0.5), lamp_post (-3.5, -3), the shop wall, door and window.

import { T, type Era } from '../tuning.ts';
import type { Prop } from './layout.ts';
import { BOARD_FRONT, BOTH, GAP, NOW, PAST, WALL_FRONT_Z } from './props/helpers.ts';

type Span = readonly [number, number];
type Color = Prop['color'];

const S = T.street;

// --- shared measurements (layout.ts uses the car and scooter ones for old_car and scooter) ---
export const CAR = { x: 5, z: 3.5, length: 3.6, width: 1.7, bottom: 0.3, height: 0.7 } as const; // old_car is the lower body
export const SCOOTER = { x: 5, z: 3.5, length: 1.4, width: 0.4, bottom: 0.3, height: 0.32 } as const; // scooter is the deck

const STREET_X: Span = [-14.5, 14.5]; // road and kerb run on past both ends of the walkable ground
const KERB_Z: Span = [2.34, 2.56]; // pavement behind the kerb (towards the shop), road in front
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
const FAR_FRONT = -2.2; // buildings beyond the ground's edges, set back a little
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

/** A sash window on a wall facing +Z (front face at `front`): frame, dark glass, meeting rail, sill, lintel. */
function sashWindow(id: string, x: number, y: Span, front: number, width: number): Prop[] {
  const w = width / 2;
  const railY = mid(y);
  return [
    slab(`${id}_frame`, BOTH, [x - w, x + w], y, [front + GAP, front + 0.07], S.windowFrame),
    slab(`${id}_glass`, BOTH, [x - w + 0.1, x + w - 0.1], [y[0] + 0.1, y[1] - 0.1], [front + 0.09, front + 0.12], S.glass),
    slab(`${id}_rail`, BOTH, [x - w + 0.08, x + w - 0.08], [railY - 0.03, railY + 0.03], [front + 0.14, front + 0.16], S.windowFrame),
    slab(`${id}_sill`, BOTH, [x - w - 0.08, x + w + 0.08], [y[0] - 0.12, y[0] - GAP], [front - 0.06, front + 0.14], S.stone),
    slab(`${id}_lintel`, BOTH, [x - w - 0.05, x + w + 0.05], [y[1] + GAP, y[1] + 0.14], [front - 0.06, front + 0.08], S.stone),
  ];
}

/** A chimney stack with two pots, standing on a roof whose top is at `roof`. */
function chimney(id: string, x: Span, roof: number, z: Span): Prop[] {
  const top = roof + 1;
  return [
    slab(id, BOTH, x, [roof - 0.07, top], z, S.chimney), // sunk a little into the roof
    ...[0.3, 0.7].map((f, i) => rod(`${id}_pot_${i + 1}`, BOTH, around(x[0] + f * (x[1] - x[0]), 0.16), [top + GAP, top + 0.3], around(mid(z), 0.16), S.chimneyPot)),
  ];
}

/** The road, the kerb, road paint, and the pavement carried on past the ground's ends. */
function road(): Prop[] {
  const dashes = Array.from({ length: 13 }, (_, i) => (i - 6) * 2.4);
  return [
    slab('street_road', BOTH, STREET_X, [-0.08, ROAD_TOP], [mid(KERB_Z), 8], S.road),
    // The kerb and pavement stop a little short of the road's ends, so their end faces never meet.
    slab('street_kerb', BOTH, [STREET_X[0] + 0.1, STREET_X[1] - 0.1], [-0.05, 0.13], KERB_Z, S.kerb),
    slab('street_pavement_left', BOTH, [STREET_X[0] + 0.2, -7.85], [-0.2, -0.015], [-6.5, 2.5], S.pavement),
    slab('street_pavement_right', BOTH, [7.85, STREET_X[1] - 0.2], [-0.2, -0.015], [-6.5, 2.5], S.pavement),
    slab('street_yellow_1', BOTH, STREET_X, LINE_Y, [2.6, 2.65], S.yellowLine),
    slab('street_yellow_2', BOTH, STREET_X, LINE_Y, [2.71, 2.76], S.yellowLine),
    ...dashes.map((x, i) => slab(`street_dash_${i + 1}`, BOTH, around(x, 1.2), LINE_Y, [5.25, 5.37], S.roadLine)),
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
    // The door frame, knob and letterbox.
    slab('shop_door_jamb_l', BOTH, [DOOR_X[0] - 0.16, DOOR_X[0] - 0.04], [-0.05, 2.3], [W - 0.06, W + 0.16], S.woodwork),
    slab('shop_door_jamb_r', BOTH, [DOOR_X[1] + 0.04, DOOR_X[1] + 0.16], [-0.05, 2.3], [W - 0.06, W + 0.16], S.woodwork),
    slab('shop_door_head', BOTH, [DOOR_X[0] - 0.2, DOOR_X[1] + 0.2], [2.28, 2.38], [W - 0.08, W + 0.18], S.woodwork),
    slab('shop_door_knob', BOTH, [2.02, 2.1], [1.0, 1.08], [W + 0.14, W + 0.18], S.brass),
    slab('shop_letterbox', BOTH, [2.3, 2.7], [0.84, 0.9], [W + 0.14, W + 0.155], S.brass),
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

/** A backrest on the bench, on two supports. */
function benchBack(): Prop[] {
  const b = BENCH.back;
  return [
    slab('bench_back', BOTH, [BENCH.x[0] + 0.05, BENCH.x[1] - 0.05], [BENCH.top + 0.12, BENCH.top + 0.48], [b - 0.06, b + 0.02], S.bench),
    ...[BENCH.x[0] + 0.19, BENCH.x[1] - 0.19].map((x, i) =>
      slab(`bench_support_${i + 1}`, BOTH, around(x, 0.08), [BENCH.top - 0.04, BENCH.top + 0.16], [b - 0.045, b - 0.015], S.bench)),
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

/** Every street detail. */
export const STREET_DETAIL: readonly Prop[] = [
  ...road(),
  ...shopFront(),
  ...shopUpper(),
  ...alleys(),
  ...leftNeighbour(),
  ...rightNeighbour(),
  ...farBuilding('far_left', [-14, -7.9], 7, S.farLeft, [[3.6, 4.7], [5.3, 6.4]], [-9.2, -10.8, -12.4]),
  ...farBuilding('far_right', [7.9, 14], 5.2, S.farRight, [[3.3, 4.4]], [9.2, 10.8, 12.4]),
  ...lamp(),
  ...benchBack(),
  ...car(),
  ...payphone(),
  ...charger(),
  ...scooter(),
  ...planterHedge(),
  ...pastBits(),
];
