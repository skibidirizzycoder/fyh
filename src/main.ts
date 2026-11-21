// main.ts — start-up: checks the story data, makes the renderer, wires
// input -> game -> world/HUD, and starts the fixed-timestep loop.

import * as THREE from 'three';
import { createAudio } from './audio/audio.ts';
import { createEvents } from './core/events.ts';
import { createInput } from './core/input.ts';
import { createLoop } from './core/loop.ts';
import { createGame, usedObjects } from './game.ts';
import { createNewsDesk } from './news/desk.ts';
import { createAvatar } from './player/avatar.ts';
import { createPhoneView } from './phone/view.ts';
import { content } from './story/content.ts';
import { propOverrides } from './story/timeline.ts';
import { validateContent } from './story/validate.ts';
import { T } from './tuning.ts';
import { createHud, showFallback } from './ui/hud.ts';
import { buildWorld } from './world/build.ts';
import { GROUND, PROPS } from './world/layout.ts';
import { lookFor } from './world/look.ts';
import { createPostFilter } from './world/post.ts';
import { installDebugApi } from './debug.ts';

/** Makes the WebGL renderer, or returns the reason it failed. */
function makeRenderer(): THREE.WebGLRenderer | string {
  try {
    return new THREE.WebGLRenderer({ antialias: true });
  } catch (e) {
    return `WebGL is not available in this browser, so the 3D scene cannot be drawn. (${String(e)})`;
  }
}

/** Starts the game, or shows plainly why it could not. */
function boot(): void {
  const errors = validateContent(content, [GROUND, ...PROPS].map((p) => ({ id: p.id, eras: p.eras, moments: p.moments, interactable: !!p.interactable })));
  if (errors.length > 0) return showFallback(`The story files (src/story/) have errors:\n- ${errors.join('\n- ')}`);
  const made = makeRenderer();
  if (typeof made === 'string') return showFallback(made);
  const renderer: THREE.WebGLRenderer = made;

  const app = document.getElementById('app');
  if (!app) return showFallback('index.html has no #app element.');
  app.appendChild(renderer.domElement);
  renderer.info.autoReset = false; // we count draw calls for a whole frame (scene + post filter)

  const input = createInput(window);
  const news = createNewsDesk({ content });
  const events = createEvents();
  const audio = createAudio(events, { target: window });
  const game = createGame(content, input, { news, events });
  const world = buildWorld();
  const avatar = createAvatar(world.scene);
  const camera = new THREE.PerspectiveCamera(T.camera.fovDeg, 1, T.camera.near, T.camera.far);
  const post = createPostFilter(1, 1);
  const hud = createHud(app, content, news);
  const phone = createPhoneView(app);
  let drawCalls = 0;

  function resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(w, h, false);
    post.setSize(w * window.devicePixelRatio, h * window.devicePixelRatio);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function render(): void {
    const s = game.state;
    const { shown, hidden } = propOverrides(content, s.flags);
    world.apply(s.era, s.moment, shown, hidden, usedObjects(content, s.flags));
    world.highlight(s.target);
    world.animate(s.frame / T.loop.stepsPerSecond);
    post.setLook(lookFor(s.era, s.moment));
    avatar.sync(s.player, camera, s.frame); // the frame lets the camera glide by game time
    renderer.info.reset();
    post.render(renderer, world.scene, camera, s.frame);
    drawCalls = renderer.info.render.calls;
    hud.render(game);
    phone.render(s.phone);
  }

  const loop = createLoop({
    stepMs: 1000 / T.loop.stepsPerSecond,
    maxSteps: T.loop.maxStepsPerFrame,
    update: () => game.update(),
    render,
  });

  window.addEventListener('resize', resize);
  resize();
  loop.start();

  if (import.meta.env.DEV || import.meta.env.MODE === 'test') {
    installDebugApi({ game, input, loop, news, audio, camera, avatar, scene: world.scene, drawCalls: () => drawCalls });
  }
}

boot();
