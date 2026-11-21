// people.ts — the people in the scenes: props with shape 'person' drawn as round people (person.ts).
// Each look is built once, standing; its meshes (one per material) become instanced meshes with one
// instance per person prop, so a crowd of any size costs one draw call per look and material.
// A hidden person's instance is scaled to nothing; a mesh with nobody showing is not drawn at all.
// Everyone breathes (a small stretch up and down), each at their own point in the breath.

import * as THREE from 'three';
import { createPerson, type Person, type PersonTextures } from '../player/person.ts';
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

/** The ids of the boxes people draw themselves: each person's `<id>_head` (round people have their own heads). */
export function headsOfPeople(props: readonly Prop[]): Set<string> {
  const ids = new Set(props.map((p) => p.id));
  return new Set(props.filter(isPerson).map((p) => `${p.id}_head`).filter((id) => ids.has(id)));
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
}

/** Builds one look's instanced meshes from its standing person (built facing +Z, which faces 0 degrees). */
function lookGroup(look: PersonLookName, props: Prop[], indices: number[], textures: PersonTextures): LookGroup {
  const template = createPerson(T.person.looks[look], textures, `people_${look}`);
  const meshes = template.meshes.map((m) => {
    const mesh = new THREE.InstancedMesh(m.geometry, m.material, props.length);
    mesh.name = `people_${look}_${m.name.split('_').pop() ?? ''}`;
    mesh.frustumCulled = false; // instances move and hide; the sphere of the first frame would not fit
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    return mesh;
  });
  return { template, props, indices, meshes };
}

/** Creates the people for the person props (all of them, every era: show() picks who is there). */
export function createPeople(props: readonly Prop[], textures: PersonTextures): People {
  const people = props.filter(isPerson);
  const byLook = new Map<PersonLookName, { props: Prop[]; indices: number[] }>();
  people.forEach((p, i) => {
    const look = lookOf(p, i);
    const entry = byLook.get(look) ?? { props: [], indices: [] };
    entry.props.push(p);
    entry.indices.push(i);
    byLook.set(look, entry);
  });
  const groups = [...byLook.entries()].map(([look, e]) => lookGroup(look, e.props, e.indices, textures));
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
    });
  }
  show(() => false);
  return { meshes: groups.flatMap((g) => g.meshes), show, animate, dispose };
}
