# Anchor 2.0 style generation

Anchor 2.0 adds 15 visual styles **alongside** the Anchor 1.5 catalog. It is an additive generation
contract, not a migration. Legacy style IDs, definitions, prompts, wrappers and negatives are
unchanged and guarded by a byte-for-byte snapshot
(`src/services/__tests__/fixtures/legacyStyleSnapshots.json`, taken before any 2.0 code existed).

`ANCHOR_STYLE_PROMPTS_STEADY_FOCUS.md` is a historical export of **legacy** prompts. It does not
describe the 2.0 contract and was not edited.

## Legacy vs Anchor 2.0

| | Legacy (Anchor 1.5) | Anchor 2.0 |
|---|---|---|
| Catalog | `AI_STYLE_IDS` / `STYLE_PROMPT_LIBRARY` (47 styles) | `ANCHOR2_STYLE_IDS` / `ANCHOR2_STYLE_LIBRARY` (15 styles) |
| Output | Standalone abstract Anchor, transparent/clean background preferred, composited by the app | One complete edge-to-edge artwork; the material field is part of the piece |
| Prompt | Legacy master prompt in `buildStylePrompt` | `buildAnchor2StylePrompt` (shares only the structural-preservation block) |
| Provider wrapper | "Standalone artwork mandate" | "Anchor 2.0 presentation reminder" |
| Negative prompt | Global negative + style extras | Global negative minus surface-forbidding terms + 2.0 legibility additions + style additions |
| Post-generation validator | `validateAnchorArtwork` (occupancy/plaque checks) | Skipped: it finds the Anchor by separating it from an empty surround and would reject a valid full field |

### Why 2.0 generates a field

The 15 styles are material worlds (woven cloth, paper, porcelain, lacquer and leaf, worked metal,
pressed botanicals, a painted wall, tattoo-flash paper, felt, a deep-space field). The field is the
style, so asking the model for transparency or an isolated symbol would erase the style. Both the
prompt and every provider wrapper therefore branch on the same registry lookup, and tests assert no
Anchor 2.0 prompt, wrapper or negative contains transparency, isolation or blank/plain/white/solid
background language.

## How the branch is decided

`getStyleGenerationVersion(styleId)` in `anchor2StyleLibrary.ts` is the only place the version is
decided. It looks the (normalized) ID up in the registry; anything else, including unknown IDs, is
`legacy`, which preserves the existing watercolor fallback. The version is **never** read from a
request. Callers: `buildStylePrompt`, `getStyleNegativePrompt`, `referenceImageWrappers.ts` (Gemini
nano-banana path, Gemini adapter, OpenAI adapter), `GeminiImageService` and `AIEnhancer` (validator
skip). `GenerateImageRequest.styleId` carries the ID to the adapters.

Files: `anchor2StyleLibrary.ts` (registry, leaf module), `anchor2Contract.ts` (shared 2.0 text and
negative terms), `referenceImageWrappers.ts` (legacy and 2.0 wrappers), `stylePromptLibrary.ts`
(builder and negative branch).

## The 15 styles

| ID | Working label | Availability |
|---|---|---|
| `deep_cosmos_v2` | Deep Cosmos | forward |
| `velvet_ember_v2` | Velvet Ember | forward |
| `porcelain_v2` | Porcelain | forward |
| `paper_v2` | Paper | forward |
| `woven_v2` | Woven | forward |
| `plush_v2` | Plush | forward |
| `herbarium_v2` | Herbarium | forward |
| `alloy_v2` | Alloy | forward |
| `graphic_v2` | Graphic | forward |
| `gilt_v2` | Gilt | forward |
| `flash_v2` | Flash | forward |
| `buff_v2` | Buff | forward |
| `prism_flow_v2` | Prism Flow | rotation |
| `clay_v2` | Clay (working name, not final) | rotation |
| `joybrush_v2` | Joybrush | rotation |

`availability` is picker metadata only. Rotation styles are fully generatable. `displayName` is
never written into a prompt, so `clay_v2` can be renamed in one line of the registry without
changing its stable ID or any generated prompt.

## Style data model

Every Anchor 2.0 definition (`Anchor2StyleDefinition`) must define, and
`validateAnchor2StyleDefinition` enforces:

- **lockedCore**: what makes the style recognizably itself.
- **allowedVariation**: what may differ between users and renders.
- **prohibitedDrift**: what would collapse it into another style or generic AI art.
- **paletteLanes**: each with `fieldValue` (light, dark, mixed), `anchorTone` and `anchorValue`.
- **anchorRendering**: how the structure is physically made, without changing geometry. Style
  prohibitions such as embroidery or stitching apply to background decoration only.
- `materialVariants`, `materialBehavior`, `styleNativeMotifs`, `legibilityRule`, `categoryInfluence`.
- **visualLanguage** (`VisualLanguageDNA`): the keys in `REQUIRED_ANCHOR2_DNA_KEYS` are required, not defaulted.
- `generationVersion: 'anchor2'` and `availability`.

Legacy definitions carry none of these fields and keep their derived defaults.

## Adaptive contrast

The structure colour follows the value behind it: light field, dark structure; dark field, light
structure; never forced gold or category colour at the cost of legibility. The lane is picked
deterministically from `style id : intention : variation index : category`. The builder emits an
explicit instruction for the chosen lane; for `mixed` lanes it also requires a calm, low-contrast
tonal zone behind the geometry. Validation rejects a lane that breaks the light/dark rule. The
reference PNG still draws the geometry in gold on an empty surround (`svgToPng`); the prompt and
wrapper say that colour and surround are only a geometry diagram.

## Anchor-aware legibility

There is no fixed "clear centre third" in production. The protected area follows the actual Anchor
footprint: competing contrast, high-frequency texture, stroke-like marks and hard boundaries are
suppressed there and richer detail moves to the perimeter. It is a spatial rule, not a ban, so
Herbarium keeps stems, Buff keeps overspray and Deep Cosmos keeps sparse speckle, away from the
Anchor. The intention signal is told to act on the perimeter and tonal pressure, never on detail
inside the footprint.

## Flag and API

`POST /api/ai/enhance` accepts `*_v2` IDs only when `ENABLE_ANCHOR2_STYLES=true` (default false,
read per request). Otherwise they get the same 400 an unknown style gets. No mobile picker or
catalog was changed.

## Adding a future style without touching legacy

1. Add the ID to `ANCHOR2_STYLE_IDS` in `src/types/index.ts` (the registry is typed as
   `Record<Anchor2StyleId, …>`, so TypeScript forces a definition).
2. Add the definition to `ANCHOR2_STYLE_LIBRARY`. Run the tests; validation and the forbidden-term
   scan cover it automatically.
3. Do not edit `AI_STYLE_IDS`, `STYLE_PROMPT_LIBRARY`, the legacy master prompt or the legacy
   wrapper text. Do not alias a legacy ID to a new style.
4. Never write transparency, isolation or blank-background language into 2.0 text.

## Output

Unchanged by 2.0: 1:1 aspect ratio, 1024×1024 structure reference. Representative rendered prompts:
`ANCHOR2_REPRESENTATIVE_PROMPTS.md` (generated, text only).
