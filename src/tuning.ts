// tuning.ts — the ONE place for every gameplay number, colour and timing.
// Game code reads values from here; it never hard-codes them.
// Units: metres (Three.js units), seconds, degrees. Colours are hex strings.
// (Where props stand lives in src/world/layout.ts; the story lives in src/story/content.json.)

export const T = {
  loop: {
    stepsPerSecond: 60, // fixed simulation rate
    maxStepsPerFrame: 5, // after a long pause, drop time instead of spiralling
  },

  player: {
    speed: 3, // metres per second
    runMultiplier: 1.7, // holding Shift runs this much faster (same ease-in and ease-out times)
    accelSec: 0.2, // W/S eases in: from standing to full speed in this long...
    decelSec: 0.15, // ...and eases out: from full speed to standing after you let go
    turnSpeedDeg: 150, // degrees per second (A/D)
    turnAccelSec: 0.1, // A/D eases in: from still to full turning speed in this long...
    turnDecelSec: 0.05, // ...and eases out when you let go
    easeSnap: 1e-9, // a ramp this close to its end counts as there (float rounding), so ramps take exactly sec / dt steps
    startX: -9, // the start of the high street (T.areas): you walk in towards the shop...
    startZ: 3,
    startYawDeg: -90, // ...facing +X, along the street (0 = facing -Z, -90 = facing +X)
    radius: 0.35,
    height: 1.6,
    interactRange: 2.2, // metres from player centre to object centre
    interactConeDeg: 70, // object must be within +/- this angle of facing
    bodyColor: '#f2f2f2',
    noseColor: '#ff8a3d', // the nose shows facing
  },

  // The player bumps into solid props (src/player/collide.ts). A prop does NOT block when
  // its top is at most stepHeight (ground, cables), its bottom is at or above player.height
  // (signs, roofs), or its footprint is narrower than minWidth on both sides (poles, stands).
  collide: {
    stepHeight: 0.1, // metres: props whose top is no higher than this are walked over
    minWidth: 0.15, // metres: props thinner than this both ways (x and z) are ignored
    passes: 4, // push-out passes per step, so corners between two props settle
    skin: 1e-6, // metres: overlaps smaller than this count as just touching (float rounding)
    pathCell: 0.1, // metres between grid spots when finding a way around props (src/player/path.ts)
    reachMargin: 0.1, // metres: a path ends this far inside the interact range, so the target gets picked
    aimToleranceDeg: 3, // following a path: turn until facing the next point within this, then walk
    waypointReached: 0.1, // metres: this close to a path point, head for the next one
    sightStopM: 0.4, // a route ends with nothing solid between you and the target, up to this far short of it (its own stand)
  },

  camera: {
    fovDeg: 50, // a bit tighter, like Messenger's (about 45): the player and the street feel closer
    distance: 4.2, // behind the player (about 2.5 body-heights, like Messenger)
    height: 2.4, // above the ground (about 1.5 body-heights)
    lookHeight: 1.2, // point on the player the camera aims at
    near: 0.1,
    far: 60,
  },

  world: {
    groundWidth: 48, // the high street, from its start (x = -12) past the shop and the bus stop to the square (T.areas)...
    groundCenterX: 12, // ...so the walkable ground is x -12..36 (z stays -6..6)
    groundDepth: 12,
    groundThickness: 0.1,
    surfaceGap: 0.02, // gap between touching surfaces: prevents z-fighting (rule: >= 0.01)
    markerHeight: 0.5, // floating marker above interactables
    markerSize: 0.15,
    markerBobHz: 1,
    markerBobAmount: 0.08,
  },

  // Cel shading and prop textures (src/world/materials.ts), the same in both eras. Owner: director.
  // A surface is lit (its colour) or in shade (its colour in HSV with the value lowered and the hue
  // nudged towards blue/purple), with a soft step between. The era's sun and sky then tint both.
  cel: {
    sunPosition: [4, 8, 6] as readonly [number, number, number], // the sun shines from here towards the origin
    litEdge: 0.05, // a face is lit where N·L (sun) is above this...
    litSoftness: 0.04, // ...with a soft step this wide either side (0 = a hard cut)
    litGradient: 0.25, // lit faces turned away from the sun are up to this much darker, so box faces read apart
    sunWeight: 0.3, // scene light = sun colour x intensity x sunWeight...
    skyWeight: 0.35, // ...+ sky light x skyWeight (1 = the colours exactly as written)
    shadowValue: 0.68, // shade: HSV value x this
    shadowHue: 250, // shade: hue (degrees) nudged towards this blue-purple...
    shadowHueShift: 18, // ...by at most this many degrees
    shadowSaturation: 1.15, // shade: saturation x this...
    shadowMinSaturation: 0.12, // ...and at least this, so even greys get a coloured shade
    textureMixFront: 0.95, // a picture on a front face (cover, poster, window) shows this much image...
    textureMixTiled: 0.4, // ...a tiled one (brick, pavement) less, so it stays calm; the rest is the prop's era colour
    textureFilter: 'linear' as 'linear' | 'nearest', // how textures are sampled
    // Rounded shapes (src/world/shapes.ts): boxes are bevelled at their real size, cylinders smooth.
    bevelRatio: 0.12, // bevel radius = this x the box's shortest side...
    bevelMax: 0.06, // ...at most this (metres; big walls)...
    bevelMin: 0.006, // ...and a box whose bevel would be under this stays plain (flyers, road paint)
    bevelSegments: 2, // steps around each rounded edge
    cylinderSegments: 28, // sides of every cylinder
    // Soft contact shadows: one blob under every standing prop and the player (one draw call).
    blobColor: '#241f36', // dark blue-purple, like the shade tones
    blobOpacity: 0.55,
    blobMargin: 0.35, // a blob reaches this far (metres) past the prop's footprint on every side
    blobSoftness: 0.7, // how much of the blob's radius fades out (1 = all of it)
    blobY: 0.055, // height above the ground: over the road (0.035) by more than the surface gap
    blobMaxBottom: 0.35, // a prop whose bottom is at most this high stands on the ground (the car body is at 0.3)...
    blobMinHeight: 0.25, // ...and gets a blob if it is at least this tall (not kerbs or road paint)
    playerBlob: 1, // the player's blob, metres across
    blobTexturePx: 64,
    // Street decoration atlas (src/world/atlas.ts): the merged decor's building fronts and wooden bits show
    // images from one texture made at load, so they add no draw calls. Each image is a detail pattern on the
    // prop's own colour (its brightness, a little of its colour), so every building keeps its tint.
    atlas: {
      files: [ // the cells, left to right then bottom to top
        'textures/facade_2004_a.png', 'textures/facade_2004_b.png', 'textures/wood.png',
        'textures/facade_today_a.png', 'textures/facade_today_b.png',
      ],
      columns: 3,
      rows: 2,
      cellPx: 512, // each image is drawn this many pixels square (facades are stretched back by their UVs)
      blankGrey: '#808080', // a cell whose file is missing (or the spare one) shows this, so it adds no detail
      facades: { '2004': [0, 1], present: [3, 4] } as Record<'2004' | 'present', readonly number[]>, // cells per era; buildings take turns
      wood: 2, // the wood cell
      facadeAspect: 341 / 512, // a facade image's width / height: a front is tiled across so windows keep their shape
      facadeMix: 0.8, // how strongly the facade pattern shows on a building front...
      woodMix: 0.85, // ...and the wood grain on wooden decoration
      colorAmount: 0.3, // 0: only the image's light and dark; 1: its own colours too (times the prop colour)
      inset: 0.015, // each cell is sampled this far in from its edges, so neighbours don't bleed in
      facadeMinHeight: 4.5, // a decoration box is a building (and gets a facade) if at least this tall...
      facadeMinWidth: 2.5, // ...and this wide...
      streetZ: 5.4, // ...and stands on one side of the road (its centre line here): the face towards it is its front
      woodDecor: ['bench_back'] as readonly string[], // decoration props made of wood
    },
  },

  eras: {
    '2004': {
      label: '2004',
      sky: '#d9a066',
      fogNear: 12,
      fogFar: 40,
      sunColor: '#ffd9a0',
      sunIntensity: 2.4,
      ambient: 0.9,
      tint: [1.1, 0.97, 0.8], // post filter: warm
      saturation: 0.8,
      grain: 0.04, // post filter: grainy (in display colour, one grain per chunky pixel)
      vignette: 0.45,
      pixelHeight: 180, // post filter: drawn about this many lines tall, scaled up with chunky pixels (the lead: 'a bit more pixelated')
      colorLevels: 24, // post filter: levels per channel, ordered (Bayer 4x4) dithering
      // Ink outlines (post filter, src/world/post.ts). Widths are screen pixels on a 1080-line screen,
      // rounded to whole scene pixels: 6 = one chunky pixel here, so the lines are as chunky as the rest.
      outlinePx: 6, // 0 = no outlines
      outlineColor: '#2a2d2f', // a darker blue-grey than today, so lines stay the darkest pixels at dusk (the grade warms it)
      outlineDepth: 0.03, // ink the far side where the neighbours are this much nearer (fraction of the distance)
      outlineColorEdge: 0.14, // ink the darker side where neighbour colours differ this much (0..1.7, 0 = off)
      outlineCreaseDeg: 0, // no crease lines: at 180 lines they would be 2 chunky pixels thick (and too busy)
      outlineCreaseTone: 0.03, // (when creases are on) their colour must change this much, so flat unlit markers stay clean
      outlineBreakup: 0.6, // how much the lines fade in the noise's gaps (0 = solid lines)
      outlineNoisePx: 72, // size of the noise patches that break the lines up
      msaa: 4, // post filter: MSAA samples, only for full-resolution moments (2017); chunky pixels never get it
      skyDeepen: 0.3, // sky gradient: the top of the sky is this much darker than the horizon (0 = flat)
      bloom: 1.0, // post filter: the brightest light (lit windows, neon, markers) glows this strongly (0 = off)
      bloomThreshold: 0.7, // ... only light brighter than this (linear luminance: markers 0.75; keeps 1988's sunlit walls calm)
      bloomScale: 0.5, // ... the glow is worked out at half the (chunky) resolution, added per chunky pixel
      bloomSpread: 1, // ... glow texels between blur taps: one chunky pixel is already wide
      fxaa: 1, // post filter: FXAA after the ink, only for full-resolution moments (2017)
      scanlines: 0, // VHS scanlines (every other scene row darker), off (1988 turns them on in moments)
      chromaBleed: 0, // VHS red/blue bleed in scene pixels, off
      tracking: 0, // VHS tracking band: the most a row slips sideways (scene pixels), off
      trackingSec: 7, // ... seconds of game time for the band to roll down the screen
      trackingBand: 0.06, // ... its half height, as a share of the screen
      blackLevel: 0, // display black level: > 0 lifts (worn tape), < 0 crushes (phone camera)
      badgeText: '#ffcf7a',
    },
    present: {
      label: 'TODAY',
      sky: '#a9c8e8',
      fogNear: 18,
      fogFar: 50,
      sunColor: '#e8f2ff',
      sunIntensity: 2.6,
      ambient: 1.0,
      tint: [0.93, 1.0, 1.08], // post filter: cool
      saturation: 1.05,
      grain: 0, // post filter: clean
      vignette: 0.15,
      pixelHeight: 0, // post filter: full resolution (crisp)
      colorLevels: 0, // post filter: no dithering
      // Ink outlines, like the reference game: about 2 px at 1080p, scaled with the screen.
      outlinePx: 2, // 0 = no outlines
      outlineColor: '#363a3c', // dark blue-grey ink, never pure black
      outlineDepth: 0.03, // ink the far side where the neighbours are this much nearer (fraction of the distance)
      outlineColorEdge: 0.14, // ink the darker side where neighbour colours differ this much (0..1.7, 0 = off)
      outlineCreaseDeg: 40, // ink where a surface bends more than this (box edges); round props bend 22.5° per facet
      outlineCreaseTone: 0.03, // ... and its colour changes at least this much (flat unlit markers get no inner lines)
      outlineBreakup: 0.6, // how much the lines fade in the noise's gaps (0 = solid lines)
      outlineNoisePx: 72, // size of the noise patches that break the lines up
      msaa: 4, // post filter: multisample anti-aliasing samples (smooth edges)
      skyDeepen: 0.3, // sky gradient: the top of the sky is this much darker than the horizon (0 = flat)
      bloom: 1.2, // post filter: the brightest light (lit windows, neon, markers) glows this strongly (0 = off)
      bloomThreshold: 0.6, // ... only light brighter than this (linear luminance: the markers are 0.75, skies below 0.6) glows
      bloomScale: 0.5, // ... the glow is worked out at half resolution
      bloomSpread: 2, // ... glow texels between blur taps (a soft glow about 30 px wide at 1080p)
      fxaa: 1, // post filter: FXAA after the ink, so ink lines and edges are smooth too
      scanlines: 0, // no tape or camera effects today
      chromaBleed: 0,
      tracking: 0,
      trackingSec: 7,
      trackingBand: 0.06,
      blackLevel: 0,
      badgeText: '#bfe6ff',
    },
  },

  interact: {
    highlightColor: '#fff2a8', // emissive glow on the targeted object
    highlightIntensity: 0.9,
    markerColor: '#ffe14d', // every interactable has a bobbing marker; decoration never does
  },

  timing: {
    dialogueSec: 4, // how long a dialogue line stays up
    endingDelaySec: 5, // time on the "because you..." card before the ending
  },

  news: {
    endpoint: 'api/headline', // relative, so it works under any base path
    timeoutMs: 3000, // browser gives up and prints the offline edition after this
    serverTimeoutMs: 2800, // server gives up on Snowflake a little earlier
    pingTimeoutMs: 20000, // the manual `npm run snowflake:ping` waits longer
    model: 'mistral-large2', // default Cortex model; override with SNOWFLAKE_MODEL
    maxTokens: 300,
    temperature: 0.7,
    headlineMaxChars: 100,
    articleMaxChars: 700,
    paper: '#f3ecd9', // newspaper panel: light paper, dark ink
    ink: '#1d1a14',
    offlineInk: '#8a1c1c', // "offline edition" label
  },

  // The CD player outside the shop today: the time machine (props in src/world/props/player.ts).
  cdPlayer: {
    insertSec: 0.8, // E at a CD: it goes into the player at once, you arrive in its 2004 moment this much later
    crate: '#9c7a4f', // the wooden crate it stands on
    crateSlat: '#6f5233', // darker slats on the crate's front
    body: '#2b2e33', // the boombox
    grille: '#121315', // its two speakers
    trim: '#c3c8ce', // the silver CD lid and handle
    display: '#7cf2c4', // a small lit display
    cds: { mira: '#f06595', static: '#ff922b', kbit: '#51cf66' } as Record<string, string>, // one clear colour per CD
    gold: '#ffcc33', // a fixed CD turns gold
  },

  // Life in the air (src/world/particles.ts): one cloud of soft round dots per scene, one draw call.
  // Metres and seconds. fall: downwards per second (negative rises); drift: sideways (+X) per second;
  // wobble: metres of sway at wobbleHz. Sparse on purpose: each scene's look (smoke `looks`) barely moves.
  particles: {
    seed: 1987, // the motes start in the same random spots every run
    box: [18, 5, 16] as const, // metres (x, y, z) in front of the camera that the motes fill; they wrap at its edges
    floorM: 0.1, // the box's bottom, just above the ground
    aheadM: 6, // the box's centre sits this far in front of the camera
    spritePx: 64, // the soft round dot is drawn on a canvas this big...
    softCore: 0.35, // ...solid in the middle, fading out from this far (0..1) to its edge
    paceMin: 0.5, // each mote moves at its own pace, from this...
    paceRange: 1, // ...to this much more
    kinds: {
      dust: { count: 70, size: 0.05, color: '#ffe2a6', opacity: 0.6, fall: -0.02, drift: 0.06, wobble: 0.2, wobbleHz: 0.12 }, // warm 2004 light
      snow: { count: 220, size: 0.08, color: '#ffffff', opacity: 0.85, fall: 0.8, drift: 0.15, wobble: 0.25, wobbleHz: 0.25 }, // December
      pollen: { count: 30, size: 0.07, color: '#f6f0c2', opacity: 0.55, fall: 0.04, drift: 0.2, wobble: 0.35, wobbleHz: 0.08 }, // today
    },
    byScene: { open_mic: 'dust', street_gig: 'dust', ringtone: 'snow', present: 'pollen' } as Record<string, 'dust' | 'snow' | 'pollen'>,
  },

  pitch: {
    maxAutopilotSec: 45, // smoke: playing the demo route (2 CDs) must take at most this much game time
    readSec: 2.5, // smoke: pause after each line of dialogue, as if the presenter reads it
    route: ['ringtone', 'open_mic'], // the moments the pitch demo fixes, in order (see docs/PLAN.md)
  },

  // ---- Teammate A's sections ----
  flip: { // the flip-phone transition when you travel (src/fx/flip.ts)
    closeSec: 0.45, // the screen folds shut after the CD goes in (less than cdPlayer.insertSec)
    rollSec: 1.6, // shut, the outer screen's clock races from now to the destination (slow, fast, slow)...
    holdSec: 0.45, // ...and rests on the destination's clock and date...
    lcdFadeSec: 0.12,
    openSec: 0.5, // ...then it flips open on the new time
  },

  phone: {
    flipSec: 0.25, // open/close animation time
    keyFlashSec: 0.15, // how long a keypad key stays pressed down after a move
    connectSec: 0.9, // after choosing a moment: "Connecting..." with the signal bars filling...
    staticSec: 0.35, // ...then a burst of static, then the phone flips shut
    blinkSec: 0.8, // one on/off cycle of the selected row's cursor
    momentTimes: { open_mic: '21:30', street_gig: '15:10', ringtone: '17:45' } as Record<string, string>, // outer screen clock in each past moment
    foldedWidthPx: 96, // the closed phone
    foldedBottomPx: 64, // the closed phone sits lower than the open one, clear of a host's corner badge (Netlify's is ~50 px tall)
    outerScreen: '#0d1b2a', // the closed phone's small outer screen...
    outerText: '#9be7ff', // ...blue-backlit text
    widthPx: 220, // whole phone; stays under 300 px
    rightPx: 16, // gap to the window's right edge
    bottomPx: 104, // sits above #dialogue (bottom centre), so they never overlap
    compactBelowPx: 680, // windows shorter than this get a smaller phone...
    compactScale: 0.8, // ...scaled by this much
    shellLight: '#e9ecef', // brushed-silver shell: gradient from light...
    shellDark: '#9aa1a9', // ...to dark
    shellEdge: '#6b7178',
    hinge: '#2b2f35',
    lcd: '#c7e0a3', // pale green LCD (background of all LCD text)
    lcdInk: '#1f2a14', // dark pixel text; the selected row swaps the two
    keyFace: '#d5d9de',
    keyInk: '#1d2024',
    keyLetters: '#4a5058',
    callKey: '#2f9e44',
    endKey: '#c92a2a',
  },
  static: {
    // The Static's street gig, 6 August 1988 (props in src/world/props/static.ts).
    stage: '#3b3f47', // low wooden-pallet stage, painted black-ish
    amp: '#1c1c1f',
    ampDead: '#e03131', // the amp's light while it keeps cutting out...
    ampLive: '#51cf66', // ...and once it's plugged into the shop
    cableReel: '#f08c00', // bright orange site reel, easy to spot
    cable: '#f08c00',
    socket: '#dee2e6',
    drum: '#c92a2a',
    cymbal: '#fcc419',
    stand: '#868e96', // cymbal and mic stands
    band: ['#364fc7', '#5f3dc4'], // singer, guitarist
    skin: '#e9b48a',
    guitar: '#e8590c',
    banner: '#ff6b6b', // hand-painted banner behind the stage
    crowd: ['#2b8a3e', '#d6336c', '#1971c2', '#f59f00', '#0c8599', '#862e9c', '#e8590c', '#5c940d'], // the crowd once the mic works
    paper: '#f8f9fa', // the dropped set list and the tip jar's label
    paperTitle: '#e03131', // "SET LIST" scrawled in red
    paperInk: '#212529', // the song titles
    jarGlass: '#a5d8ff',
    jarLid: '#495057',
    banknote: '#69db7c', // a fiver poking out of the tip jar
  },
  mira: {
    // Mira's battle night, 13 December 2002 (props in src/world/props/mira.ts).
    cd: '#d0d8e0', // her dropped demo CD on the bench
    listeningPost: '#8a3fb0',
    sign: '#ffd166', // "OPEN MIC" board on the listening post
    flyer: '#ff5fa2',
    micStand: '#868e96',
    amp: '#2b2b30', // small practice amp by the window
    wire: '#2a2a2a', // string lights' wire
    bulbs: ['#ffe066', '#ffa94d', '#fff3bf'], // warm bulbs, repeated along the wire
    mira: '#c2255c', // Mira's coat
    skin: '#d9a07b',
    guitar: '#a0522d', // acoustic guitar body
    neck: '#5c3a1e',
    listeners: ['#495057', '#1864ab', '#5f3dc4'], // the bored crowd
    phoneGlow: '#a5f3fc', // their phone screens: everyone's looking down
  },
  screens: {
    // Title, "Because you..." card, newspaper and ending (src/ui/). Owner: Teammate A.
    titleVariant: 'lcd' as 'lcd' | 'colour', // the team picks: artifacts/title-variants.png shows both
    bootSec: 1.2, // the boot progress bar fills in this long (then PRESS START pulses)
    titleShade: 'rgba(11, 11, 15, 0.55)', // the title darkens the live street behind it, more at the edges
    logoTiltDeg: 10, // the logo leans up to this much towards the mouse
    logoSwaySec: 6, // one slow idle sway of the logo
    blinkSec: 1.1, // one on/off cycle of "Press Enter"
    narrowBelowPx: 700, // windows narrower than this (phones) stack the card and paper and move the phone up
    // Hand-made UI (like Messenger's, our own colours): off-white paper, thick ink outlines, chunky type,
    // panels a little rotated. Used by the era badge, prompt, dialogue, card, paper and ending captions.
    paper: '#fbf6e9',
    paper2004: '#f3e3c0', // the era badge in 2004: older, yellower paper
    paperInk: '#1d1a14',
    outlinePx: 3,
    note: '#ffe14d', // the "E — ..." prompt is a yellow sticky note
    chunkyFont: "'Trebuchet MS', 'Arial Rounded MT Bold', system-ui, sans-serif",
    dialogueMaxPx: 720, // the dialogue never gets wide enough to reach the open phone (bottom-right)
    bubbles: {
      // Fixing a CD: ♪ and ♥ bubbles pop over the moment (Messenger's payoff), then float away.
      count: 8,
      sec: 1.2, // each bubble's pop, float and fade
      staggerSec: 0.35, // the last bubble starts this much after the first
      band: { left: 22, right: 78, top: 26, bottom: 52 }, // % of the window: where the crowd is when you fix a CD
      sizePx: 44,
      paper: '#fffdf5',
      ink: '#1d1a14',
      heart: '#e03131',
    },
    backdrop: '#0b0b0f', // behind the title and the ending
    // 'lcd' title: the phone's own green LCD (T.phone.lcd / lcdInk), with a dark bezel
    bezel: '#2b2f35',
    // 'colour' title: a 2004 colour screen
    colourTop: '#1c4fd8',
    colourBottom: '#0a1f5c',
    colourText: '#ffffff',
    colourAccent: '#ffd43b',
    // dusty CDs on the title
    cdDusty: '#9aa0a6',
    cdHub: '#4b5057',
    // tabloid: card + newspaper
    tabloidInk: '#111111',
    tabloidRed: '#c8102e', // red-top masthead (white text on it: 5.8:1)
    tabloidRedText: '#ffffff',
    sticker: '#ffe14d', // "EXCLUSIVE" sticker (dark text on it)
    // ending: the wall of gold discs
    wall: '#2a1218',
    gold: '#ffcc33',
    goldDeep: '#b8860b',
    frame: '#111111',
    mat: '#f1ece1',
    caption: '#fff3bf',
  },

  // The shared street: shop front, neighbours, kerb and road (where they stand: src/world/street.ts).
  // A { '2004', present } pair changes with the era; a single colour is the same in both.
  street: {
    pavement: { '2004': '#948f87', present: '#55595e' }, // the ground in front of the shops: grey stone flags
    road: { '2004': '#67625c', present: '#3a3e44' },
    kerb: { '2004': '#aaa8a2', present: '#b4b7ba' },
    roadLine: '#e9e4d8', // white centre dashes
    yellowLine: { '2004': '#c9a23a', present: '#e3c44a' }, // double yellow lines along the kerb
    shopWall: { '2004': '#7a4a3a', present: '#5d5f66' },
    woodwork: { '2004': '#1f4a3c', present: '#2b3946' }, // shopfront frame, pilasters, fascia: racing green in 2004
    stallriser: { '2004': '#173528', present: '#232d38' }, // the panel under the shop window
    awning: { '2004': '#8c2a2a', present: '#3d4450' },
    awningStripe: { '2004': '#efe2c4', present: '#7d8794' },
    sign: { '2004': '#1b1410', present: '#1c1f25' }, // the shop's name board...
    signInk: { '2004': '#e8c36a', present: '#d9e1ea' }, // ...and its painted letters
    signText: 'HOLLOW RECORDS',
    signFont: 'Georgia, "Times New Roman", serif', // bold
    signFontPx: 132, // shrunk to fit the board if the text is too wide
    signLetterSpacingPx: 10,
    signTexturePx: [2048, 211], // canvas size: the same shape as the board (6.4 x 0.66 m)
    door: { '2004': '#4a3022', present: '#33363d' },
    brass: '#c9a54a', // door knob and letterbox
    upperWall: { '2004': '#8a4f3c', present: '#7a5a4e' }, // brick flat above the shop
    stone: { '2004': '#cfc3ad', present: '#d6d6d2' }, // cornices, sills, lintels, kerb-side posts
    glass: { '2004': '#2b2a2e', present: '#33414f' }, // dark window panes
    windowFrame: { '2004': '#ece3d0', present: '#eef0f2' },
    chimney: { '2004': '#6e3b2e', present: '#6a5048' },
    chimneyPot: '#b5652f',
    alleyWall: { '2004': '#5a3a30', present: '#4c4f55' }, // closes the gaps between the shop and its neighbours
    leftBuilding: { '2004': '#8a6a50', present: '#7b8087' },
    rightBuilding: { '2004': '#6e5a4a', present: '#8d939a' },
    farLeft: { '2004': '#5f4a3d', present: '#6c7178' }, // buildings past the edge of the walkable street
    farRight: { '2004': '#7c6450', present: '#9aa0a6' },
    leftShop: { '2004': '#3e5c8a', present: '#4a4f57' }, // fascia of the left neighbour's shop...
    rightShop: { '2004': '#8c2f2f', present: '#2f6f6a' }, // ...the right neighbour's...
    farShop: { '2004': '#6b5a2f', present: '#5a4a7a' }, // ...and the shops further along
    shutter: '#8e949b', // the left neighbour is closed down today
    lamp: '#2a2a2a', // lamp post, arm and head
    lampGlass: '#fff1c2',
    bench: { '2004': '#6a4a2a', present: '#4a4f57' },
    car: { body: '#4a6b8a', glass: '#25313a', tyre: '#161616', chrome: '#c4c8cc', headlight: '#f6e9b8', taillight: '#b3261e' },
    payphone: { body: '#7a7f3a', hood: '#3b3e42', panel: '#c0c4c8', handset: '#111111' },
    charger: { body: '#e8eef2', screen: '#38d9a9', holster: '#2b2f36' },
    scooter: { body: '#2dd4bf', tyre: '#161616', seat: '#22262b', bar: '#3a3f46' },
    planter: '#7d8185', // concrete trough...
    plants: '#4a7f45', // ...with a clipped hedge in it
    tvScreen: '#20262c',
    notices: ['#f1efe6', '#f3e39a', '#a9d3f0'], // papers pinned on the noticeboard
    // The rest of the high street: the square's town hall, clock tower and memorial; the bus stop's
    // pub, newsagent, post box and (today) shelter; trees, lamps, and the terrace across the road.
    hall: { '2004': '#c2ab84', present: '#c9c4b8' }, // pale stone town hall...
    hallDoor: { '2004': '#3a2a1e', present: '#2a2d33' },
    hallSign: { '2004': '#1f3b2c', present: '#1c1f25' }, // ...its name board (same ink as the shop's)
    hallText: 'TOWN HALL',
    towerRoof: { '2004': '#4a5560', present: '#56606a' }, // lead roof on the clock tower
    clockFace: '#f2ecd8',
    clockHands: '#1a1a1a',
    memorial: { '2004': '#b0a38f', present: '#b9b7b0' },
    wreath: '#a3262a',
    pubWall: { '2004': '#e0d2b4', present: '#cfccc4' }, // the pub at the bus stop...
    pubFront: { '2004': '#2c3d5a', present: '#30343b' }, // ...its painted ground floor...
    pubSign: { '2004': '#2c3d5a', present: '#1c1f25' }, // ...and its name board
    pubText: 'THE BELL',
    newsagent: { '2004': '#9a5d2a', present: '#4a6a7a' }, // fascia of the shop next to the pub
    trunk: '#5a4632',
    leaves: { '2004': '#6a8a3a', present: '#4f7a46' },
    busBox: { '2004': '#c9a23a', present: '#e3c44a' }, // the yellow box painted on the road at the bus stop
    shelter: { frame: '#3a3f46', glass: '#8fb3c4', roof: '#2b2f36', flag: '#e8eef2' }, // today's bus shelter
    postBox: '#b3261e',
    terrace: [ // the row of buildings across the road
      { '2004': '#8a5a46', present: '#7a7f86' },
      { '2004': '#a8835e', present: '#9a958c' },
      { '2004': '#6e5446', present: '#666b73' },
      { '2004': '#b8946c', present: '#a9acb0' },
    ],
    terraceShop: [ // their shop fascias
      { '2004': '#2f5a3e', present: '#3a4a5a' },
      { '2004': '#7a2f2f', present: '#5a3a5a' },
      { '2004': '#2f4a7a', present: '#2f6f6a' },
    ],
  },

  // The player's walk (src/player/avatar.ts). The body itself is a round person: T.person, look "player".
  avatar: {
    settleRad: 0.25, // per drawn frame: when you stop, the legs finish their step at this rate
    teleportM: 0.5, // a jump bigger than this in one frame (travel, restart) is not walking
    cameraFollow: 0.12, // each step (60 a second) the camera moves this part of the way to its spot behind you...
    cameraLookFollow: 0.2, // ...and its aim this part of the way to you, so it glides after you instead of jerking
    cameraSnapM: 3, // the camera cuts instead of gliding when its spot jumps further than this (travel, restart)
    talkCloser: 0.25, // while a dialogue line shows the camera comes this part of its distance closer...
    talkLowerM: 0.45, // ...and this much lower...
    talkEase: 0.05, // ...easing in (and back out after) this part of the way each step
    cheerSec: 1.2, // when a CD is fixed the camera pushes in and back out over this long...
    cheerCloser: 0.3, // ...coming this part of its distance closer at the peak...
    cheerTiltDeg: 4, // ...with this much tilt
  },

  // Round people (src/player/person.ts): capsule body and limbs, a sphere head with a face, rounded shoes.
  // Metres, soles at y = 0 (they stand T.world.surfaceGap above the ground); the player's look fits
  // inside T.player.height and T.player.radius. Each person is at most 5 draw calls (one per material).
  person: {
    radialSegments: 12, // facets round a limb (30 degrees each: under the outline crease angle)
    capSegments: 4, // rows in each rounded end
    headSegments: [24, 16] as const, // round and up-down facets of the head
    head: { r: 0.16, y: 1.41 }, // a sphere, big like a cartoon's; the face image covers its front
    neck: { r: 0.05, bottom: 1.24, top: 1.32 },
    torso: { r: 0.16, bottom: 0.72, top: 1.36, widen: 1.15, depth: 0.75 }, // a capsule, squashed front to back
    hips: { r: 0.1, width: 0.1, y: 0.78, depth: 0.8 }, // a sideways capsule of jeans that joins the legs
    hipY: 0.74, // legs hang from here...
    legX: 0.09, // ...this far either side of the middle
    kneeY: 0.4, // knees bend here (thigh and shin end in round caps centred on it)
    leg: { r: 0.068, top: 0.06, bottom: 0.07 }, // top: above the hip (inside the hips); bottom: height of the shin's end (inside the shoe)
    shoe: { r: 0.055, length: 0.12, squash: 0.8, forward: 0.04 }, // a capsule lying toe-forward on the ground
    shoulderY: 1.24, // arms hang from here...
    armX: 0.22, // ...this far either side of the middle (the sleeve's top tucks into the shoulder)
    armOutDeg: 6, // and lean out this much, so hands clear the hips
    elbowDrop: 0.24, // elbows bend this far below the shoulder
    arm: { r: 0.05, top: 0.03, bottom: -0.45 }, // a sleeve, from its shoulder
    hand: { r: 0.05, y: -0.49 },
    hair: { gapM: 0.01, crownDeg: 72, backDeg: 120, backArcDeg: 220 }, // a shell over the crown, longer at the back
    cap: { gapM: 0.01 }, // a cap covers the crown instead of hair (down to hair.crownDeg)
    brim: { r: 0.11, h: 0.018, depth: 0.75, y: 1.46, z: -0.18 }, // a flat oval out front: the player's "nose"
    headphones: { band: 0.012, cupR: 0.045, cupH: 0.035, cupOut: 0.02 }, // band over the cap, cups on the ears
    // The face image wraps the head's front: this many degrees across and up-down, centred this far
    // below the crown. The cel shader shows it on the front only; the rest of the head is the image's skin colour.
    face: { acrossDeg: 150, upDownDeg: 150, centreDeg: 105 },
    skinUv: [0.05, 0.05] as const, // neck and hands use this spot of the face image: plain skin
    fabricTileM: 0.45, // one fabric image covers this many metres of sleeve, jumper or leg
    cullMarginM: 0.3, // the drawn-or-not sphere is this much bigger than the standing pose, for swinging limbs
    // How people move. Idle -> walk -> run blends by speed (walk = T.player.speed, run = that x runMultiplier).
    // The stride phase moves with the distance walked, and the legs swing just far enough for that
    // stride, so feet don't slide. Every pose follows the (eased) speed and turn rate: nothing snaps.
    gait: {
      walkStrideM: 1.4, // metres per full stride (left + right step) when walking...
      runStrideM: 2.1, // ...and running
      walkKneeDeg: 45, runKneeDeg: 95, // the swinging leg's knee bends this much as it passes under the body
      runKneeBaseDeg: 18, // a runner's knees stay a little bent
      walkArmDeg: 20, runArmDeg: 50, // arms counter-swing from the shoulders this far
      walkElbowDeg: 12, runElbowDeg: 85, // elbows bend this much (runners hold their arms bent)
      elbowSwingBend: 0.5, // ...and more as the arm swings forward (this much of the swing angle)
      walkLeanDeg: 3, runLeanDeg: 10, // forward lean from the hips
      turnLeanDeg: 7, // lean into a turn at full turning speed
      swayM: 0.02, // the upper body sways over the standing foot, side to side, this far
      hipTwistDeg: 8, shoulderTwistDeg: 7, // hips turn with the forward leg, shoulders the other way
      runBounceM: 0.05, // running: the body lifts off between steps (twice per stride)
      breathM: 0.006, breathSec: 3.6, // standing: the chest rises and falls this much, once every breathSec
      lookMaxDeg: 40, // the head turns at most this far towards what you could use (E)
      poseEaseSec: 0.2, // the pose follows speed and turning with this lag (game time), so stopping or turning never snaps
    },
    // Each image's plain colour (a face's skin, a fabric's average): the material colour around the image.
    images: {
      face_player: '#ce8958', face_npc_a: '#622a17', face_npc_b: '#fcd2b8',
      fabric_denim: '#4b78a9', fabric_knit: '#db9a0a', fabric_jacket: '#334028',
    },
    // Who wears what. cap: true = an orange cap (T.player.noseColor) with a brim.
    looks: {
      player: { face: 'face_player', top: 'fabric_knit', legs: 'fabric_denim', shoes: '#f0f0f0', hair: '#2e211a', cap: true, headphones: '#1e1e24' },
      npc_a: { face: 'face_npc_a', top: 'fabric_jacket', legs: 'fabric_denim', shoes: '#26262b', hair: '#17110e', cap: false, headphones: null },
      npc_b: { face: 'face_npc_b', top: 'fabric_knit', legs: 'fabric_denim', shoes: '#7a4b2c', hair: '#b88a4a', cap: false, headphones: null },
    },
  },

  // The high street's three areas, one after another along +X (the shop faces +Z). Every visit starts at
  // the start of the street (T.player.startX), with the shop ahead and the other two further along.
  // Each 2004 moment's props are laid out around the shop in their own files and drawn in their
  // moment's area, moved along x by its shiftX (src/world/areas.ts).
  // Walking into an area's span of x emits the `area` event; between two spans the area stays as it was.
  life: { // street life in the areas (src/world/life.ts), all by game time
    presentClock: '17:55', // the tower clock today; in a moment it shows the phone's time (T.phone.momentTimes). It runs on from there
    hourHand: { length: 0.45, width: 0.08 },
    minuteHand: { length: 0.62, width: 0.06 },
    pubGlow: '#ffd98a', // the pub sign is lit with this glow...
    pubGlowIntensity: 0.35,
    pubFlickerHz: 12, // ...which may dip this many times a second...
    pubFlickerShare: 0.1, // ...this share of those times...
    pubFlickerDim: 0.15, // ...to this much of itself
    pigeon: '#6f7480',
    pigeonHomes: [[24.8, 1.4], [25.5, 1.9], [31.2, 1.3], [31.9, 1.75], [32.6, 1.1]] as [number, number][], // x, z by the kerb, clear of the gig crowd
    pigeonArea: { x: [24, 34], z: [0.9, 2.15] }, // where they may hop (clear of the memorial, the lamp and the crowd)
    pigeonScareM: 2.2, // they hop away when you come this close...
    pigeonFleeM: 3.2, // ...until they are this far from you...
    pigeonHopMs: 3, // ...at this speed (m/s), hopping this high...
    pigeonHopM: 0.18,
    pigeonHopHz: 5, // ...this many hops a second
    pigeonHomeMs: 0.35, // when you are gone they walk back home this fast
  },
  areas: {
    list: [
      { id: 'shop', title: 'Hollow Records', x: [-99, 7.5], shiftX: 0 },
      { id: 'bus_stop', title: 'The Bus Stop', x: [8.5, 21.5], shiftX: 18 },
      { id: 'square', title: 'The Square', x: [22.5, 99], shiftX: 27 },
    ],
    moments: { open_mic: 'shop', street_gig: 'square', ringtone: 'bus_stop' }, // where each moment happens
    home: 'shop',
    arrive: { x: 0, z: 3, yawDeg: 0 }, // in a past moment you arrive here (plus its area's shiftX), facing -Z: the scene's own start spot
  },

  // Each 2004 moment's own time of day, on top of the 2004 look (src/world/look.ts).
  tv: {
    // The shop TV (src/ui/tv.ts): each CD's real song from its official YouTube video. Owner: Teammate A.
    // YouTube's embed rules: the player stays visible, at least 200 x 200 px, and nothing covers it.
    enabled: true,
    apiUrl: 'https://www.youtube.com/iframe_api',
    apiTimeoutSec: 8, // no YouTube by then: the CDs play their Creative Commons stand-ins
    screenPx: 200, // the smallest YouTube allows
    leftPx: 16,
    bottomPx: 150, // clear of the dialogue box (three lines reach ~134 px up)
    frame: '#1f1d1b',
    volume: 100, // 0-100: the song is the reward, so it plays out loud
    // startSec: each song starts at its first chorus (from the videos' own lyric captions, and LRCLIB lyric
    // timings for Lose Yourself, which has no captions); at the end it goes back there. lengthSec 0 = to the end.
    videos: {
      mira: { id: 'xFYQQPAOz7Y', startSec: 98, lengthSec: 0, credit: 'Lose Yourself · Eminem' }, // "You better lose yourself..." at 1:39
      static: { id: '1w7OgIMMRc4', startSec: 59, lengthSec: 0, credit: "Sweet Child O' Mine · Guns N' Roses" }, // "Whoa, oh, oh, sweet child..." at ~1:00
      kbit: { id: 'kJQP7kiw5Fk', startSec: 81, lengthSec: 0, credit: 'Despacito · Luis Fonsi ft. Daddy Yankee' }, // "Des-pa-ci-to" at 1:23
    },
  },
  moments: {
    // Each moment is in its own year, so each looks like the screens of its time (overrides on the 2004 era):
    // 1988 is a worn VHS tape (fewer, chunkier pixels, few colours, heavy grain), 2002 the era's retro
    // pixels, 2017 a phone photo (full resolution, light grain, a little extra colour).
    open_mic: { // 13 December 2002, 21:30: battle night, winter evening light (the era's retro pixels)
      sky: '#7a5873', fogNear: 10, fogFar: 34, sunColor: '#ffb27a', sunIntensity: 1.5, ambient: 0.75,
      tint: [1.12, 0.94, 0.86],
    },
    street_gig: { // 6 August 1988: bright summer afternoon on a worn VHS tape
      sky: '#f2c36b', sunColor: '#fff2cc', sunIntensity: 3.1, ambient: 1.05, tint: [1.1, 1.0, 0.8], saturation: 0.82,
      pixelHeight: 144, colorLevels: 12, grain: 0.09, vignette: 0.42,
      // Worn VHS: faint scanlines, red/blue bleeding sideways, a tracking band rolling down, greyish blacks.
      scanlines: 0.14, chromaBleed: 1, tracking: 2, trackingSec: 7, blackLevel: 0.07,
    },
    ringtone: { // 13 January 2017: cold grey dusk, like a phone photo (sharp, light grain; still warmer than today)
      sky: '#8791a6', fogNear: 9, fogFar: 32, sunColor: '#ffd9b0', sunIntensity: 1.4, ambient: 0.8,
      pixelHeight: 0, colorLevels: 0, grain: 0.015, outlinePx: 2, // sharp like today, so today's thin ink
      // Phone camera: a warm "filter" grade, a little extra colour, crushed blacks and a touch of lens vignette.
      tint: [1.08, 0.99, 0.88], saturation: 0.95, blackLevel: -0.05, vignette: 0.3,
    },
  },

  limits: {
    maxDrawCalls: 64, // smoke fails above this (includes up to 4 cheap full-screen post passes: bloom x2, ink, FXAA)
    minLookDistance: 18, // smoke: mean scene colours of any two scenes differ by at least this (0..441)
    maxPixelRatio: 2, // draw at most this many device pixels per CSS pixel (sharp on retina, affordable on phones)
  },

  // --- Teammate B: all sound, generated in code (no sound files) ---
  // Notes are MIDI numbers (60 = middle C, 69 = A 440 Hz). Times in seconds, gains 0..1.
  // Song parts are lists of [step, note, lengthInSteps]; a step is one 16th note.
  audio: {
    master: 0.5, // overall volume
    muteKey: 'KeyM',
    ringtoneActions: ['kbit_ring_bus_stop'], // finishing these actions plays the ringtone instead of the chime
    beamActions: ['kbit_beam_track'], // ...and these play K-Bit's AirDrop
    attackSec: 0.005, // every note fades in this fast (no clicks)
    releaseSec: 0.05, // ...and fades out this fast
    beep: { note: 88, sec: 0.06, gain: 0.18, wave: 'square' }, // keypad (phone-move)
    keyClick: { sec: 0.012, gain: 0.25, hz: 4500, q: 2 }, // the plastic key itself, under beep and blip
    blip: { note: 81, toNote: 93, sec: 0.08, gain: 0.2, wave: 'square' }, // select (phone-select)
    flipOpen: { note: 52, toNote: 64, sec: 0.05, gain: 0.3, noiseSec: 0.04, noiseGain: 0.35, noiseHz: 3200 },
    flipClose: { note: 64, toNote: 45, sec: 0.06, gain: 0.35, noiseSec: 0.05, noiseGain: 0.4, noiseHz: 1800 },
    ringtone: {
      // An ORIGINAL 2-bar polyphonic ringtone (A minor: Am - F - C - G). Up to 4 notes at once.
      bpm: 140,
      melody: { wave: 'square', gain: 0.16, notes: [
        [0, 76, 2], [2, 79, 1], [3, 81, 1], [4, 76, 2], [6, 74, 2], [8, 72, 2], [10, 74, 1], [11, 76, 3],
        [16, 81, 2], [18, 79, 1], [19, 76, 1], [20, 79, 2], [22, 81, 1], [23, 84, 3], [26, 83, 2], [28, 81, 4],
      ] },
      bass: { wave: 'triangle', gain: 0.3, notes: [
        [0, 45, 3], [4, 45, 3], [8, 41, 3], [12, 41, 3], [16, 48, 3], [20, 48, 3], [24, 43, 3], [28, 43, 3],
      ] },
      chords: { wave: 'square', gain: 0.07, notes: [
        [2, 60, 1], [2, 64, 1], [6, 60, 1], [6, 64, 1], [10, 57, 1], [10, 60, 1], [14, 57, 1], [14, 60, 1],
        [18, 64, 1], [18, 67, 1], [22, 64, 1], [22, 67, 1], [26, 62, 1], [26, 67, 1], [30, 62, 1], [30, 67, 1],
      ] },
    },
    whoosh: { sec: 0.9, gain: 0.8, fromHz: 250, toHz: 5000, q: 4 }, // travel: filtered noise sweep
    // The CD player is the time machine (cd-insert): tray out, disc clicks in, tray in, spin-up, laser seeks,
    // and the travel whoosh lands at whooshAtSec (later if travel comes early).
    cdInsert: {
      whooshAtSec: 1.05,
      motor: { sec: 0.18, note: 50, toNote: 53, gain: 0.05, noiseHz: 900, noiseGain: 0.12 }, // tray motor whine
      trays: [0, 0.36], // tray out, tray back in (motor runs, then a clunk)
      clunk: { sec: 0.07, note: 33, gain: 0.3, noiseHz: 1400, toHz: 500, noiseGain: 0.3 },
      click: { at: 0.27, sec: 0.02, hz: 5200, q: 3, gain: 0.45, note: 96, toneGain: 0.05 }, // the disc snaps onto the spindle
      spin: { at: 0.62, sec: 0.75, fromNote: 36, toNote: 74, gain: 0.11, hissFromHz: 400, hissToHz: 3200, hissGain: 0.1 },
      seek: { notes: [100, 103, 98], at: [0.84, 0.94, 1.02], sec: 0.025, gain: 0.04 }, // the laser finding the track
    },
    chime: { notes: [76, 81, 88], gapSec: 0.08, sec: 0.5, gain: 0.2, wave: 'sine' }, // action-done
    nope: { notes: [50, 46], gapSec: 0.12, sec: 0.14, gain: 0.2, wave: 'square' }, // action-locked
    // The "remaster" sting (reputation: back today after a fix): the tape rewinds (a warbling squeal rising,
    // tape hiss), the play key clunks, and the remix comes in crisp. The music holds silent until the clunk.
    remaster: {
      delaySec: 0.45, // starts while the travel whoosh fades
      rewindSec: 0.8, fromNote: 52, toNote: 90, steps: 10, warble: 0.7, gain: 0.06, // squeal: up in wobbly steps
      hiss: { gain: 0.16, fromHz: 900, toHz: 6500, q: 0.8 },
      clunk: { sec: 0.07, note: 38, gain: 0.28, noiseHz: 1500, toHz: 450, noiseGain: 0.32 }, // the play key
    },
    // K-Bit's AirDrop (2017): a quick upward swoosh as it flies over, then a bright two-note "received" ping.
    // Our own sound (not Apple's). The cue keeps its old id, 'beam'.
    beam: { swooshSec: 0.35, swooshGain: 0.35, swooshFromHz: 600, swooshToHz: 5000, swooshQ: 3, pingAt: 0.4, pingNotes: [88, 95], pingGapSec: 0.11, pingSec: 0.32, pingGain: 0.16, wave: 'sine' },
    ambience: {
      fadeSec: 1.2, // crossfade when you travel
      underMusic: 0.3, // era bed + moment soundscape volume while a song plays (TV or built-in), so the song is heard
      loopSec: 2, // length of the looping noise buffers
      seed: 2004, // crackle is random but the same every run
      '2004': { humHz: 55, humGain: 0.025, noiseGain: 0.02, noiseLowpassHz: 1200, cracklePerSec: 9, crackleGain: 0.06 },
      present: { humHz: 0, humGain: 0, noiseGain: 0.012, noiseLowpassHz: 6000, cracklePerSec: 0, crackleGain: 0 },
    },

    // Game feel: small sounds for everything you do (footsteps, paper, camera, voices). Not "cues": they
    // are never the lastCue, so they can't hide the story sounds from the checks.
    feel: {
      seed: 31,
      step: { variants: 4, sec: 0.07, gain: 0.08, fromHz: 1800, toHz: 500, q: 1.2, thumpNote: 40, thumpGain: 0.09, pitchJitter: 0.12, strideM: 0.9 }, // game: one `footstep` event per strideM walked
      paper: { rustles: 4, gapSec: 0.045, sec: 0.07, gain: 0.3, minHz: 2500, maxHz: 6500, q: 1.5 },
      zoom: { sec: 0.45, gain: 0.25, lowHz: 300, highHz: 1600, q: 2 }, // a soft whoosh: rising in, falling out
      voice: {
        blipSec: 0.06, gapSec: 0.085, gain: 0.1, maxBlips: 24, // one blip per syllable-ish, at most ~2 s
        spread: 5, // semitones up from the speaker's note, picked by each letter
        speakers: { // base MIDI note and wave per speaker
          mira: { note: 74, wave: 'triangle' },
          band: { note: 62, wave: 'square' },
          kbit: { note: 79, wave: 'square' },
          owner: { note: 57, wave: 'triangle' },
        },
        byMoment: { open_mic: 'mira', street_gig: 'band', ringtone: 'kbit' }, // who talks when the event doesn't say
      },
    },

    // Each moment's own background (on top of the era hum/crackle above). Made in code, seeded.
    soundscape: {
      loopSec: 8, // looping layers are this long, so repeats are hard to hear
      seed: 77,
      fadeSec: 1.5,
      sampleRate: 24000, // scene layers are made at this rate (all below 12 kHz): half the work of 48 kHz
      seamSec: 0.3, // each layer's end crossfades into its start over this long, so the loop has no click
      layerRms: 0.25, // every layer is scaled to this loudness; its `gain` then sets how loud it is
      open_mic: { // a pub-ish evening: murmuring people and clinking glasses
        babble: { gain: 0.08, voices: 6, syllableHz: 4, lowHz: 250, highHz: 1100 },
        clinks: { gain: 0.05, perSec: 0.7, minHz: 2600, maxHz: 4200, decaySec: 0.2 },
      },
      street_gig: { // a busy summer street, a little chatter, an ice-cream van far away
        traffic: { gain: 0.1, carsPerSec: 0.4, lowpassHz: 350, passSec: 2.5 },
        babble: { gain: 0.035, voices: 4, syllableHz: 5, lowHz: 300, highHz: 1300 },
        iceCream: { gain: 0.04, notes: [79, 84, 83, 79, 76, 77, 79, 72], noteSec: 0.2, startSec: 2, vibratoHz: 6, vibrato: 0.004 }, // an ORIGINAL jingle
      },
      ringtone: { // cold January dusk (2017): wind and traffic; the bus pulls in at the payoff (and nobody gets on)
        wind: { gain: 0.1, minHz: 300, maxHz: 1200, gustHz: 0.13, q: 3 },
        traffic: { gain: 0.05, carsPerSec: 0.3, lowpassHz: 300, passSec: 3 },
        bus: { gain: 0.16, sec: 3.2, engineHz: 42, hissSec: 0.7, hissGain: 0.35 },
      },
      present: { // today: quieter, smoother modern traffic
        traffic: { gain: 0.04, carsPerSec: 0.25, lowpassHz: 500, passSec: 3.5 },
      },
    },

    // The CD music: in 2004 the raw/broken/ignored version, today the modern remix (+ a code beat).
    // A CD's `file` stays '' until its MP3 is in public/music/ (a missing file would log a 404).
    music: {
      busGain: 0.55, // music sits under the dialogue
      fadeSec: 1.5, // crossfade between songs
      todaySwitchSec: 30, // today, with several fixed CDs: next song after this long
      duckGain: 0.3, // music volume while a whoosh, chime or ringtone plays
      duckCues: ['whoosh', 'chime', 'ringtone', 'beam', 'cd-insert'],
      duckAttackSec: 0.05,
      crispSec: 0.03, // after the remaster sting the remix snaps in this fast (no fade)
      duckReleaseSec: 0.5,
      past: { lowpassHz: 2500, gain: 0.7 }, // "2004 style": muffled, mono
      broken: { cutHz: 0.6 }, // the dying amp: the song cuts in and out this many times a second
      live: { lowpassHz: 9000, gain: 1 }, // The Static with the shop's mic: opens up, louder
      leak: { lowpassHz: 4000, highpassHz: 1500, gain: 0.12 }, // tinny spill from K-Bit's headphones
      today: { levelGain: [0, 0.7, 0.85, 1], beatGain: [0, 0.3, 0.45, 0.6] }, // by reputation level 0-3
      beat: { kickHz: 130, kickEndHz: 45, kickSec: 0.25, kickGain: 0.9, hatSec: 0.04, hatGain: 0.22, seed: 909 },
      // Clips are cut on a measured beat (beatOffsetSec 0). bpm was MEASURED, not heard, and the
      // detector was unsure (see docs/notes/teammate-b.md), so the code beat is off (beat: 0)
      // until someone confirms by ear that it plays in time; then set beat: 1.
      // `file` is the Creative Commons stand-in (in git, deployed). `real` is used only when your own copy
      // of the real song is in src/audio/local-songs/<cd>.mp3 (git-ignored, see src/audio/songs.ts): the
      // part played (startSec, lengthSec: whole bars at bpm) and its tempo. Set them by ear.
      cds: {
        mira: { file: 'music/mira.mp3', gain: 0.9, bpm: 68, beatOffsetSec: 0, beat: 0, past: { silentUntil: 'mira_play_cd' },
          real: { song: "Lose Yourself (Eminem)", startSec: 0, lengthSec: 39.3, bpm: 171 } }, // 28 bars: the "one shot" intro
        static: { file: 'music/static.mp3', gain: 0.8, bpm: 104.5, beatOffsetSec: 0, beat: 0, past: { brokenUntil: 'static_plug_amp', liveAfter: 'static_give_mic' },
          real: { song: "Sweet Child O' Mine (Guns N' Roses)", startSec: 0, lengthSec: 40.32, bpm: 125 } }, // 21 bars: the riff
        kbit: { file: 'music/kbit.mp3', gain: 0.8, bpm: 163.5, beatOffsetSec: 0, beat: 0, past: { leakUntil: 'kbit_beam_track', liveAfter: 'kbit_ring_bus_stop' },
          real: { song: 'Despacito (Luis Fonsi ft. Daddy Yankee)', startSec: 0, lengthSec: 40.45, bpm: 89 } }, // 15 bars: the intro
      },
    },
  },

  // --- Teammate B: today's shop at each reputation level (where props stand: src/world/props/today.ts) ---
  today: {
    boards: '#7d6a50', // level 0: boarded up
    litWindow: '#9fe0ff',
    openSign: '#ff3b6b',
    customer: '#d9734a',
    posters: ['#ff9f1c', '#ff5fa2', '#39ff88'], // one per artist: Mira pink, K-Bit green
    plaque: '#2f6fdb', // the blue plaque
    neon: '#ff4fd8', // HOLLOW RECORDS in neon, level 3
    gold: '#ffcc33',
    frame: '#2a2522', // empty frames wait for gold discs
    people: ['#5a6fa8', '#a8605a', '#6a9a62', '#9a7ab8', '#c9a227'],
  },

  // --- Teammate B: DJ K-Bit's moment, "13 January 2017" (where props stand: src/world/props/kbit.ts) ---
  kbit: {
    shelterGlass: '#7f9fb0',
    shelterFrame: '#3b4048',
    shelterRoof: '#2f343b',
    signPole: '#2a2a2a',
    sign: '#e23b3b', // the bus stop sign: interactable
    signBand: '#f4f4f0', // the "BUS" band on the sign
    timetable: '#f2e6b8', // paper timetable on the pole
    people: ['#5a6fa8', '#a8605a', '#6a9a62', '#9a7ab8'], // the queue, one coat colour each
    queuePhone: '#2a2e35', // 2017: everyone in the queue is looking down at a dark phone
    shazam: '#1f8fff', // ...until yours rings: phones held up, screens bright blue
    kbitBody: '#1e1e28',
    headphones: '#39ff88', // neon, very 2004
    kbitPhone: '#ffd23f', // K-Bit's phone: interactable
    // street life (decoration: never glows)
    bin: '#3a3f3a',
    binLid: '#262a26',
    newsBox: '#2b5fa8',
    newsWindow: '#d8dde3',
    pigeon: '#8a8f99',
    dog: '#b07a45',
    dogHead: '#8f5f33',
    // The demo's payoff: shared timings (Teammate A's phone screen and bubbles read these too).
    beamSec: 0.83, // the AirDrop: its sound lasts this long (an AirDrop sheet on the phone can match it)
    busAtSec: 2.6, // after K-Bit rings you, the bus pulls in (its hiss lands as the queue's ringtones end)
    spread: {
      // After your phone rings, the queue catches it: each phone joins one ringtone beat after the last.
      gapSec: 0.43, // = one beat of the ringtone (140 bpm); phone i starts at (i + 1) * gapSec
      phones: ['kbit_shazam_1', 'kbit_shazam_2', 'kbit_shazam_3', 'kbit_shazam_4'], // the raised phones, in queue order
      octaves: [1, 0, -1, 1], // each phone plays it an octave up/down: a cheap tinny speaker, a bassy one...
      waves: ['triangle', 'sawtooth', 'square', 'triangle'],
      pans: [-0.6, -0.2, 0.25, 0.65], // spread across the queue, left to right
      gain: 0.7, // each queue phone, relative to yours (the chorus has to swell)
    },
  },

  ui: {
    panel: 'rgba(12, 12, 16, 0.88)',
    text: '#f4f4f6',
    textDim: '#c9c9d1',
    accent: '#ffe14d',
    fontFamily: 'system-ui, sans-serif',
    minContrast: 4.5, // smoke fails below this, measured on rendered pixels
  },
} as const;

export type Era = keyof typeof T.eras;
export const ERAS = Object.keys(T.eras) as Era[];
