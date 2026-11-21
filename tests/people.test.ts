// people.test.ts — person props: who is drawn as a round person, their looks, places, breathing,
// visibility, and that a crowd stays a few draw calls.
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createPersonTextures } from '../src/player/person.ts';
import { footprintOf } from '../src/player/collide.ts';
import { T } from '../src/tuning.ts';
import { PROPS, type Prop } from '../src/world/layout.ts';
import { breath, createPeople, headsOfPeople, isPerson, lookOf, personMatrix } from '../src/world/people.ts';

const C = T.cel.people;
const PEOPLE = PROPS.filter(isPerson);
const textures = (): ReturnType<typeof createPersonTextures> => createPersonTextures(() => new THREE.Texture());

/** A person prop for the tests. */
function someone(id: string, x: number, z: number, extra: Partial<Prop> = {}): Prop {
  return { id, shape: 'person', eras: ['present'], pos: [x, 0.8 + T.world.surfaceGap, z], size: [0.45, 1.6, 0.45], color: '#888888', ...extra };
}

describe('person props', () => {
  it('everyone in the moments and today is a round person', () => {
    const ids = PEOPLE.map((p) => p.id);
    for (const id of ['mira_waiting', 'mira_live', 'mira_bored_1', 'mira_gathered_1', 'static_crowd_1', 'static_singer', 'static_guitarist',
      'kbit_body', 'kbit_person_1', 'rep_customer', 'rep_queue_1', 'rep_crowd_1']) {
      expect(ids, id).toContain(id);
    }
  });

  it('their head boxes are drawn by the person, and nothing else is', () => {
    const heads = headsOfPeople(PROPS);
    expect(heads.has('static_crowd_1_head')).toBe(true);
    expect(heads.has('mira_live_head')).toBe(true);
    for (const id of heads) expect(PEOPLE.some((p) => `${p.id}_head` === id), id).toBe(true);
  });

  it('a person blocks like a cylinder of its size', () => {
    const f = footprintOf(someone('a', 1, 2));
    expect(f).toEqual({ shape: 'circle', x: 1, z: 2, r: 0.225 });
  });

  it('wears its own look, or the default looks in turn', () => {
    expect(lookOf(someone('a', 0, 0), 0)).toBe(C.looks[0]);
    expect(lookOf(someone('b', 0, 0), 1)).toBe(C.looks[1 % C.looks.length]);
    expect(lookOf(someone('c', 0, 0, { look: 'npc_b' }), 0)).toBe('npc_b');
  });

  it('stands on the bottom of its box, facing its way', () => {
    const p = someone('a', 2, -3, { facingDeg: 90 });
    const m = personMatrix(p, 1);
    const pos = new THREE.Vector3();
    const turn = new THREE.Quaternion();
    m.decompose(pos, turn, new THREE.Vector3());
    expect(pos.toArray().map((n) => Number(n.toFixed(5)))).toEqual([2, Number(T.world.surfaceGap.toFixed(5)), -3]);
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(turn); // built facing +Z
    expect(forward.x).toBeCloseTo(1);
  });

  it('breathes a little, out of step with the next person', () => {
    for (let s = 0; s < C.breathSec; s += 0.1) {
      expect(breath(s, 0)).toBeGreaterThanOrEqual(1);
      expect(breath(s, 0)).toBeLessThanOrEqual(1 + C.breathScale + 1e-9);
    }
    expect(breath(1, 0)).not.toBeCloseTo(breath(1, 1), 5);
    expect(breath(C.breathSec * 0.5, 0)).toBeCloseTo(1 + C.breathScale);
  });
});

describe('drawing people', () => {
  it('a crowd of any size is one instanced mesh per look and material', () => {
    const crowd = Array.from({ length: 30 }, (_, i) => someone(`p${i}`, i, 0));
    const people = createPeople(crowd, textures());
    expect(people.meshes.length).toBeLessThanOrEqual(C.looks.length * 5);
    for (const mesh of people.meshes) expect(mesh.count).toBe(crowd.length / C.looks.length);
    people.dispose();
  });

  it('shows only the people asked for; a mesh with nobody showing is not drawn', () => {
    const crowd = [someone('a', 0, 0), someone('b', 1, 0)]; // a wears looks[0], b looks[1]
    const people = createPeople(crowd, textures());
    expect(people.meshes.every((m) => !m.visible)).toBe(true); // everyone starts hidden
    people.show((id) => id === 'a');
    const shown = people.meshes.filter((m) => m.visible);
    expect(shown.length).toBeGreaterThan(0);
    expect(shown.every((m) => m.name.includes(C.looks[0]))).toBe(true);
    const m = new THREE.Matrix4();
    shown[0]?.getMatrixAt(0, m);
    expect(m.elements[13]).toBeCloseTo(T.world.surfaceGap); // standing on the ground
    people.animate(1.3);
    shown[0]?.getMatrixAt(0, m);
    expect(new THREE.Vector3().setFromMatrixScale(m).y).toBeCloseTo(breath(1.3, 0));
    people.show(() => false);
    expect(people.meshes.every((x) => !x.visible)).toBe(true);
    people.dispose();
  });

  it('builds every person prop of the game', () => {
    const people = createPeople(PEOPLE, textures());
    const total = people.meshes.reduce((n, m) => n + m.count, 0);
    expect(total).toBeGreaterThanOrEqual(PEOPLE.length); // each look's meshes each hold its people
    people.dispose();
  });
});
