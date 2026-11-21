// build.ts — turns the layout into Three.js meshes, once.
// Every prop of every era is built at start; switching era only changes
// visibility and colours, so nothing is created or thrown away mid-game.
// Geometry is shared (one unit box, one unit cylinder) and the cel materials
// (materials.ts) are reused per colour and texture; only interactables get their
// own material (for the glow).

import * as THREE from 'three';
import { T, type Era } from '../tuning.ts';
import { GROUND, PROPS, propColor, propTexture, visibleProps, type Prop } from './layout.ts';
import { lookFor } from './look.ts';
import { createMaterials, type Materials, type Surface } from './materials.ts';

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

const unitBox = new THREE.BoxGeometry(1, 1, 1);
const unitCylinder = new THREE.CylinderGeometry(0.5, 0.5, 1, 16);
const markerGeometry = new THREE.OctahedronGeometry(T.world.markerSize);

/** Creates the scene graph for the whole location. */
export function buildWorld(): WorldView {
  const scene = new THREE.Scene();
  const materials = createMaterials();
  const markerMaterial = new THREE.MeshBasicMaterial({ color: T.interact.markerColor });
  const views = new Map<string, PropView>();

  for (const prop of [GROUND, ...PROPS]) {
    const view = buildProp(prop, markerMaterial, materials);
    views.set(prop.id, view);
    scene.add(view.mesh);
    if (view.marker) scene.add(view.marker);
  }

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
      view.mesh.visible = on;
      if (view.marker) view.marker.visible = on && !used.has(view.prop.id); // used things stop glowing
      const surface = propSurface(view.prop, era);
      if (view.prop.interactable) materials.restyle(view.mesh.material as THREE.MeshLambertMaterial, surface);
      else view.mesh.material = materials.shared(surface);
    }
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
    const bob = Math.sin(seconds * Math.PI * 2 * T.world.markerBobHz) * T.world.markerBobAmount;
    for (const view of views.values()) {
      if (!view.marker) continue;
      view.marker.position.y = markerBaseY(view.prop) + bob;
      view.marker.rotation.y = seconds;
    }
  }

  function dispose(): void {
    materials.dispose(); // shared and interactable materials, and their textures
    markerMaterial.dispose();
    unitBox.dispose();
    unitCylinder.dispose();
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
function buildProp(prop: Prop, markerMaterial: THREE.Material, materials: Materials): PropView {
  const geometry = prop.shape === 'box' ? unitBox : unitCylinder;
  // Interactables get their own material so the highlight glow affects only them.
  const surface = propSurface(prop, '2004');
  const material = prop.interactable ? materials.own(surface) : materials.shared(surface);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = prop.id;
  mesh.position.set(...prop.pos);
  mesh.scale.set(...prop.size);

  let marker: THREE.Mesh | null = null;
  if (prop.interactable) {
    marker = new THREE.Mesh(markerGeometry, markerMaterial);
    marker.name = `${prop.id}_marker`;
    marker.position.set(prop.pos[0], markerBaseY(prop), prop.pos[2]);
  }
  return { prop, mesh, marker };
}
