# Anchor Details repair — October 4, 2026

## Changes

- Restore sheet gesture arbitration: stationary taps reach the child buttons; dragging expands the sheet; upward gestures at full height scroll its content.
- Restore handle tap cycling and use the resolved layout opacity for the header and bottom action hit targets.
- Keep hero translation based on the disc center, matching React Native's center-based scaling.
- Restore the compact Details Chart portal with its saved waypoint/destination copy; render the current etched Chart map instead of the photographic journey artwork.
- Supply typed Vision and Chart navigation fallbacks when Details is mounted outside the daily-shell intent provider.
- Keep the unavailable Vision image message legible on the light Details card.

## Evidence

- Supplied recording reviewed: Vision taps stayed on Details, the small hero was hidden near the center behind the sheet, and Chart used the photographic map.
- Samsung SM-S928U1: confirmed the hero appears beside the title when expanded (`hero-open.png`) using the existing "I stay focused during training" Anchor. `gallery.png` records the existing Anchors available before the session interruption.
- Focused Jest run: 3 suites, 77 tests passed (Details, sheet layout, ChartWorldPreview).
- TypeScript: no diagnostics in the five changed production files. The repository check retains two existing fixture type errors in `V2AnchorDetailsScreen.test.tsx`.
- Scoped `git diff --check`: passed.

## Device acceptance still open

The phone changed apps and its account session signed out during verification. After the user signed in again, the session disappeared once more. Vision and Chart navigation, and the compact etched map with this account's saved Chart, still need a stable authenticated device check. No content was seeded, generated, completed, released, or deleted during this repair.
