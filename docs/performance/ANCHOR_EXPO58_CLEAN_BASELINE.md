# Anchor Expo 58 Clean Development Baseline

Date: 2026-10-18 (America/Chicago)

## Location and provenance

- Development worktree: `E:\Projects\Anchor-Expo58-Clean`
- Branch: `feat/expo58-sqlcipher-stable`
- Migration base: Expo 58 source worktree `feat/expo58-vision-aura`, HEAD `5d9a6497996665eb28b4e3641531cac5a7b34546`
- Migration commit: recorded in the companion Git handoff after this baseline commit is created.
- Original checkout: `E:\Projects\Anchor`, branch `feat/celebration-layer`, HEAD `5765acd2710b2f45144ab7da6069b67c4a80b3c4`.
- Expo 58 source checkout: `C:\Users\dwill\.codex\worktrees\expo58-upgrade\Anchor`, branch `feat/expo58-vision-aura`, HEAD `5d9a6497996665eb28b4e3641531cac5a7b34546`.
- Both original checkouts remain in place. No reset, clean, forced checkout, or source-worktree cleanup was run.

## Migration inventory

The new branch starts at the Expo 58 source commit, then includes its complete reviewed tracked working diff (60 files) applied as a binary-safe patch, four explicitly allowed untracked source/test files, and current persistence/performance audit documents from the original checkout.

| Classification | Migrated content |
|---|---|
| Product implementation | Thread Strength aura and Home carousel/hero; Anchor Details; Focus/Deep Focus presentation and completion; Vision note/layout/photo-fit; Chart teaching and active state; creation, settings, and authentication hydration updates. |
| Expo 58 compatibility | Existing SDK 58, React Native 0.88, Reanimated 4, Worklets, Gesture Handler, and Jest runtime stubs from the Expo 58 source branch. No dependency versions were changed for freshness. |
| SQLCipher implementation | Existing encrypted record database, cohort gates, account-scoped persistence, completion receipts, migrations and integration coverage from the Expo 58 base, plus current database and product integration edits. |
| Test/stabilization work | The source branch's Jest fixes, `paywallSkiaMock.ts`, `devThreadStrengthStore.ts`, and stabilization diagnostic utility/test. |
| Performance evidence | Latest account persistence repair, device validation matrix, performance audit/remediation plan, SQLCipher implementation notes, and native benchmark results JSON. These are historical evidence, not a current device performance claim. |
| Excluded generated/temporary items | Expo 58 QA screenshots, Thread Aura device captures/video, `.expo*` captures, `_expo58_generated`, build outputs, Metro/Android crash logs, caches, and node_modules. They remain in the original checkout/source worktree where they existed. |
| Excluded local configuration | `.env.local`, `google-services.json`, `GoogleService-Info.plist`, and local Claude settings were not copied or committed. Native/Firebase configuration must be supplied locally when a native build is separately authorized. |
| Conflicts | The source tracked diff applied without content conflicts. Where the Expo 54 checkout had different contents in overlapping UI files, the Expo 58-compatible source versions were retained. Its newer persistence/performance documents were copied separately. |

## Runtime and package versions

| Component | Version/configuration |
|---|---|
| Expo SDK package | `^58.0.14`; installed `58.0.14`; resolved `sdkVersion` `58.0.0` |
| React Native | `0.88.0` |
| React | `19.3.0` |
| Reanimated | `4.7.1` |
| Worklets | `0.13.0` |
| expo-sqlite | `~58.0.13` (installed `58.0.13`, existing patch applied by `postinstall`) |

`npm ci` completed successfully and ran `postinstall`, including the existing Gradle, expo-sqlite, Android widget, and Worklets patches. npm reported 60 dependency audit findings (21 moderate, 36 high, 3 critical); dependency changes were outside this migration and none were applied.

## SQLCipher startup and runtime selection

Start from PowerShell:

```powershell
cd E:\Projects\Anchor-Expo58-Clean\anchor\mobile
npm run dev:sqlcipher
```

The command runs `scripts/start-expo58-qa.ps1`. It verifies Expo 58, sets `ANCHOR_SQLCIPHER_PRODUCTION_QA=1`, clears competing SQLCipher profile flags including `ANCHOR_EXPO58_QA`, sets the owner QA production API endpoint, validates the public Expo config and SQLCipher cohort, and launches Metro with `--dev-client --clear --scheme anchor-sqlcipher-qa --host lan --port 8081`.

The distinction is deliberate: the current `ANCHOR_EXPO58_QA=1` profile selects `com.anchorintentions.expo58qa20261016`, runtime `2.0-expo58-sqlcipher-qa`, and a synthetic `.invalid` API. The phone had the owner QA package `com.anchorintentions.sqlcipherpreview20261015` installed during initial ADB inventory. The startup command therefore selects the separate owner real-account profile and does not change Firebase authentication or point to synthetic data.

Validated config and served Metro manifest:

- Runtime: `2.0-sqlcipher-v2-realdata-qa`
- Android/iOS identity: `com.anchorintentions.sqlcipherpreview20261015`
- API: `https://anchor-production-26bf.up.railway.app`
- `extra.sqlCipherLab=true`, owner-pilot flags false, updates disabled
- `expo-sqlite` plugin has `useSQLCipher=true`
- Manifest `_internal.projectRoot`: `E:\Projects\Anchor-Expo58-Clean\anchor\mobile`
- `sqlCipherEnabled()` maps the manifest's `sqlCipherLab` to the encrypted storage adapter; the native cohort allowlist contains this package. Cohort, database, SQLCipher product integration, and startup hydration tests passed in the focused/full suite.

The script checks port 8081 and reports the owning command/project. If occupied, it exits without killing the process. This behavior was exercised against the Metro process from this worktree. The current Metro process was started by this script and its manifest was fetched successfully. This host had no active non-loopback IPv4 address, so Expo advertised loopback despite explicit LAN mode.

## Focus persistence safeguard

Focus completion now waits up to five seconds at the UI boundary for the local durable receipt. This threshold does not cancel the database operation. A still-pending receipt moves to an “outcome is still being confirmed” presentation with a status-check action; a rejected receipt shows confirmed failure and a retry action. Retry reuses the original session ID, and the canonical completion service remains responsible for idempotency and durable commit. The screen does not show Thread Strength for failed or unknown saves; server-authoritative movement remains unchanged.

Coverage added/updated for immediate success, delayed success, failure, unresolved receipt, late resolution, background/foreground, status check without a second pending write, and retry with the same completion ID. Existing SQLCipher product integration tests also cover recovery after the event commit but before middleware projection. No native write is canceled, no server strength is synthesized, and the Focus visual sequence was not rewritten.

## Verification results

| Check | Result |
|---|---|
| `npm ci` | Passed; 1,420 packages installed; existing patches applied. |
| `npx tsc --noEmit` | Passed. |
| `npx expo install --check` | Passed: dependencies up to date. |
| Focus save helper + Focus session integration | 2 suites, 31 tests passed. |
| SQLCipher, completion-service, startup-hydration focused tests | Passed in the focused run; these suites also passed in the full run. |
| Expo Doctor | 18/20. Remaining notices: gitignore matching local Expo module `android`/`ios` directories, and native folders coexisting with app config fields that EAS will not sync. No speculative config changes were made. |
| Full Jest (`npm test -- --runInBand`) | 568 suites: 542 passed, 26 failed; 5,471 tests passed, 50 failed, 1 skipped (5,522 total); 16 snapshots passed. |

The historical report cited 25 failing suites/48 failing tests. Current results are 26/50, so the suite is not green. The current failing suites are:

`VisionCeremony`, `ActivationScreen`, `V2ChartScreen`, `ChartSummitAndRouteScenes`, `creationStore`, `homeArrivalEvolved`, `AnchorDetailScreen`, `V2VisualizePreparation`, `SoundPool`, `V2CreationFlow`, `homeArrivalRelease`, `homeArrival`, `V2ReleaseCompletion`, `adapters`, `progressSharedTransition`, `creationFlowSounds`, `ChartMap`, `homeDetailsReverseTransition`, `VisionBoardPhoto`, `ChartMapWeather`, `homeDetailsCoverage`, `homeRenderBudget`, `ExportAnchorSheet`, `chartMapResources`, `isolation`, and `useShareExportRenderer.integration`.

Observed failure classes include stale color/category/SVG/shape expectations, a changed chart adapter payload, a player-limit expectation that does not match the current constant, completion/gesture tests that do not reach the current interaction state, and unresolved Reanimated timing/canvas/transition assertions. These were not weakened or deleted. No product-level Worklets/PanGesture crash was reproduced by the focused tests; the Expo 58 Jest Worklets/Reanimated/Gesture Handler stubs are active. The animation/map/transition failures need individual runtime-backed triage before performance claims are made.

## Device smoke test and performance readiness

Metro returned HTTP 200 and served the expected owner QA runtime, package, SQLCipher plugin, and clean-worktree project root. ADB initially saw the S24 Ultra and the owner QA package, but the device disconnected before package metadata or runtime compatibility could be checked; subsequent `adb devices -l` returned no devices. Therefore no app was launched or connected, no account data was touched, and navigation, Focus completion on-device, restart recovery on-device, and runtime adapter observation on the handset remain unverified. No native/EAS build was made.

This worktree is a reproducible development baseline, but it is **not yet approved for release-like performance benchmarking**: the device smoke test is blocked, the installed binary runtime/signing identity was not revalidated, and the full Jest suite has 26 failing suites. Resume once the same owner QA development client is attached and its runtime identity is confirmed; do not clear or reinstall its data to bypass that gate.

## Handoff

Use `E:\Projects\Anchor-Expo58-Clean` for future Anchor 2.0 Expo 58 development. Its tracked and allowed source changes are committed on `feat/expo58-sqlcipher-stable`; after this report is committed, verify `git status --short --branch` is clean. The original Expo 54 checkout and Expo 58 source worktree remain intact as recovery references.
