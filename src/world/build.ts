// build.ts — turns the layout into Three.js meshes, once.
// Every prop of every era is built at start; switching era only changes
// visibility and colours, so nothing is created or thrown away mid-game.
// Geometry is shared (one unit box, one unit cylinder) and materials are
// reused per colour; only interactables get their own material (for the glow).

import * as THREE from 'three';
import { T, type Era } from '../tuning.ts';
import { GROUND, PROPS, propColor, visibleProps, type Prop } from './layout.ts';

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

const unitBox = new THREE.BoxGeometry(1, 1, 1);
const unitCylinder = new THREE.CylinderGeometry(0.5, 0.5, 1, 16);
const markerGeometry = new THREE.OctahedronGeometry(T.world.markerSize);

/** Creates the scene graph for the whole location. */
export function buildWorld(): WorldView {
  const scene = new THREE.Scene();
  const shared = new Map<string, THREE.MeshStandardMaterial>();
  const markerMaterial = new THREE.MeshBasicMaterial({ color: T.interact.markerColor });
  const views = new Map<string, PropView>();

  /** Returns the shared material for a colour, making it the first time. */
  function sharedMaterial(color: string): THREE.MeshStandardMaterial {
    let m = shared.get(color);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
      shared.set(color, m);
    }
    return m;
  }

  for (const prop of [GROUND, ...PROPS]) {
    const view = buildProp(prop, markerMaterial, sharedMaterial);
    views.set(prop.id, view);
    scene.add(view.mesh);
    if (view.marker) scene.add(view.marker);
  }

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
      if (view.prop.interactable) (view.mesh.material as THREE.MeshStandardMaterial).color.set(color);
      else view.mesh.material = sharedMaterial(color);
    }
    const look = T.eras[era];
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

/** Builds one prop mesh (and its marker if interactable). */
function buildProp(
  prop: Prop,
  markerMaterial: THREE.Material,
  sharedMaterial: (color: string) => THREE.MeshStandardMaterial,
): PropView {
  const geometry = prop.shape === 'box' ? unitBox : unitCylinder;
  // Interactables get their own material so the highlight glow affects only them.
  const material = prop.interactable
    ? new THREE.MeshStandardMaterial({ color: propColor(prop, '2004'), emissive: T.interact.highlightColor, emissiveIntensity: 0 })
    : sharedMaterial(propColor(prop, '2004'));
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
