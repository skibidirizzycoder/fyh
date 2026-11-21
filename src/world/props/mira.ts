// mira.ts — props for Mira's moment: "14 March 2004: open mic". Owner: Teammate A.
// Open mic night in front of the shop window: string lights over the window, a mic stand and a
// small amp. Mira waits at the side with her guitar; three bored listeners stare at their phones.
//   mira_take_cd   hides her dropped demo CD (on the bench)
//   mira_play_cd   (the listening post) phones go away, the listeners gather in front of the mic,
//                  Mira steps up to it, and her flyer goes up on the noticeboard
// Keep the ids mira_cd and listening_post: tests and the pitch route use them.
// Same conventions as layout.ts: centre + size in metres, ground top at y = 0,
// standOn / mountOn keep a gap between touching surfaces (no z-fighting).

import { T } from '../../tuning.ts';
import type { Prop } from '../layout.ts';
import { BENCH_TOP, BOARD_FRONT, GAP, PAST, POST_TOP, WALL_FRONT_Z, mountOn, standOn } from './helpers.ts';

const M = ['open_mic'];
const C = T.mira;

// --- the open-mic corner, in front of the shop window (window: x -3..0) ---
const MIC = { x: -1.5, z: -3.6, h: 1.4, d: 0.06, head: 0.1 } as const;
const micTop = standOn(0, MIC.h) + MIC.h / 2;
const AMP: Prop['size'] = [0.5, 0.5, 0.35];
const ampPos: Prop['pos'] = [-0.5, standOn(0, AMP[1]), -4.3];

// --- string lights on the wall, just above the window (its top is at y 2.32) ---
const WIRE = { x: -1.5, y: 2.55, w: 3.6, t: 0.03 } as const;
const BULB = 0.14;
const BULB_XS = [-3.0, -2.4, -1.8, -1.2, -0.6, 0.0];
const bulbY = WIRE.y - WIRE.t / 2 - GAP - BULB / 2; // hanging just under the wire

// --- people: a body (cylinder) and a head (box) ---
const BODY_D = 0.45;
const BODY_H = 1.6;
const HEAD = 0.28;
const headY = standOn(standOn(0, BODY_H) + BODY_H / 2, HEAD);

// --- Mira: waiting by the lamp post, then at the mic (just behind it) ---
const MIRA_WAITING = { x: -2.9, z: -2.3 } as const;
const MIRA_LIVE = { x: MIC.x, z: -4.05 } as const;
const GUITAR_BODY: Prop['size'] = [0.4, 0.45, 0.06];
const GUITAR_NECK: Prop['size'] = [0.07, 0.55, 0.04];
const GUITAR_Y = 0.95;

// --- listeners: bored on the right (on their phones, away from Mira), then gathered round the mic ---
// Gathered spots stay off the camera's line to Mira at the end of the pitch route (camera near
// x -0.9, z 2.2 once you've played the CD), so she is never hidden behind them.
const BORED: readonly (readonly [number, number])[] = [[2.0, -1.2], [2.9, -2.6], [3.3, -1.0]];
const GATHERED: readonly (readonly [number, number])[] = [[-2.7, -3.1], [-2.3, -2.2], [0.1, -3.2]];
const PHONE: Prop['size'] = [0.12, 0.18, 0.05];
const PHONE_Y = 1.3;

/** A 2004 prop that only exists in Mira's moment. */
function openMic(p: Omit<Prop, 'eras' | 'moments'>): Prop {
  return { ...p, eras: PAST, moments: M };
}

/** Mira with her guitar held in front of her, at one spot. Ids end in `suffix`. */
function mira(at: { x: number; z: number }, suffix: string, startsHidden: boolean): Prop[] {
  const front = at.z + BODY_D / 2;
  const guitarZ = mountOn(front, GUITAR_BODY[2]);
  const hidden = startsHidden ? { startsHidden: true } : {};
  return [
    openMic({ id: `mira_${suffix}`, shape: 'cylinder', pos: [at.x, standOn(0, BODY_H), at.z], size: [BODY_D, BODY_H, BODY_D], color: C.mira, ...hidden }),
    openMic({ id: `mira_${suffix}_head`, shape: 'box', pos: [at.x, headY, at.z], size: [HEAD, HEAD, HEAD], color: C.skin, ...hidden }),
    openMic({ id: `mira_${suffix}_guitar`, shape: 'box', pos: [at.x, GUITAR_Y, guitarZ], size: GUITAR_BODY, color: C.guitar, ...hidden }),
    openMic({ id: `mira_${suffix}_neck`, shape: 'box', pos: [at.x, standOn(GUITAR_Y + GUITAR_BODY[1] / 2, GUITAR_NECK[1]), guitarZ], size: GUITAR_NECK, color: C.neck, ...hidden }),
  ];
}

/** The listeners: bored ones hold a glowing phone; gathered ones start hidden. */
function listeners(spots: readonly (readonly [number, number])[], kind: 'bored' | 'gathered'): Prop[] {
  return spots.flatMap(([x, z], i) => {
    const color = C.listeners[i % C.listeners.length] ?? C.mira;
    const body = openMic({ id: `mira_${kind}_${i + 1}`, shape: 'cylinder', pos: [x, standOn(0, BODY_H), z], size: [BODY_D, BODY_H, BODY_D], color, ...(kind === 'gathered' ? { startsHidden: true } : {}) });
    if (kind === 'gathered') return [body];
    const phone = openMic({ id: `mira_bored_phone_${i + 1}`, shape: 'box', pos: [x, PHONE_Y, mountOn(z + BODY_D / 2, PHONE[2])], size: PHONE, color: C.phoneGlow });
    return [body, phone];
  });
}

export const PROPS_MIRA: readonly Prop[] = [
  // The two things you use: her dropped CD on the bench, and the shop's listening post.
  openMic({ id: 'mira_cd', shape: 'box', pos: [-2, standOn(BENCH_TOP, 0.03), 0], size: [0.3, 0.03, 0.3], color: C.cd, interactable: true }),
  openMic({ id: 'listening_post', shape: 'box', pos: [1.2, standOn(0, 1.3), -4.2], size: [0.6, 1.3, 0.6], color: C.listeningPost, interactable: true }),
  openMic({ id: 'open_mic_sign', shape: 'box', pos: [1.2, standOn(POST_TOP, 0.4), -4.2], size: [0.5, 0.4, 0.06], color: C.sign }),
  openMic({ id: 'mira_flyer', shape: 'box', pos: [3.6, 1.3, mountOn(BOARD_FRONT, 0.02)], size: [0.4, 0.55, 0.02], color: C.flyer, startsHidden: true }),

  // The open-mic corner: mic stand, small amp, string lights.
  openMic({ id: 'mira_mic_stand', shape: 'cylinder', pos: [MIC.x, standOn(0, MIC.h), MIC.z], size: [MIC.d, MIC.h, MIC.d], color: C.micStand }),
  openMic({ id: 'mira_mic', shape: 'box', pos: [MIC.x, standOn(micTop, MIC.head), MIC.z], size: [MIC.head, MIC.head, MIC.head], color: C.amp }),
  openMic({ id: 'mira_amp', shape: 'box', pos: ampPos, size: AMP, color: C.amp }),
  openMic({ id: 'mira_lights_wire', shape: 'box', pos: [WIRE.x, WIRE.y, mountOn(WALL_FRONT_Z, WIRE.t)], size: [WIRE.w, WIRE.t, WIRE.t], color: C.wire }),
  ...BULB_XS.map((x, i) => openMic({ id: `mira_bulb_${i + 1}`, shape: 'box', pos: [x, bulbY, mountOn(WALL_FRONT_Z, BULB)], size: [BULB, BULB, BULB], color: C.bulbs[i % C.bulbs.length] ?? C.sign })),

  // Mira: waiting at the side, then (after the listening post) at the mic.
  ...mira(MIRA_WAITING, 'waiting', false),
  ...mira(MIRA_LIVE, 'live', true),

  // The crowd: on their phones, then gathered in front of the mic.
  ...listeners(BORED, 'bored'),
  ...listeners(GATHERED, 'gathered'),
];

/** What mira_play_cd changes (exported so tests and checks share one list). */
export const MIRA_PLAY_SHOWS = PROPS_MIRA.filter((p) => p.startsHidden).map((p) => p.id);
export const MIRA_PLAY_HIDES = PROPS_MIRA.filter((p) => /^mira_(waiting|bored)/.test(p.id)).map((p) => p.id);
