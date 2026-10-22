# Anchor 2 UI C Creation Mechanics

> **Baseline reconciliation (this branch `anchor-2/ui-c-creation`, based on `f955c896`).**
> The UI-C flow was originally built before the real UI-A primitive layer and UI-B first-run engine
> landed. It has now been transplanted onto the canonical post-UI-B baseline and:
> - re-composed entirely on the real UI-A primitives (`V2Screen`, `V2Surface`, `V2Button`,
>   `V2IconButton`, `CircularAnchorRenderer`, `V2Feedback`, `@/theme/v2`, `@/hooks/v2`);
> - reconciled onto the **same sigil engine UI-B first-run uses** — `generateTrueSigil`
>   (`utils/sigil/traditional-generator`) with `CATEGORY_TO_TIER` — replacing the earlier
>   `generateAbstractSigil`. UI-C's only extension is the variant it requests
>   (Focused→`balanced`, Contained→`dense`, Raw→`minimal`); UI-B always uses `balanced`;
> - gated behind the same `validateIntention` check UI-B applies before forming an Anchor.
>
> No central navigation was edited. No UI-A or UI-B file was modified. `SHARED FILES TOUCHED = NONE`.

## Source HTML references

- `E:\downloads\anchor (10).zip` — `10 Intention Entry.html`, `13 Letter Distillation.html`, `14 Draw Your Structure.html`, `15 Refine Expression.html`, `16 Choose Structure.html`, `20 Generation System.html`, and `23 Creation Flow.html`.
- `Anchor_2.0_Creation_Flow_FINAL.html` — authoritative integrated behavior audit. It confirms Focused, Contained, Raw, and Drawn; the locked finishes; two candidate selection; and optional Vision and Chart continuation.
- The supplied design-system Word document was read as reference material only. It did not expand the user-requested ownership boundary.

## State machine

`intention -> distillation -> structure -> draw (Drawn only) -> expression -> generation -> candidates -> save -> continue`

`src/stores/v2/creationStore.ts` is the sole authority. Screens are presentation only; no route parameter chain carries formation state. The encrypted, persisted draft includes a draft ID, client request ID, original and normalized intention, category, distilled letters, geometry or drawn paths, expression, candidates, selected candidate, save state, and authoritative returned Anchor ID.

## Draft invalidation

- An intention change removes normalized input, category, distilled letters, structure, drawn paths, expression, generation job, candidates, selected candidate, persisted state, and returned Anchor ID.
- A structure change regenerates deterministic geometry where applicable and clears incompatible drawn data, candidates, selection, and save state.
- An expression change clears only generation outputs and save state. It leaves the intention, letters, structure, SVG geometry, and drawn paths intact.

## Formation and structure

The flow reuses the existing Austin Osman Spare `distillIntention` utility, `validateIntention`, and
`detectCategoryFromText`; none was copied or rewritten. Structure geometry is produced by
`generateTrueSigil(letters, CATEGORY_TO_TIER[category], variant)` — **the identical call**
`stores/v2/firstRunStore.ts › formFirstRunAnchor()` makes for the first Anchor, so a user's first
and later Anchors come from one engine. The canonical user-facing structures are Focused, Contained,
Raw, and Drawn; the first three select the generator's `balanced` / `dense` / `minimal` variant.
Drawn paths remain vectors and are serialized to SVG for downstream rendering; expression treatments
are a view-layer style only and never re-enter the generator.

### Shared-formation audit (spec §9)

| Concern | UI-B first-run | UI-C creation (this branch) | Status |
| --- | --- | --- | --- |
| Distillation | `distillIntention(...).finalLetters` | same | shared, unchanged |
| Category | `detectCategoryFromText` | same | shared, unchanged |
| Intention gate | `validateIntention` | `validateIntention` (added here) | reconciled |
| Sigil engine | `generateTrueSigil` + `CATEGORY_TO_TIER` | `generateTrueSigil` + `CATEGORY_TO_TIER` | reconciled |
| Variant | always `balanced` | `balanced` / `dense` / `minimal` by structure | UI-C superset |
| Orchestration | inline in `formFirstRunAnchor` | inline in `creationStore` | duplicated — see integration follow-up |

Follow-up (not done here, to keep UI-B tests green and the ownership boundary intact): extract a
shared `domain/v2/formation.ts` that both `firstRunStore` and `creationStore` call for
normalize → validate → detect category → distill → generate.

## Expression and generation

Expression is stored as appearance metadata separate from structure. The 13 locked finishes are Original, Monoline, Architectural, Foil, Embossed, Etched, Ink, Halo, Glass, Radiant, Organic, Woven, and Cut Paper. Generation has idle, generating, success, retry, and error states. The default integration-safe fallback returns exactly two candidates sharing identical structural SVG; only expression differs. An injected generation adapter can replace visual output without changing formation truth.

## Save and continuation

`CreationSaveAdapter` receives the canonical draft, selected candidate, and stable `clientRequestId` idempotency key. The draft remains intact until the adapter acknowledges with an authoritative Anchor ID. Retry retains the same request ID. The post-save contract emits one of `home`, `vision`, `chart`, or `vision_and_chart`; chart-only is first-class and no Vision persistence is invented here.

## UI-A composition

`components/v2/creation/V2CreationFlow.tsx` now renders on the real foundation:

| Concern | UI-A primitive used |
| --- | --- |
| Screen shell, safe area, scroll, keyboard avoidance | `V2Screen` (`scroll`, `keyboardAvoiding` on the intention step, `testID="v2-creation-<step>"`) |
| Back chrome | `V2IconButton` + `ArrowLeft`, driven by a pure per-step `backStep` map (mirrors `V2FirstRunFlow`) |
| Cards / writing surface / canvas frame | `V2Surface` |
| All actions | `V2Button` (`primary` / `secondary`, `size="large"|"compact"`, `disabled`, `loading`) |
| Anchor artwork (structure previews, expression preview, generation, candidates) | `CircularAnchorRenderer` wrapped in the ported `expressionTreatment` style map |
| Generation loading / retryable error | `V2ActivityIndicator`, `V2InlineError` |
| Type, color, spacing, radii | `@/theme/v2` (`typography`, `colors`, `getCategoryColor`, `getCategorySoftTint`, `spacing`, `radii`) — no hard-coded hex |
| Haptics | `v2Haptics.selection` (structure/expression/candidate), `.confirmation` (generation, drawn commit), `.completion` (save) |
| Reduce Motion | `useV2ReduceMotion` gates the staged distillation animation (same pattern as UI-B `Formation`) |

The 13 finishes and their treatments are ported from UI-B's `ExpressionArtwork` so first-run and
normal creation render identically. UI-C keeps the finish key `cut_paper` (UI-B uses `cutpaper`) and
maps it to the same visual treatment.

Accessibility retained: ≥44px controls, `accessibilityRole="radio"` + `accessibilityState.selected`
on every choice, descriptive preview labels, a labeled drawn canvas with Undo/Reset, keyboard-safe
multiline intention input, and `accessibilityLiveRegion` on generation/distillation status.

## Tests

- `stores/v2/__tests__/creationStore.test.ts` (14 cases) — canonical distillation, shared engine
  parity with UI-B, `validateIntention` gating + error clearing, intention→downstream invalidation,
  structure→generation-descendant invalidation, expression/geometry separation, drawn vector
  preservation, stable idempotency key on retry, forward/back state preservation, cold-start resume,
  all four continuations incl. Chart-without-Vision, and both invalidation helpers.
- `components/v2/creation/__tests__/V2CreationFlow.test.tsx` (6 cases) — every step renders on the
  real `V2Screen` shell, exactly-two-candidates enforced (adapter and fallback), no duplicate
  persistence on double Save (one `saveAnchor` call, shared `idempotencyKey`), each continuation
  routes its own intent + saved anchor id, Chart offered without a Vision.

## REQUIRED_INTEGRATION_CHANGES

UI-C is complete within its owned paths. The integration branch — after UI-C, UI-D, and backend are
reconciled — performs exactly the following, none of which UI-C may do itself:

1. **Creation screen / component export.** Register `V2CreationScreen`
   (`screens/v2/creation/V2CreationScreen.tsx`, re-exported from `screens/v2/creation/index.ts`) as
   a screen in `navigation/v2/AnchorV2Navigator.tsx`, adding its route to
   `navigation/v2/routes.ts` and `navigation/v2/types.ts`.
2. **Route manifest.** Use `CREATION_ROUTE_MANIFEST` / `CREATION_ROUTE_NAME` from
   `constants/v2/creation.ts`. Intended starting route: a single route **`V2Creation`** — the nine
   steps are store-internal state, never route params.
3. **Required initial props / adapters** passed to `V2CreationScreen`:
   - `saveAnchor: (input: { draft; candidate; idempotencyKey: string }) => Promise<{ anchorId: string }>`
     — the existing Anchor persistence path. It **must** treat `idempotencyKey` as the dedupe key
     (retries reuse it) and resolve with the authoritative server/local Anchor id. The draft is not
     cleared until it resolves.
   - `onContinue: (c: CreationContinuation) => void` — see (5).
   - `generateCandidates?: (draft) => Promise<AnchorCandidate[]>` — optional; must return exactly two
     candidates sharing one `structureSvg`. Omit it to use the built-in deterministic fallback.
4. **Intended starting route:** navigate to `V2Creation` with no params; `V2CreationFlow` calls
   `useCreationStore.start()` on mount (or resumes a persisted draft).
5. **Continuation callbacks** — `onContinue` receives one of, each carrying the saved `anchorId`:
   - `{ type: 'home' }` → Anchor detail / home
   - `{ type: 'vision' }` → Vision creation
   - `{ type: 'chart' }` → Chart creation **without** any Vision (first-class; no Vision persistence
     is invented in UI-C)
   - `{ type: 'vision_and_chart' }` → Vision, then Chart
6. **Shared formation follow-up** (optional, recommended): extract `domain/v2/formation.ts` and route
   both `firstRunStore` and `creationStore` through it.
7. **Dev-boot entry:** the integration branch adds the `V2SystemGallery` / dev-menu link. UI-C does
   not, to keep every UI-A screen untouched.

## HTML parity review

Re-checked against the JS-rendered references in `anchor (10).zip › Anchor 2.0 Screens/` (10, 13,
14, 15, 16, 20, 23) served locally and viewed at 375×812.

| HTML reference | Behavior preserved | Intentional deviation | Reason |
| --- | --- | --- | --- |
| 10 Intention Entry | short/present/felt prompt, keyboard-safe multiline, CTA disabled until non-empty | eyebrow+title instead of centred top bar; copy is the transplant's, not the mock's | UI-C copy is preserved per "no redesign"; layout is the native `V2Screen` idiom |
| 13 Letter Distillation | shows original + distilled letters; vowels/duplicates removed; `validateIntention` gate | staged reveal reduced to a 3-phase caption (Reduce-Motion aware); no "How this works" link | staged animation kept minimal and RM-safe; the explainer link is an integration/nav concern |
| 16 Choose Structure | Focused / Contained / Raw / Drawn, all four on the same distilled letters, real `CircularAnchorRenderer` previews, Continue gated on a selection | vertical list with descriptions instead of a 2×2 icon grid; no "About structures" modal | the transplant's descriptive list is retained; a modal is out of UI-C's owned surface |
| 14 Draw Your Structure | source letters shown, freehand vector canvas, Undo/Reset, "Use this structure" gated on ≥1 stroke, paths persisted as SVG | warm `V2Surface` frame; no on-canvas letter guides overlay | guide overlay is a later drawing-tool enhancement, not formation truth |
| 15 Refine Expression | 13 finishes, one shared geometry, live preview, "Structure preserved · appearance only" lock | thumbnail grid of all 13 (ported from UI-B `ExpressionArtwork`) **without** the For You / Core / Material / Light / Organic / Graphic filter tabs or "Hold to compare" | filter taxonomy and the press-and-hold compare are additive UX not present in the transplant; deferred |
| 20 Generation System | idle → generating → success/error, retryable, structure preserved through generation, exactly two candidates | single `V2ActivityIndicator` instead of the Structure/Expression/Variations staged animation | generation visuals are provided by the injected adapter; the fallback stays minimal |
| 23 Creation Flow (FINAL) | idempotent save (stable `clientRequestId`), draft survives until authoritative save, all four continuations incl. Chart-without-Vision | continuations rendered as a primary + three secondary buttons; no central-navigation wiring | integration ownership boundary (`navigation/v2/*` untouched) |
