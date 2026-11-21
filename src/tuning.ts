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
    turnSpeedDeg: 150, // degrees per second (A/D)
    startX: 0,
    startZ: 3,
    startYawDeg: 0, // 0 = facing -Z (towards the shop)
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
  },

  camera: {
    fovDeg: 60,
    distance: 4.5, // behind the player
    height: 2.6, // above the ground
    lookHeight: 1.2, // point on the player the camera aims at
    near: 0.1,
    far: 60,
  },

  world: {
    groundWidth: 16,
    groundDepth: 12,
    groundThickness: 0.1,
    surfaceGap: 0.02, // gap between touching surfaces: prevents z-fighting (rule: >= 0.01)
    markerHeight: 0.5, // floating marker above interactables
    markerSize: 0.15,
    markerBobHz: 1,
    markerBobAmount: 0.08,
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
      grain: 0.09, // post filter: grainy
      vignette: 0.45,
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

  pitch: {
    maxAutopilotSec: 45, // smoke: playing the demo route (2 CDs) must take at most this much game time
    readSec: 2.5, // smoke: pause after each line of dialogue, as if the presenter reads it
    route: ['ringtone', 'open_mic'], // the moments the pitch demo fixes, in order (see docs/PLAN.md)
  },

  // ---- Teammate A's sections ----
  phone: {
    flipSec: 0.25, // open/close animation time
    keyFlashSec: 0.15, // how long a keypad key stays pressed down after a move
    connectSec: 0.9, // after choosing a moment: "Connecting..." with the signal bars filling...
    staticSec: 0.35, // ...then a burst of static, then the phone flips shut
    blinkSec: 0.8, // one on/off cycle of the selected row's cursor
    momentTimes: { open_mic: '19:30', street_gig: '15:10', ringtone: '16:45' } as Record<string, string>, // outer screen clock in 2004
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
    // The Static's street gig, 2 July 2004 (props in src/world/props/static.ts).
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
    // Mira's open mic, 14 March 2004 (props in src/world/props/mira.ts).
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

  // Each 2004 moment's own time of day, on top of the 2004 look (src/world/look.ts).
  moments: {
    open_mic: { // 14 March: evening, dusk light
      sky: '#7a5873', fogNear: 10, fogFar: 34, sunColor: '#ffb27a', sunIntensity: 1.5, ambient: 0.75,
      tint: [1.12, 0.94, 0.86],
    },
    street_gig: { // 2 July: bright summer afternoon
      sky: '#f2c36b', sunColor: '#fff2cc', sunIntensity: 3.1, ambient: 1.05, tint: [1.1, 1.0, 0.8], saturation: 0.9,
    },
    ringtone: { // 5 December: cold grey dusk (still warmer and grainier than today)
      sky: '#8791a6', fogNear: 9, fogFar: 32, sunColor: '#ffd9b0', sunIntensity: 1.4, ambient: 0.8,
      tint: [1.04, 0.98, 0.92], saturation: 0.72,
    },
  },

  limits: {
    maxDrawCalls: 60, // smoke fails above this
    minLookDistance: 18, // smoke: mean scene colours of any two scenes differ by at least this (0..441)
  },

  // --- Teammate B: all sound, generated in code (no sound files) ---
  // Notes are MIDI numbers (60 = middle C, 69 = A 440 Hz). Times in seconds, gains 0..1.
  // Song parts are lists of [step, note, lengthInSteps]; a step is one 16th note.
  audio: {
    master: 0.5, // overall volume
    muteKey: 'KeyM',
    ringtoneActions: ['kbit_ring_bus_stop'], // finishing these actions plays the ringtone instead of the chime
    beamActions: ['kbit_beam_track'], // ...and these play the infrared beam
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
    fanfare: { notes: [67, 72, 76, 79, 84], gapSec: 0.1, sec: 0.35, gain: 0.18, wave: 'square', delaySec: 0.7 }, // reputation; waits for the travel whoosh
    beam: { notes: [86, 93], chirps: 14, chirpSec: 0.035, gain: 0.12, wave: 'square', doneNotes: [84, 96], doneGapSec: 0.09, doneSec: 0.08, doneGain: 0.18 }, // infrared handshake, then "got it"
    ambience: {
      fadeSec: 1.2, // crossfade when you travel
      loopSec: 2, // length of the looping noise buffers
      seed: 2004, // crackle is random but the same every run
      '2004': { humHz: 55, humGain: 0.035, noiseGain: 0.03, noiseLowpassHz: 1200, cracklePerSec: 9, crackleGain: 0.12 },
      present: { humHz: 0, humGain: 0, noiseGain: 0.012, noiseLowpassHz: 6000, cracklePerSec: 0, crackleGain: 0 },
    },

    // Game feel: small sounds for everything you do (footsteps, paper, camera, voices). Not "cues": they
    // are never the lastCue, so they can't hide the story sounds from the checks.
    feel: {
      seed: 31,
      step: { variants: 4, sec: 0.07, gain: 0.12, fromHz: 1800, toHz: 500, q: 1.2, thumpNote: 40, thumpGain: 0.09, pitchJitter: 0.12, strideM: 0.9 }, // game: one `footstep` event per strideM walked
      paper: { rustles: 4, gapSec: 0.045, sec: 0.07, gain: 0.3, minHz: 2500, maxHz: 6500, q: 1.5 },
      zoom: { sec: 0.45, gain: 0.25, lowHz: 300, highHz: 1600, q: 2 }, // a soft whoosh: rising in, falling out
      voice: {
        blipSec: 0.06, gapSec: 0.085, gain: 0.16, maxBlips: 24, // one blip per syllable-ish, at most ~2 s
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
      ringtone: { // cold December dusk: wind, traffic, and a bus pulling in when you arrive
        wind: { gain: 0.1, minHz: 300, maxHz: 1200, gustHz: 0.13, q: 3 },
        traffic: { gain: 0.05, carsPerSec: 0.3, lowpassHz: 300, passSec: 3 },
        bus: { gain: 0.16, delaySec: 1.2, sec: 3.2, engineHz: 42, hissSec: 0.7, hissGain: 0.35 },
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
      cds: {
        mira: { file: 'music/mira.mp3', gain: 0.9, bpm: 68, beatOffsetSec: 0, beat: 0, past: { silentUntil: 'mira_play_cd' } },
        static: { file: 'music/static.mp3', gain: 0.8, bpm: 104.5, beatOffsetSec: 0, beat: 0, past: { brokenUntil: 'static_plug_amp', liveAfter: 'static_give_mic' } },
        kbit: { file: 'music/kbit.mp3', gain: 0.8, bpm: 163.5, beatOffsetSec: 0, beat: 0, past: { leakUntil: 'kbit_beam_track' } },
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

  // --- Teammate B: DJ K-Bit's moment, "5 December 2004" (where props stand: src/world/props/kbit.ts) ---
  kbit: {
    shelterGlass: '#7f9fb0',
    shelterFrame: '#3b4048',
    shelterRoof: '#2f343b',
    signPole: '#2a2a2a',
    sign: '#e23b3b', // the bus stop sign: interactable
    signBand: '#f4f4f0', // the "BUS" band on the sign
    timetable: '#f2e6b8', // paper timetable on the pole
    people: ['#5a6fa8', '#a8605a', '#6a9a62', '#9a7ab8'], // the queue, one coat colour each
    flipPhone: '#c0c6cc', // everyone in the queue has one
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
