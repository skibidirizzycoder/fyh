// kbit.ts — props for DJ K-Bit's moment, "5 December 2004": the ringtone craze. Owner: Teammate B.
// A bus stop shelter on the left pavement with a queue of people, and DJ K-Bit in headphones
// next to it, holding out his phone. Everything stays between z = -4 and z = 1, close to where
// the player starts (0, 3), so the pitch demo is short. standOn/mountOn keep the 0.02 gap.
// Interactables: kbit_phone (K-Bit's phone) and kbit_bus_stop (the stop's sign).

import { T } from '../../tuning.ts';
import type { Prop } from '../layout.ts';
import { GAP, PAST, mountOn, standOn } from './helpers.ts';

const M = ['ringtone'];
const K = T.kbit;

// --- the shelter: a glass back wall, two front posts and a roof, open towards +X (the street) ---
const SHELTER_X = -5.8; // centre of the shelter floor
const SHELTER_Z = -0.4;
const SHELTER_DEPTH = 1.4; // along x
const SHELTER_LENGTH = 2.4; // along z
const SHELTER_H = 2.2;
const backX = SHELTER_X - SHELTER_DEPTH / 2 + 0.05;
const frontX = SHELTER_X + SHELTER_DEPTH / 2 - 0.05;
const shelterTop = standOn(0, SHELTER_H) + SHELTER_H / 2;

// --- the queue: four people under the roof; their flip phones come out when yours rings ---
const PERSON_D = 0.45;
const PERSON_H = 1.6;
const QUEUE_Z = [-1.2, -0.6, 0, 0.6];
const PHONE = [0.08, 0.14, 0.04] as const;
const phoneX = SHELTER_X + PERSON_D / 2 + GAP + PHONE[0] / 2;

// --- the bus stop sign on a pole, at the front corner of the shelter ---
const SIGN_X = -4.6;
const SIGN_Z = 0.85;
const POLE_H = 2;
const SIGN = [0.6, 0.6, 0.08] as const;
const SIGN_Y = standOn(standOn(0, POLE_H) + POLE_H / 2, SIGN[1]);
const BAND = [0.5, 0.16, 0.02] as const; // the white "BUS" band across the sign's front
const TIMETABLE = [0.4, 0.55, 0.03] as const; // on the pole, at reading height
const POLE_D = 0.08;

// --- DJ K-Bit: a body, headphones on top, his phone held out towards the street ---
const KBIT_X = -3.8;
const KBIT_Z = 0.6;
const KBIT_D = 0.5;
const KBIT_H = 1.7;
const HEADPHONES = [0.6, 0.12, 0.2] as const;
const KBIT_PHONE = [0.18, 0.3, 0.08] as const; // big enough to read as "a phone" from the start

// --- street life (decoration only): a bin, a newspaper box, pigeons, a dog waiting with the queue ---
const roofTop = standOn(shelterTop, 0.1) + 0.05;
const BIN = [0.45, 0.8, 0.45] as const;
const NEWS_BOX = [0.5, 1, 0.45] as const;
const PIGEON = [0.12, 0.1, 0.2] as const;
const DOG = [0.25, 0.3, 0.6] as const;
const DOG_HEAD = [0.2, 0.2, 0.22] as const;
const DOG_X = -4.95;
const DOG_Z = 0.3;

const streetLife: Prop[] = [
  { id: 'kbit_bin', shape: 'cylinder', eras: PAST, moments: M, pos: [-4.5, standOn(0, BIN[1]), -1], size: BIN, color: K.bin },
  { id: 'kbit_bin_lid', shape: 'cylinder', eras: PAST, moments: M, pos: [-4.5, standOn(standOn(0, BIN[1]) + BIN[1] / 2, 0.05), -1], size: [0.5, 0.05, 0.5], color: K.binLid },
  { id: 'kbit_news_box', shape: 'box', eras: PAST, moments: M, pos: [-2.3, standOn(0, NEWS_BOX[1]), -2.2], size: NEWS_BOX, color: K.newsBox },
  { id: 'kbit_news_window', shape: 'box', eras: PAST, moments: M, pos: [-2.3, 0.75, mountOn(-2.2 + NEWS_BOX[2] / 2, 0.02)], size: [0.4, 0.3, 0.02], color: K.newsWindow },
  { id: 'kbit_pigeon_1', shape: 'box', eras: PAST, moments: M, pos: [-5.5, standOn(roofTop, PIGEON[1]), -1], size: PIGEON, color: K.pigeon },
  { id: 'kbit_pigeon_2', shape: 'box', eras: PAST, moments: M, pos: [-6, standOn(roofTop, PIGEON[1]), 0.3], size: PIGEON, color: K.pigeon },
  { id: 'kbit_pigeon_3', shape: 'box', eras: PAST, moments: M, pos: [-1.6, standOn(0, PIGEON[1]), 0.9], size: PIGEON, color: K.pigeon },
  { id: 'kbit_dog', shape: 'box', eras: PAST, moments: M, pos: [DOG_X, standOn(0, DOG[1]), DOG_Z], size: DOG, color: K.dog },
  { id: 'kbit_dog_head', shape: 'box', eras: PAST, moments: M, pos: [DOG_X, 0.35, mountOn(DOG_Z + DOG[2] / 2, DOG_HEAD[2])], size: DOG_HEAD, color: K.dogHead },
];

const queue: Prop[] = QUEUE_Z.flatMap((z, i): Prop[] => [
  { id: `kbit_person_${i + 1}`, shape: 'cylinder', eras: PAST, moments: M, pos: [SHELTER_X, standOn(0, PERSON_H), z], size: [PERSON_D, PERSON_H, PERSON_D], color: K.people[i % K.people.length] ?? K.kbitBody },
  { id: `kbit_queue_phone_${i + 1}`, shape: 'box', eras: PAST, moments: M, pos: [phoneX, 1.4, z], size: PHONE, color: K.flipPhone, startsHidden: true },
]);

export const KBIT_PROPS: readonly Prop[] = [
  { id: 'kbit_shelter_back', shape: 'box', eras: PAST, moments: M, pos: [backX, standOn(0, SHELTER_H), SHELTER_Z], size: [0.1, SHELTER_H, SHELTER_LENGTH], color: K.shelterGlass },
  { id: 'kbit_shelter_post_1', shape: 'cylinder', eras: PAST, moments: M, pos: [frontX, standOn(0, SHELTER_H), SHELTER_Z - SHELTER_LENGTH / 2 + 0.05], size: [0.08, SHELTER_H, 0.08], color: K.shelterFrame },
  { id: 'kbit_shelter_post_2', shape: 'cylinder', eras: PAST, moments: M, pos: [frontX, standOn(0, SHELTER_H), SHELTER_Z + SHELTER_LENGTH / 2 - 0.05], size: [0.08, SHELTER_H, 0.08], color: K.shelterFrame },
  { id: 'kbit_shelter_roof', shape: 'box', eras: PAST, moments: M, pos: [SHELTER_X, standOn(shelterTop, 0.1), SHELTER_Z], size: [SHELTER_DEPTH + 0.1, 0.1, SHELTER_LENGTH + 0.2], color: K.shelterRoof },
  ...queue,
  ...streetLife,
  { id: 'kbit_sign_pole', shape: 'cylinder', eras: PAST, moments: M, pos: [SIGN_X, standOn(0, POLE_H), SIGN_Z], size: [POLE_D, POLE_H, POLE_D], color: K.signPole },
  { id: 'kbit_bus_stop', shape: 'box', eras: PAST, moments: M, pos: [SIGN_X, SIGN_Y, SIGN_Z], size: SIGN, color: K.sign, interactable: true },
  { id: 'kbit_sign_band', shape: 'box', eras: PAST, moments: M, pos: [SIGN_X, SIGN_Y + 0.08, mountOn(SIGN_Z + SIGN[2] / 2, BAND[2])], size: BAND, color: K.signBand },
  { id: 'kbit_timetable', shape: 'box', eras: PAST, moments: M, pos: [SIGN_X, 1.35, mountOn(SIGN_Z + POLE_D / 2, TIMETABLE[2])], size: TIMETABLE, color: K.timetable },
  { id: 'kbit_body', shape: 'cylinder', eras: PAST, moments: M, pos: [KBIT_X, standOn(0, KBIT_H), KBIT_Z], size: [KBIT_D, KBIT_H, KBIT_D], color: K.kbitBody },
  { id: 'kbit_headphones', shape: 'box', eras: PAST, moments: M, pos: [KBIT_X, standOn(standOn(0, KBIT_H) + KBIT_H / 2, HEADPHONES[1]), KBIT_Z], size: HEADPHONES, color: K.headphones },
  { id: 'kbit_phone', shape: 'box', eras: PAST, moments: M, pos: [KBIT_X + KBIT_D / 2 + GAP + KBIT_PHONE[0] / 2, 1.2, KBIT_Z], size: KBIT_PHONE, color: K.kbitPhone, interactable: true },
];
