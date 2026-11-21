// person.ts — round people: a capsule body and limbs, a sphere head with a cartoon face, rounded shoes.
// A person is one skinned mesh per material (skin, top, jeans, plain colours) sharing one skeleton
// (body, hips, spine, head, thighs, shins, feet, upper arms, forearms), plus the cap's brim when they wear
// a cap: at most 5 draw calls. Materials are the street's cel materials (src/world/materials.ts).
// The face image shows on the front of the head (the cel shader's front-face picture), and the head,
// neck and hands are the image's own skin colour, so the skin has no seams.
// posePerson() sets a walk, run or idle pose from a Gait: the same gait always gives the same pose.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { forwardFromYaw } from '../core/facing.ts';
import { T } from '../tuning.ts';
import { SHADE_ATTRIBUTE, celVertexMaterial, createMaterials, shadeColor, type TextureLoad } from '../world/materials.ts';

const P = T.person;
const G = T.person.gait;
const GAP = T.world.surfaceGap;
const DEG = Math.PI / 180;
const UP = new THREE.Vector3(0, 1, 0);

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

const BONES = [
  'body', 'hips', 'spine', 'head', 'leg_l', 'leg_r', 'shin_l', 'shin_r', 'foot_l', 'foot_r', 'arm_l', 'arm_r', 'forearm_l', 'forearm_r',
] as const;
type BoneName = (typeof BONES)[number];
const LAYERS = ['skin', 'top', 'legs', 'plain'] as const;
type Layer = (typeof LAYERS)[number];

/** A person: stand `root` where they are and turn it to face; posePerson() moves the bones. */
export interface Person {
  root: THREE.Group;
  /** Every bone by name (`leg_*` are the thighs, `arm_*` the upper arms). */
  bones: Readonly<Record<BoneName, THREE.Bone>>;
  /** The body bone: everything hangs from it, and it rises and falls while walking. */
  rig: THREE.Bone;
  legs: readonly [THREE.Bone, THREE.Bone]; // the thighs, left and right
  arms: readonly [THREE.Bone, THREE.Bone]; // the upper arms
  /** The cap's brim, on the local -Z side (forward), or null without a cap. */
  brim: THREE.Mesh | null;
  /** Every mesh: one draw call each. */
  meshes: readonly THREE.Mesh[];
  dispose(): void;
}

/** How someone is moving right now: all a pose needs. */
export interface Gait {
  phase: number; // radians through the stride (move it on with advancePhase)
  speed: number; // metres per second, either way (0 = standing)
  turnRate: number; // degrees per second, + = turning left
  time: number; // seconds of game time (for breathing)
  look?: number; // radians the head turns from straight ahead (+ = left), e.g. towards what they could use
  cheer?: number; // how far through a cheer (0..1; none outside that)
}

/** The people's images as cel materials, each loaded once. The caller disposes it. */
export interface PersonTextures {
  /** The material for a face or fabric image (its plain colour until it loads). */
  material(image: PersonImage): THREE.MeshLambertMaterial;
  dispose(): void;
}

/** One shape of a person, in person space (soles at y = 0, facing -Z): the bone that moves it and its material. */
interface Piece {
  geometry: THREE.BufferGeometry;
  bone: BoneName;
  layer: Layer;
}

// ---------- shapes ----------

/** A capsule standing upright from y = `bottom` to y = `top`, centred on x = z = 0. */
function capsule(r: number, bottom: number, top: number): THREE.BufferGeometry {
  const g = new THREE.CapsuleGeometry(r, Math.max(0, top - bottom - 2 * r), P.capSegments, P.radialSegments);
  return g.translate(0, (top + bottom) / 2, 0);
}

/** An upright capsule tiled with fabric: whole repeats round it (no seam), true-size repeats along it. */
function fabricCapsule(r: number, bottom: number, top: number, round = 2 * Math.PI * r): THREE.BufferGeometry {
  const geo = capsule(r, bottom, top);
  const along = Math.max(0, top - bottom - 2 * r) + Math.PI * r;
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
 * The head: a sphere (seam at the back) with the face image wrapped round its front. The sphere's own
 * u runs from the back past the person's right (+X), the front (u = 0.5) and the left; its v runs up.
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

/** Gives every vertex one colour and its cel shade tone (the plain layer's material reads both). */
function painted(geo: THREE.BufferGeometry, color: string): THREE.BufferGeometry {
  const n = geo.getAttribute('position').count;
  const solid = (c: THREE.Color): THREE.BufferAttribute => {
    const rgb = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) rgb.set([c.r, c.g, c.b], i * 3);
    return new THREE.BufferAttribute(rgb, 3);
  };
  geo.setAttribute('color', solid(new THREE.Color(color))); // converted to linear, like a material colour
  geo.setAttribute(SHADE_ATTRIBUTE, solid(shadeColor(color)));
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

/** Torso (the top), neck and head (skin) on the spine; the hips (jeans) on the hips bone. */
function bodyPieces(): Piece[] {
  const { torso: t, hips: h, neck: n } = P;
  const half = (t.top - t.bottom) / 2;
  const torso = fabricCapsule(t.r, -half, half, Math.PI * t.r * (t.widen + t.depth)).scale(t.widen, 1, t.depth);
  const hips = fabricCapsule(h.r, -h.width / 2 - h.r, h.width / 2 + h.r).rotateZ(Math.PI / 2).scale(1, 1, h.depth);
  return [
    { geometry: torso.translate(0, t.bottom + half, 0), bone: 'spine', layer: 'top' },
    { geometry: hips.translate(0, h.y, 0), bone: 'hips', layer: 'legs' },
    { geometry: flatUvs(capsule(n.r, n.bottom, n.top), P.skinUv), bone: 'spine', layer: 'skin' },
    { geometry: headGeometry(), bone: 'head', layer: 'skin' },
  ];
}

/** A leg on side `s` (-1 left, +1 right): thigh and shin (jeans) meeting in round caps at the knee, and a shoe. */
function legPieces(s: -1 | 1, look: PersonLook): Piece[] {
  const { leg, shoe } = P;
  const side = s < 0 ? 'l' : 'r';
  const x = s * P.legX;
  const thigh = fabricCapsule(leg.r, P.kneeY - leg.r, P.hipY + leg.top);
  const shin = fabricCapsule(leg.r, leg.bottom, P.kneeY + leg.r);
  const sole = new THREE.CapsuleGeometry(shoe.r, shoe.length, P.capSegments, P.radialSegments).rotateX(Math.PI / 2);
  sole.scale(1, shoe.squash, 1).translate(x, ankleY(), -shoe.forward); // toe forward, sole on the ground
  return [
    { geometry: thigh.translate(x, 0, 0), bone: `leg_${side}`, layer: 'legs' },
    { geometry: shin.translate(x, 0, 0), bone: `shin_${side}`, layer: 'legs' },
    { geometry: painted(sole, look.shoes), bone: `foot_${side}`, layer: 'plain' },
  ];
}

/** An arm on side `s`: upper arm and forearm (sleeve) meeting at the elbow, and a hand, leaning out a little. */
function armPieces(s: -1 | 1): Piece[] {
  const { arm, hand } = P;
  const side = s < 0 ? 'l' : 'r';
  const atShoulder = (g: THREE.BufferGeometry): THREE.BufferGeometry => g.rotateZ(s * P.armOutDeg * DEG).translate(s * P.armX, P.shoulderY, 0);
  const upper = fabricCapsule(arm.r, -P.elbowDrop - arm.r, arm.top);
  const fore = fabricCapsule(arm.r, arm.bottom, -P.elbowDrop + arm.r);
  const palm = flatUvs(new THREE.SphereGeometry(hand.r, P.radialSegments, P.capSegments * 2).translate(0, hand.y, 0), P.skinUv);
  return [
    { geometry: atShoulder(upper), bone: `arm_${side}`, layer: 'top' },
    { geometry: atShoulder(fore), bone: `forearm_${side}`, layer: 'top' },
    { geometry: atShoulder(palm), bone: `forearm_${side}`, layer: 'skin' },
  ];
}

/** Part of a sphere round the head: `from`..`to` degrees down from the crown, `arcDeg` round the back. */
function headShell(r: number, fromDeg: number, toDeg: number, arcDeg = 360): THREE.BufferGeometry {
  const rows = Math.max(2, Math.round((P.headSegments[1] * (toDeg - fromDeg)) / 180));
  const phiStart = Math.PI / 2 - (arcDeg * DEG) / 2; // centred on the back (+Z)
  const shell = new THREE.SphereGeometry(r, P.headSegments[0], rows, phiStart, arcDeg * DEG, fromDeg * DEG, (toDeg - fromDeg) * DEG);
  return shell.translate(0, P.head.y, 0);
}

/** Hair (a cap over the crown instead, when they wear one) and headphones: plain colours on the head bone. */
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
  return shells.map((geometry) => ({ geometry, bone: 'head', layer: 'plain' }));
}

/** Every piece of a person in this look. */
function personPieces(look: PersonLook): Piece[] {
  return [...bodyPieces(), ...legPieces(-1, look), ...legPieces(1, look), ...armPieces(-1), ...armPieces(1), ...headwearPieces(look)];
}

// ---------- skeleton and meshes ----------

/** Height of the ankle (the foot bone): the middle of the shoe. */
function ankleY(): number {
  return P.shoe.r * P.shoe.squash;
}

/** Where each bone sits on its parent, standing (the body bone at the soles, under the root). */
function boneLayout(): Record<BoneName, { parent: BoneName | null; at: [number, number, number] }> {
  const knee = P.kneeY - P.hipY;
  const elbow: [number, number, number] = [0, -P.elbowDrop, 0];
  return {
    body: { parent: null, at: [0, 0, 0] },
    hips: { parent: 'body', at: [0, P.hipY, 0] },
    spine: { parent: 'body', at: [0, P.hipY, 0] },
    head: { parent: 'spine', at: [0, P.neck.bottom - P.hipY, 0] }, // turns at the bottom of the neck
    leg_l: { parent: 'hips', at: [-P.legX, 0, 0] },
    leg_r: { parent: 'hips', at: [P.legX, 0, 0] },
    shin_l: { parent: 'leg_l', at: [0, knee, 0] },
    shin_r: { parent: 'leg_r', at: [0, knee, 0] },
    foot_l: { parent: 'shin_l', at: [0, ankleY() - P.kneeY, 0] },
    foot_r: { parent: 'shin_r', at: [0, ankleY() - P.kneeY, 0] },
    arm_l: { parent: 'spine', at: [-P.armX, P.shoulderY - P.hipY, 0] },
    arm_r: { parent: 'spine', at: [P.armX, P.shoulderY - P.hipY, 0] },
    forearm_l: { parent: 'arm_l', at: elbow },
    forearm_r: { parent: 'arm_r', at: elbow },
  };
}

/** The bones, standing. Upper arms lean out like their sleeves; forearms hang along them. */
function makeBones(name: string): Record<BoneName, THREE.Bone> {
  const layout = boneLayout();
  const bones = {} as Record<BoneName, THREE.Bone>;
  for (const b of BONES) {
    bones[b] = new THREE.Bone();
    bones[b].name = `${name}_${b}`;
    bones[b].position.set(...layout[b].at);
  }
  for (const b of BONES) {
    const parent = layout[b].parent;
    if (parent) bones[parent].add(bones[b]);
  }
  bones.arm_l.rotation.z = -P.armOutDeg * DEG;
  bones.arm_r.rotation.z = P.armOutDeg * DEG;
  return bones;
}

/** Merges one layer's pieces into one skinned mesh, built facing +Z (null if the layer is empty). */
function layerMesh(pieces: Piece[], material: THREE.Material, name: string): THREE.SkinnedMesh | null {
  if (pieces.length === 0) return null;
  const parts = pieces.map((p) => boneOnly(p.geometry, p.bone).rotateY(Math.PI));
  const merged = mergeGeometries(parts);
  parts.forEach((g) => g.dispose());
  if (!merged) throw new Error(`could not merge ${name}`);
  const mesh = new THREE.SkinnedMesh(merged, material);
  mesh.name = name;
  return mesh;
}

/** The cap's brim: a flat oval out front, on the head bone (plain colours, like the cap). */
function makeBrim(material: THREE.Material, name: string): THREE.Mesh {
  const b = P.brim;
  const geo = painted(new THREE.CylinderGeometry(b.r, b.r, b.h, P.radialSegments * 2).scale(1, 1, b.depth), T.player.noseColor);
  const brim = new THREE.Mesh(geo, material);
  brim.name = `${name}_brim`;
  brim.position.set(0, b.y - P.neck.bottom, b.z); // local -Z = forward
  return brim;
}

/** Sets each skinned mesh's drawn-or-not sphere from the standing pose, with room for swinging limbs. */
function fitCullSpheres(meshes: readonly THREE.SkinnedMesh[]): void {
  for (const mesh of meshes) {
    mesh.computeBoundingSphere();
    if (mesh.boundingSphere) mesh.boundingSphere.radius += P.cullMarginM;
  }
}

/** The four materials: the look's images (shared, from `textures`) and a plain vertex-colour one of its own. */
function layerMaterials(look: PersonLook, textures: PersonTextures): Record<Layer, THREE.Material> {
  return { skin: textures.material(look.face), top: textures.material(look.top), legs: textures.material(look.legs), plain: celVertexMaterial() };
}

/**
 * Builds a person in a look, standing at the origin facing -Z. `name` prefixes every part's name.
 * The skinned meshes are built facing +Z and turned round: the cel shader shows a picture on +Z
 * faces only, and that way it is the face.
 */
export function createPerson(look: PersonLook, textures: PersonTextures, name = 'person'): Person {
  const bones = makeBones(name);
  const root = new THREE.Group();
  root.name = name;
  const turned = new THREE.Group(); // the skinned meshes, built facing +Z, turned to face -Z
  turned.rotation.y = Math.PI;
  root.add(bones.body, turned);
  root.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(BONES.map((b) => bones[b]));
  const materials = layerMaterials(look, textures);
  const pieces = personPieces(look);
  const skinned = LAYERS.flatMap((layer) => {
    const mesh = layerMesh(pieces.filter((p) => p.layer === layer), materials[layer], `${name}_${layer}`);
    return mesh ? [mesh] : [];
  });
  skinned.forEach((mesh) => {
    turned.add(mesh);
    mesh.bind(skeleton); // the standing pose is the bind pose
  });
  const brim = look.cap ? makeBrim(materials.plain, name) : null;
  if (brim) bones.head.add(brim);
  bones.body.position.y = GAP; // the soles stand just above the ground
  root.updateMatrixWorld(true);
  fitCullSpheres(skinned);
  const meshes: THREE.Mesh[] = brim ? [...skinned, brim] : skinned;

  function dispose(): void {
    meshes.forEach((m) => m.geometry.dispose());
    materials.plain.dispose(); // the image materials belong to `textures`
    skeleton.dispose();
    root.removeFromParent();
  }

  return { root, bones, rig: bones.body, legs: [bones.leg_l, bones.leg_r], arms: [bones.arm_l, bones.arm_r], brim, meshes, dispose };
}

/** The people's images as shared cel materials: faces on the front, fabrics tiled. A missing image leaves the plain colour. */
export function createPersonTextures(load?: TextureLoad): PersonTextures {
  const library = createMaterials(load);
  return {
    material: (image) => library.shared({
      color: P.images[image],
      texture: `textures/${image}.png`,
      repeat: image.startsWith('fabric_') ? [1, 1] : null, // UVs already tile fabrics at true size
    }),
    dispose: () => library.dispose(),
  };
}

// ---------- the walk ----------

/**
 * How far to turn the head (radians, + = left) to look from someone standing at `from` (facing
 * yawDeg) towards a point, at most T.person.gait.lookMaxDeg either way. Null point: straight ahead.
 */
export function lookAngle(from: { x: number; z: number; yawDeg: number }, at: { x: number; z: number } | null): number {
  if (!at) return 0;
  const f = forwardFromYaw(from.yawDeg);
  const left = forwardFromYaw(from.yawDeg + 90);
  const d = { x: at.x - from.x, z: at.z - from.z };
  const angle = Math.atan2(d.x * left.x + d.z * left.z, d.x * f.x + d.z * f.z);
  const max = G.lookMaxDeg * DEG;
  return Math.max(-max, Math.min(max, angle));
}

/** Smooth 0..1 ramp of x between a and b. */
function ramp(x: number, a: number, b: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** How much of a walk and of a run a speed is: walk 0..1 up to walking speed, run 0..1 from there to running speed. */
export function gaitBlend(speed: number): { walk: number; run: number } {
  const walkSpeed = T.player.speed;
  return { walk: ramp(speed, 0, walkSpeed), run: ramp(speed, walkSpeed, walkSpeed * T.player.runMultiplier) };
}

/** Metres per full stride at a speed: longer when running. */
export function strideLength(speed: number): number {
  return G.walkStrideM + (G.runStrideM - G.walkStrideM) * gaitBlend(speed).run;
}

/**
 * Eases a pose input (speed, turn rate) towards its target over `steps` game steps, with a lag of
 * T.person.gait.poseEaseSec: stopping or turning never snaps the body. No steps: straight there.
 */
export function easePose(current: number, target: number, steps: number | undefined): number {
  if (steps === undefined) return target;
  const keep = Math.exp(-Math.max(0, steps) / (G.poseEaseSec * T.loop.stepsPerSecond));
  return target + (current - target) * keep;
}

/** Moves a stride phase on by a distance walked at a speed (distance, not time: feet don't slide). */
export function advancePhase(phase: number, moved: number, speed: number): number {
  return (phase + (moved / strideLength(speed)) * Math.PI * 2) % (Math.PI * 2);
}

/** A leg's angles at a phase: thigh swing (+ = forward) and knee bend, in radians. */
function legAngles(phase: number, speed: number): { thigh: number; knee: number } {
  const { walk, run } = gaitBlend(speed);
  const legLen = P.hipY - ankleY();
  const reach = Math.asin(Math.min(0.9, strideLength(speed) / (4 * legLen))); // the swing that covers the stride
  const bend = (G.walkKneeDeg + (G.runKneeDeg - G.walkKneeDeg) * run) * DEG;
  const thigh = reach * Math.sin(phase) * walk;
  const knee = (G.runKneeBaseDeg * DEG * run + bend * Math.max(0, Math.cos(phase))) * walk; // bent as it swings forward
  return { thigh, knee };
}

/** How high a leg reaches from hip to ankle with these angles. */
function legHeight(a: { thigh: number; knee: number }): number {
  const thighLen = P.hipY - P.kneeY;
  const shinLen = P.kneeY - ankleY();
  return thighLen * Math.cos(a.thigh) + shinLen * Math.cos(a.thigh - a.knee);
}

/** Sets a leg's bones: thigh swing, knee bend, and the foot turned back so the shoe stays flat. */
function poseLeg(person: Person, side: 'l' | 'r', a: { thigh: number; knee: number }): void {
  const b = person.bones;
  b[`leg_${side}`].rotation.x = a.thigh;
  b[`shin_${side}`].rotation.x = -a.knee;
  b[`foot_${side}`].rotation.x = a.knee - a.thigh;
}

/** Sets an arm's bones: swing from the shoulder (+ = forward) and elbow bend (+ = hand up and forward). */
function poseArm(person: Person, side: 'l' | 'r', swing: number, elbow: number): void {
  person.bones[`arm_${side}`].rotation.set(swing, 0, (side === 'l' ? -1 : 1) * P.armOutDeg * DEG);
  person.bones[`forearm_${side}`].rotation.x = elbow;
}

/** Sets the upper body: forward lean (more when running), lean into turns, twist against the hips, sway and breath. */
function poseSpine(person: Person, gait: Gait, walk: number, run: number): void {
  const s = Math.sin(gait.phase);
  const turn = Math.max(-1, Math.min(1, gait.turnRate / T.player.turnSpeedDeg));
  const lean = (G.walkLeanDeg + (G.runLeanDeg - G.walkLeanDeg) * run) * DEG * walk;
  const b = person.bones;
  b.hips.rotation.y = -G.hipTwistDeg * DEG * s * walk;
  b.spine.rotation.set(-lean, G.shoulderTwistDeg * DEG * s * walk, G.turnLeanDeg * DEG * turn * walk);
  const breath = G.breathM * Math.sin((gait.time / G.breathSec) * Math.PI * 2) * (1 - walk);
  b.spine.position.set(G.swayM * s * walk, P.hipY + breath, 0);
}

/** How much of a cheer shows at its progress `t` (0..1): in quickly, held, out at the end; 0 outside. */
export function cheerAmount(t: number): number {
  const C = G.cheer;
  if (t <= 0 || t >= 1) return 0;
  return ramp(t, 0, C.inShare) * (1 - ramp(t, 1 - C.outShare, 1));
}

/** Cheers on top of the pose: arms up and out over the head, the head tipped up, and hops with a crouch between them. */
function poseCheer(person: Person, t: number): void {
  const C = G.cheer;
  const up = cheerAmount(t);
  if (up <= 0) return;
  const b = person.bones;
  for (const [side, s] of [['l', -1], ['r', 1]] as const) {
    const arm = b[`arm_${side}`];
    arm.rotation.x += (C.armDeg * DEG - arm.rotation.x) * up;
    arm.rotation.z = s * (P.armOutDeg + C.spreadDeg * up) * DEG;
    const fore = b[`forearm_${side}`];
    fore.rotation.x += (C.elbowDeg * DEG - fore.rotation.x) * up;
  }
  b.head.rotateX(C.lookUpDeg * DEG * up);
  const air = Math.abs(Math.sin(Math.PI * C.hops * t)); // 0 on the ground, 1 at the top of a hop
  const crouch = { thigh: (C.crouchDeg / 2) * DEG * up * (1 - air), knee: C.crouchDeg * DEG * up * (1 - air) };
  poseLeg(person, 'l', crouch);
  poseLeg(person, 'r', crouch);
  person.rig.position.y = GAP - (P.hipY - ankleY() - legHeight(crouch)) + C.hopM * air * up;
}

/** Keeps the head level and facing ahead whatever the body does (it undoes the spine's lean, twist and tilt), then turns it by `look`. */
function poseHead(person: Person, look: number): void {
  const b = person.bones;
  b.head.quaternion.copy(b.spine.quaternion).invert().multiply(new THREE.Quaternion().setFromAxisAngle(UP, look));
}

/**
 * Poses a person for a gait. Legs swing from the hips with bent knees, arms counter-swing from the
 * shoulders, the body rests on the longer leg (so it dips twice per stride and the feet stay on the
 * ground), the upper body sways, twists, leans and breathes (poseSpine), and the head stays level and
 * looks where `gait.look` says (poseHead); a cheer goes on top (poseCheer). A pure function of the
 * gait, which comes from eased speed and turn rate, so poses never snap.
 */
export function posePerson(person: Person, gait: Gait): void {
  const { walk, run } = gaitBlend(gait.speed);
  const left = legAngles(gait.phase, gait.speed);
  const right = legAngles(gait.phase + Math.PI, gait.speed);
  poseLeg(person, 'l', left);
  poseLeg(person, 'r', right);
  const swing = (G.walkArmDeg + (G.runArmDeg - G.walkArmDeg) * run) * DEG * Math.sin(gait.phase) * walk;
  const elbow = (G.walkElbowDeg + (G.runElbowDeg - G.walkElbowDeg) * run) * DEG * walk;
  poseArm(person, 'l', -swing, elbow + Math.max(0, -swing) * G.elbowSwingBend); // each arm with the other leg
  poseArm(person, 'r', swing, elbow + Math.max(0, swing) * G.elbowSwingBend);
  const drop = P.hipY - ankleY() - Math.max(legHeight(left), legHeight(right));
  person.rig.position.y = GAP - drop + G.runBounceM * run * Math.abs(Math.sin(gait.phase));
  poseSpine(person, gait, walk, run);
  poseHead(person, gait.look ?? 0);
  poseCheer(person, gait.cheer ?? 0);
}
