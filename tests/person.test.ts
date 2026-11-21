// person.test.ts — round people: few draw calls, a face on the front, skin with no seams, a walk that
// is the same for the same inputs, and plain colours that match the images they stand in for.
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createPerson, createPersonTextures, headGeometry, posePerson, type Person, type PersonImage } from '../src/player/person.ts';
import { T } from '../src/tuning.ts';

const P = T.person;
const GAP = T.world.surfaceGap;
const LOOKS = Object.entries(P.looks);

/** A person in a look, with textures that never load (tests have no page). */
function made(look: keyof typeof P.looks = 'player'): Person {
  return createPerson(P.looks[look], createPersonTextures(), look);
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

  it('never sink into the ground mid-stride, and bob up while walking', () => {
    const person = made();
    for (const phase of [0.4, Math.PI / 2, 2, Math.PI, 4.2, (3 * Math.PI) / 2]) {
      posePerson(person, phase, 1);
      expect(bounds(person).min.y, `phase ${phase}`).toBeGreaterThanOrEqual(GAP - 1e-6);
    }
    posePerson(person, Math.PI / 2, 1);
    expect(person.rig.position.y).toBeCloseTo(GAP + P.bobM, 9);
    person.dispose();
  });

  it('pose the same for the same inputs; standing still at amount 0; each arm with the other leg', () => {
    const person = made();
    const pose = () => [...person.legs, ...person.arms].map((b) => b.rotation.x).concat(person.rig.position.y);
    posePerson(person, 1.3, 0.6);
    const first = pose();
    posePerson(person, 4, 1);
    posePerson(person, 1.3, 0.6);
    expect(pose()).toEqual(first);
    const [legL, legR, armL, armR] = first;
    expect(legL).toBeCloseTo(-(legR ?? 0), 9);
    expect(Math.sign(armL ?? 0)).toBe(-Math.sign(legL ?? 0));
    expect(armR).toBeCloseTo(-(armL ?? 0), 9);
    posePerson(person, 1.3, 0);
    expect(pose()).toEqual([0, -0, -0, 0, GAP].map((v) => expect.closeTo(v, 12)));
    person.dispose();
  });

  it('skin the limbs to their bones: a swung leg carries its shoe', () => {
    const person = made();
    const plain = person.meshes.find((m) => m.name === 'player_plain') as THREE.SkinnedMesh;
    const pos = plain.geometry.getAttribute('position');
    let toe = 0; // the left shoe's front-most vertex
    for (let i = 0; i < pos.count; i++) if (pos.getX(i) < 0 && pos.getY(i) < 0.2 && pos.getZ(i) < pos.getZ(toe)) toe = i;
    person.root.updateMatrixWorld(true);
    const standing = plain.getVertexPosition(toe, new THREE.Vector3());
    expect(standing.y).toBeCloseTo(pos.getY(toe) + GAP, 6);
    posePerson(person, Math.PI / 2, 1); // left leg swung its full way
    person.root.updateMatrixWorld(true);
    const swung = plain.getVertexPosition(toe, new THREE.Vector3());
    expect(Math.abs(swung.z - standing.z)).toBeGreaterThan(0.2);
    expect(swung.y).toBeGreaterThan(standing.y);
    person.dispose();
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

  it('dispose every geometry, material and the skeleton', () => {
    const person = made();
    let disposed = 0;
    const count = (): void => void disposed++;
    const things = new Set<THREE.EventDispatcher<{ dispose: object }>>();
    person.meshes.forEach((m) => [m.geometry, m.material as THREE.Material].forEach((x) => things.add(x)));
    things.forEach((x) => x.addEventListener('dispose', count));
    person.root.parent?.remove(person.root);
    new THREE.Scene().add(person.root);
    person.dispose();
    expect(disposed).toBe(things.size);
    expect(person.root.parent).toBeNull();
  });
});
