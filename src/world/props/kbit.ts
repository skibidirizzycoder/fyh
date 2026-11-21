// kbit.ts — props for DJ K-Bit's moment, "5 December 2004": the ringtone craze.
// A bus stop shelter on the left of the street with a queue of people, and DJ K-Bit
// in headphones next to it. Same conventions as src/world/layout.ts: centre + size,
// ground top at y = 0, and a gap (T.world.surfaceGap) between touching surfaces.
// Interactables: kbit_phone (K-Bit's phone) and kbit_bus_stop (the stop's sign).

import { T, type Era } from '../../tuning.ts';
import type { Prop } from '../layout.ts';

/** A prop that only appears in some 2004 moments. */
export type MomentProp = Prop & { moments: readonly string[] };

const GAP = T.world.surfaceGap;
const K = T.kbit;
const PAST: readonly Era[] = ['2004'];
const MOMENT = 'ringtone';

/** Centre y for something of height h standing on a surface whose top is at `top`. */
function standOn(top: number, h: number): number {
  return top + GAP + h / 2;
}

// --- the shelter: a back wall, two front posts and a roof, open towards +X (the street) ---
const SHELTER_X = -5.6; // centre of the shelter floor
const SHELTER_Z = 1.5;
const SHELTER_DEPTH = 1.4; // along x
const SHELTER_LENGTH = 3; // along z
const SHELTER_H = 2.2;
const backX = SHELTER_X - SHELTER_DEPTH / 2 + 0.05;
const frontX = SHELTER_X + SHELTER_DEPTH / 2 - 0.05;
const roofY = standOn(standOn(0, SHELTER_H) + SHELTER_H / 2, 0.1);

// --- the queue: four people under the roof, each with a flip phone held up ---
const PERSON_D = 0.45;
const PERSON_H = 1.6;
const QUEUE_X = SHELTER_X;
const QUEUE_Z = [0.55, 1.2, 1.85, 2.5];
const PHONE = [0.08, 0.14, 0.04] as const;
const phoneX = QUEUE_X + PERSON_D / 2 + GAP + PHONE[0] / 2;

// --- the bus stop sign on a pole, at the front corner of the shelter ---
const SIGN_X = -4.5;
const SIGN_Z = 3.4;
const POLE_H = 2;
const SIGN = [0.6, 0.6, 0.08] as const;

// --- DJ K-Bit: a body, headphones on top, his phone held out towards the street ---
const KBIT_X = -3.6;
const KBIT_Z = 1.4;
const KBIT_D = 0.5;
const KBIT_H = 1.7;
const HEADPHONES = [0.6, 0.12, 0.2] as const;
const KBIT_PHONE = [0.12, 0.2, 0.06] as const;

const queue: MomentProp[] = QUEUE_Z.flatMap((z, i) => [
  { id: `kbit_person_${i + 1}`, shape: 'cylinder', eras: PAST, moments: [MOMENT], pos: [QUEUE_X, standOn(0, PERSON_H), z], size: [PERSON_D, PERSON_H, PERSON_D], color: K.people[i % K.people.length] ?? K.kbitBody },
  // Phones come out when your ringtone goes off (kbit_ring_bus_stop shows them).
  { id: `kbit_queue_phone_${i + 1}`, shape: 'box', eras: PAST, moments: [MOMENT], pos: [phoneX, 1.4, z], size: PHONE, color: K.flipPhone, startsHidden: true },
]);

export const KBIT_PROPS: readonly MomentProp[] = [
  { id: 'kbit_shelter_back', shape: 'box', eras: PAST, moments: [MOMENT], pos: [backX, standOn(0, SHELTER_H), SHELTER_Z], size: [0.1, SHELTER_H, SHELTER_LENGTH], color: K.shelterGlass },
  { id: 'kbit_shelter_post_1', shape: 'cylinder', eras: PAST, moments: [MOMENT], pos: [frontX, standOn(0, SHELTER_H), SHELTER_Z - SHELTER_LENGTH / 2 + 0.05], size: [0.08, SHELTER_H, 0.08], color: K.shelterFrame },
  { id: 'kbit_shelter_post_2', shape: 'cylinder', eras: PAST, moments: [MOMENT], pos: [frontX, standOn(0, SHELTER_H), SHELTER_Z + SHELTER_LENGTH / 2 - 0.05], size: [0.08, SHELTER_H, 0.08], color: K.shelterFrame },
  { id: 'kbit_shelter_roof', shape: 'box', eras: PAST, moments: [MOMENT], pos: [SHELTER_X, roofY, SHELTER_Z], size: [SHELTER_DEPTH + 0.1, 0.1, SHELTER_LENGTH + 0.2], color: K.shelterRoof },
  ...queue,
  { id: 'kbit_sign_pole', shape: 'cylinder', eras: PAST, moments: [MOMENT], pos: [SIGN_X, standOn(0, POLE_H), SIGN_Z], size: [0.08, POLE_H, 0.08], color: K.signPole },
  { id: 'kbit_bus_stop', shape: 'box', eras: PAST, moments: [MOMENT], pos: [SIGN_X, standOn(standOn(0, POLE_H) + POLE_H / 2, SIGN[1]), SIGN_Z], size: SIGN, color: K.sign, interactable: true },
  { id: 'kbit_body', shape: 'cylinder', eras: PAST, moments: [MOMENT], pos: [KBIT_X, standOn(0, KBIT_H), KBIT_Z], size: [KBIT_D, KBIT_H, KBIT_D], color: K.kbitBody },
  { id: 'kbit_headphones', shape: 'box', eras: PAST, moments: [MOMENT], pos: [KBIT_X, standOn(standOn(0, KBIT_H) + KBIT_H / 2, HEADPHONES[1]), KBIT_Z], size: HEADPHONES, color: K.headphones },
  { id: 'kbit_phone', shape: 'box', eras: PAST, moments: [MOMENT], pos: [KBIT_X + KBIT_D / 2 + GAP + KBIT_PHONE[0] / 2, 1.2, KBIT_Z], size: KBIT_PHONE, color: K.kbitPhone, interactable: true },
];
