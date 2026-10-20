# Vision materials and entrance implementation — validation incomplete

The corrected four-panel reference in `165021.jpg` is the reference used for this pass. The earlier side-by-side Home/Details image was discarded. The supplied screenshot is only 628 pixels wide and its individual screen panels are small; exact typography and spacing parity remain unverified.

## Implemented

- Added 26 separate photographed material cutouts: eight sticky notes with physical lifted corners, four paper sheets, four neutral editorial papers, six translucent tape strips and four Polaroid frames with alpha apertures. No words, photographs or Anchor artwork are baked into them.
- Added 16 small palette thumbnails. The manifest uses static Metro requires; full-size materials are decoded only where rendered. Raw generation atlases are retained in the generation workspace and are not app assets.
- Vision's board and note editor opt into shared material primitives. Existing persisted note style IDs, text, font choices, placements and CRUD services are retained. Existing illustrated editorial presets remain available.
- Removed the note editor's synthetic SVG curl and extra grain layer. The selected material now supplies its own physical corner, grain and contact shadow in both editor and saved board.
- Restored the real Anchor, saved notes and captions on the resting Visualize entrance. The Anchor uses `anchorRenderProps`, `VisionBoardIntentionCard` and `CircularAnchorRenderer`; `anchor.threadStrength` passes unchanged to the existing aura path. No new glow formula was introduced.
- Removed the two-line intention cap. The existing statement is the fallback when intention text is empty.
- Kept notes and the Anchor visible through the entrance flight so they do not disappear and remount at rest.

## Components and contracts

| Component | Contract preserved / change |
| --- | --- |
| `VisionBoard` | Existing camera, photo selection/reordering, controls, note CRUD callbacks and captured launch frame; opts into photographic materials. |
| `VisionBoardScene` | Shared layout/roster renderer; adds an optional `materialMode` with `legacy` default for cinematic callers. |
| `VisionBoardPhoto` | Existing image URLs, crop/cover behavior, gesture shared values and caption editor; photographic frame/tape opt-in and read-only captions. |
| `VisionBoardNoteElement` | Persisted note placement, gestures and single-settle writes; forwards material mode. |
| `VisionNoteRenderer` | Text stays live native text above a memoized material surface. Legacy default remains for cinematic snapshots. |
| `V2VisionNoteComposer` | 200 Unicode-character limit, keyboard avoidance, fixed footer, style/font selection and save/edit payloads retained. |
| `V2VisualizePrepareScreen` | Existing `onBegin` payload, entitlement path, preparation, audio setup, durations, navigation and Begin handler retained. Presentation changes only. |
| `VisionMaterialSurface` (new) | Memoized static texture with optional compatible style tint and small thumbnail selection. |
| `VisionPolaroidFrame` (new) | Reusable transparent frame; photographs, captions and shadows are independent. |
| `visionNoteMaterials` (new) | Maps existing persisted style IDs to materials without a data-model migration. |

The existing deterministic layouts for photo counts 0–8 and the session's geometry are unchanged. Their rendered fidelity still needs comparison against the reference on devices.

## Assets

All files are under `src/assets/vision/materials/`. `inventory.json` lists every filename, dimension and measured source crop. `manifest.ts` supplies static sources to Metro.

| Family | Filenames (each `.webp`) | Dimensions |
| --- | --- | --- |
| Sticky | `sticky-blush-pink`, `sticky-butter-yellow`, `sticky-sky-blue`, `sticky-sage-green`, `sticky-lavender`, `sticky-peach`, `sticky-warm-ivory`, `sticky-rose-lined` | 600×600 |
| Paper | `paper-ivory-rough`, `paper-cream-fiber`, `paper-warm-beige`, `paper-torn-edge` | 600×600 |
| Editorial | `editorial-classic-ivory`, `editorial-warm-cream`, `editorial-oyster`, `editorial-soft-parchment` | 600×600 |
| Tape | `tape-cream`, `tape-muted-pink`, `tape-beige`, `tape-translucent-clear`, `tape-textured-ivory`, `tape-torn-cream` | 512×160 |
| Polaroid | `polaroid-classic`, `polaroid-torn-bottom`, `polaroid-rough-edge`, `polaroid-wide-bottom` | 600×720 |
| Palette | One matching file in `thumbnails/` for each sticky/paper/editorial material | 128×128 |

`scripts/vision-materials/prepare.mjs` extracts the individual materials, removes detached alpha debris, preserves source shadow alpha, clears the frame apertures and encodes WebP. It requires ImageMagick and the generated source atlases. `--emit-shell` supports environments that restrict Node subprocesses.

## Validation and evidence

- `git diff --check`: passed.
- `python3 scripts/vision-materials/verify.py`: checks all 26 material dimensions, transparent pixels, entire Polaroid aperture regions, tape translucency, palette dimensions and file-size budget.
- Individual alpha proofs were inspected on contrasting backgrounds. `vision-fidelity-evidence/material-library.jpg` is an **asset contact sheet**, not a screenshot of the running app.
- Updated existing regression tests for entrance Anchor/notes, shared note materials, removal of the editor-only curl and legacy cinematic material defaults.
- Attempted the four relevant Jest suites: command exited 127 (`jest: not found`).
- Attempted `./node_modules/.bin/tsc --noEmit`: command exited 127 (TypeScript is not installed).
- Dependency installation, app launch and Android/iOS captures were blocked by workspace network access. Shell commands could not connect to the configured proxy, and scoped network requests did not complete.

No active Visualize session files are included in this change. No guided audio, beatmaps, playback hooks, session timing, chapter sequencing, completion, Thread Strength updates, haptics or session navigation were edited. Shared renderers retain their legacy defaults; only Vision and the entrance explicitly opt into new materials. The Begin handler is unchanged.

## Still required before acceptance

1. Install the repository's locked dependencies, run TypeScript and the relevant existing suites (including all scrapbook-layout and protected session regression suites).
2. Capture before/after screens from the running app and compare the corrected reference, including 1–8 photographs, no/multiple notes, all fonts/materials, different Anchor geometries, and zero/medium/high server strength.
3. Exercise photo upload/generation/replacement/reorder, note CRUD/persistence, premium gating, navigation and Begin Visualize on Android and iOS.
4. Verify keyboard/safe-area constraints, first-open decode behavior and performance on S24 Ultra/comparable iOS hardware.
5. Resolve any spacing, composition, crop, typography or lighting differences found by that comparison. Visual parity is **not claimed**.
