// flip.ts — the flip-phone transition over the whole screen when you travel in time.
// Putting a CD in the player shuts the screen like a flip phone (two halves fold in to a hinge in
// the middle); the phone's outer screen shows where you're going (clock and date); then it flips
// open on the new time. A trip by phone (no CD) starts already shut.
// Real-time CSS only: it never changes the game. Test builds don't install it (main.ts), because
// smoke screenshots the scene right after a jump.

import type { Events } from '../core/events.ts';
import type { StoryContent } from '../story/types.ts';
import { T } from '../tuning.ts';
import { shortDate } from '../ui/dates.ts';

type Stage = 'open' | 'closing' | 'shut' | 'opening';

/** What the outer screen shows for a destination: [clock, date]. `moment` null = today. */
export function outerScreen(content: StoryContent, moment: string | null, now: Date): [string, string] {
  if (!moment) {
    const clock = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    return [clock, now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })];
  }
  const cd = content.cds.find((c) => c.moment === moment);
  return [T.phone.momentTimes[moment] ?? '--:--', cd ? shortDate(cd.date) : ''];
}

/** Makes an element with a class. */
function el(className: string): HTMLDivElement {
  const d = document.createElement('div');
  d.className = className;
  return d;
}

/** Adds the transition's styles to the page once. */
function addStyles(): void {
  if (document.getElementById('flip-styles')) return;
  const F = T.flip;
  const style = document.createElement('style');
  style.id = 'flip-styles';
  style.textContent = `
#flip { position: fixed; inset: 0; z-index: 1000; pointer-events: none; perspective: 1600px; }
#flip .flip-lid { position: absolute; left: 0; right: 0; height: 50.2%; backface-visibility: hidden;
  background: linear-gradient(180deg, #555c68, #30353d 55%, #24282e);
  box-shadow: inset 0 0 0 3px #1b1e24, inset 0 0 60px rgba(0, 0, 0, 0.45); }
#flip .flip-top { top: 0; transform-origin: 50% 0; border-bottom: 4px solid #9aa3ad; }
#flip .flip-bottom { bottom: 0; transform-origin: 50% 100%; border-top: 4px solid #9aa3ad;
  background: linear-gradient(0deg, #555c68, #30353d 55%, #24282e); }
#flip .flip-top::after { content: ''; position: absolute; left: 50%; top: 28%; width: 120px; height: 14px;
  transform: translateX(-50%); border-radius: 7px;
  background: repeating-linear-gradient(90deg, #15171b 0 6px, transparent 6px 12px); }
#flip .flip-lcd { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
  min-width: 230px; padding: 14px 24px 12px; border-radius: 14px; border: 7px solid #15171b;
  background: #a9c79b; color: #1c2a19; font-family: 'Courier New', monospace; text-align: center;
  box-shadow: inset 0 0 18px rgba(28, 42, 25, 0.35), 0 6px 24px rgba(0, 0, 0, 0.5); opacity: 0; }
#flip .flip-clock { font-size: 46px; font-weight: 700; letter-spacing: 2px; }
#flip .flip-date { font-size: 18px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; }
#flip[data-stage='open'] .flip-top { transform: rotateX(-100deg); }
#flip[data-stage='open'] .flip-bottom { transform: rotateX(100deg); }
#flip[data-stage='closing'] .flip-lid { transform: rotateX(0deg);
  transition: transform ${F.closeSec}s cubic-bezier(0.55, 0, 0.9, 0.4); }
#flip[data-stage='shut'] .flip-lid { transform: rotateX(0deg); }
#flip[data-stage='shut'] .flip-lcd { opacity: 1; transition: opacity ${F.lcdFadeSec}s linear; }
#flip[data-stage='opening'] .flip-top { transform: rotateX(-100deg); }
#flip[data-stage='opening'] .flip-bottom { transform: rotateX(100deg); }
#flip[data-stage='opening'] .flip-lid { transition: transform ${F.openSec}s cubic-bezier(0.15, 0.6, 0.35, 1); }
`;
  document.head.appendChild(style);
}

/** Puts the transition over `app` and plays it on `cd-insert` and `travel`. */
export function createFlipTransition(app: HTMLElement, events: Events, content: StoryContent): void {
  addStyles();
  const root = el('flip');
  root.id = 'flip';
  root.setAttribute('aria-hidden', 'true');
  const lcd = el('flip-lcd');
  const clock = el('flip-clock');
  const date = el('flip-date');
  lcd.append(clock, date);
  root.append(el('flip-lid flip-top'), el('flip-lid flip-bottom'), lcd);
  app.appendChild(root);

  let timer = 0;
  const set = (stage: Stage): void => {
    root.dataset.stage = stage;
  };
  const after = (sec: number, then: () => void): void => {
    window.clearTimeout(timer);
    timer = window.setTimeout(then, sec * 1000);
  };
  set('open');

  events.on('cd-insert', () => set('closing')); // the travel follows T.cdPlayer.insertSec later
  events.on('travel', (e) => {
    [clock.textContent, date.textContent] = outerScreen(content, e.moment, new Date());
    set('shut'); // after a CD it's already folded shut; a trip by phone starts shut
    void root.offsetWidth; // apply it before the next stage, so the opening animates
    after(T.flip.holdSec, () => {
      set('opening');
      after(T.flip.openSec, () => set('open'));
    });
  });
}
