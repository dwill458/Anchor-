# Anchor 2.0 UI-B — Identity & First Run

## Authority and reference audit

The audited source is `E:\downloads\anchor (10).zip`, which contains the full `Anchor 2.0 Screens` HTML set. It is authoritative as the latest supplied 2.0 composition/interaction reference, except where the written UI-B contract or the living design-system specification makes a newer product decision.

| Surface | HTML reference | Preserved behavior/composition |
| --- | --- | --- |
| Direction and first system | `22 Onboarding.html` | Four immediate direction choices; concise editorial copy; no feature-tour slides. |
| Intention | `10 Intention Entry.html`, `22 Onboarding.html` | Single writing surface, 100-character boundary, concise present-tense guidance. |
| Formation | `13 Letter Distillation.html`, `22 Onboarding.html` | Intention → vowel removal → unique remaining letters in order → stable structure. |
| Structure/generation | `16 Choose Structure.html`, `20 Generation System.html`, `23 Creation Flow.html` | Shared structure generation, recoverable state, and a separate expression layer. |
| Anchor reveal | `22 Onboarding.html`, `20 Generation System.html` | Anchor-led reveal with no legacy ring/medallion treatment. |
| Expression | `15 Refine Expression.html` | Live same-geometry preview and the 13 locked finishes: Original, Monoline, Architectural, Foil, Embossed, Etched, Ink, Halo, Glass, Radiant, Organic, Woven, and Cut Paper. |
| Vision / Chart | `11 Vision.html`, `12 Visualize.html`, `22 Onboarding.html`, `23 Creation Flow.html` | Future-facing choice after Anchor creation. |
| First Focus | `07 Focus Practice.html`, `22 Onboarding.html` | An uncluttered Anchor-led ten-second first use. |
| Identity | `19 Sign In & Sign Up.html`, `22 Onboarding.html` | Apple where supported, Google, and email after the system has value worth saving. |

The living specification in `E:\downloads\Anchor_Design_System_Living_Spec_v0_4_THREAD_EVENTS_LIVING_COLOR_LOCKED.docx` was also reviewed. Its text and tables were extracted directly. Rendered page review could not run because the bundled document runtime has no LibreOffice `soffice` binary; this does not affect the source-text audit. The specification locks the light editorial shell, category-color restraint, banned legacy terminology, real distillation method, server-authoritative Thread results, no-trial onboarding, and the rule that onboarding direction groups are messaging—not formation authority.

### Intentional differences from the prototype HTML

- The prototype’s initial welcome page is omitted: the written UI-B contract requires Direction as the first interaction.
- The prototype walks everyone through Vision and Chart. UI-B keeps the contractually newer optional decision: Anchor only, Vision, Chart without Vision, or both.
- The prototype’s illustrative `+12` Thread result is not reproduced. Production uses the result from the canonical completion path.
- The prototype has local demo generation states. UI-B uses the existing synchronous compatible generator; no unsupported async job or Vision persistence contract is invented.
- Expression treatment is represented by the V2 renderer wrapper while retaining the same source SVG. A future renderer-level treatment implementation can deepen individual material effects without changing formation geometry or stored structure.

## State machine, draft, and resume

`src/stores/v2/firstRunStore.ts` owns the canonical AsyncStorage-backed draft at `anchor:v2:first-run`.

```text
direction → intention → formation → anchor → expression → vision → focus → auth → complete
```

`FirstRunDraft` includes the selected messaging direction, original and normalized formation input, detected category, distilled letters, stable structure/SVG, expression, stable local Anchor and Focus ids, optional Vision/Chart intent, completion flags, and explicit current step. Navigation is only presentation; it is not the source of truth. Rehydration resumes the stored valid step, while `complete` goes to the isolated V2 development Home shell.

Changing intention invalidates only formation descendants: normalized input, letters, structure, SVG/candidate, expression, local Anchor id, Focus id, completion recording, and unsaved Anchor state. Direction and Vision/Chart decision are retained. Changing expression only changes `expression`; it never regenerates geometry or structure.

## Formation, generation, and expression

Formation reuses `distillIntention` from the existing stable distillation utility: vowels are removed, repeated remaining letters are removed, and original remaining order is retained. `generateTrueSigil` is called once using the existing category-to-tier adapter. Category is detected from the written intention, not selected from the Work/Performance/Growth/Personal messaging group. The original intention stays intact separately from the normalized formation input.

`CircularAnchorRenderer` renders the generated SVG for both the first reveal and expression comparison. Expression never writes to `structureVariant` or changes the SVG; it is stored as independent presentation metadata.

## Vision / Chart, Focus, and identity

The Vision decision persists four valid outcomes:

- `skip_for_now`: Anchor only
- `create_now`: Anchor + Vision
- `chart_only`: Anchor + Chart, without Vision
- `vision_and_chart`: Anchor + Vision + Chart

The present Vision domain is incomplete, so this is clearly isolated local handoff state—not fabricated backend persistence.

First Focus is fixed at ten seconds, uses Focus purple `#8B5CF6`, pauses when the app backgrounds, and exposes live timer text. On authentication, its stable `focusSessionId` is sent once to `PracticeCompletionService`; that canonical service owns idempotency and any progression/Thread result. UI-B never computes Thread Strength or awards it twice.

Authentication reuses Firebase `AuthService` for Google, Apple on iOS, and email. The draft remains persisted through external-provider round trips and failure/retry. A stable `anchorLocalId`, `anchorPersisted` flag, and Focus session id prevent duplicate local Anchor creation and duplicate completion. Account creation keeps the user on Free: no UI-B action invokes trial activation.

## Error recovery, analytics, and accessibility

Formation validation preserves the writing surface; auth failures remain on Auth with the completed draft intact; pending Focus completion is retained for a retry. Analytics uses the existing provider and records state-only `v2_first_run_*` events—never raw intention text.

The flow uses UI-A V2 primitives, semantic haptics, category and Practice tokens, `useV2ReduceMotion`, labeled radio choices, accessible single-object Anchor artwork, live Focus time, keyboard-safe input, and 44px-or-larger interactive surfaces. There is no V2 import into legacy production navigation or screens.

## Known backend boundaries

- Full Vision/Chart persistence remains a handoff until that V2 domain exists.
- The synchronous existing generator is used until the asynchronous generation workstream has a compatible V2 contract.
- UI-D Home is still represented by the isolated V2 development shell.
