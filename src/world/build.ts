// build.ts — turns the layout into Three.js meshes, once.
// Every prop of every era is built at start; switching era only changes
// visibility and colours, so nothing is created or thrown away mid-game.
// Geometry is shared (one unit box, one unit cylinder) and materials are
// reused per colour; only interactables get their own material (for the glow).
// Street decoration (`decor`) is merged into one vertex-coloured mesh per set of eras,
// so the whole street costs a couple of draw calls. A prop with a `label` gets its text
// painted on a canvas texture, one per era.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ERAS, T, type Era } from '../tuning.ts';
import { placed } from './areas.ts';
import { GROUND, PROPS, inScene, propColor, visibleProps, type Prop } from './layout.ts';
import { lookFor } from './look.ts';

export interface PropView {
  prop: Prop;
  mesh: THREE.Mesh;
  marker: THREE.Mesh | null; // floating marker for interactables
}

export interface WorldView {
  scene: THREE.Scene;
  views: Map<string, PropView>;
  sun: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  /** Shows the props for an era + story overrides and recolours them. */
  /** Shows the props of an era and moment (moment = null today), with story effects. */
  apply(era: Era, moment: string | null, shown: ReadonlySet<string>, hidden: ReadonlySet<string>, used: ReadonlySet<string>): void;
  /** Turns the highlight glow on for one interactable (or none). */
  highlight(id: string | null): void;
  /** Animates markers; `seconds` is game time so it is deterministic. */
  animate(seconds: number): void;
  dispose(): void;
}

/** Decoration props that share eras and moments, drawn as one mesh. */
interface DecorGroup {
  first: Prop; // any member: they all share eras and moments
  mesh: THREE.Mesh;
  colors: Record<Era, Float32Array>; // vertex colours for each era
}

const unitBox = new THREE.BoxGeometry(1, 1, 1);
const unitCylinder = new THREE.CylinderGeometry(0.5, 0.5, 1, 16);
const labelBox = frontFaceBox();
const markerGeometry = new THREE.OctahedronGeometry(T.world.markerSize);

/** Creates the scene graph for the whole location. */
export function buildWorld(): WorldView {
  const scene = new THREE.Scene();
  const shared = new Map<string, THREE.MeshStandardMaterial>();
  const markerMaterial = new THREE.MeshBasicMaterial({ color: T.interact.markerColor });
  const decorMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
  const views = new Map<string, PropView>();
  const labels = new Map<string, Record<Era, THREE.MeshStandardMaterial>>();

  /** Returns the shared material for a colour, making it the first time. */
  function sharedMaterial(color: string): THREE.MeshStandardMaterial {
    let m = shared.get(color);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
      shared.set(color, m);
    }
    return m;
  }

  for (const prop of [GROUND, ...PROPS].filter((p) => !p.decor).map(placed)) { // where it stands (areas.ts)
    const view = buildProp(prop, markerMaterial, sharedMaterial);
    views.set(prop.id, view);
    scene.add(view.mesh);
    if (view.marker) scene.add(view.marker);
    if (prop.label) labels.set(prop.id, labelMaterials(prop));
  }
  const decor = buildDecor(PROPS.filter((p) => p.decor), decorMaterial);
  decor.forEach((d) => scene.add(d.mesh));

  const hemi = new THREE.HemisphereLight('#ffffff', '#444444', 1);
  const sun = new THREE.DirectionalLight('#ffffff', 1);
  sun.position.set(4, 8, 6);
  scene.add(hemi, sun);

  let appliedKey = '';

  function apply(era: Era, moment: string | null, shown: ReadonlySet<string>, hidden: ReadonlySet<string>, used: ReadonlySet<string>): void {
    const key = `${era}|${moment ?? ''}|${[...shown].join()}|${[...hidden].join()}|${[...used].join()}`;
    if (key === appliedKey) return; // nothing changed since last frame
    appliedKey = key;
    const visible = new Set(visibleProps(era, moment, shown, hidden).map((p) => p.id));
    for (const view of views.values()) {
      const on = visible.has(view.prop.id);
      view.mesh.visible = on;
      if (view.marker) view.marker.visible = on && !used.has(view.prop.id); // used things stop glowing
      const color = propColor(view.prop, era);
      const label = labels.get(view.prop.id);
      if (label) view.mesh.material = label[era];
      else if (view.prop.interactable) (view.mesh.material as THREE.MeshStandardMaterial).color.set(color);
      else view.mesh.material = sharedMaterial(color);
    }
    decor.forEach((d) => showDecor(d, era, moment));
    const look = lookFor(era, moment);
    scene.background = new THREE.Color(look.sky);
    scene.fog = new THREE.Fog(look.sky, look.fogNear, look.fogFar);
    sun.color.set(look.sunColor);
    sun.intensity = look.sunIntensity;
    hemi.intensity = look.ambient;
  }

  function highlight(id: string | null): void {
    for (const view of views.values()) {
      if (!view.prop.interactable) continue;
      const m = view.mesh.material as THREE.MeshStandardMaterial;
      m.emissiveIntensity = view.prop.id === id ? T.interact.highlightIntensity : 0;
    }
  }

  function animate(seconds: number): void {
    const bob = Math.sin(seconds * Math.PI * 2 * T.world.markerBobHz) * T.world.markerBobAmount;
    for (const view of views.values()) {
      if (!view.marker) continue;
      view.marker.position.y = markerBaseY(view.prop) + bob;
      view.marker.rotation.y = seconds;
    }
  }

  function dispose(): void {
    shared.forEach((m) => m.dispose());
    views.forEach((v) => {
      if (v.prop.interactable) (v.mesh.material as THREE.Material).dispose();
    });
    labels.forEach((byEra) => Object.values(byEra).forEach((m) => {
      m.map?.dispose();
      m.dispose();
    }));
    decor.forEach((d) => d.mesh.geometry.dispose());
    decorMaterial.dispose();
    markerMaterial.dispose();
    unitBox.dispose();
    unitCylinder.dispose();
    labelBox.dispose();
    markerGeometry.dispose();
  }

  return { scene, views, sun, hemi, apply, highlight, animate, dispose };
}

/** Height of the marker above an interactable's top. */
function markerBaseY(prop: Prop): number {
  return prop.pos[1] + prop.size[1] / 2 + T.world.markerHeight;
}

/** Builds one prop mesh (and its marker if interactable). */
function buildProp(
  prop: Prop,
  markerMaterial: THREE.Material,
  sharedMaterial: (color: string) => THREE.MeshStandardMaterial,
): PropView {
  const geometry = prop.label ? labelBox : prop.shape === 'box' ? unitBox : unitCylinder;
  // Interactables get their own material so the highlight glow affects only them.
  const material = prop.interactable
    ? new THREE.MeshStandardMaterial({ color: propColor(prop, '2004'), emissive: T.interact.highlightColor, emissiveIntensity: 0 })
    : sharedMaterial(propColor(prop, '2004'));
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = prop.id;
  place(mesh, prop);

  let marker: THREE.Mesh | null = null;
  if (prop.interactable) {
    marker = new THREE.Mesh(markerGeometry, markerMaterial);
    marker.name = `${prop.id}_marker`;
    marker.position.set(prop.pos[0], markerBaseY(prop), prop.pos[2]);
  }
  return { prop, mesh, marker };
}

/** Moves, turns and scales a unit shape so it fills the prop's box (a lying cylinder is turned onto its axis). */
function place(object: THREE.Object3D, prop: Prop): void {
  const [x, y, z] = prop.size;
  object.position.set(...prop.pos);
  if (prop.axis === 'x') {
    object.rotation.set(0, 0, Math.PI / 2); // the cylinder's length (local y) now runs along world x
    object.scale.set(y, x, z);
  } else if (prop.axis === 'z') {
    object.rotation.set(Math.PI / 2, 0, 0); // the cylinder's length (local y) now runs along world z
    object.scale.set(x, z, y);
  } else {
    object.scale.set(x, y, z);
  }
}

/** A unit box whose +Z face shows the whole texture; every other face shows only its bottom-left corner. */
function frontFaceBox(): THREE.BoxGeometry {
  const box = new THREE.BoxGeometry(1, 1, 1);
  const uv = box.getAttribute('uv');
  const frontStart = 16; // BoxGeometry faces are +x, -x, +y, -y, +z, -z, with four vertices each
  for (let i = 0; i < uv.count; i++) {
    if (i < frontStart || i >= frontStart + 4) uv.setXY(i, 0, 0);
  }
  return box;
}

/** Paints a prop's label on a canvas in an era's colours: board colour behind, a thin border, the text. */
function paintLabel(prop: Prop, era: Era): HTMLCanvasElement {
  const [w, h] = T.street.signTexturePx;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d');
  if (!g) return canvas; // no 2D canvas: the board shows its plain colour
  const ink = T.street.signInk[era];
  g.fillStyle = propColor(prop, era);
  g.fillRect(0, 0, w, h);
  g.strokeStyle = ink;
  g.lineWidth = h * 0.035;
  g.strokeRect(h * 0.09, h * 0.09, w - h * 0.18, h - h * 0.18);
  g.letterSpacing = `${T.street.signLetterSpacingPx}px`;
  g.font = `bold ${T.street.signFontPx}px ${T.street.signFont}`;
  const fit = Math.min(1, (w * 0.86) / g.measureText(prop.label ?? '').width);
  g.font = `bold ${Math.floor(T.street.signFontPx * fit)}px ${T.street.signFont}`;
  g.fillStyle = ink;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(prop.label ?? '', w / 2, h / 2 + h * 0.04);
  return canvas;
}

/** One textured material per era for a labelled prop. */
function labelMaterials(prop: Prop): Record<Era, THREE.MeshStandardMaterial> {
  const byEra = {} as Record<Era, THREE.MeshStandardMaterial>;
  for (const era of ERAS) {
    const texture = new THREE.CanvasTexture(paintLabel(prop, era));
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    byEra[era] = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.9 });
  }
  return byEra;
}

/** Groups decoration by eras and moments and merges each group into one mesh. */
function buildDecor(props: readonly Prop[], material: THREE.Material): DecorGroup[] {
  const groups = new Map<string, Prop[]>();
  for (const p of props) {
    const key = `${p.eras.join()}|${p.moments?.join() ?? ''}`;
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }
  return [...groups.entries()].map(([key, members]) => mergeDecor(key, members, material));
}

/** Merges a group of decoration props into one mesh with a vertex colour set per era. */
function mergeDecor(key: string, props: readonly Prop[], material: THREE.Material): DecorGroup {
  const parts = props.map((p) => {
    const shape = new THREE.Object3D();
    place(shape, p);
    shape.updateMatrix();
    return (p.shape === 'box' ? unitBox : unitCylinder).clone().applyMatrix4(shape.matrix);
  });
  const geometry = mergeGeometries(parts);
  if (!geometry) throw new Error(`could not merge the street decoration "${key}"`);
  const counts = parts.map((g) => g.getAttribute('position').count);
  parts.forEach((g) => g.dispose());
  const colors = {} as Record<Era, Float32Array>;
  for (const era of ERAS) colors[era] = vertexColors(props, counts, era);
  geometry.setAttribute('color', new THREE.BufferAttribute(colors['2004'].slice(), 3));
  const first = props[0];
  if (!first) throw new Error(`street decoration "${key}" is empty`);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = `street_decor_${first.eras.join('_')}`;
  return { first, mesh, colors };
}

/** One RGB colour per vertex: each prop's colour in an era, repeated over its vertices. */
function vertexColors(props: readonly Prop[], counts: readonly number[], era: Era): Float32Array {
  const out = new Float32Array(counts.reduce((a, b) => a + b, 0) * 3);
  const color = new THREE.Color();
  let at = 0;
  props.forEach((p, i) => {
    color.set(propColor(p, era)); // converted to linear, like a material colour
    for (let v = 0; v < (counts[i] ?? 0); v++, at += 3) out.set([color.r, color.g, color.b], at);
  });
  return out;
}

/** Shows a decoration group in the scenes it belongs to, in the era's colours. */
function showDecor(group: DecorGroup, era: Era, moment: string | null): void {
  group.mesh.visible = inScene(group.first, era, moment);
  const attr = group.mesh.geometry.getAttribute('color') as THREE.BufferAttribute;
  (attr.array as Float32Array).set(group.colors[era]);
  attr.needsUpdate = true;
}
