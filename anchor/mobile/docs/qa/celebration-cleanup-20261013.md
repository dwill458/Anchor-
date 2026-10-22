# Celebration cleanup — 2026-10-13

Branch: `feat/celebration-layer`. Started at `72426105`, rather than the audit tip `3246c2a8`. Existing Vision/font and image-picker/backend dirty work was preserved. No push, history rewrite, Node Tone or audio-settings changes.

## 1. Commits and files

### 3404692a5 test(chart): include intended ink-hold beat in M1 sequence

- `anchor/mobile/src/components/v2/chart/map/__tests__/chartMapSequences.test.ts`

### 0db8825ec fix(celebration): distinguish duplicate active requests

- `anchor/mobile/src/components/v2/chart/ChartActiveView.tsx`
- `anchor/mobile/src/components/v2/home/__tests__/homeArrivalPractice.test.tsx`
- `anchor/mobile/src/components/v2/home/homeArrival.tsx`
- `anchor/mobile/src/stores/v2/__tests__/celebrationStore.test.ts`
- `anchor/mobile/src/stores/v2/celebrationStore.ts`

### 467139c12 fix(chart): cap summit thud at seal volume

- `anchor/mobile/src/services/CreationSounds.ts`

### 73dd569bf fix(progress): use approved Thread stage labels

- `anchor/mobile/src/adapters/v2/progress/progressAdapter.ts`
- `anchor/mobile/src/components/v2/progress/V2EvidenceSummary.tsx`
- `anchor/mobile/src/components/v2/progress/V2ProgressHero.tsx`
- `anchor/mobile/src/components/v2/progress/__tests__/V2ProgressHero.test.tsx`
- `anchor/mobile/src/components/v2/progress/__tests__/V2ThreadEventTimeline.test.tsx`
- `anchor/mobile/src/components/v2/threadEvents/V2ThreadEventCelebration.tsx`

### fac1ab0fa fix(home): show Evolve lineage only during arrival

- `anchor/mobile/src/components/v2/home/HomeArrivalEvolved.tsx`
- `anchor/mobile/src/components/v2/home/__tests__/homeArrivalEvolved.test.tsx`

### 5f4b549bf fix(home): reserve scaled space for EV1 lineage row

- `anchor/mobile/src/components/v2/home/HomeArrivalEvolved.tsx`
- `anchor/mobile/src/components/v2/home/V2HomeHero.tsx`
- `anchor/mobile/src/components/v2/home/__tests__/homeHeroLayout.test.ts`
- `anchor/mobile/src/components/v2/home/homeHeroLayout.ts`
- `anchor/mobile/src/screens/v2/home/__tests__/V2HomeEvolvedArrival.test.tsx`

M1 passes with `[0, routeAt, routeAt + route]`, preserving `inkHold`. The coordinator returns `duplicate` for an active ID, retains the original callbacks, accepts the same ID after finish, and queues a different equal-level ID. Chart move, summit and waypoint callers now start only on `play`; route-revision returns on `duplicate`. Home checks the owned active ID before starting its animation. Practice, Release completion and Vision-to-Home already start only on `play`; Vision ceremony uses a committed latch and a freshly generated ID, so it cannot request an active ID again. Its other session's dirty file was not edited.

Final Chart volumes (registered defaults):

| Cue | Volume |
|---|---:|
| chart-air | 0.9 |
| chart-open / chart-ink / chart-flag / chart-check / chart-stamp / chart-wind | 1.0 each (existing legacy cues) |
| chart-waypoint_1 / chart-waypoint_2 / chart-waypoint_3 | 0.6 each |
| chart-move-done / chart-ink-hold | 0.6 each |
| chart-summit-thud / chart-summit-chord | 0.9 each |

Only the requested thud default changed; seal remains 0.9. `EnhancementChoiceScreen.tsx` and `weeklyInsightSelector.ts` were not changed. All listed permanent Progress strings and their test fixtures are gone. EV1's line is absent at rest, after natural completion and after Skip. Reduce Motion shows it only during its crossfade. The scene gets its own carousel allocation: `ceil(20 × fontScale) + 8` dp, including 4dp above and below. At 1.3× this is 34dp, covering a 26dp scaled line. The layout test checks that the full 34dp is added without reducing the existing artwork or Thread row space. This is automated layout-contract evidence; physical-device font rendering was not measured in this pass.

## 2. Item 7 — hunk-by-hunk Evolve review

These nine files are clean in this checkout. Every audit-era hunk is already in mixed commit `096a26d7`; creating `fix(release): finalize Evolve successor handoff` now would be an empty or duplicate commit. The patch reviewed is `3246c2a8..096a26d7`, restricted to these nine files. No new item-7 commit was made.

| File / hunk | Behavior and review |
|---|---|
| `hooks/v2/release/useReleaseHold.ts` reset | Eases rejected/failed hold back instead of snapping; Reduce Motion immediately resets. Only visual state changes; it does not mutate an Anchor. Pass. |
| `navigation/v2/__tests__/evolveReturn.test.ts` successor assertion | Expects the origin ID carried with the attached successor, and still checks navigation back to existing Release. Pass. |
| `screens/create/IntentionInputScreen.tsx` refs | Adds synchronous start latch and paywall-return flag. Prevents double launch without any entitlement exemption. Pass. |
| same file, focus effect | Clears latches on focus; retains typed intention while returning from a paywall. Normal fresh entry still resets. Pass. |
| same file, start guard | Rejects re-entry before starting creation. Existing consonant validation remains. Pass. |
| same file, paywall navigation | Marks return from gate before navigating Paywall. Creation gate still applies to Evolve. Pass. |
| same file, admitted creation | Latches only after gate accepts, then updates draft and navigates creation. Pass. |
| `screens/create/__tests__/IntentionInputScreen.evolve.test.tsx` new test | Two rapid Continue presses must create one `AnchorCreationFlow` route. Pass. |
| `screens/create/flow/AnchorCreationFlowScreen.tsx` finishDrawing | Ignores repeated drawing completion; no save or release is triggered twice. Pass. |
| same file, missing seal inputs | Clears pending save and resets Choose when there is no sealable form/generated result/style. Avoids a dead held medallion; no successor is attached. Pass. |
| same file, missing save at seal completion | Resets Choose instead of leaving it held. No attachment or release is fabricated. Pass. |
| `screens/create/flow/__tests__/evolveHandoff.test.tsx` assertion | Checks origin ID in the successor, pending session cleared, and navigation to existing Release. Pass. |
| `screens/v2/release/V2ReleaseScreen.tsx` Reduce Motion import | Uses creation's combined preference/system source for this ceremony. No entitlement or data change. Pass. |
| same file, session-successor selection | Accepts origin-tagged session successor only on that origin's Release. Retains compatibility with older untagged in-process successors; current `attach` tags the origin. Pass for current flow. |
| same file, returned-successor entrance | Replays only Release chrome entrance when a new successor arrives; does not release either Anchor. Pass. |
| same file, focus cleanup | Resets start latch and clears pending Evolve state when creation returns with no successor. Pass. |
| same file, Evolve start latch | Begins only once after the choice's entitlement gate accepts. Pass. |
| same file, completion-action latch | Home/successor return is synchronously latched, preventing a second navigation on double tap. Pass. |
| same file, successor-action latch | Latches before `onContinueWithSuccessor`; the released artwork is passed to EV1. Pass. |
| `stores/v2/evolveSessionStore.ts` successor type | Adds optional origin ID for session compatibility. Pass. |
| same file, attach | Copies origin from pending session, clears pending and attaches successor. No Anchor mutations. Pass. |
| `stores/v2/__tests__/evolveSessionStore.test.ts` attach assertion | Requires origin ID alongside successor. Pass. |
| same file, new origin test | Verifies remembered origin so another Release cannot adopt current session's successor. Pass. |

The surrounding contracts were also traced: Evolve choice asks `entitlements.canCreateAnchor` and opens `Paywall` before starting the session; creation's gates remain active. Creation Back aborts generation and goes back through intention; leaving the creation flow back to Release attaches nothing, and Release's focus cleanup clears pending state. Release Cancel uses `navigation.goBack()` to the anchor route underneath. `useV2Release.startRelease` is called only by completed hold, and starts server submission then; the old Anchor is released locally only after server confirmation. `linkEvolvedFrom` is called only in that confirmed Evolve reconciliation with a valid successor, writes only the successor, and is idempotent. Anchor-store merge paths preserve the locally stored lineage through server refreshes. There are no half-done hunks found in these nine files. No device navigation/hold validation was performed.

## 3. String inventory (no inventory-driven copy edits)

“Final” means the current source treats it as authored/shipped copy; it does not claim fresh approval. Only the Part A.4 replacements have explicit approval in this task. Placeholder means the source explicitly flags approval as pending. Dynamic intentions, dates and stage names come from real data.

| String | Source | Status |
|---|---|---|
| Skip | [src/screens/v2/home/V2HomeScreen.tsx:796](E:/Projects/Anchor/anchor/mobile/src/screens/v2/home/V2HomeScreen.tsx:796) | Final |
| Skip | [src/components/v2/release/V2ReleaseCompletion.tsx:284](E:/Projects/Anchor/anchor/mobile/src/components/v2/release/V2ReleaseCompletion.tsx:284) | Final |
| Skip | [src/components/v2/vision/ceremony/VisionCeremony.tsx:658](E:/Projects/Anchor/anchor/mobile/src/components/v2/vision/ceremony/VisionCeremony.tsx:658) | Final |
| Skip | [src/screens/v2/home/visionHomeReturn.tsx:166](E:/Projects/Anchor/anchor/mobile/src/screens/v2/home/visionHomeReturn.tsx:166) | Final |
| Skip | [src/components/v2/chart/ChartActiveView.tsx:1295](E:/Projects/Anchor/anchor/mobile/src/components/v2/chart/ChartActiveView.tsx:1295) | Final |
| Skip | [src/screens/v2/practice/focus/V2FocusCompleteScreen.tsx:34](E:/Projects/Anchor/anchor/mobile/src/screens/v2/practice/focus/V2FocusCompleteScreen.tsx:34) | Final |
| Your Thread has begun. | [src/screens/v2/practice/focus/V2FocusCompleteScreen.tsx:83](E:/Projects/Anchor/anchor/mobile/src/screens/v2/practice/focus/V2FocusCompleteScreen.tsx:83) | Final |
| Reinforced today ✓ | [src/screens/v2/practice/focus/V2FocusCompleteScreen.tsx:94](E:/Projects/Anchor/anchor/mobile/src/screens/v2/practice/focus/V2FocusCompleteScreen.tsx:94) | Final |
| Your Anchor is now {stage}. | [src/screens/v2/practice/focus/V2FocusCompleteScreen.tsx:30](E:/Projects/Anchor/anchor/mobile/src/screens/v2/practice/focus/V2FocusCompleteScreen.tsx:30) | Final |
| Full Strength. | [src/screens/v2/practice/focus/V2FocusCompleteScreen.tsx:31](E:/Projects/Anchor/anchor/mobile/src/screens/v2/practice/focus/V2FocusCompleteScreen.tsx:31) | Final |
| Your Anchor is fully reinforced. | [src/screens/v2/practice/focus/V2FocusCompleteScreen.tsx:32](E:/Projects/Anchor/anchor/mobile/src/screens/v2/practice/focus/V2FocusCompleteScreen.tsx:32) | Final |
| Back at full strength. | [src/screens/v2/practice/focus/V2FocusCompleteScreen.tsx:33](E:/Projects/Anchor/anchor/mobile/src/screens/v2/practice/focus/V2FocusCompleteScreen.tsx:33) | Final |
| Forming / Building / Established / Integrated / Reinforced | [src/screens/v2/practice/focus/V2FocusCompleteScreen.tsx:40](E:/Projects/Anchor/anchor/mobile/src/screens/v2/practice/focus/V2FocusCompleteScreen.tsx:40) | Final; existing domain names shown by new strip |
| THREAD STRENGTH | [src/screens/v2/practice/focus/V2FocusCompleteScreen.tsx:314](E:/Projects/Anchor/anchor/mobile/src/screens/v2/practice/focus/V2FocusCompleteScreen.tsx:314) | Final; reused label |
| → / {value}% | [src/screens/v2/practice/focus/V2FocusCompleteScreen.tsx:350](E:/Projects/Anchor/anchor/mobile/src/screens/v2/practice/focus/V2FocusCompleteScreen.tsx:350) | Final; figures/arrows from saved strength |
| Full Strength reached | [src/adapters/v2/progress/progressAdapter.ts:279](E:/Projects/Anchor/anchor/mobile/src/adapters/v2/progress/progressAdapter.ts:279) | Final |
| Full Strength reached · First achieved {date} | [src/components/v2/progress/V2ProgressHero.tsx:45](E:/Projects/Anchor/anchor/mobile/src/components/v2/progress/V2ProgressHero.tsx:45) | Final |
| Evolved from “{intention}” | [src/components/v2/home/HomeArrivalEvolved.tsx:28](E:/Projects/Anchor/anchor/mobile/src/components/v2/home/HomeArrivalEvolved.tsx:28) | Final |
| Release it | [src/constants/v2/release.ts:183](E:/Projects/Anchor/anchor/mobile/src/constants/v2/release.ts:183) | Placeholder |
| Move this intention into your history. | [src/constants/v2/release.ts:184](E:/Projects/Anchor/anchor/mobile/src/constants/v2/release.ts:184) | Placeholder |
| Evolve it | [src/constants/v2/release.ts:185](E:/Projects/Anchor/anchor/mobile/src/constants/v2/release.ts:185) | Placeholder |
| Carry this intention into a new Anchor. | [src/constants/v2/release.ts:186](E:/Projects/Anchor/anchor/mobile/src/constants/v2/release.ts:186) | Placeholder |
| Evolving into “{successor intention}” | [src/constants/v2/release.ts:187](E:/Projects/Anchor/anchor/mobile/src/constants/v2/release.ts:187) | Placeholder; composed at V2ReleaseChoice.tsx |
| {title}, on {date} | [src/components/v2/progress/V2ThreadEventTimeline.tsx:75](E:/Projects/Anchor/anchor/mobile/src/components/v2/progress/V2ThreadEventTimeline.tsx:75) | Final; accessibility |
| {category} Anchor artwork / Your new Anchor | [src/components/v2/home/homeArrival.tsx:749](E:/Projects/Anchor/anchor/mobile/src/components/v2/home/homeArrival.tsx:749) | Final; accessibility |
| THREAD STAGE | [src/components/v2/progress/V2ProgressHero.tsx:101](E:/Projects/Anchor/anchor/mobile/src/components/v2/progress/V2ProgressHero.tsx:101) | Final; explicitly approved |
| Your Anchor reached the {stage} stage. Stages follow your current Thread Strength. | [src/adapters/v2/progress/progressAdapter.ts:259](E:/Projects/Anchor/anchor/mobile/src/adapters/v2/progress/progressAdapter.ts:259) | Final; explicitly approved |
| Your Anchor reached this stage for the first time. | [src/components/v2/threadEvents/V2ThreadEventCelebration.tsx:42](E:/Projects/Anchor/anchor/mobile/src/components/v2/threadEvents/V2ThreadEventCelebration.tsx:42) | Final; explicitly approved |
| Current stage | [src/components/v2/progress/V2EvidenceSummary.tsx:77](E:/Projects/Anchor/anchor/mobile/src/components/v2/progress/V2EvidenceSummary.tsx:77) | Approved deferred comment; not rendered |

The five `RELEASE_EVOLVE_COPY` entries above are the complete object; its option accessibility label combines label + descriptor with “. ” in `V2ReleaseChoice.tsx`. `{stage} again.` was added in `10af2243` and removed in `4ba083a5`; stage relight now has no sentence. Earlier permanent stage phrases were replaced by the explicitly approved strings above. Existing Release endings, Vision captions, summit-panel copy and server event titles were reused, not authored anew by the celebration scenes.

Chart opening/One Move work also authored these supporting strings in `c9d91c3d` (included for a complete approval inventory; this commit also contains teaching and lab work):

| String | Source | Status |
|---|---|---|
| Replay move teaching | [chartCopy.ts:8](E:/Projects/Anchor/anchor/mobile/src/constants/v2/chartCopy.ts:8) | Final; developer-only |
| Reset move teaching | [chartCopy.ts:9](E:/Projects/Anchor/anchor/mobile/src/constants/v2/chartCopy.ts:9) | Final; developer-only |
| Replay move teaching | [chartCopy.ts:16](E:/Projects/Anchor/anchor/mobile/src/constants/v2/chartCopy.ts:16) | Final; shipped supporting copy |
| One move this week | [chartCopy.ts:17](E:/Projects/Anchor/anchor/mobile/src/constants/v2/chartCopy.ts:17) | Final; shipped supporting copy |
| {done} of {total} done | [chartCopy.ts:18](E:/Projects/Anchor/anchor/mobile/src/constants/v2/chartCopy.ts:18) | Final; shipped supporting copy |
| Tap to read it all | [chartCopy.ts:19](E:/Projects/Anchor/anchor/mobile/src/constants/v2/chartCopy.ts:19) | Final; shipped supporting copy |
| Show less | [chartCopy.ts:20](E:/Projects/Anchor/anchor/mobile/src/constants/v2/chartCopy.ts:20) | Final; shipped supporting copy |
| Why this move | [chartCopy.ts:21](E:/Projects/Anchor/anchor/mobile/src/constants/v2/chartCopy.ts:21) | Final; shipped supporting copy |
| Done means | [chartCopy.ts:22](E:/Projects/Anchor/anchor/mobile/src/constants/v2/chartCopy.ts:22) | Final; shipped supporting copy |
| Toward | [chartCopy.ts:23](E:/Projects/Anchor/anchor/mobile/src/constants/v2/chartCopy.ts:23) | Final; shipped supporting copy |
| Tap the circle when it's done. Tap the words to see the detail. | [chartCopy.ts:24](E:/Projects/Anchor/anchor/mobile/src/constants/v2/chartCopy.ts:24) | Final; shipped supporting copy |
| Move done. Your route is holding. | [chartCopy.ts:25](E:/Projects/Anchor/anchor/mobile/src/constants/v2/chartCopy.ts:25) | Final; shipped supporting copy |
| Mark this move done | [chartCopy.ts:26](E:/Projects/Anchor/anchor/mobile/src/constants/v2/chartCopy.ts:26) | Final; shipped supporting copy |
| Mark this move not done | [chartCopy.ts:27](E:/Projects/Anchor/anchor/mobile/src/constants/v2/chartCopy.ts:27) | Final; shipped supporting copy |
| The move is done. Mark the waypoint reached when you feel it is. | [chartCopy.ts:28](E:/Projects/Anchor/anchor/mobile/src/constants/v2/chartCopy.ts:28) | Final; shipped supporting copy |
| Mark this move done when you have completed it. | [chartCopy.ts:29](E:/Projects/Anchor/anchor/mobile/src/constants/v2/chartCopy.ts:29) | Final; shipped supporting copy |
| This is your one move. | [chartCopy.ts:35](E:/Projects/Anchor/anchor/mobile/src/constants/v2/chartCopy.ts:35) | Final; shipped supporting copy |
| Each waypoint has one small thing to do this week. It is the only thing that moves your route forward. | [chartCopy.ts:36](E:/Projects/Anchor/anchor/mobile/src/constants/v2/chartCopy.ts:36) | Final; shipped supporting copy |
| The circle is for done. | [chartCopy.ts:39](E:/Projects/Anchor/anchor/mobile/src/constants/v2/chartCopy.ts:39) | Final; shipped supporting copy |
| Tap it when you have actually done the move. Your route only moves when you do. | [chartCopy.ts:40](E:/Projects/Anchor/anchor/mobile/src/constants/v2/chartCopy.ts:40) | Final; shipped supporting copy |
| The words are for detail. | [chartCopy.ts:43](E:/Projects/Anchor/anchor/mobile/src/constants/v2/chartCopy.ts:43) | Final; shipped supporting copy |
| Tap the text to read the full move, why it matters, and what counts as done. | [chartCopy.ts:44](E:/Projects/Anchor/anchor/mobile/src/constants/v2/chartCopy.ts:44) | Final; shipped supporting copy |
| Next | [chartCopy.ts:47](E:/Projects/Anchor/anchor/mobile/src/constants/v2/chartCopy.ts:47) | Final; shipped supporting copy |
| Got it | [chartCopy.ts:48](E:/Projects/Anchor/anchor/mobile/src/constants/v2/chartCopy.ts:48) | Final; shipped supporting copy |
| {n} of 3 | [chartCopy.ts:49](E:/Projects/Anchor/anchor/mobile/src/constants/v2/chartCopy.ts:49) | Final; shipped supporting copy |
| Dismiss move teaching | [chartCopy.ts:50](E:/Projects/Anchor/anchor/mobile/src/constants/v2/chartCopy.ts:50) | Final; shipped supporting copy |
| REINFORCING | [chartCopy.ts:54](E:/Projects/Anchor/anchor/mobile/src/constants/v2/chartCopy.ts:54) | Final; shipped supporting copy |

Developer preview labels are inventoried in the supporting UI appendix below. They are developer-facing, not production celebration prose.
- `Opening sequence` — [anchor/mobile/src/screens/v2/system/V2ChartPreview.tsx:333](E:/Projects/Anchor/anchor/mobile/src/screens/v2/system/V2ChartPreview.tsx:333); final developer-only label.

- `Chart motion lab` — [src/screens/v2/system/ChartLabDevHost.tsx:12](E:/Projects/Anchor/anchor/mobile/src/screens/v2/system/ChartLabDevHost.tsx:12); final developer-only label.
- `Replay opening (full)` — [src/screens/v2/system/V2ChartPreview.tsx:334](E:/Projects/Anchor/anchor/mobile/src/screens/v2/system/V2ChartPreview.tsx:334); final developer-only label.
- `Replay opening (short)` — [src/screens/v2/system/V2ChartPreview.tsx:340](E:/Projects/Anchor/anchor/mobile/src/screens/v2/system/V2ChartPreview.tsx:340); final developer-only label.
- `Reset intro seen` — [src/screens/v2/system/V2ChartPreview.tsx:346](E:/Projects/Anchor/anchor/mobile/src/screens/v2/system/V2ChartPreview.tsx:346); final developer-only label.

## 4. Part B — onboarding arrival, read-only diagnosis

1. **Actual path and arrival.** Onboarding seal/save takes the `params.fromOnboarding` branch of `AnchorCreationFlowScreen`: it sets `firstRunStore.currentStep` to `auth` and `popToTop()` returns to `V2FirstRun`. It skips both the save-time `prepareHomeArrival` and the normal `handOffToHome`. `V2FirstRunFlow` renders `V2SealedSaveScreen` for `auth`; Continue marks onboarding complete and resets directly to `V2DevelopmentHome`. That route hosts the daily shell's `V2HomeScreen`. The shared `useHomeArrival` hook exists on Home, but there is no staged arrival in this flow, so neither `HomeArrivalOverlay` nor the first-anchor-ever 3400ms arrival starts. What can run is the independent `V2HomeHero.useHeroEntrance` cold-mount entrance. This has a process-local once flag, separate from the first-arrival persisted flag; if already consumed, even that entrance is absent.

Evidence: [src/screens/create/flow/AnchorCreationFlowScreen.tsx:701](E:/Projects/Anchor/anchor/mobile/src/screens/create/flow/AnchorCreationFlowScreen.tsx:701), [src/screens/create/flow/AnchorCreationFlowScreen.tsx:799](E:/Projects/Anchor/anchor/mobile/src/screens/create/flow/AnchorCreationFlowScreen.tsx:799), [src/screens/v2/onboarding/V2FirstRunFlow.tsx:146](E:/Projects/Anchor/anchor/mobile/src/screens/v2/onboarding/V2FirstRunFlow.tsx:146), [src/components/v2/home/V2HomeHero.tsx:134](E:/Projects/Anchor/anchor/mobile/src/components/v2/home/V2HomeHero.tsx:134).

2. **Blank cream disc.** Home renders a fresh `CircularAnchorRenderer` inside its already-painted `anchorMount` (cream frame/background). With an enhanced image URL, it renders React Native `Image` immediately but does not draw the SVG while that image is loading: `showImage` is based on URL/nonfailure, not load completion. During `useHeroEntrance`, `ground` starts at zero and controls the raster artwork opacity as well as the inner paper. `onLoad` starts the entrance (or a 600ms timeout does), followed by a 200ms delay and a 900ms eased fade. The outer cream mount can therefore be visible before the image decodes and/or before its ground fade starts. The account/save medallion's mounted image is not Home's mounted image. The ordinary creation handoff's prefetch/overlay/image-hold protection is bypassed here. The recording's 0.3s blank and apparent 0.4s fade are device observations; current source specifies 200ms + 900ms after load or timeout, so those durations cannot be identified as the authored first-arrival timeline. Native image decode/cache time and frame timestamps require device tracing to distinguish.

Evidence: [src/components/v2/home/V2HomeHero.tsx:134](E:/Projects/Anchor/anchor/mobile/src/components/v2/home/V2HomeHero.tsx:134), [src/components/v2/home/homeHeroPresence.ts:20](E:/Projects/Anchor/anchor/mobile/src/components/v2/home/homeHeroPresence.ts:20), [src/components/v2/anchor/CircularAnchorRenderer.tsx:105](E:/Projects/Anchor/anchor/mobile/src/components/v2/anchor/CircularAnchorRenderer.tsx:105), [src/components/v2/home/V2HomeHero.tsx:458](E:/Projects/Anchor/anchor/mobile/src/components/v2/home/V2HomeHero.tsx:458).

3. **Medallion ownership and continuity.** `V2SealedSaveScreen` owns the account form AND confirmation coin (`v2-sealed-save-coin`); the form-to-confirmation change is local component state, so that coin can stay mounted through both states. Home's separate owner is `V2HomeHero`/carousel, with its own `CircularAnchorRenderer`, image lifecycle and entrance. A reset unmounts the save screen; a single mounted native object cannot currently carry through it. Continuity would require a shared overlay above both routes (or an overlay copy that looks identical), measuring the confirmed coin's artwork rect and Home's artwork rect, preserving the artwork URL/expression, and releasing the overlay only once Home's image is ready. The existing shared Home arrival overlay provides much of that mechanism, but this save/confirmation path never supplies its origin or stages/releases it. No such changes were made.

Evidence: [src/screens/v2/onboarding/V2SealedSaveScreen.tsx:374](E:/Projects/Anchor/anchor/mobile/src/screens/v2/onboarding/V2SealedSaveScreen.tsx:374), [src/components/v2/home/V2HomeHero.tsx:349](E:/Projects/Anchor/anchor/mobile/src/components/v2/home/V2HomeHero.tsx:349), [src/components/v2/home/homeArrival.tsx:657](E:/Projects/Anchor/anchor/mobile/src/components/v2/home/homeArrival.tsx:657).

4. **Panel present on frame one.** `V2HomeScreen` applies `arrival.lowerStyle` to the graphite zone. Without a matching staged arrival, `useHomeArrival` initializes/resets `progress` to 1; its lower style is therefore opacity 1 / translation 0 on the first frame. Hero's cold-mount entrance only animates the coin and ring; it never animates this panel. A confirmation-origin arrival staged before Home paints would pose the panel hidden/below, then drive the lower-region window after the medallion lands. Existing first-arrival `WINDOWS_FIRST.lower` is 0.55–0.95 of 3400ms, with a 36dp lift and fade; a large panel rise would require an explicit lower slide distance/window like the release arrival uses. No panel-animation changes were made.

Evidence: [src/screens/v2/home/V2HomeScreen.tsx:703](E:/Projects/Anchor/anchor/mobile/src/screens/v2/home/V2HomeScreen.tsx:703), [src/components/v2/home/homeArrival.tsx:325](E:/Projects/Anchor/anchor/mobile/src/components/v2/home/homeArrival.tsx:325), [src/components/v2/home/homeArrival.tsx:507](E:/Projects/Anchor/anchor/mobile/src/components/v2/home/homeArrival.tsx:507).

5. **Route names and params.** The onboarding route is `V2FirstRun`, with the journey/creation/account/save substeps driven by `firstRunStore`, not separate account-form or Progress Saved routes. Its inline `IntentionInputScreen` uses `fromOnboarding=true`. Continue navigates `AnchorCreationFlow` with `intentionText`, derived category, `distilledLetters`, `fromOnboarding: true`, entry `glide` plus measured input frame (or `fade` without measurement), and optional focus-area context. The save callback calls `setStep('auth')` + `popToTop()`, with no new route params. `V2SealedSaveScreen.emailOpen` and `mode='create'|'signin'` select the inline form; successful account handling/finalization sets local `saved='account'` (guest sets `saved='guest'`). `confirmed = saved !== null` renders the confirmation; there is no `ProgressSaved` route. Current heading is `PROGRESS SAVED`. The confirmation button invokes `onContinue(saved)`; `V2FirstRunFlow` clears creation draft, completes onboarding, and resets to `[{name:'V2DevelopmentHome'}]` with no arrival params. `V2Auth` with `{initialMode:'signin'}` is the separate pre-journey Sign In path, not the inline form in the recorded sequence. Any future arrival must be staged/measured from this confirmation button before that reset.

Evidence: [src/screens/create/IntentionInputScreen.tsx:337](E:/Projects/Anchor/anchor/mobile/src/screens/create/IntentionInputScreen.tsx:337), [src/screens/v2/onboarding/V2SealedSaveScreen.tsx:346](E:/Projects/Anchor/anchor/mobile/src/screens/v2/onboarding/V2SealedSaveScreen.tsx:346), [src/screens/v2/onboarding/V2SealedSaveScreen.tsx:397](E:/Projects/Anchor/anchor/mobile/src/screens/v2/onboarding/V2SealedSaveScreen.tsx:397), [src/screens/v2/onboarding/V2FirstRunFlow.tsx:146](E:/Projects/Anchor/anchor/mobile/src/screens/v2/onboarding/V2FirstRunFlow.tsx:146).

## 5. Part C — branch hygiene, report only

The audit-era range `70f89b45^..3246c2a8` contains 39 commits. The following are wholly celebration work or narrowly required celebration fixes, ordered for extraction:

| Commit | Subject |
|---|---|
| `70f89b453` | feat(celebration): coordinator, Home glow ease, first/repeat anchor arrival |
| `9341f4d13` | feat(celebration): defer Home glow record until the seen store hydrates |
| `35c89ac93` | fix(practice): play threadSettle once per session, clear Focus completion timers on unmount |
| `6a2b68e1f` | feat(celebration): once-ever first-anchor flag, L2 reduce-motion arrival, Skip label, atomic arrival sound |
| `8f4cec96a` | feat(release): circular paper reveal, settle beat, skippable L3 ending, destination flag |
| `717d3414e` | feat(vision): L4/L2 seal ceremony via coordinator, 900ms hold for later images, drop Medium hold haptic, Skip |
| `90b876815` | feat(practice): first-practice (L3) and repeat-practice (L2) completion scenes |
| `decfbb7cb` | feat(release): Evolve choice at Release, creation return with successor, evolve count-gate exemption |
| `16de0b790` | fix(release): Evolve is a paid path; remove the client count-gate exemption |
| `10af22430` | feat(practice): stage-reached and Full Strength scenes with per-anchor celebration records |
| `b35112c7d` | feat(progress): stage dates from celebration records, Full Strength timeline event and fact line, hold server modals while a scene plays |
| `4ba083a58` | feat(practice): stage relight is L2, at most 1.9s, no sentence |
| `e14607e4d` | feat(practice): P3 complete-to-Home arrival (L2, ~2.4s) via the shared Home arrival |
| `1e8b41700` | feat(vision): first image returns to Home with an in-place L4 arrival; fix Vision double-fires |
| `f7fe38cb7` | fix(home): type V2DevelopmentHome's route locally so the Home namespace keeps off central navigation types |
| `b418808af` | feat(release): Evolve paywall on the choice, local evolvedFrom, RL1 Return Home, EV1 evolved arrival |
| `045364495` | feat(chart): waypoint reached (L3, one Light haptic, climbing note) and One Move done (L2, tap haptic, ink to the hold) |
| `a75e0a28e` | feat(chart): summit (L4, single Heavy at the flag, existing cream panel) and route revised (L1, pen settling to pencil) |
| `65bb9a0d5` | Wire celebration audio cues |

`decfbb7c` must be followed by `16de0b79` and `b418808a`; taken alone, it contains the explicitly forbidden count-gate exemption. Do not merge its intermediate behavior.

Additional celebration-related supporting commits are not strictly celebration-only: `c9d91c3d` combines Chart opening with One Move teaching, sheet layout and lab controls; `4aca7827` is opening/One Move QA artifacts and design docs; `c73f5995` changes route geometry and fog as well as summit framing. Chart M1/S1 relies on the map/sequence infrastructure, so review these dependencies when assembling the clean branch. `65bb9a0d` is authored celebration cue wiring, not Node Tone/session audio.

Do not cherry-pick mixed `f0d91475`, `2aa92771`, `1c05627b`, `c76e6a62`, `e93d2003`, or `096a26d7` wholesale. The latter contains all nine item-7 files alongside library selection and audio settings. Backend token migrations, AI routing, notification implementation, Node Tone MP3 conversion and session-audio manifests are outside celebration scope. The later `ae019e2e` onboarding/background work explains current Part B behavior and is also mixed; do not include it automatically.

Proposed extraction: create a new branch/worktree from the agreed integration base that already contains V2 UI, creation, chart map and navigation prerequisites. Apply the ordered list above, with the Chart opening/geometry dependencies explicitly reviewed. For mixed `096a26d7`, export only its nine reviewed paths with `git diff 096a26d7^ 096a26d7 -- <nine paths>`, apply that patch and stage those paths only; commit it as `fix(release): finalize Evolve successor handoff` on the clean branch. Never cherry-pick its audio-settings/library hunks. Then apply this cleanup's six commits, resolving against the selected prerequisites, and rerun typecheck/V2 checks. This is a proposal; no clean branch, cherry-pick, history rewrite or push was performed. A blind list onto local `origin/main` is not proven: that ref is much older than the V2 baseline, so dependencies must be validated first.

New cleanup-only commits, in order: `3404692a`, `0db8825e`, `467139c1`, `73dd569b`, `fac1ab0f`, `5f4b549b`.

## 6. Tests and likely introducing commits

Typecheck: `npx tsc --noEmit --pretty false` passed (exit 0). Focused M1: 39/39 tests. Coordinator/practice-arrival recheck: 31/31. Chart celebration scenes also passed. Relabel/adapter/timeline/Chart sound: 75/75. EV1 component/Home/layout: 41/41. Evolve/Release/hold/creation handoff: 8 suites, 105/105. None of the known failing tests were edited or fixed.

Full V2 command: `npx jest --runInBand --no-watchman --testPathPattern='[/\\]v2[/\\]' --json --outputFile=.jest-cache/celebration-cleanup-v2.json`. Result: **310 suites passed, 5 failed; 3221 tests passed, 6 failed; 1 snapshot passed**. The same six failure categories occur in the separate known-failure reproduction; the notification storage error attaches to a different test there. No new cleanup failure remains.

Exact V2 failure list (also separately reproduced):

| Suite / test | Failure | Most likely introducing commit and evidence |
|---|---|---|
| `creationStore.test.ts` — v2 creation state machine distils with the production algorithm and detects the category | Category now resolves Desire instead of Career, changing the category-grid SVG. | `c76e6a62`: its confidence-margin rule at categoryDetection.ts:536–540 requires score ≥2 or a ≥2 lead. “I finish the project” has only one Career keyword. Both assertions still assume Career. |
| `creationStore.test.ts` — v2 creation state machine forms the structure with the real generator on the category grid | Category now resolves Desire instead of Career, changing the category-grid SVG. | `c76e6a62`: its confidence-margin rule at categoryDetection.ts:536–540 requires score ≥2 or a ≥2 lead. “I finish the project” has only one Career keyword. Both assertions still assume Career. |
| `V2CreationFlow.test.tsx` — V2CreationFlow distils the real intention and forms the real deterministic structure | Same category-grid SVG mismatch. | `c76e6a62`, same category-confidence change; inherited by creation state machine. |
| `NotificationSettingsScreen.test.tsx` — NotificationSettingsScreen shows the toggle OFF when the native schedule is missing even though prefs say on | AsyncStorage.removeItem is not a function. | `16b31454`: added this suite with a partial AsyncStorage mock that lacks removeItem; existing encryptedPersistStorage.ts:152 calls it (older `38672f45`). |
| `adapters.test.ts` — chartAdapter reads real destination + next move + progress and never advances anything | Exact object comparison omits new weatherProgress. | `c76e6a62`: blame assigns chartAdapter.ts:127 weatherProgress to this commit. |
| `isolation.test.ts` — UI-D isolation does not touch backend, central V2 navigation, or legacy theme | dailyShell.tsx imports central navigation types. | `14f5c012`: blame assigns dailyShell.tsx:5 AnchorV2StackParamList import to it. The isolation test was created by `d678a442` and was not adjusted. |

In the separate focused reproduction, the same notification `removeItem` error instead surfaced in `NotificationSettingsScreen turning Daily OFF disables only the personal reminder`. Both exact names are reported because the failing assertion attribution varies with suite execution order.

These are likely source/test introductions from diff and blame, not a performed bisect. Legacy ChartPreview: 2 suites, 57 passed / 12 failed tests; 12 failed snapshots, 3 passed. All failed snapshot tests are listed below. The earliest likely introducing commit is `0aeb3d06`: it adds the map-layer testID, veil/weather rendering and first-draw hold seen in snapshot diffs. The snapshots were last updated in `46db9f96`, before it. Later `c9d91c3d` map-layer rendering and `c76e6a62` preview weather wiring add further differences. Do not attribute all snapshot churn to this cleanup.

- hero ChartPreview renders and snapshots empty, and delegates presses
- hero ChartPreview renders and snapshots normal, and delegates presses
- hero ChartPreview renders and snapshots regressed, and delegates presses
- hero ChartPreview renders and snapshots reached, and delegates presses
- hero ChartPreview renders and snapshots complete, and delegates presses
- card ChartPreview renders and snapshots empty, and delegates presses
- card ChartPreview renders and snapshots normal, and delegates presses
- card ChartPreview renders and snapshots regressed, and delegates presses
- card ChartPreview renders and snapshots reached, and delegates presses
- card ChartPreview renders and snapshots complete, and delegates presses
- row ChartPreview renders and snapshots normal, and delegates presses
- row ChartPreview renders and snapshots regressed, and delegates presses

Machine-readable evidence: `.jest-cache/celebration-cleanup-v2.json`, `.jest-cache/celebration-known-failures.json`, `.jest-cache/celebration-cleanup-legacy.json`; detailed console logs are in the host TEMP folder with `celebration-*.log` names. These generated results are not staged.

## Acceptance disposition

- M1 ink-hold assertion and coordinator duplicate tests: passed.
- Summit thud/chord: 0.9 each.
- Approved Progress relabel: applied in all listed files and fixtures.
- EV1 scene-only behavior: component and Home tests pass for finish/skip; 1.3× layout allocation test passes.
- Item 7: all hunks reviewed, focused tests passed; already committed in mixed `096a26d7`, so no duplicate commit created.
- String inventory: delivered above, including all five placeholder Evolve entries and supporting Chart copy; no inventory-driven edits.
- Parts B/C: delivered as read-only reports. No history rewriting or push.
- Physical-device font rendering, motion, audio loudness and onboarding frame pacing: not newly verified.
