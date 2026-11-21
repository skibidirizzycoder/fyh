// people.ts — the people in the scenes: props with shape 'person' drawn as round people (person.ts).
// Each look is built once, standing; its meshes (one per material) become instanced meshes with one
// instance per person prop, so a crowd of any size costs one draw call per look and material.
// A hidden person's instance is scaled to nothing; a mesh with nobody showing is not drawn at all.
// Everyone breathes (a small stretch up and down), each at their own point in the breath.

import * as THREE from 'three';
import { createPerson, posePerson, type Person, type PersonTextures } from '../player/person.ts';
import { T } from '../tuning.ts';
import type { PersonLookName, Prop } from './layout.ts';

const C = T.cel.people;
const DEG = Math.PI / 180;

/** The people of the scenes, drawn instanced. */
export interface People {
  /** Every instanced mesh (add them to the scene). */
  meshes: readonly THREE.InstancedMesh[];
  /** Shows the people whose ids pass `visible`, hides the rest. */
  show(visible: (id: string) => boolean): void;
  /** Breathing, from game time in seconds. */
  animate(seconds: number): void;
  dispose(): void;
}

/** True for a prop drawn as a round person. */
export function isPerson(prop: Prop): boolean {
  return prop.shape === 'person';
}

/** The ids of the boxes people draw themselves: each person's `<id>_head` and `<id>_arm_l/_r` (they have their own). */
export function headsOfPeople(props: readonly Prop[]): Set<string> {
  const ids = new Set(props.map((p) => p.id));
  return new Set(props.filter(isPerson).flatMap((p) => ['_head', '_arm_l', '_arm_r'].map((s) => p.id + s)).filter((id) => ids.has(id)));
}

/** True for a person with arm boxes (`<id>_arm_l`): they cheer, arms up. */
export function cheers(prop: Prop, ids: ReadonlySet<string>): boolean {
  return ids.has(`${prop.id}_arm_l`) || ids.has(`${prop.id}_arm_r`);
}

/** The person a small box is held by (it is just outside their footprint, at their height), or null. */
function holder(item: Prop, people: readonly Prop[]): Prop | null {
  if (item.shape !== 'box' || item.decor || Math.max(...item.size) > C.holdMaxSize) return null;
  return people.find((p) => {
    const reach = Math.hypot(item.pos[0] - p.pos[0], item.pos[2] - p.pos[2]);
    const top = p.pos[1] + p.size[1] / 2;
    return reach <= p.size[0] / 2 + C.holdReach && item.pos[1] > p.pos[1] - p.size[1] / 2 && item.pos[1] < top + C.holdReach;
  }) ?? null;
}

/**
 * Moves what people hold (guitars, phones, headphones) from where it was placed for a cylinder body
 * onto the round person: pulled in to the front of the body, and anything on top of the head down onto it.
 */
export function holdItems(props: readonly Prop[]): Prop[] {
  const people = props.filter(isPerson);
  const front = T.person.torso.r * T.person.torso.depth; // the round body's front, from its centre
  const headTop = T.person.head.y + T.person.head.r;
  return props.map((item) => {
    const p = isPerson(item) ? null : holder(item, people);
    if (!p) return item;
    const [dx, dz] = [item.pos[0] - p.pos[0], item.pos[2] - p.pos[2]];
    const reach = Math.hypot(dx, dz);
    const pull = reach > 1e-3 ? Math.max(0, reach - (p.size[0] / 2 - front)) / reach : 1;
    const bottom = p.pos[1] - p.size[1] / 2;
    const onHead = item.pos[1] - item.size[1] / 2 >= bottom + p.size[1] - C.holdReach;
    const y = onHead ? bottom + headTop : item.pos[1];
    return { ...item, pos: [p.pos[0] + dx * pull, y, p.pos[2] + dz * pull] };
  });
}

/** The look a person prop wears: its own, or the default looks in turn (`index` counts the people before it). */
export function lookOf(prop: Prop, index: number): PersonLookName {
  return prop.look ?? C.looks[index % C.looks.length] ?? 'npc_a';
}

/** How much taller a breathing person is at a time (1 = standing still), each person `index` at their own point. */
export function breath(seconds: number, index: number): number {
  const turn = (seconds / C.breathSec + index * C.breathStep) % 1;
  return 1 + C.breathScale * 0.5 * (1 - Math.cos(turn * 2 * Math.PI));
}

/** A person's place: soles on the bottom of their prop's box, facing their way, stretched by `stretch`. */
export function personMatrix(prop: Prop, stretch: number, out = new THREE.Matrix4()): THREE.Matrix4 {
  const bottom = prop.pos[1] - prop.size[1] / 2;
  const turn = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (prop.facingDeg ?? C.facingDeg) * DEG);
  const slim = 1 / Math.sqrt(stretch); // keeps the body's volume
  return out.compose(new THREE.Vector3(prop.pos[0], bottom, prop.pos[2]), turn, new THREE.Vector3(slim, stretch, slim));
}

/** One look's instanced meshes: the look's standing person, one instance per prop that wears it. */
interface LookGroup {
  template: Person; // keeps the geometry and materials; never added to the scene
  props: Prop[];
  indices: number[]; // each prop's index among all the people (for its breath)
  meshes: THREE.InstancedMesh[];
  extra: THREE.BufferGeometry[]; // posed copies of the template's geometry
}

/** A skinned mesh's geometry in its current pose (positions and normals moved by the bones). */
function posedGeometry(mesh: THREE.SkinnedMesh): THREE.BufferGeometry {
  const geometry = mesh.geometry.clone();
  const position = geometry.getAttribute('position');
  const normal = geometry.getAttribute('normal');
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (let v = 0; v < position.count; v++) {
    p.fromBufferAttribute(position, v);
    n.fromBufferAttribute(normal, v).add(p);
    mesh.applyBoneTransform(v, p);
    mesh.applyBoneTransform(v, n);
    position.setXYZ(v, p.x, p.y, p.z);
    normal.setXYZ(v, ...n.sub(p).normalize().toArray());
  }
  return geometry;
}

/** Builds one look's instanced meshes from its standing (or cheering) person, built facing +Z (0 degrees). */
function lookGroup(look: PersonLookName, cheer: boolean, props: Prop[], indices: number[], textures: PersonTextures): LookGroup {
  const template = createPerson(T.person.looks[look], textures, `people_${look}${cheer ? '_cheer' : ''}`);
  if (cheer) {
    posePerson(template, { phase: 0, speed: 0, turnRate: 0, time: 0, cheer: C.cheerAt });
    template.rig.position.y = 0; // soles on the ground, as built
    template.root.updateMatrixWorld(true);
  }
  const extra: THREE.BufferGeometry[] = [];
  const meshes = template.meshes.map((m) => {
    const geometry = cheer && m instanceof THREE.SkinnedMesh ? posedGeometry(m) : m.geometry;
    if (geometry !== m.geometry) extra.push(geometry);
    const mesh = new THREE.InstancedMesh(geometry, m.material, props.length);
    mesh.name = `people_${look}${cheer ? '_cheer' : ''}_${m.name.split('_').pop() ?? ''}`;
    mesh.frustumCulled = false; // instances move and hide; the sphere of the first frame would not fit
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    return mesh;
  });
  return { template, props, indices, meshes, extra };
}

/** Creates the people for the person props (all of them, every era: show() picks who is there). */
/** The performer everyone in a moment watches (the first person prop whose id matches). */
const PERFORMERS: Readonly<Record<string, RegExp>> = {
  open_mic: /^mira_[a-z]+$/, // Mira herself; her listeners are mira_<kind>_<n>
  street_gig: /^static_(singer|guitarist|bassist|drummer)/,
  ringtone: /^kbit_body$/,
};

/**
 * Which way a person without their own `facingDeg` faces: performers face the street (T.cel.people.facingDeg);
 * everyone else in a moment turns to watch that moment's performer; today's people face the shop (-Z).
 */
export function autoFacing(person: Prop, all: readonly Prop[]): number {
  if (person.facingDeg !== undefined) return person.facingDeg;
  const moment = person.moments?.[0];
  if (!moment) return C.facingDeg + 180;
  const isPerformer = PERFORMERS[moment];
  if (!isPerformer || isPerformer.test(person.id)) return C.facingDeg;
  const focus = all.find((p) => isPerson(p) && p.moments?.includes(moment) && isPerformer.test(p.id));
  if (!focus) return C.facingDeg;
  const dx = focus.pos[0] - person.pos[0];
  const dz = focus.pos[2] - person.pos[2];
  return Math.atan2(dx, dz) / DEG; // 0 faces +Z, as the people are built
}

export function createPeople(props: readonly Prop[], textures: PersonTextures): People {
  const people = props.filter(isPerson).map((p, _i, all) => ({ ...p, facingDeg: autoFacing(p, all) }));
  const ids = new Set(props.map((p) => p.id));
  const byLook = new Map<string, { look: PersonLookName; cheer: boolean; props: Prop[]; indices: number[] }>();
  people.forEach((p, i) => {
    const look = lookOf(p, i);
    const cheer = cheers(p, ids);
    const entry = byLook.get(`${look}|${cheer}`) ?? { look, cheer, props: [], indices: [] };
    entry.props.push(p);
    entry.indices.push(i);
    byLook.set(`${look}|${cheer}`, entry);
  });
  const groups = [...byLook.values()].map((e) => lookGroup(e.look, e.cheer, e.props, e.indices, textures));
  const shown = new Set<string>();
  const matrix = new THREE.Matrix4();
  const hidden = new THREE.Matrix4().makeScale(0, 0, 0);

  /** Places every instance of a group: breathing if shown, scaled to nothing if not. */
  function update(group: LookGroup, seconds: number): void {
    group.props.forEach((p, k) => {
      const m = shown.has(p.id) ? personMatrix(p, breath(seconds, group.indices[k] ?? k), matrix) : hidden;
      group.meshes.forEach((mesh) => mesh.setMatrixAt(k, m));
    });
    const anyone = group.props.some((p) => shown.has(p.id));
    group.meshes.forEach((mesh) => {
      mesh.visible = anyone;
      mesh.instanceMatrix.needsUpdate = true;
    });
  }

  let time = 0;
  function show(visible: (id: string) => boolean): void {
    shown.clear();
    people.forEach((p) => { if (visible(p.id)) shown.add(p.id); });
    groups.forEach((g) => update(g, time));
  }
  function animate(seconds: number): void {
    time = seconds;
    groups.forEach((g) => { if (g.props.some((p) => shown.has(p.id))) update(g, seconds); });
  }
  function dispose(): void {
    groups.forEach((g) => {
      g.meshes.forEach((mesh) => { mesh.removeFromParent(); mesh.dispose(); });
      g.template.dispose(); // its geometry and plain material
      g.extra.forEach((x) => x.dispose());
    });
  }
  show(() => false);
  return { meshes: groups.flatMap((g) => g.meshes), show, animate, dispose };
}
