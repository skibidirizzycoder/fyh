// hud.ts — all on-screen text, as plain HTML on top of the 3D canvas.
// Each frame, render() makes the page match the game state.
// Colours come from tuning.ts via CSS variables.

import type { Game } from '../game.ts';
import type { NewsDesk } from '../news/desk.ts';
import type { StoryContent } from '../story/types.ts';
import { T } from '../tuning.ts';

export interface Hud {
  render(game: Game): void;
}

/** Creates the HUD elements inside `root`. */
export function createHud(root: HTMLElement, content: StoryContent, news: NewsDesk): Hud {
  setCssColours();
  root.insertAdjacentHTML('beforeend', `
    <div id="title" class="overlay panel">
      <h1>Flip Phone</h1>
      <p>Something old, into something modern.</p>
      <p class="dim">W/S walk · A/D turn · E or click to use · Q flip phone · M mute</p>
      <p class="accent">Press Enter to start</p>
    </div>
    <div id="era" class="panel"></div>
    <div id="prompt" class="panel"></div>
    <div id="dialogue" class="panel"></div>
    <div id="card" class="panel">
      <h2>Because you...</h2>
      <ol id="card-causes"></ol>
      <p id="card-change" class="accent"></p>
    </div>
    <div id="news" class="paper">
      <p class="masthead">THE CORNER GAZETTE</p>
      <h3 id="news-headline"></h3>
      <p id="news-article"></p>
      <p id="news-offline">offline edition</p>
    </div>
    <div id="ending" class="overlay panel">
      <h1>The End</h1>
      <p>${content.ending}</p>
    </div>
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

  return {
    render(game) {
      const s = game.state;
      const scene = game.scenes.current();
      const playing = scene === 'play';
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

/** Copies UI colours from tuning.ts into CSS variables. */
function setCssColours(): void {
  const css = document.documentElement.style;
  css.setProperty('--panel', T.ui.panel);
  css.setProperty('--text', T.ui.text);
  css.setProperty('--text-dim', T.ui.textDim);
  css.setProperty('--accent', T.ui.accent);
  css.setProperty('--font', T.ui.fontFamily);
  css.setProperty('--era-2004', T.eras['2004'].badgeText);
  css.setProperty('--era-present', T.eras.present.badgeText);
  css.setProperty('--paper', T.news.paper);
  css.setProperty('--ink', T.news.ink);
  css.setProperty('--offline-ink', T.news.offlineInk);
}

/** Replaces the page with a plain message saying why the game could not run. */
export function showFallback(reason: string): void {
  const box = document.createElement('pre');
  box.id = 'fallback';
  box.textContent = `The game could not start.\n\nWhy: ${reason}`;
  document.body.replaceChildren(box);
}
