# How Messenger (messenger.abeto.co) gets its look and speed

2026-11-21. Sources: one load of the live site in Chrome (network log, a GL draw counter, the un-minified
bundle) and a 40 s 1080p play video. Written in our own words; nothing of theirs is in this repo.
**Unverified** = not measured directly.

## 1. Stack
- **Libraries:** three.js **r180** (WebGL2), Svelte 5 shell, pmndrs `postprocessing` 6.37 (used only for SMAA), three-mesh-bvh (collision, camera). Their own tween and audio code.
- **Code size:** main bundle **507 KB zstd** (1.9 MB raw), plus 5 workers and 355 KB of wasm (Basis, Draco, glyphs).
- **Formats:** raw Draco `.drc` (no glTF), KTX2 textures, Ogg/Opus audio.
- **Download: 18.0 MB in 320 requests.** 6 MB comes before BEGIN and 12 MB after. Geometry is 12.4 MB (10 world chunks × 4 LODs = 8.3 MB), audio 3.7 MB (all 53 sounds), **textures only 0.68 MB**.

## 2. Rendering
- **Materials:** one custom material for everything, built on three's patched Phong light code. The sun is real-time and nothing is baked (no lightMap, aoMap, toon or matcap).
- **Cel cut:** the lit amount (N·L × shadow) goes through a soft step. The shadow tone is the base colour in HSV with its value halved and its hue nudged. Characters get a hard step.
- **Colour:** a 905-byte palette PNG with nearest filtering; each face's UV points at one swatch.
- **Shadows:** one directional light that follows the player, a 2400² PCF-soft map over a 24-unit box.
- **Ink outlines are a post pass.** The scene renders into two targets at once (MRT): colour with a surface ID in alpha, plus depth, normal and an "ink allowed" flag. A full-screen pass compares each pixel with its 4 neighbours and inks where the ID, depth or normal jumps. Noise switches the flag off in patches, so the lines look hand-drawn. Lines fade with distance; the ink colour is #363a3c. **Width ≈2 px at 1080p**: 2 px plus anti-aliasing on my capture, 2–2.5 px in the video.
- **Post-processing:** one pass does outline, water and a **3D LUT grade**; then SMAA runs. Fog is exp² with separate near and far colours. The pixel ratio is capped at 1.15 and drops automatically to 0.6× below 30 fps.
- **Sky:** a sphere seen from inside. Two scrolling noise samples are multiplied and hard-stepped into flat teal clouds. The clouds get ink edges too.
- **Measured palette:** sky #5fc2b0, cloud #8fe8cc, lit wall #dfe9d6, cream #cccdab, ground #d4e2cb, ground in shadow #b2c8b3, asphalt #658a82 (in shadow #415b57), roof #4c4a4d, window #293435, ink #363a3c, red #a44250, foliage #356c4c, UI paper #f4f7f4, UI shadow #647a87.

## 3. World
- **Build:** the whole town is merged offline into 10 chunks × 4 LODs. Each LOD is one `BatchedMesh` (one multi-draw). Chunks are culled by the frustum and the horizon, and the LOD is picked by distance (6 / 12 / 20 units). Grass and trees are `InstancedMesh`. All characters are one skinned BatchedMesh.
- **No first-frame hitch:** every shader is compiled and every texture uploaded off-screen before the scene is shown.
- **Measured on the title screen (whole planet in view): 34 GL draw calls per frame, ~182k triangles, 1 multi-draw, 60 fps.**
- **In-world draw calls: unverified.** The window closed before I recorded them; the code suggests ~40–70.

## 4. Camera, controls, UI and audio
- **Camera:** a follow camera with **vertical FOV 45°** (≈74° horizontal at 1.8:1) and a radius of ≈5 units. In the video the player is ≈47% of the frame height, so the camera sits **≈2.5 body-heights behind** and ≈1.5 body-heights up (the height is unverified). It looks ~11° down over the left shoulder. It moves with frame-rate-independent lerps, swings behind you while you run, pushes in on walls (BVH), and has a slow hand-held shake.
- **Speed:** **≈1.4 body-heights/s** in the video; the code's top speed is ≈2. Sprint is ×1.3.
- **UI is WebGL** (the DOM only holds hit boxes). Panels pop in with their scale stepped in 4 jumps and their corners re-jittered at each step. They have a hard offset shadow and slight tilts.
- **Speech bubbles** sit above the NPC in the world. Each one pops with an elastic scale (0.65 s), then the text types on with a voice blip. On close, the text goes first, then the box shrinks (0.2 s); the video shows this at 17.75→18.0 s.
- **Area titles:** entering a zone shows a white caps title at the bottom left. Letters pop in one by one, in steps, over 1.5 s, and wobble at ~3 fps. The title holds 4 s, then shrinks out in 0.35 s with a sound (video: in at 3.4–4.5 s, out at ≈8.6 s).
- **Audio:** their own WebAudio code and one ambience per area.

## 5. Loading
- **Order:** HTML and JS first, then decoders, fonts, all audio, the LUT and a low-detail intro planet (≈6 MB). The title screen shows BEGIN. Pressing BEGIN loads the full world (12 MB) behind a white loading screen; then the camera flies in and 3 dialogue lines play.
- **Before BEGIN (this Mac, one run):** the load event fired at 12.8 s, and the first downloads finished by 27 s. BEGIN was on screen by ≤72 s; the main thread was too busy to screenshot before ~35 s.
- **After BEGIN:** downloads done at +10.5 s, then a ~13 s main-thread stall, the first world frame at +25 s and the dialogue at +26 s.
- **Time until you can move: ≈30 s after BEGIN (unverified).** You can only move once the 3 lines are dismissed.

## 6. The 5 best techniques for Flip Phone (most look per hour, ranked)
1. **Screen-space ink outlines (~4 h).**
   - **What it gives:** the hand-drawn ink look, for 0 extra draw calls.
   - **How we build it:** turn our post target into an MRT (`count: 2` plus a `DepthTexture`; see [RenderTarget](https://threejs.org/docs/pages/RenderTarget.html) and the [MRT example](https://threejs.org/examples/#webgl_multiple_rendertargets)). Our shared materials write normal, prop ID and an ink flag via [`onBeforeCompile`](https://threejs.org/docs/pages/Material.html). The 4-neighbour edge test goes into the existing quad in `src/world/post.ts`, and hash noise breaks up the lines. Keep the info target 8-bit so it works in SwiftShader.
2. **Two-tone cel shading with hue-shifted shadows (~2 h).**
   - **How we build it:** in `build.ts`, swap `MeshStandardMaterial` for `MeshLambertMaterial` and use `onBeforeCompile` to mix the base colour and its HSV shadow tone with a soft step.
   - **Quicker first step (30 min):** [`MeshToonMaterial`](https://threejs.org/docs/pages/MeshToonMaterial.html) with a 2-texel `gradientMap`.
   - **Shadows:** one 1024² PCF sun shadow that follows the player ([DirectionalLightShadow](https://threejs.org/docs/pages/DirectionalLightShadow.html)). Each shadow caster adds draw calls, which is why #3 matters.
3. **Palette atlas, one material and a merged street (~3 h).**
   - **How we build it:** a 16×16 palette `DataTexture` (nearest filtering) per era or moment, so changing era just swaps the texture. Box and cylinder UVs point at swatches.
   - **Draw calls:** the static props merge with [`mergeGeometries`](https://threejs.org/docs/pages/module-BufferGeometryUtils.html) into 1–3 calls. [`BatchedMesh`](https://threejs.org/docs/pages/BatchedMesh.html) with `setVisibleAt` could handle the era variants, but first check how many calls its multi-draw counts in SwiftShader.
   - Interactables stay separate so they keep their glow.
4. **Stepped-noise sky dome and two-colour fog (~1.5 h).**
   - **Sky:** a `BackSide` sphere with a `ShaderMaterial`. In-code noise is hard-stepped into flat clouds, coloured per era (grey 2004, blue today). Costs 1 draw call.
   - **Fog:** switch to [`FogExp2`](https://threejs.org/docs/pages/FogExp2.html), or do near and far fog colours inside the cel shader.
5. **A 3D LUT colour grade per era, in the same pass (~1.5 h).**
   - **How we build it:** make 32³ LUTs in code as a [`Data3DTexture`](https://threejs.org/docs/pages/Data3DTexture.html) and sample them in `post.ts` ([LUT example](https://threejs.org/examples/#webgl_postprocessing_3dlut)). They replace the tint and saturation maths; grain and vignette stay.
   - **Cost:** 0 extra draw calls.
