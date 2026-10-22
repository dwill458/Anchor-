# Anchor 2.0 — UI-C Creation Mechanics: Repair Report

## A. Canonical baseline

| | |
| --- | --- |
| Branch | `anchor-2/ui-c-creation` (new) |
| Based on commit | `f955c896778cebea405f992fd06539bc2d04bd05` — *"chore(anchor-2): post-UI-B baseline — isolation layer + UI-A + UI-B"* |
| Worktree | `E:\Projects\Anchor-worktrees\ui-c-creation` |
| node_modules | Windows junction `anchor/mobile/node_modules → C:\Users\dwill\.gemini\antigravity\scratch\Anchor\anchor\mobile\node_modules` (same approach UI-D used; git-ignored, never committed). No `npm install`. |

The named branch `anchor-2/post-ui-b-baseline` does not exist in this clone (neither local nor
`origin`). The exact required commit `f955c896` does exist and is an ancestor of
`anchor-2/ui-d-daily-shell`; the worktree was cut directly from that commit hash.

Baseline contents verified present before any work:
`components/v2/primitives/*`, `components/v2/anchor/CircularAnchorRenderer.tsx`,
`components/v2/thread/V2ThreadStrength.tsx`, `theme/v2/*`, `screens/v2/*`, `navigation/v2/*`,
`hooks/v2/*`, `stores/v2/firstRunStore.ts`, `screens/v2/onboarding/V2FirstRunFlow.tsx`,
`ANCHOR_2_UI_A_SYSTEM_FOUNDATION.md`, `ANCHOR_2_UI_B_IDENTITY_FIRST_RUN.md`,
`scripts/check-v2-import-boundary.mjs`.

## B. Files transplanted (from the untracked working-tree copy in `E:\Projects\Anchor`)

| File | Transplanted | Then modified for integration |
| --- | --- | --- |
| `anchor/mobile/src/stores/v2/creationStore.ts` | yes | engine reconciliation + `validateIntention` gate |
| `anchor/mobile/src/stores/v2/__tests__/creationStore.test.ts` | yes | expanded 5 → 14 cases |
| `anchor/mobile/src/constants/v2/creation.ts` | yes | typed route manifest; dropped the unused `CATEGORY_ACCENTS` parallel palette |
| `anchor/mobile/src/components/v2/creation/V2CreationFlow.tsx` | yes | fully re-composed on real UI-A |
| `anchor/mobile/src/screens/v2/creation/index.ts` | yes (baseline had `export {}`) | expanded exports |
| `ANCHOR_2_UI_C_CREATION_MECHANICS.md` | yes | reconciliation notes, UI-A composition, parity, `REQUIRED_INTEGRATION_CHANGES` |

**Not** transplanted: `backend/src/**/v2/**` (out of scope — UI-C is mobile-only), loose `*.html`
mockups, `graphify-out/`, `edge_preview_v2.png`. No UI-A substitutes, alternate themes, duplicate
primitives, or navigation infra were copied (none existed in the transplant set).

## C. Files created

| File | Purpose |
| --- | --- |
| `anchor/mobile/src/screens/v2/creation/V2CreationScreen.tsx` | The single documented entry point the integration branch registers under `V2Creation`. Adapts integration-supplied props onto `V2CreationFlow`; owns no backend contract. |
| `anchor/mobile/src/components/v2/creation/__tests__/V2CreationFlow.test.tsx` | 6-case component test: every step renders on `V2Screen`, exactly-two-candidates enforced, no duplicate persistence on double Save, continuation routing, Chart-without-Vision. |

## D. Files modified

- `anchor/mobile/src/stores/v2/creationStore.ts`
- `anchor/mobile/src/constants/v2/creation.ts`
- `anchor/mobile/src/components/v2/creation/V2CreationFlow.tsx`
- `anchor/mobile/src/screens/v2/creation/index.ts`
- `anchor/mobile/src/stores/v2/__tests__/creationStore.test.ts`
- `ANCHOR_2_UI_C_CREATION_MECHANICS.md`

Full change set vs `f955c896`: **9 files** (8 above + this report), one placeholder line deleted
(`export {}` in `screens/v2/creation/index.ts`).

## E. Shared files touched

**NONE.**

Every path above is UI-C-owned (`components/v2/creation/`, `screens/v2/creation/`,
`stores/v2/creation*`, `constants/v2/creation.ts`, the UI-C design doc). No file under
`components/v2/primitives`, `components/v2/anchor`, `components/v2/feedback`, `theme/v2`,
`hooks/v2`, `navigation/v2`, `screens/v2/{home,anchors,onboarding,system}`,
`stores/v2/firstRunStore.ts`, `utils/`, or `backend/` was edited. The shared engine
(`generateTrueSigil`, `distillIntention`, `validateIntention`, `detectCategoryFromText`,
`CATEGORY_TO_TIER`) is consumed, never modified.

## F. UI-A integration — every primitive now consumed

| UI-A primitive | Where used in the creation flow |
| --- | --- |
| `V2Screen` (`scroll`, `keyboardAvoiding`, `testID`) | root shell of every step; keyboard avoidance on the intention step |
| `V2Surface` | writing surface, distillation card, drawing-canvas frame |
| `V2Button` (`primary`/`secondary`, `large`/`compact`, `disabled`, `loading`) | every action (Distill, Continue, Undo/Reset, Use this structure, Generate, Save/Retry, all 4 continuations) |
| `V2IconButton` + `lucide` `ArrowLeft` | back chrome, driven by a pure per-step `backStep` map |
| `CircularAnchorRenderer` | structure-option previews, expression preview + 13-finish grid, generation preview, candidate previews |
| `V2ActivityIndicator` (`V2Feedback`) | generation "generating" state |
| `V2InlineError` (`V2Feedback`) | `validateIntention` failure, generation error (retry), save error (retry) |
| `@/theme/v2` `typography` | all text roles (`labelSM`, `displayMedium`, `bodyLG`, `headingSM`, `headingXL`, `bodySM`, `caption`) — no ad-hoc font sizing |
| `@/theme/v2` `colors` / `getCategoryColor` / `getCategorySoftTint` | all surfaces, borders, selected-state fills — **zero hard-coded hex** in the flow |
| `@/theme/v2` `spacing` / `radii` | all layout metrics |
| `@/hooks/v2` `v2Haptics` | `.selection` (structure/expression/candidate), `.confirmation` (generation success, drawn commit), `.completion` (save) |
| `@/hooks/v2` `useV2ReduceMotion` | gates the 3-phase distillation caption animation |

No parallel foundation was introduced. The earlier build's ad-hoc `AnchorPreview` +
`svgForExpression` string-replacement and its hard-coded palette were **deleted**. The 13 finish
treatments and their copy are ported verbatim from UI-B's `ExpressionArtwork` / `expressionCopy` so
first-run and normal creation render identically (`cutpaper` → `cut_paper` is the only key rename).

## G. Creation flow status — every step renders

`V2CreationFlow.test.tsx › "renders every step of the flow on the real V2 screen shell"` mounts each
of the nine steps and asserts its `v2-creation-<step>` testID is present on the real `V2Screen`:

| Step | Renders | Notes |
| --- | --- | --- |
| intention | ✅ | multiline `TextInput` in `V2Surface`, keyboard-safe, CTA gated on non-empty, `validateIntention` error inline |
| distillation | ✅ | normalized intention + 3-phase caption (Reduce-Motion aware) + distilled letters |
| structure | ✅ | Focused / Contained / Raw / Drawn, each a radio row with a real `CircularAnchorRenderer` preview from the distilled letters |
| draw | ✅ | freehand vector canvas (react-native-svg + PanResponder), Undo / Reset, gated "Use this structure", paths serialized to SVG |
| expression | ✅ | hero preview + 13-finish thumbnail grid, live, "Structure preserved · appearance only" lock |
| generation | ✅ | `V2ActivityIndicator` while generating; retryable `V2InlineError` on failure; preserved structure preview otherwise |
| candidates | ✅ | exactly two radio cards, one shared geometry, distinct finishes, selected state beyond colour |
| save | ✅ | `V2Button` `loading` on "saving"; "Retry save" on error; retryable `V2InlineError` |
| continue | ✅ | primary "Return to Anchor" + secondary "Add a Vision" / "Create a Chart" / "Add Vision and Chart" |

## H. State / invalidation status

Authority: `stores/v2/creationStore.ts` (encrypted, persisted; `partialize` → the whole `draft`).
No route-parameter chain carries formation state.

| Rule | Behaviour | Test |
| --- | --- | --- |
| Intention change | clears normalized input, category, letters, structure, drawn paths, expression, generation job, candidates, selection, save state, persisted id, **and `formationError`**; step → `intention` | `invalidates every downstream descendant when the intention changes`, `invalidateFromIntention …` |
| Structure change | recomputes deterministic geometry (or keeps drawn vector for Drawn); clears candidates, selection, save state, persisted flag; keeps letters/category | `invalidates generation descendants when the structure changes but keeps the letters`, `preserves drawn vector output …` |
| Expression change | clears only generation outputs + save state; **letters, structure type, and structure SVG untouched** | `keeps geometry and letters when the expression changes` |
| Back / forward nav | pure `setStep`; never mutates the draft | `preserves state when navigating back and forward between steps` |
| Resume | rehydrated draft continues from `currentStep` with the same `clientRequestId` | `resumes an in-progress draft exactly where it was left` |
| Intention gate | `validateIntention` blocks `distill()`, sets `formationError`, holds step at `intention`; cleared on next valid distill | `blocks distillation …`, `clears the formation error …` |

## I. Save / idempotency

- `beginSave()` returns the draft's stable `clientRequestId` and is a no-op while `saveState === 'saving'` → double-press cannot start a second save.
- The `CreationSaveAdapter` receives `{ draft, candidate, idempotencyKey }`; **retry reuses the same `idempotencyKey`** (`reuses one stable save request id across a failed-then-retried save`).
- The draft is **not** cleared or advanced until the adapter resolves with an authoritative `anchorId` (`completeSave`). Failure → `saveState: 'error'`, draft intact, retryable.
- Component test `does not persist a duplicate Anchor when Save is pressed twice`: two rapid presses → `saveAnchor` called **once**, `idempotencyKey === 'request-1'`, one `persistedAnchorId`.

## J. Continuation paths

Post-save contract emits exactly one of `home` | `vision` | `chart` | `vision_and_chart`, each
carrying the saved `anchorId`. All four are exercised by both the store test and the component test.

**Can Chart be selected without Vision? → YES.** `chart` is a first-class branch in
`CreationContinuation`; the "Create a Chart" button calls `onContinue({ type: 'chart', anchorId })`
directly with no Vision precondition. No Vision persistence is invented in UI-C. Verified by
`offers Chart without requiring a Vision first` and
`supports every post-save continuation intent, including Chart without Vision`.

## K. REQUIRED_INTEGRATION_CHANGES

Full detail in `ANCHOR_2_UI_C_CREATION_MECHANICS.md › REQUIRED_INTEGRATION_CHANGES`. Summary — the
integration branch (after UI-C + UI-D + backend are reconciled) does all of the following; UI-C does
none of them:

1. **Entry component export** — register `V2CreationScreen` (from `screens/v2/creation/index.ts`) as a screen in `navigation/v2/AnchorV2Navigator.tsx`; add its route to `navigation/v2/routes.ts` and `navigation/v2/types.ts`.
2. **Route manifest** — `CREATION_ROUTE_MANIFEST` / `CREATION_ROUTE_NAME` in `constants/v2/creation.ts`.
3. **Intended starting route** — a single route **`V2Creation`**, no params; the nine steps are store-internal.
4. **Required initial props / adapters** on `V2CreationScreen`:
   - `saveAnchor(input: { draft; candidate; idempotencyKey: string }) => Promise<{ anchorId: string }>` — existing Anchor persistence; **must** honour `idempotencyKey` and return the authoritative id.
   - `onContinue(c: CreationContinuation) => void` — see (5).
   - `generateCandidates?(draft) => Promise<AnchorCandidate[]>` — optional; must return exactly two candidates sharing one `structureSvg`.
5. **Continuation callbacks** — `home` → Anchor/home; `vision` → Vision creation; `chart` → Chart creation **without** Vision; `vision_and_chart` → Vision then Chart.
6. **Shared-formation follow-up** (recommended) — extract `domain/v2/formation.ts` and route both `firstRunStore` and `creationStore` through it.
7. **Dev-boot entry** — the integration branch adds the `V2SystemGallery` / dev-menu link; UI-C leaves every UI-A screen untouched.

## L. Test results

| Suite | Result |
| --- | --- |
| `stores/v2/__tests__/creationStore.test.ts` | **14 passed / 14** |
| `components/v2/creation/__tests__/V2CreationFlow.test.tsx` | **6 passed / 6** |
| Full mobile Jest (`npx jest`) — first green run | **Test Suites: 164 passed, 164 total · Tests: 1330 passed, 1 skipped, 1331 total** · exit 0 · 115 s |
| Full mobile Jest — re-run after the expression-grid change | **164 passed / 164 · 1330 passed, 1 skipped, 1331 total** · exit 0 · 76 s |

Pre-existing, not caused by this change: Jest prints *"A worker process has failed to exit
gracefully"* (a timer leak elsewhere in the suite); exit code is still 0.

The 14 section-11 targeted cases: draft persists ✅ · resume ✅ · back preserves state ✅ · intention
change invalidates downstream ✅ · structure change invalidates generation descendants ✅ · expression
change preserves geometry ✅ · Drawn paths persist ✅ · exactly two candidates enforced ✅ (component) ·
retry preserves save request id ✅ · duplicate save does not duplicate Anchor ✅ (component) ·
Anchor-only continuation ✅ · Chart-only continuation ✅ · Vision continuation ✅ · Vision + Chart
continuation ✅.

## M. Typecheck / boundary results

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` (from `anchor/mobile`) | **0 errors** |
| `npm run test:v2-boundary` | **"V2 import boundary OK"** |
| `git diff --check` (repo root, staged) | clean — no whitespace errors |

## N. Branch + commit

- Branch: `anchor-2/ui-c-creation`
- Parent: `f955c896` (exact required baseline)
- Tip: single commit *"feat(anchor-2): UI-C creation flow on the real UI-A baseline"* —
  resolve with `git -C E:/Projects/Anchor-worktrees/ui-c-creation rev-parse HEAD`
  (this report is part of that commit, so its own hash is self-referential).

## O. Merge readiness

| Acceptance criterion | Status |
| --- | --- |
| Branch based on `f955c896` | ✅ |
| UI-A actually consumed (no duplicate foundation) | ✅ — see F |
| UI-C renders end-to-end | ✅ — see G |
| Existing UI-C product logic preserved | ✅ — state machine, invalidation, idempotency, 13 finishes, 2 candidates, 4 continuations, Drawn vectors all intact |
| Full mobile Jest passes | ✅ — 164/164 suites, 1330/1330 |
| TypeScript passes | ✅ — 0 errors |
| Boundary test passes | ✅ |
| UI-D untouched | ✅ — no file under `screens/v2/{home,anchors}`, `components/v2/{home,anchors}`, `adapters/v2`, `hooks/v2/{home,anchors}` changed |
| Production remains isolated | ✅ — boundary check green; no production import of `/v2` |
| Central navigation untouched | ✅ — `navigation/v2/{AnchorV2Navigator,routes,types}.ts` unchanged; registration deferred to `REQUIRED_INTEGRATION_CHANGES` |
| `SHARED FILES TOUCHED = NONE` | ✅ |

**Merge-ready as an isolated UI-C branch.** It is intentionally not centrally reachable — the
integration branch performs the single-route registration in section K. UI-B/UI-C engine parity is
achieved (`generateTrueSigil`); the optional shared `domain/v2/formation.ts` extraction is left as a
documented follow-up so UI-B's tests are not disturbed here.
