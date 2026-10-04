# Vision polish — 4 October 2026

## Changes and purpose

1. **Generation wait:** kept the existing foreground flow. Both wavy placeholders now carry continuous moving light and haze, with a breathing real Anchor and staged copy at 0, 9, 20 and 40 seconds. Motion continues beyond 36 seconds until the server reports readiness. It pauses in the background and respects Reduce Motion. No estimated percentage or client timer unlocks the images. This makes the irreducible wait an intentional part of the experience.
2. **Neither path:** “Neither feels right — try again” returns to the existing description, retaining the draft and appearance-reference state. The user can edit a word and start another request.
3. **Preview decision:** tapping a candidate opens a full-screen preview. “Use this one” explicitly saves it; “Try again” returns to the retained description. Back returns to the two choices. Saving disables competing actions; failed saves remain retryable. The image arrival starts from the actual contained image bounds and Anchor position.
4. **Material:** retained all board geometry and wavy edges, adding restrained warm light, photo shading/shadows, and a gold transition into My Vision. The real enhanced Anchor artwork now appears on the generation screen, choice screen, preview and arrival rather than falling back to its line-only sigil.
5. **Motion:** wait effects run on the UI thread using transform/opacity animations, with cleanup when hidden or finished. The Anchor settles smoothly when generation completes. The preview uses the native modal fade. Existing drag/reorder gestures, long-press menu, board layout transitions, and persistence remain intact. **The universal 60fps acceptance requirement is still open:** this pass does not establish zero dropped frames across every Vision transition on Android and iOS.

At the user's follow-up request, the empty creation input now offers **Use suggested description**. It copies the existing Anchor-specific worked example into editable text only after a tap. Existing writing is never overwritten. This is the existing local suggestion, not a new AI request. The chips, word/detail counter, appearance reference, coaching copy and creation-method footnote are preserved.

## Recordings

- `vision-creation-flow.mp4`: isolated Android emulator, production UI components in the development-only Vision QA host. Shows method, empty input, opt-in suggestion, the full 36-second wait, choice, preview and confirmation. The emulator uses the existing sample Anchor SVG; `vision-enhanced-anchor-wait.mp4` shows the real enhanced artwork on the Samsung.
- `vision-retry-paths.mp4`: emulator fixture demonstrating preview Try again returning to the retained input and starting another generation.
- `vision-neither-path.mp4`: emulator fixture demonstrating Neither returning to the retained input after that generation completes.
- `vision-detail-scroll-final.mp4`: the same phone scrolling the six-image detail, with the enhanced Anchor, original wavy edges, light treatment and section transition.

These are native recordings of the production components, **with fixture images and a simulated 36-second job**. They do not claim a live backend generation or persisted account write. Recordings are for visual review; the screen recorder's frame rate is not application frame-rate evidence. Any trimmed idle time is outside the generation wait; playback speed is unchanged.

## Checks and remaining acceptance

- **17 Vision suites / 151 tests passed** (`tests.txt`). Includes explicit confirmation, failed-save recovery, retained prompts, enhanced-artwork handoff, suggested-description editing and submitted values.
- Scoped `git diff --check` passed.
- Native Android development bundle rendered on the physical phone.
- Repository TypeScript check still fails in the unrelated Anchor Details screen/tests (`typecheck.txt`); no diagnostics in this Vision change.
- Native `gfxinfo` during the wait/choice/preview sample: 4,506 frames, 10 missed deadlines (0.22%), p95 6 ms, p99 8 ms (`final-flow-gfx.txt`). This is a development build with recording active, and includes transitions as well as waiting.
- Final six-image scroll sample: 550 frames, 17 missed deadlines (3.09%), p95 9 ms, p99 12 ms (`detail-final-gfx.txt`). The device's refresh rate is adaptive; deadline counts are not equivalent to a fixed 60 Hz benchmark.
- UI-thread frame callback samples during three continuous ten-second wait windows averaged about 8.32 ms with no gaps over 20 ms. A later transition window contained four gaps over 20 ms, maximum about 41.61 ms (`phone-frame-samples.txt`). Callback cadence is supporting evidence, not proof of every rendered frame.
- Another simultaneous QA flow later navigated the Samsung away from Vision, interrupting subsequent recordings. Captures were moved to an isolated emulator. Physical samples above must be treated as bounded observations, not an exclusive device acceptance session.
- Required before declaring item 5 complete: a release-build trace for list scrolling, sheets, add-image flow, long-press/reorder, preview/save arrival and wait-to-choice; resolve remaining measured stalls; repeat on iOS. Authenticated generation/save and native reference-photo acceptance also remain open.

## Direction choices

Chose a beautiful foreground wait rather than background notifications. Added the opt-in input suggestion because the user explicitly requested it. No information architecture changes, caption truncation work, backend generation changes, new mystical copy, commits or deployment.
