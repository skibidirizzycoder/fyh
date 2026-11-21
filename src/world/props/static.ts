// static.ts — props for The Static's moment: "6 August 1988: street gig". Owner: Teammate A.
// A low stage in front of the shop with the band, a drum kit, a dead amp and a mic stand.
// An orange cable reel sits beside the stage; the shop's outdoor socket is on the wall.
//   static_plug_amp  shows the cable (socket -> reel) and swaps the amp's red light for green
//   static_give_mic  shows the payoff (STATIC_FIX_SHOWS): a crowd of eight packed round the stage,
//                    half of them with their arms up, a set list dropped by the mic and a tip jar
// The two interactable ids must match src/story/cds/static.json.
// Same conventions as layout.ts: centre + size in metres, ground top at y = 0,
// standOn / mountOn keep a gap between touching surfaces (no z-fighting).

import { T } from '../../tuning.ts';
import type { Prop } from '../layout.ts';
import { GAP, PAST, WALL_FRONT_Z, mountOn, standOn } from './helpers.ts';

const M = ['street_gig'];
const C = T.static;

// --- the stage: between the bench and the door, facing the player's start (z = 3) ---
const STAGE = { x: 0.8, z: -2.4, w: 3.2, h: 0.3, d: 2 } as const;
const STAGE_TOP = standOn(0, STAGE.h) + STAGE.h / 2;
const STAGE_FRONT = STAGE.z + STAGE.d / 2;

// --- the amp at the back right of the stage (clear of the band, so its light is seen from the start) ---
const AMP = { x: 2.05, z: -3.0, w: 0.6, h: 0.8, d: 0.45 } as const;
const AMP_FRONT = AMP.z + AMP.d / 2;
const AMP_LIGHT: Prop['size'] = [0.1, 0.1, 0.03];
const ampLightPos: Prop['pos'] = [AMP.x + 0.2, standOn(STAGE_TOP, AMP.h) + 0.25, mountOn(AMP_FRONT, AMP_LIGHT[2])];

// --- the cable: shop socket -> along the ground -> the reel beside the stage ---
const REEL = { x: 2.95, z: -1.9, diameter: 0.55, h: 0.3 } as const;
const SOCKET_X = 3.6;
const CABLE = { w: 0.05, h: 0.03 } as const;
const CABLE_Y = standOn(0, CABLE.h);
const runStartZ = WALL_FRONT_Z + 0.05; // tucked against the wall under the socket
const runEndZ = REEL.z - CABLE.w / 2 - GAP; // stops before the lead's strip so they never share a face
const leadStartX = REEL.x + REEL.diameter / 2 + GAP; // just clear of the reel
const leadEndX = SOCKET_X - CABLE.w / 2 - GAP; // just clear of the run

// --- the band ---
const BODY_D = 0.45;
const SINGER = { x: 0.8, z: -2.0, h: 1.55 } as const;
const GUITARIST = { x: 1.4, z: -2.1, h: 1.5 } as const;
const HEAD = 0.3;
const MIC = { x: SINGER.x, z: STAGE_FRONT - 0.15, h: 1.45, d: 0.1 } as const;
const guitarFront = GUITARIST.z + BODY_D / 2;
const GUITAR_BODY: Prop['size'] = [0.42, 0.45, 0.06];
const GUITAR_NECK: Prop['size'] = [0.08, 0.6, 0.04];
const guitarZ = mountOn(guitarFront, GUITAR_BODY[2]);
const guitarY = 1.0;

// --- the drum kit at the back left ---
const KICK = { x: -0.1, z: -2.9, d: 0.6, h: 0.55 } as const;
const SNARE = { x: 0.45, z: -2.55, d: 0.35, h: 0.6 } as const;
const CYMBAL = { x: -0.55, z: -2.5, standH: 1.1, d: 0.45, h: 0.03 } as const;
const cymbalStandTop = standOn(STAGE_TOP, CYMBAL.standH) + CYMBAL.standH / 2;

// --- the banner, strung between two poles behind the stage ---
const POLE = { z: -3.6, h: 2.6, d: 0.08, xs: [-0.7, 2.3] } as const;
const BANNER: Prop['size'] = [2.86, 0.6, 0.04];

// --- the crowd that packs in once the mic works (hidden until then) ---
// Close round the stage on both sides, leaving an aisle (x 0..1.6) from the player's start to the mic,
// so they never block the band or stand where the player is, with room between them for a player
// a person appears on to be pushed out (towards +Z, see collide.ts). [x, z, arms up?]
const CROWD_H = 1.6;
const CROWD_HEAD = 0.28;
const CROWD: readonly (readonly [number, number, boolean])[] = [
  [-0.9, -0.8, true], [2.5, -0.75, true], [3.2, -0.2, false], [-1.7, -0.95, false],
  [-0.35, 0.45, true], [1.95, -0.35, false], [3.2, -1.1, true], [2.2, 0.35, false],
];
const ARM: Prop['size'] = [0.07, 0.7, 0.07]; // raised arms: shoulder to hands, above the head
const ARM_X = BODY_D / 2 + GAP + ARM[0] / 2; // beside the body, never inside it
const ARM_Y = 1.35 + ARM[1] / 2;

// --- the set list the singer dropped, lying on the stage by the mic ---
const SETLIST = { x: 1.35, z: -1.62, w: 0.21, d: 0.3, h: 0.004 } as const;
const SETLIST_TOP = standOn(STAGE_TOP, SETLIST.h) + SETLIST.h / 2;
const INK_H = 0.003;
const SETLIST_LINES = [-0.04, 0.02, 0.08]; // z offsets of the scribbled song titles

// --- the tip jar at the front of the stage beside the mic (seen from the aisle), a note poking out ---
const JAR = { x: 0.3, z: -1.6, d: 0.16, h: 0.24 } as const;
const JAR_LID: Prop['size'] = [0.17, 0.03, 0.17];
const jarTop = standOn(STAGE_TOP, JAR.h) + JAR.h / 2;
const lidTop = standOn(jarTop, JAR_LID[1]) + JAR_LID[1] / 2;
const NOTE: Prop['size'] = [0.09, 0.07, 0.01];
const JAR_LABEL: Prop['size'] = [0.1, 0.06, 0.01];

/** A 2004 prop that only exists in The Static's moment. */
function gig(p: Omit<Prop, 'eras' | 'moments'>): Prop {
  return { ...p, eras: PAST, moments: M };
}

/** One person in the crowd: body, head and, for some, both arms up. Hidden until the mic works. */
function crowdMember(n: number, x: number, z: number, armsUp: boolean): Prop[] {
  const id = `static_crowd_${n}`;
  const color = C.crowd[(n - 1) % C.crowd.length] ?? C.band[0];
  const person: Prop[] = [
    gig({ id, shape: 'person', pos: [x, standOn(0, CROWD_H), z], size: [BODY_D, CROWD_H, BODY_D], color, startsHidden: true }),
    gig({ id: `${id}_head`, shape: 'box', pos: [x, standOn(GAP + CROWD_H, CROWD_HEAD), z], size: [CROWD_HEAD, CROWD_HEAD, CROWD_HEAD], color: C.skin, startsHidden: true }),
  ];
  if (armsUp) {
    for (const side of [-1, 1]) person.push(gig({ id: `${id}_arm_${side < 0 ? 'l' : 'r'}`, shape: 'box', pos: [x + side * ARM_X, ARM_Y, z], size: ARM, color: C.skin, startsHidden: true }));
  }
  return person;
}

export const PROPS_STATIC: readonly Prop[] = [
  gig({ id: 'static_stage', shape: 'box', pos: [STAGE.x, standOn(0, STAGE.h), STAGE.z], size: [STAGE.w, STAGE.h, STAGE.d], color: C.stage }),

  // The amp, its light (red while it cuts out, green once plugged in), the reel and the cable.
  gig({ id: 'static_amp', shape: 'box', pos: [AMP.x, standOn(STAGE_TOP, AMP.h), AMP.z], size: [AMP.w, AMP.h, AMP.d], color: C.amp }),
  gig({ id: 'static_amp_dead', shape: 'box', pos: ampLightPos, size: AMP_LIGHT, color: C.ampDead }),
  gig({ id: 'static_amp_live', shape: 'box', pos: ampLightPos, size: AMP_LIGHT, color: C.ampLive, startsHidden: true }),
  gig({ id: 'static_cable_reel', shape: 'cylinder', pos: [REEL.x, standOn(0, REEL.h), REEL.z], size: [REEL.diameter, REEL.h, REEL.diameter], color: C.cableReel, interactable: true }),
  gig({ id: 'static_socket', shape: 'box', pos: [SOCKET_X, 0.5, mountOn(WALL_FRONT_Z, 0.05)], size: [0.22, 0.22, 0.05], color: C.socket }),
  gig({ id: 'static_cable_run', shape: 'box', pos: [SOCKET_X, CABLE_Y, (runStartZ + runEndZ) / 2], size: [CABLE.w, CABLE.h, runEndZ - runStartZ], color: C.cable, startsHidden: true }),
  gig({ id: 'static_cable_lead', shape: 'box', pos: [(leadStartX + leadEndX) / 2, CABLE_Y, REEL.z], size: [leadEndX - leadStartX, CABLE.h, CABLE.w], color: C.cable, startsHidden: true }),

  // The band: singer behind the mic stand, guitarist with a guitar.
  gig({ id: 'static_singer', shape: 'person', pos: [SINGER.x, standOn(STAGE_TOP, SINGER.h), SINGER.z], size: [BODY_D, SINGER.h, BODY_D], color: C.band[0] }),
  gig({ id: 'static_singer_head', shape: 'box', pos: [SINGER.x, standOn(STAGE_TOP + GAP + SINGER.h, HEAD), SINGER.z], size: [HEAD, HEAD, HEAD], color: C.skin }),
  gig({ id: 'static_mic', shape: 'cylinder', pos: [MIC.x, standOn(STAGE_TOP, MIC.h), MIC.z], size: [MIC.d, MIC.h, MIC.d], color: C.stand, interactable: true }),
  gig({ id: 'static_guitarist', shape: 'person', pos: [GUITARIST.x, standOn(STAGE_TOP, GUITARIST.h), GUITARIST.z], size: [BODY_D, GUITARIST.h, BODY_D], color: C.band[1] }),
  gig({ id: 'static_guitarist_head', shape: 'box', pos: [GUITARIST.x, standOn(STAGE_TOP + GAP + GUITARIST.h, HEAD), GUITARIST.z], size: [HEAD, HEAD, HEAD], color: C.skin }),
  gig({ id: 'static_guitar', shape: 'box', pos: [GUITARIST.x, guitarY, guitarZ], size: GUITAR_BODY, color: C.guitar }),
  gig({ id: 'static_guitar_neck', shape: 'box', pos: [GUITARIST.x, standOn(guitarY + GUITAR_BODY[1] / 2, GUITAR_NECK[1]), guitarZ], size: GUITAR_NECK, color: C.stand }),

  // The drum kit.
  gig({ id: 'static_kick', shape: 'cylinder', pos: [KICK.x, standOn(STAGE_TOP, KICK.h), KICK.z], size: [KICK.d, KICK.h, KICK.d], color: C.drum }),
  gig({ id: 'static_snare', shape: 'cylinder', pos: [SNARE.x, standOn(STAGE_TOP, SNARE.h), SNARE.z], size: [SNARE.d, SNARE.h, SNARE.d], color: C.drum }),
  gig({ id: 'static_cymbal_stand', shape: 'cylinder', pos: [CYMBAL.x, standOn(STAGE_TOP, CYMBAL.standH), CYMBAL.z], size: [0.04, CYMBAL.standH, 0.04], color: C.stand }),
  gig({ id: 'static_cymbal', shape: 'cylinder', pos: [CYMBAL.x, standOn(cymbalStandTop, CYMBAL.h), CYMBAL.z], size: [CYMBAL.d, CYMBAL.h, CYMBAL.d], color: C.cymbal }),

  // The hand-painted banner.
  ...POLE.xs.map((x, i) => gig({ id: `static_banner_pole_${i + 1}`, shape: 'cylinder', pos: [x, standOn(0, POLE.h), POLE.z], size: [POLE.d, POLE.h, POLE.d], color: C.stand })),
  gig({ id: 'static_banner', shape: 'box', pos: [(POLE.xs[0] + POLE.xs[1]) / 2, standOn(0, POLE.h) + POLE.h / 2 - 0.45, POLE.z], size: BANNER, color: C.banner }),

  // The payoff once the mic works: a packed crowd, the dropped set list, the tip jar.
  ...CROWD.flatMap(([x, z, armsUp], i) => crowdMember(i + 1, x, z, armsUp)),
  gig({ id: 'static_setlist', shape: 'box', pos: [SETLIST.x, standOn(STAGE_TOP, SETLIST.h), SETLIST.z], size: [SETLIST.w, SETLIST.h, SETLIST.d], color: C.paper, startsHidden: true }),
  gig({ id: 'static_setlist_title', shape: 'box', pos: [SETLIST.x, standOn(SETLIST_TOP, INK_H), SETLIST.z - 0.1], size: [0.15, INK_H, 0.04], color: C.paperTitle, startsHidden: true }),
  ...SETLIST_LINES.map((dz, i) => gig({ id: `static_setlist_line_${i + 1}`, shape: 'box', pos: [SETLIST.x - 0.01, standOn(SETLIST_TOP, INK_H), SETLIST.z + dz], size: [0.13, INK_H, 0.015], color: C.paperInk, startsHidden: true })),
  gig({ id: 'static_tip_jar', shape: 'cylinder', pos: [JAR.x, standOn(STAGE_TOP, JAR.h), JAR.z], size: [JAR.d, JAR.h, JAR.d], color: C.jarGlass, startsHidden: true }),
  gig({ id: 'static_tip_jar_lid', shape: 'cylinder', pos: [JAR.x, standOn(jarTop, JAR_LID[1]), JAR.z], size: JAR_LID, color: C.jarLid, startsHidden: true }),
  gig({ id: 'static_tip_jar_note', shape: 'box', pos: [JAR.x, standOn(lidTop, NOTE[1]), JAR.z], size: NOTE, color: C.banknote, startsHidden: true }),
  gig({ id: 'static_tip_jar_label', shape: 'box', pos: [JAR.x, standOn(STAGE_TOP, JAR.h) + 0.02, mountOn(JAR.z + JAR_LID[2] / 2, JAR_LABEL[2])], size: JAR_LABEL, color: C.paper, startsHidden: true }),
];

/** Ids the mic hand-over shows (all of them start hidden). Must equal static.json's step 2 "show". */
export const STATIC_FIX_SHOWS: readonly string[] = PROPS_STATIC.filter((p) => /^static_(crowd|setlist|tip_jar)/.test(p.id)).map((p) => p.id);
