// build.ts — turns the layout into Three.js meshes, once.
// Every prop of every era is built at start; switching era only changes
// visibility and colours, so nothing is created or thrown away mid-game.
// Geometry comes from shapes.ts (bevelled boxes cached per size, one smooth unit cylinder)
// and the cel materials (materials.ts) are reused per colour and texture; only
// interactables get their own material (for the glow). Every standing prop and the player
// get a soft contact shadow, all drawn as one instanced mesh.
// Street decoration (`decor`) is merged into one vertex-coloured mesh per set of eras,
// so the whole street costs a couple of draw calls; its building fronts and wooden bits show images
// from one atlas texture (atlas.ts) made at load. A prop with a `label` gets its text
// painted on a canvas texture, one per era. Everything is cel-shaded alike. People (shape 'person')
// are round people from person.ts, drawn instanced (people.ts); their prop meshes stay hidden.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ERAS, T, type Era } from '../tuning.ts';
import { placed } from './areas.ts';
import { GROUND, PROPS, inScene, propColor, propTexture, visibleProps, type Prop } from './layout.ts';
import { atlasVertices, loadAtlas } from './atlas.ts';
import { createPersonTextures } from '../player/person.ts';
import { lookFor } from './look.ts';
import {
  ATLAS_ATTRIBUTE, SHADE_ATTRIBUTE, celAtlasMaterial, celMaterial, createMaterials, shadowTone, showAtlas, type Materials, type Surface,
} from './materials.ts';
import { createPeople, headsOfPeople, isPerson } from './people.ts';
import { createBlobs, createShapes, type Shapes } from './shapes.ts';

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
  shades: Record<Era, Float32Array>; // and their shade tones (cel shading)
  cells: Record<Era, Float32Array>; // and the atlas cell each vertex shows (atlas.ts)
}

const labelBox = frontFaceBox();
const markerGeometry = new THREE.OctahedronGeometry(T.world.markerSize);

/** Creates the scene graph for the whole location. */
export function buildWorld(): WorldView {
  const scene = new THREE.Scene();
  const shapes = createShapes();
  const materials = createMaterials();
  const markerMaterial = new THREE.MeshBasicMaterial({ color: T.interact.markerColor });
  const decorMaterial = celAtlasMaterial();
  const views = new Map<string, PropView>();
  const labels = new Map<string, Record<Era, THREE.MeshLambertMaterial>>();

  for (const prop of [GROUND, ...PROPS].filter((p) => !p.decor).map(placed)) { // where it stands (areas.ts)
    const view = buildProp(prop, markerMaterial, materials, shapes);
    views.set(prop.id, view);
    scene.add(view.mesh);
    if (view.marker) scene.add(view.marker);
    if (prop.label) labels.set(prop.id, labelMaterials(prop));
  }
  const personTextures = createPersonTextures();
  const people = createPeople([...PROPS].filter((p) => !p.decor).map(placed), personTextures);
  people.meshes.forEach((m) => scene.add(m));
  const drawnByPerson = headsOfPeople(PROPS);
  const decor = buildDecor(PROPS.filter((p) => p.decor), decorMaterial, shapes);
  decor.forEach((d) => scene.add(d.mesh));
  let disposed = false;
  let atlas: THREE.Texture | null = null;
  loadAtlas((texture, means) => { // facades and wood on the decoration, once the images are in
    if (disposed) return texture.dispose();
    atlas = texture;
    showAtlas(decorMaterial, texture, means);
  });
  const blobs = createBlobs([GROUND, ...PROPS].map(placed)); // shadows under where props stand (areas.ts)
  scene.add(blobs.mesh);
  // The player's blob follows the avatar (named 'player'), read just before each draw, after it moved.
  scene.onBeforeRender = () => {
    const player = scene.getObjectByName('player');
    if (player) blobs.follow(player.position.x, player.position.z);
  };

  const hemi = new THREE.HemisphereLight('#ffffff', '#444444', 1);
  const sun = new THREE.DirectionalLight('#ffffff', 1);
  sun.position.set(...T.cel.sunPosition);
  scene.add(hemi, sun);

  let appliedKey = '';

  function apply(era: Era, moment: string | null, shown: ReadonlySet<string>, hidden: ReadonlySet<string>, used: ReadonlySet<string>): void {
    const key = `${era}|${moment ?? ''}|${[...shown].join()}|${[...hidden].join()}|${[...used].join()}`;
    if (key === appliedKey) return; // nothing changed since last frame
    appliedKey = key;
    const visible = new Set(visibleProps(era, moment, shown, hidden).map((p) => p.id));
    for (const view of views.values()) {
      const on = visible.has(view.prop.id);
      view.mesh.visible = on && !isPerson(view.prop) && !drawnByPerson.has(view.prop.id); // people.ts draws those
      if (view.marker) view.marker.visible = on && !used.has(view.prop.id); // used things stop glowing
      const surface = propSurface(view.prop, era);
      const label = labels.get(view.prop.id);
      if (label) view.mesh.material = label[era];
      else if (view.prop.interactable) materials.restyle(view.mesh.material as THREE.MeshLambertMaterial, surface);
      else view.mesh.material = materials.shared(surface);
    }
    decor.forEach((d) => showDecor(d, era, moment));
    people.show((id) => visible.has(id));
    blobs.show((p) => (p.decor ? inScene(p, era, moment) : visible.has(p.id)));
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
      const m = view.mesh.material as THREE.MeshLambertMaterial;
      m.emissiveIntensity = view.prop.id === id ? T.interact.highlightIntensity : 0;
    }
  }

  function animate(seconds: number): void {
    people.animate(seconds);
    const bob = Math.sin(seconds * Math.PI * 2 * T.world.markerBobHz) * T.world.markerBobAmount;
    for (const view of views.values()) {
      if (!view.marker) continue;
      view.marker.position.y = markerBaseY(view.prop) + bob;
      view.marker.rotation.y = seconds;
    }
  }

  function dispose(): void {
    materials.dispose(); // shared and interactable materials, and their textures
    labels.forEach((byEra) => Object.values(byEra).forEach((m) => {
      m.map?.dispose();
      m.dispose();
    }));
    decor.forEach((d) => d.mesh.geometry.dispose());
    decorMaterial.dispose();
    people.dispose();
    personTextures.dispose();
    atlas?.dispose();
    disposed = true;
    markerMaterial.dispose();
    shapes.dispose();
    blobs.dispose();
    labelBox.dispose();
    markerGeometry.dispose();
  }

  return { scene, views, sun, hemi, apply, highlight, animate, dispose };
}

/** Height of the marker above an interactable's top. */
function markerBaseY(prop: Prop): number {
  return prop.pos[1] + prop.size[1] / 2 + T.world.markerHeight;
}

/** A prop's colour and image in an era. */
function propSurface(prop: Prop, era: Era): Surface {
  return { color: propColor(prop, era), texture: propTexture(prop, era), repeat: prop.textureRepeat ?? null };
}

/** Builds one prop mesh (and its marker if interactable). */
function buildProp(prop: Prop, markerMaterial: THREE.Material, materials: Materials, shapes: Shapes): PropView {
  const geometry = geometryFor(prop, shapes);
  // Interactables get their own material so the highlight glow affects only them.
  const surface = propSurface(prop, '2004');
  const material = prop.interactable ? materials.own(surface) : materials.shared(surface);
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

/** True when a prop's geometry is made at its real size (bevelled boxes); the rest are unit shapes, scaled. */
function madeToSize(prop: Prop): boolean {
  return prop.shape === 'box' && !prop.label;
}

/** A prop's geometry: a bevelled box of its size, a flat-fronted label board, or the unit cylinder. */
function geometryFor(prop: Prop, shapes: Shapes): THREE.BufferGeometry {
  if (prop.label) return labelBox; // the painted front stays flat
  return madeToSize(prop) ? shapes.box(prop.size) : shapes.cylinder;
}

/** Moves (and, for a unit shape, turns and scales) a prop's shape so it fills the prop's box. */
function place(object: THREE.Object3D, prop: Prop): void {
  const [x, y, z] = prop.size;
  object.position.set(...prop.pos);
  if (madeToSize(prop)) {
    object.scale.set(1, 1, 1); // already the right size: scaling would stretch the bevels
  } else if (prop.axis === 'x') {
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

/** One cel material per era for a labelled prop: the painted board on its front, the board colour elsewhere. */
function labelMaterials(prop: Prop): Record<Era, THREE.MeshLambertMaterial> {
  const byEra = {} as Record<Era, THREE.MeshLambertMaterial>;
  for (const era of ERAS) {
    const texture = new THREE.CanvasTexture(paintLabel(prop, era));
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    const m = celMaterial(propColor(prop, era));
    m.map = texture; // front face only (celMapAll stays 0)
    byEra[era] = m;
  }
  return byEra;
}

/** Groups decoration by eras and moments and merges each group into one mesh. */
function buildDecor(props: readonly Prop[], material: THREE.Material, shapes: Shapes): DecorGroup[] {
  const groups = new Map<string, Prop[]>();
  for (const p of props) {
    const key = `${p.eras.join()}|${p.moments?.join() ?? ''}`;
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }
  return [...groups.entries()].map(([key, members]) => mergeDecor(key, members, material, shapes));
}

/** Merges a group of decoration props into one mesh with a vertex colour set per era. */
function mergeDecor(key: string, props: readonly Prop[], material: THREE.Material, shapes: Shapes): DecorGroup {
  const parts = props.map((p) => {
    const shape = new THREE.Object3D();
    place(shape, p);
    shape.updateMatrix();
    return geometryFor(p, shapes).clone().applyMatrix4(shape.matrix);
  });
  const geometry = mergeGeometries(parts);
  if (!geometry) throw new Error(`could not merge the street decoration "${key}"`);
  const counts = parts.map((g) => g.getAttribute('position').count);
  parts.forEach((g) => g.dispose());
  const colors = {} as Record<Era, Float32Array>;
  const shades = {} as Record<Era, Float32Array>;
  for (const era of ERAS) {
    colors[era] = vertexColors(props, counts, (p) => propColor(p, era));
    shades[era] = vertexColors(props, counts, (p) => shadowTone(propColor(p, era)));
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors['2004'].slice(), 3));
  geometry.setAttribute(SHADE_ATTRIBUTE, new THREE.BufferAttribute(shades['2004'].slice(), 3));
  const { uv, cells } = atlasVertices(props, counts, geometry);
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geometry.setAttribute(ATLAS_ATTRIBUTE, new THREE.BufferAttribute(cells['2004'].slice(), 3));
  const first = props[0];
  if (!first) throw new Error(`street decoration "${key}" is empty`);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = `street_decor_${first.eras.join('_')}`;
  return { first, mesh, colors, shades, cells };
}

/** One RGB colour per vertex: a colour for each prop (its era colour or shade), repeated over its vertices. */
function vertexColors(props: readonly Prop[], counts: readonly number[], colorOf: (p: Prop) => string): Float32Array {
  const out = new Float32Array(counts.reduce((a, b) => a + b, 0) * 3);
  const color = new THREE.Color();
  let at = 0;
  props.forEach((p, i) => {
    color.set(colorOf(p)); // converted to linear, like a material colour
    for (let v = 0; v < (counts[i] ?? 0); v++, at += 3) out.set([color.r, color.g, color.b], at);
  });
  return out;
}

/** Copies one era's values into a vertex attribute. */
function setAttribute(geometry: THREE.BufferGeometry, name: string, values: Float32Array): void {
  const attr = geometry.getAttribute(name) as THREE.BufferAttribute;
  (attr.array as Float32Array).set(values);
  attr.needsUpdate = true;
}

/** Shows a decoration group in the scenes it belongs to, in the era's colours, shades and atlas images. */
function showDecor(group: DecorGroup, era: Era, moment: string | null): void {
  group.mesh.visible = inScene(group.first, era, moment);
  setAttribute(group.mesh.geometry, 'color', group.colors[era]);
  setAttribute(group.mesh.geometry, SHADE_ATTRIBUTE, group.shades[era]);
  setAttribute(group.mesh.geometry, ATLAS_ATTRIBUTE, group.cells[era]);
}
