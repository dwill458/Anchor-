# Share Studio repair

The Vision background used an Image's intrinsic asset dimensions with absolute-fill positioning. Its preview clipped an enlarged corner of the 1080 x 1920 artwork. The background now has explicit card dimensions and uses Android image resizing; its matching thumbnail sits underneath while the full image decodes. The Vision layout thumbnail receives the selected background too.

The controls previously had fixed height budgets smaller than their content. Both horizontal selectors could shrink and clip their cards and labels. Controls now take their natural height, both selectors resist shrinking, and the preview fits its measured remaining space. The body can scroll on short screens or with enlarged text.

Browsing no longer mounts another full-size export after every selection. Export rendering happens on Save/Share and is released after capture. Memoized templates avoid redrawing the other style thumbnails for Vision background changes. PNG size, asset readiness, real saved content, background persistence, mark entitlement and native Save/Share services remain intact.

Validation:

- Six share suites: 48 tests passed. New regression tests first failed for intrinsic background sizing, mismatched thumbnails, and automatic export mounting; they pass after the fix. Measured preview fitting also passes.
- TypeScript and scoped whitespace checks passed.
- Samsung Android development client: exercised the existing Share Studio through the development-only two-photo fixture. Confirmed complete Soft Focus and Scrapbook artwork, matching selected thumbnail, all four whole style cards and labels, mark control and Save/Share buttons. See `scrapbook-settled.png` and `after-layout.xml`.
- Further rapid-tap testing was stopped when Anchor was no longer foreground. No frame-pacing improvement is quantified. Native iOS and a fresh saved PNG were not exercised.
- A full app Jest run reported failures outside the share area (including creation assertions, Home/Chart contracts and snapshots, legacy Practice/Vault tests, audio player cap, and legacy export colors). It stalled before its final summary and was stopped. No unrelated code or expectations were changed.

Changes are local and uncommitted. No OTA or deployment was published.

## Background white-edge trim

Trimmed the baked-in left borders from Scrapbook (32 px), Soft Focus (44 px), and Editorial (16 px), then resized each to the original 1080 x 1920. Regenerated matching 112 x 199 thumbnails. Used the approved deterministic crop and resize with Sharp, preserving the existing artwork. Canvas and Midnight needed no crop.

Inspected `background-edge-comparison.png` and checked dimensions and the first 40 pixel columns: no white border remains in any corrected asset. Lossless PNG compression was applied; fully opaque alpha channels were removed only when every alpha value was 255. No layout or sharing code changed in this follow-up.

## Full-resolution export repair

The failed-image readiness path allowed a thumbnail background and unavailable-photo cards to count as a finished export. Vision now reports image errors separately and rejects capture immediately. A thumbnail is present only in the visible preview; it is excluded from the export tree. The export background retains its full-resolution decode.

Before mounting a Vision export, remote background, Anchor and photo bytes are downloaded into a unique local cache directory. HTTP failures, empty files and missing photo URLs reject the operation. The staged payload preserves saved order, notes and annotation. Duplicate URLs share one download. Staged files are deleted after capture or failure. Signed URLs are omitted from exposed native-download errors. Other formats keep their existing readiness behavior.

- Ten focused suites / 72 tests passed before the additional signed-URL error test. The final download suite also passed all seven tests, including signed-URL sanitization. Template regression tests failed first for thumbnail inclusion and failure readiness; hook integration tests prove capture waits for success and does not run after an asset failure. The completed TypeScript check reported errors in concurrently edited `src/stores/authStore.ts`, with no errors in the share changes. See `export-typecheck.log`.
- Samsung native Save exercised with the development-only four-photo fixture and a saved note. The initially loaded old bundle reproduced the blurry/placeholder export (`export-before-reload.png`). After a development-client reload, the corrected flow produced `export-native-verified.png`: 1080 x 1920, four loaded photographs, saved note, annotation and sharp Scrapbook background.
- Comparison of unobstructed edge pixels against the full-resolution asset has RMSE **0** for the corrected native PNG. The earlier export had full-resolution RMSE 10.26 and thumbnail RMSE 2.27. Values are recorded in `export-resolution-comparison.json`. No staging directory remained after capture.
- This verifies the Android fixture export. Native iOS and the user's specific four-photo Vision have not been exported in this follow-up. No OTA or deployment was sent. Concurrent unrelated checkout edits were preserved.

## Save/Share recovery follow-up

After the user reported both actions failing, added a single recovery attempt for missing/expired Vision photo URLs (HTTP 401/403/404). The export carries its Anchor ID, reads fresh URLs through the authenticated Vision API, validates that the returned Vision belongs to that Anchor, and replaces only the existing scenes' URLs. Saved order, notes, annotation and artwork remain selected from the existing payload. A second failed attempt exits normally rather than looping.

Native bundled background sources retain their original source metadata. Hidden Anchor artwork is not downloaded. Downloads now cancel after 15 seconds, wait for cancellation before cleaning their temporary directory, and release the busy state so Save/Share can be retried.

Eight share suites / **66 tests passed**, including expired URLs, cross-Anchor rejection, a bounded retry, cancelled stalled downloads and actual Save/Share button presses after a failed attempt. TypeScript and scoped whitespace checks passed. The regression tests failed before the changes (`save-recovery-red.log`).

**Runtime acceptance is pending:** `adb devices` and mDNS discovery found no connected device in this follow-up. The user's saved Vision and native touch area could not be re-tested. Earlier Android fixture acceptance does not establish that this reported failure is resolved. No OTA or deployment was published.

## Requested emulator verification

Started the existing Vision_QA Android 36.1 AVD without clearing its data. Startup hit System UI/ADB authorization issues; recovered the emulator and installed the existing development APK. The emulated app loaded current workspace JavaScript from a dedicated Metro server on port 8082.

Expanded only the development QA host with `share-4-art-mixed-notes`: four local fixture photos, full enhanced artwork, a Butter Yellow sticky note and Golden Hour editorial note. This matches the asset types in the reported card without accessing or modifying owner data.

- Pressed the native Save hit area on **all five backgrounds**. Android MediaStore confirms saved 1080 x 1920 images for Canvas, Scrapbook, Soft Focus, Midnight and Editorial. Six rows exist because the Share action also performs its existing local save.
- Pressed native Share: Android's `com.android.intentresolver` opened with the PNG preview and Quick Share, Print, Drive, Maps and Messages targets. Dismissed without choosing a recipient. Evidence: `emulator-share-sheet-final.png` / `.xml`.
- Inspected `emulator-export-art-mixed-notes.png`: all photos, enhanced Anchor, two notes and annotation are rendered. The other four backgrounds are saved as `emulator-export-<background>.png`; their unobstructed edge pixels match the full-resolution source exactly (RMSE 0). Metrics: `emulator-export-validation.json`.
- Save hit area `[53,2185][457,2327]`, Share `[489,2185][1028,2327]`; both native taps reached their intended action, and both re-enabled after the share sheet was dismissed. No Share Studio export failures appeared in the emulator's log. No staging directories remained.
- TypeScript passed after the development fixture addition. This is development-build emulator verification of the current local code. The user's specific authenticated saved Vision was not available in this emulator; the reported error was not reproduced with these fixtures. Phone build identity is being clarified. No OTA/build update was published.
