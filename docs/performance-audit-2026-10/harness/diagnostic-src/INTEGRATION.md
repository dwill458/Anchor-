# Isolated diagnostic source delta

These sources are a review aid for a fresh separate diagnostic package only. Build identity is application ID com.anchorintentions.perflab20261012, Android label Anchor PERF LAB, and URL scheme anchor-perflab20261012; the package and scheme must never target the owner app or the prior user-touched perfbaseline package. Apply
them to `E:\apd\src` only after the parent clears the source-secured gate; do not apply
them to `E:\apc\src` or the shared checkout. The exact source diff is
`apd-diagnostic.patch`; keep the ordinary release build
unmodified and build the diagnostic package separately.

Required source changes around `ReleaseStorageBenchmark.ts`:

1. Add `perfDiag(event, numericFields)` to `src/utils/perfDiagnostics.ts`.
   It is enabled only by `EXPO_PUBLIC_ANCHOR_PERF_DIAGNOSTICS=1`, emits only
   fixed event names and a strict allowlist of numeric fields, and never accepts
   keys, values, IDs, strings, URLs, or error text. Keep existing `perfLog`
   development-only.
2. Keep the existing development-only `perfLog('secure-read'/'secure-write', …)`
   calls intact, and add numeric `secure-read`/`secure-write` events at the existing
   `readSecureValue`/`writeSecureValue` completion points in
   `src/stores/encryptedPersistStorage.ts`: duration, character count, chunk
   count, previous chunk count, computed SecureStore call count, and native
   success/failure counts. Emit a numeric `storage-fallback` event from
   `performWrite`/`getItem` when plaintext AsyncStorage fallback is taken.
   In the adapter benchmark, require a direct `readSecureValue` equality check
   as well as the public adapter round trip. Any fallback, native failure, or
   missing metadata invalidates that trial as a SecureStore result.
3. Add `writeSyntheticPerfAuthValue(value)` beside the existing private
   `encryptedAuthStorage` in `src/stores/authStore.ts`. It must refuse unless
   the diagnostic flag is on and auth state is signed out; write only the
   fixed valid SecureStore key `anchor-perf-synthetic-auth-v1` through the existing auth adapter,
   directly verify that key through `readSecureValue` before removing it in
   `finally`. Emit adapter-only `writeDurationMs` separately from total helper
   `durationMs`, plus payload size and fixed phase codes. The benchmark takes three sequential
   isolated control samples, followed by three large-write overlap samples;
   capture adapter write time and the helper promise settlement separately in
   its own `.then` callback,
   and await it separately from the bulk operation. Report per-trial
   `authAdapterWriteDurationMs`, `authHelperSettlementDurationMs`, and the
   write-only comparison `authWriteControlDeltaMs`. This is adapter-operation contention evidence,
   not a Firebase/authentication transition or guaranteed queue-wait component.
4. Add a bounded JS event-loop histogram (for example, 16 ms sampling with
   10-second aggregates and max/p50/p95 buckets) in the same diagnostics
   module. Never emit per-tick events or routes.
5. Add numeric `app-ready` marks in `App.tsx` using `appComponentMountElapsedMs`, which measures JS App component elapsed time rather than OS cold launch, add numeric `anchorCount` and
   hydration duration in the existing Anchor store rehydrate callback, then
   invoke `advanceReleaseFixtureSequence()` once after app-ready only when the
   diagnostic flag is enabled.
6. Add `focus-await` start/end marks around the existing awaited persistence
   promise in `V2PracticeSessionScreen.tsx`. These measure the request-to-settle
   duration without changing await order, the UI gate, or any audio/motion
   timing.

Fixture advancement also fails closed unless the native application ID is exactly
`com.anchorintentions.perflab20261012` and `API_URL` is exactly
`http://127.0.0.1:39999`; the application-ID check precedes every marker or
storage read, and the synthetic auth helper repeats both checks. Do not enable
sign-in or Focus persistence against a production Firebase project. The V2
storage-only `apd-diagnostic.patch` is historical and does not configure Auth
Emulator support is the established V4 baseline: its existing native guards
require the exact lab package, `demo-anchor-perf` Firebase app, and API at
`127.0.0.1:39999`. The V5 sequence applies the selected diagnostic overlays,
then the single consumer delta
`startup-fault-v5-consumers.patch` (SHA-256
`4CF6E9E22C7830B264F1B39FD6F92F6BB1997B6F9B68B8CA299BE67D2F4C1CCE`). That
delta adds a numeric check of the Auth Emulator route at `127.0.0.1:9099` and
the guarded one-shot startup consumers. The old
`../auth-emulator/mobile-auth-diagnostic.patch`,
`../auth-emulator/mobile-auth-diagnostic-v4.patch`, and
`startup-fault-v5-hooks.patch` are superseded review artifacts; do not apply
them. Synthetic Account C (`synthetic-account-c`) has verified demo claims and
a fixture API profile with `isComped=true`; this exercises the unchanged local
Pro gate only. It does not grant production entitlement or exercise billing,
RevenueCat, or a production account. Enable the emulator only after the
isolated server/config gate is active. In the isolated Android copy, set
`firebase.json` `react-native.android_bypass_emulator_url_remap` to `true`
before compilation. Verify compiled native `FIREBASE_JSON_RAW` contains that
boolean setting. Separately verify the native Google Services resources
identify `demo-anchor-perf`; after launch, require the numeric
`auth-emulator-route { okCode: 1 }` event, which is emitted only when the
runtime `auth().app.options.projectId` is `demo-anchor-perf` and the returned
`useEmulator()` pair is exactly `127.0.0.1:9099`. Stop if any check fails, and
do not attempt phone Auth on a remapped or cloud route.

Fixture stages are explicitly selected by exact initial URL, with no automatic
upgrade during measured cold launch. Only these literals are accepted:
`anchor-perflab20261012://perf/seed-small`,
`anchor-perflab20261012://perf/seed-large`, and
`anchor-perflab20261012://perf/measure-adapter`. The V5-only motion and startup
actions are `anchor-perflab20261012://perf/prepare-motion` and the three exact
`anchor-perflab20261012://perf/arm-startup-*` literals in
`startupFaultDiagnostic.ts`. A non-null unknown URL is a no-op
even if the optional build-time fallback is set; a null initial URL may use the
allowlisted `EXPO_PUBLIC_ANCHOR_PERF_FIXTURE_ACTION`. No URL/query is logged or
parsed. First launch the exact `seed-small` URL only on a fresh, signed-out,
empty isolated app. It accepts either no persisted Anchor value or only the
exact canonical empty Zustand default
`{"state":{"anchors":[],"totalPrimes":0,"primeStreak":0,"lastPrimedDate":null,"lastSyncedAt":null},"version":0}`;
any other persisted SecureStore value or any plaintext legacy value is refused.
It writes and verifies the canonical Anchor fixture and
durable Guest/onboarding-complete auth flags, then writes the marker last. It
does not mutate the first-run draft store; the seeded diagnostic route
intentionally bypasses onboarding UI. Relaunch with the action unset to
measure cold hydration of one Anchor.
Next select `seed-large` in a separate diagnostic stage; it requires the
one-Anchor marker/count and replaces the fixture only after app-ready. Relaunch
with the action unset to measure cold hydration of 72. Finally select
`measure-adapter` for the namespaced synthetic adapter round trips and three
auth-control/overlap comparisons. The action and marker/count guards prevent
seed writes during measured launches and stop on unexpected state.
Seed-large and measure-adapter compare the complete canonical SecureStore
payload with the deterministic expected synthetic value and require the
plaintext legacy key to be absent; a mismatched or fallback-backed Guest store
is never overwritten or measured as this fixture.

The synthetic SVG uses repeated valid path commands to calibrate the size; it
is a storage fixture, not a rendering-quality fixture or recovered user data.
The canonical guest-store launch covers actual cold Zustand persistence
hydration; the separate adapter exercise is not app boot. It adds synthetic
Anchors to the isolated diagnostic app's guest store and intentionally bypasses
onboarding UI.

The storage seed and adapter actions remain signed out. V5 `prepare-motion` and
`arm-startup-*` are separately exact-URL gated and require the V4 Auth Emulator
path, UID C with verified onboarded/comped claims, the app C profile marked
comped, and full canonical Account A 72-record fixture validation. They do not
transfer Anchor ownership: only the currently selected synthetic Anchor's
Account C Vision and Chart caches are primed. The other 71 records remain
Account A and are checked in full before any cache write. Startup fault arming
writes only the fixed one-shot marker after that same validation; its read/Auth
consumers must check lab package, loopback API, demo project, and UID C before
reading or consuming the marker. See `startupFaultDiagnostic.ts` for exact
marker, URL, phase, and delay constants. A later arming pass accepts only an
absent marker or the exact `consumed` sentinel after the same full validation;
unknown marker values and AsyncStorage copies are refused. The diagnostic-only
`startup-recovery` event records elapsed time from the first App component
mount to recovery UI mount, not operating-system cold-start duration. Cache priming is local SecureStore
cache preparation; the fixture API's matching Vision and Chart GET responses
must be available before motion interaction so revalidation remains read-only.
No production model generation, upload, Anchor mutation, or onboarding UI is
involved.

Guest Focus rejects before the durable queue, so guest Focus x10 cannot
establish storage-queue behavior. Run Focus x10 only with synthetic Account C
and the isolated emulator/API; if unavailable, mark it unrun. Firebase
transitions and UI completion are not synthesized by the storage benchmark.
Unit tests with mocked SecureStore validate control flow only and cannot
substitute for native adapter capture.
