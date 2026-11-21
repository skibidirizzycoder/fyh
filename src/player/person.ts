// person.ts — round people: a capsule body and limbs, a sphere head with a cartoon face, rounded shoes.
// A person is one skinned mesh per material (skin, top, jeans, plain colours) sharing one skeleton
// (body, legs, feet, arms), plus the cap's brim when they wear a cap: at most 5 draw calls.
// The face image wraps the front of the head and its plain-skin edge carries on round the back; the
// neck and hands use a plain-skin spot of the same image. So the skin is one colour with no seams.
// posePerson() sets the walk from a phase and an amount: the same inputs always give the same pose.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { T } from '../tuning.ts';

const P = T.person;
const GAP = T.world.surfaceGap;
const DEG = Math.PI / 180;

/** One of the images in public/textures/ that people wear. */
export type PersonImage = keyof typeof P.images;

/** What a person wears: images for the face, top and legs, plain colours for the rest. */
export interface PersonLook {
  face: PersonImage;
  top: PersonImage;
  legs: PersonImage;
  shoes: string;
  hair: string;
  cap: boolean; // an orange cap (T.player.noseColor) with a brim
  headphones: string | null;
}

/** A person: stand `root` where they are and turn it to face; posePerson() moves the bones. */
export interface Person {
  root: THREE.Group;
  /** The body bone: everything hangs from it, and it bobs while walking. */
  rig: THREE.Bone;
  legs: readonly [THREE.Bone, THREE.Bone]; // left, right
  feet: readonly [THREE.Bone, THREE.Bone]; // at the ankles: they turn back as the legs swing, so shoes stay flat
  arms: readonly [THREE.Bone, THREE.Bone];
  /** The cap's brim, on the local -Z side (forward), or null without a cap. */
  brim: THREE.Mesh | null;
  /** Every mesh: one draw call each. */
  meshes: readonly THREE.Mesh[];
  dispose(): void;
}

/** Loads the people's images once and puts them on materials. The caller disposes it. */
export interface PersonTextures {
  /** Shows `image` on `material` once it has loaded (straight away if it has). */
  dress(material: THREE.MeshLambertMaterial, image: PersonImage): void;
  dispose(): void;
}

const BONES = ['body', 'leg_l', 'leg_r', 'foot_l', 'foot_r', 'arm_l', 'arm_r'] as const;
type BoneName = (typeof BONES)[number];
const LAYERS = ['skin', 'top', 'legs', 'plain'] as const;
type Layer = (typeof LAYERS)[number];

/** One shape of a person, in person space (soles at y = 0): the bone that moves it and its material. */
interface Piece {
  geometry: THREE.BufferGeometry;
  bone: BoneName;
  layer: Layer;
}

/** The one place people get a material: swap MeshLambertMaterial here for a shared (cel) material. */
function personMaterial(color: string, vertexColors = false): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ color, vertexColors });
}

/** A capsule standing upright from y = `bottom` to y = `top`, centred on x = z = 0. */
function capsule(r: number, bottom: number, top: number): THREE.BufferGeometry {
  const g = new THREE.CapsuleGeometry(r, Math.max(0, top - bottom - 2 * r), P.capSegments, P.radialSegments);
  return g.translate(0, (top + bottom) / 2, 0);
}

/** How far the fabric's v runs along an upright capsule: its straight part plus both rounded ends. */
function capsuleArc(r: number, bottom: number, top: number): number {
  return Math.max(0, top - bottom - 2 * r) + Math.PI * r;
}

/** Tiles a fabric over a capsule: whole repeats round it (so no seam) and true-size repeats along it. */
function fabricUvs(geo: THREE.BufferGeometry, round: number, along: number): THREE.BufferGeometry {
  const uv = geo.getAttribute('uv');
  const repeats = Math.max(1, Math.round(round / P.fabricTileM));
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * repeats, (uv.getY(i) * along) / P.fabricTileM);
  return geo;
}

/** Points every vertex at one spot of the image (plain skin on a face image). */
function flatUvs(geo: THREE.BufferGeometry, at: readonly [number, number]): THREE.BufferGeometry {
  const uv = geo.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, at[0], at[1]);
  return geo;
}

/**
 * The head: a sphere whose seam is at the back, with the face image wrapped round its front.
 * The sphere's own u runs from the back, past the person's right (+X), the front (u = 0.5) and the
 * left, to the back again; its v runs from the bottom up. Image UVs outside 0..1 show the image's
 * edge (plain skin), so the back of the head is skin too.
 */
export function headGeometry(): THREE.BufferGeometry {
  const [round, rows] = P.headSegments;
  const head = new THREE.SphereGeometry(P.head.r, round, rows, Math.PI / 2, Math.PI * 2);
  const uv = head.getAttribute('uv');
  const F = P.face;
  for (let i = 0; i < uv.count; i++) {
    const across = (uv.getX(i) - 0.5) * 360; // degrees round from the front (negative: the person's right)
    const below = (1 - uv.getY(i)) * 180; // degrees down from the crown
    uv.setXY(i, 0.5 + across / F.acrossDeg, 0.5 + (F.centreDeg - below) / F.upDownDeg);
  }
  return head.translate(0, P.head.y, 0);
}

/** Gives every vertex one colour (the plain layer's material shows vertex colours). */
function painted(geo: THREE.BufferGeometry, color: string): THREE.BufferGeometry {
  const c = new THREE.Color(color); // converted to linear, like a material colour
  const n = geo.getAttribute('position').count;
  const rgb = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) rgb.set([c.r, c.g, c.b], i * 3);
  geo.setAttribute('color', new THREE.BufferAttribute(rgb, 3));
  return geo;
}

/** Ties every vertex fully to one bone. */
function boneOnly(geo: THREE.BufferGeometry, bone: BoneName): THREE.BufferGeometry {
  const n = geo.getAttribute('position').count;
  const index = new Uint16Array(n * 4);
  const weight = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    index[i * 4] = BONES.indexOf(bone);
    weight[i * 4] = 1;
  }
  geo.setAttribute('skinIndex', new THREE.BufferAttribute(index, 4));
  geo.setAttribute('skinWeight', new THREE.BufferAttribute(weight, 4));
  return geo;
}

/** Torso (the top), hips (jeans), neck and head (skin): they move with the body bone. */
function bodyPieces(): Piece[] {
  const { torso: t, hips: h, neck: n } = P;
  const torso = capsule(t.r, -(t.top - t.bottom) / 2, (t.top - t.bottom) / 2).scale(t.widen, 1, t.depth);
  fabricUvs(torso, Math.PI * t.r * (t.widen + t.depth), capsuleArc(t.r, t.bottom, t.top));
  const hips = new THREE.CapsuleGeometry(h.r, h.width, P.capSegments, P.radialSegments).rotateZ(Math.PI / 2);
  fabricUvs(hips.scale(1, 1, h.depth), 2 * Math.PI * h.r, h.width + Math.PI * h.r);
  return [
    { geometry: torso.translate(0, (t.top + t.bottom) / 2, 0), bone: 'body', layer: 'top' },
    { geometry: hips.translate(0, h.y, 0), bone: 'body', layer: 'legs' },
    { geometry: flatUvs(capsule(n.r, n.bottom, n.top), P.skinUv), bone: 'body', layer: 'skin' },
    { geometry: headGeometry(), bone: 'body', layer: 'skin' },
  ];
}

/** A leg (jeans) hanging from the hip on side `s` (-1 left, +1 right), with its shoe on the foot bone. */
function legPieces(s: -1 | 1, look: PersonLook): Piece[] {
  const { leg, shoe } = P;
  const bone: BoneName = s < 0 ? 'leg_l' : 'leg_r';
  const foot: BoneName = s < 0 ? 'foot_l' : 'foot_r';
  const x = s * P.legX;
  const top = P.hipY + leg.top;
  const bottom = P.hipY + leg.bottom;
  const jeans = fabricUvs(capsule(leg.r, bottom, top), 2 * Math.PI * leg.r, capsuleArc(leg.r, bottom, top));
  const sole = new THREE.CapsuleGeometry(shoe.r, shoe.length, P.capSegments, P.radialSegments).rotateX(Math.PI / 2);
  sole.scale(1, shoe.squash, 1).translate(x, ankleY(), -shoe.forward); // toe forward, sole on the ground
  return [
    { geometry: jeans.translate(x, 0, 0), bone, layer: 'legs' },
    { geometry: painted(sole, look.shoes), bone: foot, layer: 'plain' },
  ];
}

/** An arm (a sleeve of the top) with its hand, hanging from the shoulder on side `s`, leaning out a little. */
function armPieces(s: -1 | 1): Piece[] {
  const { arm, hand } = P;
  const bone: BoneName = s < 0 ? 'arm_l' : 'arm_r';
  const lean = s * P.armOutDeg * DEG;
  const sleeve = fabricUvs(capsule(arm.r, arm.bottom, arm.top), 2 * Math.PI * arm.r, capsuleArc(arm.r, arm.bottom, arm.top));
  const palm = flatUvs(new THREE.SphereGeometry(hand.r, P.radialSegments, P.capSegments * 2).translate(0, hand.y, 0), P.skinUv);
  const atShoulder = (g: THREE.BufferGeometry): THREE.BufferGeometry => g.rotateZ(lean).translate(s * P.armX, P.shoulderY, 0);
  return [
    { geometry: atShoulder(sleeve), bone, layer: 'top' },
    { geometry: atShoulder(palm), bone, layer: 'skin' },
  ];
}

/** Part of a sphere round the head: `from`..`to` degrees down from the crown, `arcDeg` round the back. */
function headShell(r: number, fromDeg: number, toDeg: number, arcDeg = 360): THREE.BufferGeometry {
  const rows = Math.max(2, Math.round((P.headSegments[1] * (toDeg - fromDeg)) / 180));
  const phiStart = Math.PI / 2 - (arcDeg * DEG) / 2; // centred on the back (+Z)
  const shell = new THREE.SphereGeometry(r, P.headSegments[0], rows, phiStart, arcDeg * DEG, fromDeg * DEG, (toDeg - fromDeg) * DEG);
  return shell.translate(0, P.head.y, 0);
}

/** Hair (a cap over the crown instead, when they wear one) and headphones: plain colours on the body bone. */
function headwearPieces(look: PersonLook): Piece[] {
  const { head, hair, cap, headphones: hp } = P;
  const hairR = head.r + hair.gapM;
  const shells = [painted(headShell(hairR, hair.crownDeg, hair.backDeg, hair.backArcDeg), look.hair)];
  const crownR = look.cap ? head.r + cap.gapM : hairR;
  shells.push(painted(headShell(crownR, 0, hair.crownDeg), look.cap ? T.player.noseColor : look.hair));
  if (look.headphones) {
    const band = new THREE.TorusGeometry(crownR + hp.band, hp.band, 6, P.headSegments[0], Math.PI); // over the top, ear to ear
    shells.push(painted(band.translate(0, head.y, 0), look.headphones));
    for (const s of [-1, 1]) {
      const cup = new THREE.CylinderGeometry(hp.cupR, hp.cupR, hp.cupH, P.radialSegments).rotateZ(Math.PI / 2);
      shells.push(painted(cup.translate(s * (head.r + hp.cupOut), head.y, 0), look.headphones));
    }
  }
  return shells.map((geometry) => ({ geometry, bone: 'body', layer: 'plain' }));
}

/** Every piece of a person in this look. */
function personPieces(look: PersonLook): Piece[] {
  return [
    ...bodyPieces(),
    ...legPieces(-1, look),
    ...legPieces(1, look),
    ...armPieces(-1),
    ...armPieces(1),
    ...headwearPieces(look),
  ];
}

/** Height of the ankle (the foot bone): the middle of the shoe. */
function ankleY(): number {
  return P.shoe.r * P.shoe.squash;
}

/** The bones, standing (the body bone at y = 0 while binding); legs and arms hang from the body, feet from the legs. */
function makeBones(name: string): Record<BoneName, THREE.Bone> {
  const bones = {} as Record<BoneName, THREE.Bone>;
  for (const b of BONES) {
    bones[b] = new THREE.Bone();
    bones[b].name = `${name}_${b}`;
  }
  bones.leg_l.position.set(-P.legX, P.hipY, 0);
  bones.leg_r.position.set(P.legX, P.hipY, 0);
  bones.arm_l.position.set(-P.armX, P.shoulderY, 0);
  bones.arm_r.position.set(P.armX, P.shoulderY, 0);
  bones.foot_l.position.set(0, ankleY() - P.hipY, 0);
  bones.foot_r.position.set(0, ankleY() - P.hipY, 0);
  bones.leg_l.add(bones.foot_l);
  bones.leg_r.add(bones.foot_r);
  bones.body.add(bones.leg_l, bones.leg_r, bones.arm_l, bones.arm_r);
  return bones;
}

/** The materials, one per layer: plain colours until the images load. */
function layerMaterials(look: PersonLook, textures: PersonTextures): Record<Layer, THREE.MeshLambertMaterial> {
  const m = {
    skin: personMaterial(P.images[look.face]),
    top: personMaterial(P.images[look.top]),
    legs: personMaterial(P.images[look.legs]),
    plain: personMaterial('#ffffff', true),
  };
  textures.dress(m.skin, look.face);
  textures.dress(m.top, look.top);
  textures.dress(m.legs, look.legs);
  return m;
}

/** Merges one layer's pieces into one skinned mesh (null if the layer is empty). */
function layerMesh(pieces: Piece[], material: THREE.Material, name: string): THREE.SkinnedMesh | null {
  if (pieces.length === 0) return null;
  const parts = pieces.map((p) => boneOnly(p.geometry, p.bone));
  const merged = mergeGeometries(parts);
  parts.forEach((g) => g.dispose());
  if (!merged) throw new Error(`could not merge ${name}`);
  const mesh = new THREE.SkinnedMesh(merged, material);
  mesh.name = name;
  return mesh;
}

/** The cap's brim: a flat oval out front, on the body bone (plain colours, like the cap). */
function makeBrim(material: THREE.Material, name: string): THREE.Mesh {
  const b = P.brim;
  const geo = painted(new THREE.CylinderGeometry(b.r, b.r, b.h, P.radialSegments * 2).scale(1, 1, b.depth), T.player.noseColor);
  const brim = new THREE.Mesh(geo, material);
  brim.name = `${name}_brim`;
  brim.position.set(0, b.y, b.z); // local -Z = forward
  return brim;
}

/** Sets each skinned mesh's drawn-or-not sphere from the standing pose, with room for swinging limbs. */
function fitCullSpheres(meshes: readonly THREE.SkinnedMesh[]): void {
  for (const mesh of meshes) {
    mesh.computeBoundingSphere();
    if (mesh.boundingSphere) mesh.boundingSphere.radius += P.cullMarginM;
  }
}

/** Builds a person in a look, standing at the origin facing -Z. `name` prefixes every part's name. */
export function createPerson(look: PersonLook, textures: PersonTextures, name = 'person'): Person {
  const bones = makeBones(name);
  const root = new THREE.Group();
  root.name = name;
  root.add(bones.body);
  root.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(BONES.map((b) => bones[b]));
  const materials = layerMaterials(look, textures);
  const pieces = personPieces(look);
  const skinned = LAYERS.flatMap((layer) => {
    const mesh = layerMesh(pieces.filter((p) => p.layer === layer), materials[layer], `${name}_${layer}`);
    return mesh ? [mesh] : [];
  });
  skinned.forEach((mesh) => {
    root.add(mesh);
    mesh.bind(skeleton); // the standing pose is the bind pose
  });
  const brim = look.cap ? makeBrim(materials.plain, name) : null;
  if (brim) bones.body.add(brim);
  bones.body.position.y = GAP; // the soles stand just above the ground
  root.updateMatrixWorld(true);
  fitCullSpheres(skinned);
  const meshes: THREE.Mesh[] = brim ? [...skinned, brim] : skinned;

  function dispose(): void {
    meshes.forEach((m) => m.geometry.dispose());
    Object.values(materials).forEach((m) => m.dispose());
    skeleton.dispose();
    root.removeFromParent();
  }

  return {
    root, rig: bones.body, brim, meshes, dispose,
    legs: [bones.leg_l, bones.leg_r], feet: [bones.foot_l, bones.foot_r], arms: [bones.arm_l, bones.arm_r],
  };
}

/**
 * Poses a walking person: `phase` (radians) is where they are in their stride, `amount` (0..1) how
 * hard they walk (0 = standing). Legs swing (their shoes stay flat), each arm with the opposite leg,
 * and the body bobs.
 */
export function posePerson(person: Person, phase: number, amount: number): void {
  const swing = Math.sin(phase) * amount;
  const leg = P.legSwingDeg * DEG * swing;
  const arm = P.armSwingDeg * DEG * swing;
  person.legs[0].rotation.x = leg;
  person.legs[1].rotation.x = -leg;
  person.feet[0].rotation.x = -leg;
  person.feet[1].rotation.x = leg;
  person.arms[0].rotation.x = -arm;
  person.arms[1].rotation.x = arm;
  person.rig.position.y = GAP + P.bobM * amount * Math.sin(phase) ** 2;
}

/** Puts a loaded image on a material: the image's own colours replace the plain one. */
function wear(material: THREE.MeshLambertMaterial, texture: THREE.Texture): void {
  material.map = texture;
  material.color.set('#ffffff');
  material.needsUpdate = true;
}

/** Starts loading one image from public/textures/; fabrics repeat, faces stretch their edge. */
function loadImage(image: PersonImage, onLoad: () => void): THREE.Texture {
  const texture = new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}textures/${image}.png`, onLoad);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  if (image.startsWith('fabric_')) texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

/** The people's images, each loaded once. Without a page (unit tests) nothing loads: plain colours stay. */
export function createPersonTextures(): PersonTextures {
  const textures = new Map<PersonImage, THREE.Texture>();
  const ready = new Set<PersonImage>();
  const waiting = new Map<PersonImage, THREE.MeshLambertMaterial[]>();
  const canLoad = typeof document !== 'undefined';

  function start(image: PersonImage): THREE.Texture {
    const texture = loadImage(image, () => {
      ready.add(image);
      waiting.get(image)?.forEach((m) => wear(m, texture));
      waiting.delete(image);
    });
    textures.set(image, texture);
    return texture;
  }

  function dress(material: THREE.MeshLambertMaterial, image: PersonImage): void {
    if (!canLoad) return;
    const texture = textures.get(image) ?? start(image);
    if (ready.has(image)) wear(material, texture);
    else waiting.set(image, [...(waiting.get(image) ?? []), material]);
  }

  function dispose(): void {
    textures.forEach((t) => t.dispose());
    textures.clear();
    waiting.clear();
  }

  return { dress, dispose };
}
