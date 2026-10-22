# Chart Pass C — October 2, 2026

Implemented in the authoritative mobile app. Existing dirty Chart/fog and unrelated style-generation work was preserved. No deployment or commit was performed.

## Changes

- **F1:** Width-fit creation maps keep the summit inside the window at 320/360/390/430dp. Re-authored the final master-route leg to summit (660,370), regenerated the fog field (hash 3f83162f), and kept old route vertices deferred. Summit X uses etched #7D766A ink and 3.6 stroke instead of UI ink/6; DiscretePathEffect and arrival glyph crossfade remain. The permanent map begins 100dp below the safe-area origin, 48dp below the header controls, and the camera now pans over the full landscape in a shorter viewport.
- **F2:** Creation starts landscape decode, fog upload, and grain generation. Pending resource work and decoded resources are shared across the handoff; grain keeps six recent viewport sizes. One visibility gate prevents route, flag, summit and native markers from appearing without decoded landscape art. Existing reduced-motion sequence behavior remains.
- **F3:** Current waypoint order is eyebrow/title/one-line rationale/One Move/progress. Progress editing, completion and other move actions retain their existing handlers. Map plus header reserves 360dp for the panel on a 360x760 viewport.
- **F4:** Kept review pending the product decision. Normal flow layout replaces the measured absolute panel boundary, so staged text changes cannot collide with the panel. The editable first move precedes guidance and route rows. Review events and idempotent creation remain unchanged.
- **F5:** Faint map behind photo context; Continue requires a start photo. Skip remains the explicit no-photo path; written context retains its existing validation. Vision-dependent content stays conditional on a real Vision.
- **F6:** No Vision uses “Mapping the way there.” Generating no longer renders the explanatory subtitle.
- **F7:** Shared ChartMapHeader across creation phases, with the existing serif for creation display questions/headlines.
- **F8:** No additional route-visibility change; existing dirty fog/visibility behavior preserved pending a product decision.
- **F9:** Progress track #737D89 passes 3:1 against both ink surfaces. No app-owned Refreshing label was found. React Native Libraries/Utilities/HMRClient.js explicitly shows “Refreshing...” through DevLoadingView for Fast Refresh. The exact recorded overlay cannot be visually confirmed without the recording.

## Verification

- `npx tsc --noEmit`: passed, exit 0.
- `npx jest src/components/v2/chart src/screens/v2/chart --runInBand --silent`: 29 suites / 320 tests passed, including map geometry/sequences/fog and cold/warm resource coverage.
- `npx expo export --platform android --output-dir .chart-pass-c-export`: passed (Android Hermes bundle).
- `git diff --check`: passed.
- New regression assertions failed before their respective fixes: summit/header clearance, One Move order, rationale cap, map height, landmarks without decoded art.

## Acceptance still needed

The supplied screenshot and written findings informed the fixes. The Oct 2 screen recording was not attached. ADB lists only emulator-5554; no Galaxy was connected. These automated checks do not establish Galaxy tap-to-art under 300ms, frame-by-frame F1–F3 acceptance, native checkbox visibility, or iOS visual acceptance. Re-record the same authenticated flow on the Galaxy after installing the revised build and compare intro/mapping/review/first-open frames at the specified widths, including reduced motion.

The referenced chart-codex-prompt.md v2 could not be found in the workspace or available attachments. Its full locked section remains unverified; the explicitly provided no-deletion/deferred-code, stable routes/keys/events/contracts, vocabulary, and no-new-Replan-UI requirements were followed. Happy-path review removal and additional dotted-route hiding remain pending Deon's decisions.
