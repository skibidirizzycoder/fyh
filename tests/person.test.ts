// person.test.ts — round people: few draw calls, a face on the front, skin with no seams, plain colours
// that match their images, and a walk/run/idle that keeps the feet on the ground and never snaps.
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  advancePhase, createPerson, createPersonTextures, gaitBlend, headGeometry, posePerson, strideLength, type Gait, type Person, type PersonImage,
} from '../src/player/person.ts';
import { T } from '../src/tuning.ts';

const P = T.person;
const GAP = T.world.surfaceGap;
const LOOKS = Object.entries(P.looks);

const WALK: number = T.player.speed;
const RUN: number = T.player.speed * T.player.runMultiplier;

/** A person in a look, with images that never load (tests have no page). */
function made(look: keyof typeof P.looks = 'player'): Person {
  return createPerson(P.looks[look], createPersonTextures(() => new THREE.Texture()), look);
}

/** A gait: walking speed, straight on, at a phase. */
function gait(phase: number, speed = WALK, turnRate = 0, time = 0): Gait {
  return { phase, speed, turnRate, time };
}

/** Every bone's rotation and position, as one list of numbers. */
function poseOf(person: Person): number[] {
  return Object.values(person.bones).flatMap((b) => [...b.rotation.toArray().slice(0, 3), ...b.position.toArray()] as number[]);
}

/** A mesh vertex where it is drawn now (bones applied), in world space. */
function drawnAt(mesh: THREE.SkinnedMesh, i: number): THREE.Vector3 {
  let top: THREE.Object3D = mesh;
  while (top.parent) top = top.parent;
  top.updateMatrixWorld(true); // the bones are not under the mesh
  return mesh.localToWorld(mesh.getVertexPosition(i, new THREE.Vector3()));
}

/** The world-space box round every vertex, with the bones' current pose. */
function bounds(person: Person): THREE.Box3 {
  person.root.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(person.root, true);
}

/** Byte value of a filtered PNG pixel: a = left, b = up, c = up-left (the PNG spec's five filters). */
function unfilter(type: number, raw: number, a: number, b: number, c: number): number {
  const p = a + b - c;
  const [pa, pb, pc] = [Math.abs(p - a), Math.abs(p - b), Math.abs(p - c)];
  const paeth = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  const add = [0, a, b, (a + b) >> 1, paeth][type] ?? 0;
  return (raw + add) & 255;
}

/** Reads an 8-bit RGB PNG (what scripts/art.ts writes) into its pixels. */
function readPng(path: string): { w: number; h: number; rgb: Uint8Array } {
  const buf = readFileSync(path);
  const idat: Buffer[] = [];
  let [w, h, pos] = [0, 0, 8];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') [w, h] = [data.readUInt32BE(0), data.readUInt32BE(4)];
    if (type === 'IHDR') expect([data[8], data[9], data[12]], `${path}: 8-bit RGB, not interlaced`).toEqual([8, 2, 0]);
    if (type === 'IDAT') idat.push(data);
    pos += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * 3;
  const rgb = new Uint8Array(stride * h);
  for (let y = 0; y < h; y++) {
    const type = raw[y * (stride + 1)] ?? 0;
    for (let x = 0; x < stride; x++) {
      const at = y * stride + x;
      const a = x >= 3 ? (rgb[at - 3] ?? 0) : 0;
      const b = y > 0 ? (rgb[at - stride] ?? 0) : 0;
      const c = x >= 3 && y > 0 ? (rgb[at - stride - 3] ?? 0) : 0;
      rgb[at] = unfilter(type, raw[y * (stride + 1) + 1 + x] ?? 0, a, b, c);
    }
  }
  return { w, h, rgb };
}

/** The average colour of some pixels of an image, as [r, g, b] bytes. */
function average(img: { w: number; rgb: Uint8Array }, pixels: [number, number][]): number[] {
  const sum = [0, 0, 0];
  for (const [x, y] of pixels) for (let k = 0; k < 3; k++) sum[k] = (sum[k] ?? 0) + (img.rgb[(y * img.w + x) * 3 + k] ?? 0);
  return sum.map((v) => v / pixels.length);
}

/** The pixels a test compares: a face's border (its plain skin), or every 4th pixel of a fabric. */
function sample(img: { w: number; h: number }, border: boolean): [number, number][] {
  const out: [number, number][] = [];
  for (let y = 0; y < img.h; y += 4) {
    for (let x = 0; x < img.w; x += 4) {
      const edge = Math.min(x, y, img.w - 1 - x, img.h - 1 - y) < 24;
      if (!border || edge) out.push([x, y]);
    }
  }
  return out;
}

describe('round people', () => {
  it('are at most 5 draw calls each, one per material (the player 5: with the brim)', () => {
    for (const [look] of LOOKS) {
      const person = made(look as keyof typeof P.looks);
      expect(person.meshes.length, look).toBeLessThanOrEqual(5);
      expect(person.meshes.every((m) => m instanceof THREE.Mesh)).toBe(true);
      person.dispose();
    }
    const player = made('player');
    expect(player.meshes.length).toBe(5);
    expect(player.brim).not.toBeNull();
    player.dispose();
  });

  it('stand on the ground inside the player\'s height and radius, round (no boxes)', () => {
    for (const [look] of LOOKS) {
      const person = made(look as keyof typeof P.looks);
      const box = bounds(person);
      expect(box.min.y, look).toBeGreaterThanOrEqual(GAP - 1e-6);
      expect(box.min.y, look).toBeLessThan(GAP + 1e-3);
      expect(box.max.y, look).toBeLessThanOrEqual(T.player.height + GAP + 0.01);
      for (const v of [box.min.x, box.max.x, box.min.z, box.max.z]) expect(Math.abs(v), look).toBeLessThanOrEqual(T.player.radius);
      person.dispose();
    }
  });

  it('skin the limbs to their bones: a swung leg carries its shoe, and the shoe stays flat', () => {
    const person = made();
    const plain = person.meshes.find((m) => m.name === 'player_plain') as THREE.SkinnedMesh;
    const n = plain.geometry.getAttribute('position').count;
    const shoe = [...Array(n).keys()].filter((i) => drawnAt(plain, i).x < 0 && drawnAt(plain, i).y < 0.2); // the left shoe
    const toe = shoe.reduce((best, i) => (drawnAt(plain, i).z < drawnAt(plain, best).z ? i : best));
    const heel = shoe.reduce((best, i) => (drawnAt(plain, i).z > drawnAt(plain, best).z ? i : best));
    const standing = drawnAt(plain, toe);
    const tilt = standing.y - drawnAt(plain, heel).y;
    expect(standing.y).toBeLessThan(0.1);
    posePerson(person, gait(Math.PI / 2)); // left leg swung forward its full way
    const swung = drawnAt(plain, toe);
    expect(standing.z - swung.z).toBeGreaterThan(0.2);
    expect(swung.y - drawnAt(plain, heel).y).toBeCloseTo(tilt, 3); // the shoe is as flat as when standing
    person.dispose();
  });
});

describe('how round people move', () => {
  it('keep a foot on the ground through a walk, dipping twice per stride; a run lifts off', () => {
    const person = made();
    const heights: number[] = [];
    for (let k = 0; k < 16; k++) {
      posePerson(person, gait((k / 16) * Math.PI * 2));
      expect(bounds(person).min.y, `phase ${k}/16`).toBeCloseTo(GAP, 3);
      heights.push(person.rig.position.y);
    }
    const [atStep, atPass] = [heights[4] ?? 0, heights[0] ?? 0]; // legs apart (phase pi/2) vs passing (0)
    expect(atPass - atStep).toBeGreaterThan(0.01);
    expect(heights[12]).toBeCloseTo(atStep, 6); // the second dip of the stride
    for (const phase of [0.3, Math.PI / 2, 2.5, 4.4]) {
      posePerson(person, gait(phase, RUN));
      expect(bounds(person).min.y, `run phase ${phase}`).toBeGreaterThanOrEqual(GAP - 1e-6);
    }
    person.dispose();
  });

  it('stand still at speed 0: straight legs and arms, only breathing', () => {
    const person = made();
    posePerson(person, gait(1.2, 0, 0, 0));
    for (const b of [...person.legs, ...person.arms]) expect(b.rotation.x).toBeCloseTo(0, 9);
    expect(person.rig.position.y).toBeCloseTo(GAP, 9);
    const chest = (time: number): number => {
      posePerson(person, gait(0, 0, 0, time));
      return person.bones.spine.position.y;
    };
    expect(chest(P.gait.breathSec / 4) - chest(0)).toBeCloseTo(P.gait.breathM, 6);
    person.dispose();
  });

  it('swing legs from the hips with a knee bend, arms against them, the same for the same gait', () => {
    const person = made();
    posePerson(person, gait(0)); // the left leg passes under the body, swinging forward
    expect(person.bones.shin_l.rotation.x).toBeLessThan(-0.3); // its knee bends
    expect(person.bones.shin_r.rotation.x).toBeCloseTo(0, 6); // the standing leg is straight
    posePerson(person, gait(Math.PI / 2));
    const first = poseOf(person);
    expect(person.legs[0].rotation.x).toBeGreaterThan(0.3);
    expect(person.legs[1].rotation.x).toBeCloseTo(-person.legs[0].rotation.x, 9);
    expect(person.arms[0].rotation.x).toBeLessThan(0); // left arm back while the left leg is forward
    posePerson(person, gait(4, RUN, 90, 3));
    posePerson(person, gait(Math.PI / 2));
    expect(poseOf(person)).toEqual(first);
    person.dispose();
  });

  it('run with a longer stride, bigger swing, bent arms and a forward lean', () => {
    const person = made();
    posePerson(person, gait(Math.PI / 2, WALK));
    const walk = { thigh: person.legs[0].rotation.x, elbow: person.bones.forearm_r.rotation.x, lean: person.bones.spine.rotation.x };
    posePerson(person, gait(Math.PI / 2, RUN));
    expect(strideLength(RUN)).toBeGreaterThan(strideLength(WALK));
    expect(person.legs[0].rotation.x).toBeGreaterThan(walk.thigh + 0.1);
    expect(person.bones.forearm_r.rotation.x).toBeGreaterThan(Math.max(walk.elbow, 1.2)); // ~70+ degrees
    expect(person.bones.spine.rotation.x).toBeCloseTo((-P.gait.runLeanDeg * Math.PI) / 180, 6);
    expect(walk.lean).toBeGreaterThan(person.bones.spine.rotation.x);
    expect(gaitBlend(0)).toEqual({ walk: 0, run: 0 });
    expect(gaitBlend(WALK)).toEqual({ walk: 1, run: 0 });
    expect(gaitBlend(RUN)).toEqual({ walk: 1, run: 1 });
    person.dispose();
  });

  it('lean into turns while moving (left turn: lean left), not while standing', () => {
    const person = made();
    posePerson(person, gait(0, WALK, T.player.turnSpeedDeg));
    expect(person.bones.spine.rotation.z).toBeCloseTo((P.gait.turnLeanDeg * Math.PI) / 180, 6);
    posePerson(person, gait(0, WALK, -T.player.turnSpeedDeg));
    expect(person.bones.spine.rotation.z).toBeLessThan(0);
    posePerson(person, gait(0, 0, T.player.turnSpeedDeg));
    expect(person.bones.spine.rotation.z).toBeCloseTo(0, 9);
    person.dispose();
  });

  it('never snap: a small change of speed, turn or phase is a small change of pose', () => {
    const person = made();
    for (const speed of [0, 0.4, WALK - 0.01, WALK, 4, RUN - 0.01]) {
      for (const phase of [0, 1, 2.2, 4]) {
        posePerson(person, gait(phase, speed, 40));
        const a = poseOf(person);
        posePerson(person, gait(phase + 0.01, speed + 0.01, 41));
        const b = poseOf(person);
        a.forEach((v, i) => expect(Math.abs(v - (b[i] ?? 0)), `speed ${speed} phase ${phase} value ${i}`).toBeLessThan(0.03));
      }
    }
    person.dispose();
  });

  it('move the stride with the distance walked: one stride length is one full cycle', () => {
    for (const speed of [WALK, RUN]) {
      expect(advancePhase(0.5, 0, speed)).toBe(0.5);
      expect(advancePhase(0.5, strideLength(speed), speed)).toBeCloseTo(0.5, 9);
      expect(advancePhase(0, strideLength(speed) / 4, speed)).toBeCloseTo(Math.PI / 2, 9);
    }
  });
});

describe('round people\'s faces, skin and clothes', () => {
  it('wear the face on the front of the head, not mirrored, with plain skin round the back', () => {
    const head = headGeometry();
    const pos = head.getAttribute('position');
    const uv = head.getAttribute('uv');
    for (let i = 0; i < pos.count; i++) {
      const [u, v, x, z] = [uv.getX(i), uv.getY(i), pos.getX(i), pos.getZ(i)];
      const inFace = u > 0.2 && u < 0.8 && v > 0.2 && v < 0.8;
      if (inFace) expect(z, `vertex ${i}`).toBeLessThan(0); // the face's middle is on the front (-Z)
      if (inFace && u < 0.4) expect(x, `vertex ${i}`).toBeGreaterThan(0); // image left = the person's right (+X)
      if (z > P.head.r * 0.5) expect(u < 0 || u > 1 || v < 0 || v > 1, `vertex ${i}`).toBe(true); // the back: the image's edge
    }
    head.dispose();
  });

  it('give the neck and hands the face image\'s plain skin, so skin is one colour', () => {
    const person = made();
    const skin = person.meshes.find((m) => m.name === 'player_skin');
    const pos = skin?.geometry.getAttribute('position');
    const uv = skin?.geometry.getAttribute('uv');
    let others = 0;
    for (let i = 0; pos && uv && i < pos.count; i++) {
      const fromHead = Math.hypot(pos.getX(i), pos.getY(i) - P.head.y, pos.getZ(i));
      if (Math.abs(fromHead - P.head.r) < 1e-5) continue; // the head itself
      others++;
      expect([uv.getX(i), uv.getY(i)]).toEqual([expect.closeTo(P.skinUv[0], 6), expect.closeTo(P.skinUv[1], 6)]);
    }
    expect(others).toBeGreaterThan(100);
    person.dispose();
  });

  it('show each image\'s plain colour until it loads, and that colour is the image\'s (a face: its skin)', () => {
    for (const [image, plain] of Object.entries(P.images) as [PersonImage, string][]) {
      const img = readPng(`public/textures/${image}.png`);
      const seen = average(img, sample(img, image.startsWith('face_')));
      const want = [1, 3, 5].map((i) => parseInt(plain.slice(i, i + 2), 16)); // the hex colour's bytes
      want.forEach((c, k) => expect(Math.abs(c - (seen[k] ?? 0)), `${image} channel ${k}`).toBeLessThan(8));
    }
    const person = made('npc_b');
    const skin = person.meshes.find((m) => m.name === 'npc_b_skin')?.material as THREE.MeshLambertMaterial;
    expect(`#${skin.color.getHexString()}`).toBe(P.images.face_npc_b);
    person.dispose();
  });

  it('dispose their geometries and own material; the shared image materials go with the textures', () => {
    const textures = createPersonTextures(() => new THREE.Texture());
    const person = createPerson(P.looks.player, textures, 'player');
    let disposed = 0;
    const count = (): void => void disposed++;
    const own = new Set<THREE.EventDispatcher<{ dispose: object }>>();
    person.meshes.forEach((m) => own.add(m.geometry));
    own.add(person.meshes.find((m) => m.name === 'player_plain')?.material as THREE.Material);
    own.forEach((x) => x.addEventListener('dispose', count));
    new THREE.Scene().add(person.root);
    person.dispose();
    expect(disposed).toBe(own.size);
    expect(person.root.parent).toBeNull();
    const skin = person.meshes.find((m) => m.name === 'player_skin')?.material as THREE.Material;
    skin.addEventListener('dispose', count);
    textures.dispose();
    expect(disposed).toBe(own.size + 1);
  });
});
