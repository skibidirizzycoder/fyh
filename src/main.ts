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
import { createStreetLife } from './world/life.ts';
import { createPhoneView } from './phone/view.ts';
import { withCdPrompts } from './story/cdplayer.ts';
import { content } from './story/content.ts';
import { propOverrides } from './story/timeline.ts';
import { validateContent } from './story/validate.ts';
import { T } from './tuning.ts';
import { createHud, showFallback } from './ui/hud.ts';
import { createTv } from './ui/tv.ts';
import { buildWorld } from './world/build.ts';
import { GROUND, PROPS } from './world/layout.ts';
import { lookFor } from './world/look.ts';
import { createParticles } from './world/particles.ts';
import { createFlipTransition } from './fx/flip.ts';
import { createPostFilter, msaaLimit } from './world/post.ts';
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
  // A static host (no /api/headline) builds with VITE_NEWS_API=off: the paper is then always the
  // offline edition, and the browser never asks for an endpoint that isn't there.
  const news = createNewsDesk({ content, api: import.meta.env.VITE_NEWS_API !== 'off' });
  const events = createEvents();
  const audio = createAudio(events, { target: window });
  const game = createGame(content, input, { news, events });
  const world = buildWorld();
  const avatar = createAvatar(world.scene);
  events.on('action-done', (e) => { // the action that fixes a CD: the camera pushes in for a moment
    if (content.cds.some((c) => c.finalAction === e.actionId)) avatar.cheer(game.state.frame);
  });
  const particles = createParticles(world.scene); // dust, snow or pollen in the air
  const life = createStreetLife(world.scene, world.views.get('pub_sign')?.mesh); // clock hands, pub sign, pigeons
  const camera = new THREE.PerspectiveCamera(T.camera.fovDeg, 1, T.camera.near, T.camera.far);
  const post = createPostFilter(1, 1, msaaLimit(renderer));
  const hud = createHud(app, withCdPrompts(content), news); // the HUD finds E prompts in `actions`, the CD player's too
  const phone = createPhoneView(app);
  if (import.meta.env.MODE !== 'test') createFlipTransition(app, events, content); // tests screenshot right after a jump
  const tv = createTv(app, audio, content.cds); // each CD's real song, once its moment is fixed
  let drawCalls = 0;

  function resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const ratio = Math.min(window.devicePixelRatio, T.limits.maxPixelRatio);
    renderer.setPixelRatio(ratio);
    renderer.setSize(w, h, false);
    post.setSize(w * ratio, h * ratio);
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
    avatar.sync(s.player, camera, s.frame, { talking: s.dialogueLeft > 0 }); // game time: the camera glides, and frames a dialogue line
    particles.update(s.era, s.moment, s.frame / T.loop.stepsPerSecond, camera); // game time: step() stays exact
    life.update(s.moment ?? s.era, s.frame, s.player);
    renderer.info.reset();
    post.render(renderer, world.scene, camera, s.frame);
    drawCalls = renderer.info.render.calls;
    hud.render(game);
    phone.render(s.phone);
    tv.update(s);
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
    installDebugApi({ game, input, loop, news, audio, camera, avatar, scene: world.scene, drawCalls: () => drawCalls, showOutlines: post.showOutlines });
  }
}

boot();
