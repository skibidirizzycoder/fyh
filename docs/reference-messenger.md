# Reference: Messenger (messenger.abeto.co)

A small three.js browser game by Abeto (2025): a kid delivers letters around a tiny round planet.
It's our quality bar for **look and game feel in a browser**. We learn its *principles*. We do **not**
copy its art, characters, logo or look: our game stays a UK record shop in 2004 and today.

## How to learn from it (10 minutes, do this once)

1. Play it on a laptop in Chrome, **sound on**, for 5–10 minutes. Keep a note with three columns:
   **I see / I hear / I do**. Write down every moment that feels good and *why*.
2. Watch these moments closely: the title screen; the first 60 seconds (how it teaches you without
   text); how a character shows they want something; what happens when you deliver (sound, picture,
   camera, text, all at once); how the outlines and colours look; what's in the sky.
3. Open DevTools → Network → filter `ogg`, then play for a minute. The file names are its sound
   design (we saw 53 sound files in the first minute):
   - character: `footsteps1-4`, `jump-start`, `jump-land`, `emoji-starts1-3`, `emoji-ends1-3`, `bubble-starts`
   - dialogue: a short **voice** per character type (`male2`, `male3`, `quest`), not real speech
   - UI: `click2-3`, `buttons2`, `paper1-4`, `openbox1`, `openbox-checklist`, `openbox-emote`
   - camera: `zoom-in-5`, `zoom-off-5`; intro: `rune1-4`, `letters`, `button-turn`, `button-out`
   - one ambience per area: `city`, `beach`, `factory`, `waterfalls`, `temple`
4. Network also shows how it stays small (about 5 MB to start): geometry is Draco-compressed (`.drc`),
   textures are KTX2 (`.ktx2`), decoded by small `.wasm` files.
5. Put 2–3 screenshots and your notes in your notes file. Then pick ONE principle for your next task.

## What we learned, and what each of us does with it

| Principle in Messenger | What we do in Flip Phone | Who |
|---|---|---|
| **Flat cel shading + hand-drawn ink outlines**, a small calm palette, paper-like surfaces | Toon materials (2–3 tones), dark ink outlines, one palette per era/moment in `tuning.ts`; AI paper/brick/poster textures | Claude |
| **Every action makes a sound** (steps, bubbles, paper, clicks, camera) | Footsteps while walking, a "paper" sound when the card/newspaper opens, phone key clicks, a whoosh when the camera moves | Teammate B |
| **Characters "talk" in short voice blips**, not real speech | A blip voice per speaker while each dialogue line types out (pitch per character: Mira, the band, K-Bit, the owner) | Teammate B |
| **One ambience per area**, crossfaded | Each moment's own background sound (B6) | Teammate B |
| **The title screen is the live world** with a chunky logo and ONE big button; the logo tilts with the mouse/keys | Title over the real 3D street, a chunky "FLIP PHONE" logo (AI-made) that tilts a little with the mouse, one "PRESS START" button | Teammate A |
| **UI feels hand-made**: off-white paper, thick dark outlines, slightly rotated panels, chunky type | The card, newspaper, dialogue box and ending in that style (our own colours) | Teammate A |
| **A checklist you can open** ("openbox-checklist") | The phone shows the three CDs with ticks: what's left to fix | Teammate A |
| **Big, quick payoff on delivery**: emojis pop over people, sound, camera | When you fix a CD: ♪/♥ bubbles pop over the crowd/queue, a sound, a short camera push-in | A (bubbles), B (sound), Claude (camera) |
| **The camera zooms in when someone talks** | Camera eases closer when a dialogue line shows, then back | Claude |
| **The world is dense with small things** (wires, plants, clutter) | Street life (F1): bins, a bike, posters, cables, pigeons; decoration never glows | Everyone, in their own props |
| **Small download** | Our textures are 512 px; keep songs 30–45 s | Everyone |

## Art: only Claude can make AI images

Claude is the only one with the GPT Image setup (`npm run art`, Codex CLI). **Need an image?** Add it
to your notes under **"Art requests"**: a name, a shape (square / landscape / portrait /
transparent cut-out) and one sentence of what it shows. Claude makes it into `public/textures/<name>.png`
(512 px, credited in `public/textures/CREDITS.md`). Already made or on the way: `cover_mira`,
`cover_static`, `cover_kbit`, `window_2004`, `window_today`, `poster_open_mic`, `poster_gig`,
`brick_2004`, `pavement`. Props can show a texture once Claude adds the `texture` field (see STATUS).

## Sources

- The game: https://messenger.abeto.co (played headless; asset list from the Network log)
- Tech (Three.js, three-mesh-bvh, Houdini/Blender, Substance, WebSocket multiplayer): https://webgpu.com/showcase/messenger/
- Reviews and credits (cel-shaded, emoji-only chat, lo-fi music by Kevin Colombin): https://en.wikipedia.org/wiki/Messenger_(video_game)
- A fan clone's write-up of the techniques it copied (MeshToonMaterial + gradientMap + OutlineEffect): https://github.com/Glowin/messager
