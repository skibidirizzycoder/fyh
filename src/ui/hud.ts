// hud.ts — all on-screen text, as plain HTML on top of the 3D canvas. Owner: Teammate A.
// Each frame, render() makes the page match the game state.
//   #title    a 2004 phone booting up: Hollow Records, three dusty CDs, "Press Enter"
//             (two looks, T.screens.titleVariant: 'lcd' green mono screen or 'colour' screen)
//   #card     "Because you..." as a tabloid inside story  } both inside #today-papers: apart on
//   #news     today's paper as a 2000s red-top front page } wide screens, stacked on narrow ones
//   #ending   a wall of framed gold discs, one per CD
//   #bubbles  ♪/♥ bubbles that pop over the moment when a CD is fixed, for about a second
// Colours come from tuning.ts via CSS variables. Story text only ever goes in via textContent.

import './hud.css';
import type { Game } from '../game.ts';
import type { NewsDesk } from '../news/desk.ts';
import { fixedCds } from '../story/timeline.ts';
import type { LoadedCd, StoryContent } from '../story/types.ts';
import { T } from '../tuning.ts';

export interface Hud {
  render(game: Game): void;
}

/** Makes an element with a class and optional text (text only via textContent). */
function make(tag: string, className: string, text?: string): HTMLElement {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

/** A CD drawn in CSS. `kind` is "dusty" (title) or "gold" (ending). */
function disc(kind: 'dusty' | 'gold'): HTMLElement {
  return make('span', `disc disc-${kind}`);
}

/** The boot screen: phone maker logo, the shop, three dusty CDs, a progress bar and "Press Enter". */
export function bootScreen(cds: readonly LoadedCd[], variant: string): HTMLElement {
  const boot = make('div', 'boot');
  boot.dataset.variant = variant;
  const status = make('div', 'boot-status');
  const signal = make('span', 'boot-signal');
  for (let i = 1; i <= 4; i++) signal.appendChild(make('i', ''));
  const battery = make('span', 'boot-battery');
  battery.appendChild(make('i', ''));
  status.append(signal, make('span', 'boot-clock', '20:04'), battery);

  const shelf = make('div', 'boot-cds');
  for (const cd of cds) {
    const item = make('figure', 'boot-cd');
    const name = make('figcaption', '', cd.artist);
    item.append(disc('dusty'), name);
    shelf.appendChild(item);
  }
  const bar = make('div', 'boot-bar');
  bar.appendChild(make('i', ''));

  boot.append(
    status,
    make('h1', 'boot-maker', 'FLIP PHONE'),
    make('p', 'boot-tagline', 'Something old, into something modern.'),
    make('p', 'boot-shop', 'HOLLOW RECORDS'),
    make('p', 'boot-shop-sub', `Closed since 2004. ${cds.length} CDs nobody bought.`),
    shelf,
    bar,
    make('p', 'boot-start', 'Press Enter to start'),
    make('p', 'boot-keys', 'W/S walk · A/D turn · E use · Q flip phone · M mute'),
  );
  return boot;
}

/** A number in [0, 1) from n, the same every run (so bubble layouts are stable in screenshots). */
function scatter(n: number): number {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * ♪ and ♥ bubbles across the band of the screen where the moment's crowd is when you fix its CD
 * (you are facing them). One burst per CD fixed; each bubble removes itself when its animation ends
 * (so pausing the animation, e.g. for a screenshot, keeps it on screen).
 */
function createBubbles(root: HTMLElement): (fixed: number, playing: boolean) => void {
  const B = T.screens.bubbles;
  const layer = make('div', '');
  layer.id = 'bubbles';
  root.appendChild(layer);
  const still = window.matchMedia('(prefers-reduced-motion: reduce)');
  let last = 0;

  function burst(seed: number): void {
    layer.replaceChildren(...Array.from({ length: B.count }, (_, i) => {
      const heart = i % 2 === 1;
      const bubble = make('span', heart ? 'bubble bubble-heart' : 'bubble', heart ? '♥' : '♪');
      const across = (i + 0.25 + scatter(seed * 31 + i) * 0.5) / B.count; // one per slot, nudged
      bubble.style.left = `${B.band.left + (B.band.right - B.band.left) * across}%`;
      bubble.style.top = `${B.band.top + (B.band.bottom - B.band.top) * scatter(seed * 17 + i * 7)}%`;
      bubble.style.animationDelay = `${(B.staggerSec * scatter(seed * 5 + i * 3)).toFixed(2)}s`;
      bubble.addEventListener('animationend', () => bubble.remove()); // gone once it has floated away
      return bubble;
    }));
    // Reduced motion: no animation, so no animationend either. Clear them after the same time.
    if (still.matches) setTimeout(() => layer.replaceChildren(), (B.sec + B.staggerSec) * 1000);
  }

  return (fixed, playing) => {
    if (!playing && layer.childElementCount > 0) layer.replaceChildren(); // never resume a burst after the title or ending
    layer.hidden = !playing;
    if (playing && fixed > last) burst(fixed);
    last = fixed;
  };
}

/** The ending: a wall of framed gold discs, one per CD, then the closing line. */
function endingScreen(content: StoryContent): HTMLElement[] {
  const wall = make('div', 'gold-wall');
  for (const cd of content.cds) {
    const item = make('figure', 'gold-frame');
    const caption = make('figcaption', 'gold-caption');
    caption.append(make('b', '', cd.artist), make('span', '', `"${cd.title}"`));
    const mount = make('span', 'gold-mount');
    mount.appendChild(disc('gold'));
    item.append(mount, caption);
    wall.appendChild(item);
  }
  return [make('h1', 'ending-title', 'GOLD'), wall, make('p', 'ending-text', content.ending)];
}

/** Creates the HUD elements inside `root`. */
export function createHud(root: HTMLElement, content: StoryContent, news: NewsDesk): Hud {
  setCssColours();
  root.insertAdjacentHTML('beforeend', `
    <div id="title" class="screen"></div>
    <div id="era" class="panel"></div>
    <div id="prompt" class="panel"></div>
    <div id="dialogue" class="panel"></div>
    <div id="today-papers">
      <div id="card" class="tabloid-card">
        <p class="tabloid-sticker">EXCLUSIVE</p>
        <h2 class="tabloid-head">Because you...</h2>
        <ol id="card-causes"></ol>
        <p id="card-change"></p>
      </div>
      <div id="news" class="tabloid">
        <p class="tabloid-masthead"><span>THE CORNER GAZETTE</span><span class="tabloid-price">25p</span></p>
        <h3 id="news-headline"></h3>
        <p id="news-article"></p>
        <p id="news-offline">offline edition</p>
      </div>
    </div>
    <div id="ending" class="screen"></div>
  `);
  const el = (id: string): HTMLElement => {
    const found = document.getElementById(id);
    if (!found) throw new Error(`HUD element #${id} is missing`);
    return found;
  };
  const parts = {
    title: el('title'), era: el('era'), prompt: el('prompt'), dialogue: el('dialogue'),
    card: el('card'), causes: el('card-causes'), change: el('card-change'), ending: el('ending'),
    news: el('news'), headline: el('news-headline'), article: el('news-article'), offline: el('news-offline'),
  };
  parts.title.appendChild(bootScreen(content.cds, T.screens.titleVariant));
  parts.ending.append(...endingScreen(content));
  const bubbles = createBubbles(root);

  // Phones and other narrow windows get their own layout (hud.css and phone.css read this class).
  const narrow = window.matchMedia(`(max-width: ${T.screens.narrowBelowPx - 1}px)`);
  const fit = (): void => { document.documentElement.classList.toggle('is-narrow', narrow.matches); };
  narrow.addEventListener('change', fit);
  fit();

  return {
    render(game) {
      const s = game.state;
      const scene = game.scenes.current();
      const playing = scene === 'play';
      bubbles(fixedCds(content, s.flags).length, playing);
      show(parts.title, scene === 'title');
      show(parts.ending, scene === 'ending');
      show(parts.era, playing);
      setText(parts.era, game.currentCd()?.date ?? T.eras[s.era].label);
      parts.era.dataset.era = s.era;

      const action = content.actions.find((a) => a.objectId === s.target);
      show(parts.prompt, playing && action !== undefined);
      setText(parts.prompt, action ? `E — ${action.prompt}` : '');

      show(parts.dialogue, playing && s.dialogueLeft > 0);
      setText(parts.dialogue, s.dialogue);

      const changes = game.cardChanges();
      show(parts.card, playing && s.era === 'present' && changes.length > 0 && !s.phone.open);
      setText(parts.change, changes.map((c) => `→ ${c.label}`).join('\n'));
      setList(parts.causes, game.causes().map((a) => a.label));

      // Newspaper. LLM text is untrusted, so it only ever goes in via textContent.
      const paper = news.current();
      show(parts.news, playing && s.era === 'present' && paper.status !== 'idle');
      setText(parts.headline, paper.status === 'ready' ? paper.headline : 'Printing today\'s paper...');
      setText(parts.article, paper.status === 'ready' ? paper.article : '');
      show(parts.offline, paper.status === 'ready' && paper.offline);
    },
  };
}

/** Makes a list element hold exactly these items (as text). */
function setList(list: HTMLElement, items: string[]): void {
  const key = items.join('\n');
  if (list.dataset.items === key) return;
  list.dataset.items = key;
  list.replaceChildren(...items.map((text) => {
    const li = document.createElement('li');
    li.textContent = text;
    return li;
  }));
}

/** Shows or hides an element. */
function show(e: HTMLElement, visible: boolean): void {
  e.hidden = !visible;
}

/** Sets text only when it changed (avoids needless page work every frame). */
function setText(e: HTMLElement, text: string): void {
  if (e.textContent !== text) e.textContent = text;
}

/** Copies UI colours and timings from tuning.ts into CSS variables. */
function setCssColours(): void {
  const css = document.documentElement.style;
  const S = T.screens;
  const vars: Record<string, string> = {
    '--panel': T.ui.panel,
    '--text': T.ui.text,
    '--text-dim': T.ui.textDim,
    '--accent': T.ui.accent,
    '--font': T.ui.fontFamily,
    '--era-2004': T.eras['2004'].badgeText,
    '--era-present': T.eras.present.badgeText,
    '--paper': T.news.paper,
    '--ink': T.news.ink,
    '--offline-ink': T.news.offlineInk,
    '--lcd': T.phone.lcd,
    '--lcd-ink': T.phone.lcdInk,
    '--boot-sec': `${S.bootSec}s`,
    '--blink-sec': `${S.blinkSec}s`,
    '--backdrop': S.backdrop,
    '--bezel': S.bezel,
    '--colour-top': S.colourTop,
    '--colour-bottom': S.colourBottom,
    '--colour-text': S.colourText,
    '--colour-accent': S.colourAccent,
    '--cd-dusty': S.cdDusty,
    '--cd-hub': S.cdHub,
    '--tabloid-paper': S.tabloidPaper,
    '--tabloid-ink': S.tabloidInk,
    '--tabloid-red': S.tabloidRed,
    '--tabloid-red-text': S.tabloidRedText,
    '--sticker': S.sticker,
    '--wall': S.wall,
    '--gold': S.gold,
    '--gold-deep': S.goldDeep,
    '--frame': S.frame,
    '--mat': S.mat,
    '--caption': S.caption,
    '--bubble-sec': `${S.bubbles.sec}s`,
    '--bubble-size': `${S.bubbles.sizePx}px`,
    '--bubble-paper': S.bubbles.paper,
    '--bubble-ink': S.bubbles.ink,
    '--bubble-heart': S.bubbles.heart,
  };
  for (const [name, value] of Object.entries(vars)) css.setProperty(name, value);
}

/** Replaces the page with a plain message saying why the game could not run. */
export function showFallback(reason: string): void {
  const box = document.createElement('pre');
  box.id = 'fallback';
  box.textContent = `The game could not start.\n\nWhy: ${reason}`;
  document.body.replaceChildren(box);
}
