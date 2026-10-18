# Dev-build aura visibility repair

The connected SM-S928U1 was running `com.anchorintentions.sqlcipherlab20261013` from Metro on port 8081, served by `E:\Projects\Anchor-SQLCipher`. That checkout did not contain ThreadAura, although the authoritative `E:\Projects\Anchor` checkout did.

Applied only the aura source files, its four existing Home/Details integrations, focused tests, and three SVG filter mock exports to the SQLCipher development checkout. Its existing native manifest and runtime edits were preserved. Restarted Metro with a cleared cache. The first restart omitted shell-provided configuration; corrected this by loading the existing authoritative mobile environment into the server process and setting the SQLCipher lab flag. The API subsequently returned successful authenticated responses. No environment values are included here.

Live inspection found a second defect: the installed native Skia blur filter has no `dispose()` function, despite the JS interface declaring it. Mask preparation caught that TypeError and silently returned the static fallback. Cleanup now tolerates native host objects without explicit disposal; development failures also emit a diagnostic instead of being invisible. Added a regression that failed before the fix and passes afterwards.

Enhanced artwork also used a larger viewport than the aura's structural mask. The mask now uses the enhanced image's actual display size, while traditional SVGs keep their existing SVG size. The foreground image URL, cover crop, size, and stored SVG are unchanged. A focused regression demonstrated 144px before the correction versus the expected 192px enhanced footprint for a 200px paper Anchor.

## Verification

- On the real phone, with the app's high-quality override temporarily enabled, inspected live React fibers: Home and Details both mounted `AnimatedAura` with `animate=true` and a valid native texture, using the actual confirmed 29% score. Home paused while Details was active.
- Returned the phone to Home and restored visual quality to `auto`.
- Phone Battery Saver was enabled (`low_power=1`), so Auto intentionally uses static aura. The OS battery setting was not changed.
- Focused aura checks in the actual SQLCipher checkout: 4 suites / 25 tests passed after the fixes.
- Home and Details integration checks there: 2 suites / 107 tests passed during this repair.
- Scoped whitespace checks passed in both checkouts.
- Captured `device-before.png`, `device-home-motion.mp4`, `device-details-fixed.png`, and `device-home-auto.png`. The recording and Details capture demonstrate the repaired native renderer before the subsequent enhanced-mask viewport adjustment; the Auto capture follows that adjustment.

This is native functionality verification at the user's current score, not a 60-FPS, low-end-device, iOS, or high-strength visual acceptance claim. Opaque enhanced artwork and low Thread Strength still make the effect restrained. To see continuous motion in Auto, turn Battery Saver off and view Home or Anchor Details; Practice does not use this aura.

No app uninstall, data reset, new APK, OTA, deployment, backend calculation, auth flow, or database migration was performed. The development checkout changes and the compatibility fixes remain uncommitted.
