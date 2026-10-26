# Moto native acceptance follow-up — 2026-10-26

The user made the Moto available and opened the isolated QA project. This supersedes the earlier blanket native deferral. **Native acceptance is partial; it is not a release/device sign-off.**

The physical Moto g play (2024) runs Android 14 / API 34, 720 × 1600 pixels at 280 dpi. Installed Anchor is debuggable `com.anchorintentions.app`, version 2.0.0 (39), native React Native 0.88.0. Source checkpoint: `71505dbff`, with the existing unrelated dirty working tree preserved. Captured production-source hashes are unchanged after testing.

## Isolation and limits

A separate Metro on 8093 served the current production ScreenTeaching, SpotlightCoach, ChartOneMoveTeaching, useTeachingQueue and useCelebrationActive. Only teaching persistence was replaced with a memory map; analytics went to a local recorder on 8094. No account stores, backend, widget update handler or real milestone settlement was invoked. The Details row function and its exact used styles were extracted from the production screen to avoid loading account-aware screen hooks. Fonts used the actual font assets.

The host's cards and navigation/focus signals are fixtures. Taps called local counters; they did not launch practices or complete real Chart moves. A milestone queue fixture and a separate celebration-store active fixture drove the actual blocking hook, with a visual stand-in instead of the real celebration. These tests demonstrate component behavior on hardware, not full Home/Chart/account integration.

## Executed checks

| Check | Observed result | Evidence |
| --- | --- | --- |
| Today copy / default presentation | Exact approved title/body/Got it visible; Chart shows the single approved beat | `home-default.png`, `chart-default.png` |
| Target touches | Home and Chart circle/body presses each reached underlying native target callbacks | `events.jsonl`, `checks.jsonl` |
| Hole edges | Home: inside/outside tests on left/right/top/bottom. Padding inside the hole did not dismiss; outside scrim did. Chart: same left-edge check. | `home-inside-edge.png`, `home-outside-edge.png`, Chart equivalents, event logs |
| Dismissal | Got it and scrim removed Home/Chart teaching | `home-got-it.png`, `chart-got-it.png`, logs |
| Celebration priority | Production hook/queue removed Home teaching for milestone queue and active scene signals; clearing milestone did not restart it in that visit | `home-milestone-blocked.png`, `home-after-milestone.png`, `home-scene-blocked.png` |
| Rapid transitions | Six focus/blur cycles before the 400 ms settle produced no ready teaching | `home-rapid-blur.png`, run 12 events |
| Tooltip placement | Low Home target placed tip above it; default target placed tip below | `home-bottom-target.png`, `home-default.png` |
| Text scaling | At 320 dp host width and 130% system font, Home/Chart title, body and action fit visibly | `home-320-font130.png`, `chart-320-font130.png` |
| Details wrapping | Unestablished and 100% rows wrapped their groups at 320 dp / 130% text without clipping; unestablished also checked at 280 dp | `details-*.png` |
| TalkBack | Enabled actual service; trees expose teaching text, Got it and dismiss controls. Home double-tap activated Got it | `talkback-home.xml`, `talkback-chart.xml`, run 20 events, `talkback-got-it-activated-20.png` |
| Android widget terminology | Actual Android WidgetPreview rendering of production Medium/Large sources shows DEEP FOCUS | `widget-native-preview-final.png` |

Native coordinates for the initial default target were x=28, y=240, width=355.43, height=80 dp, at 1.75 px/dp. The padded hole was x=20..391.43 and y=232..328 dp. For example x=37 px versus x=32 px at y=490 tested the inside/outside left boundary. The narrow host was centered with a window-space x offset, exercising the production window-to-overlay conversion.

## Failed / incomplete checks

**Back delivery is unresolved.** With visible Home teaching, injected Android `KEYCODE_BACK` exited the development activity instead of reporting a teaching dismissal (runs 4 and 23). A follow-up probe with no teaching mounted (run 24) also exited, with neither the independent BackHandler probe nor a DeviceEventEmitter native-back listener receiving an event. This narrows the issue to behavior outside the teaching handler in this installed host; it does not establish a root cause or prove what a release build does. The Phase 1 diff did not change the SpotlightCoach BackHandler registration. No Android manifest or native navigation behavior was changed to force a pass. Follow-up: reproduce with the intended release-like native build, confirm native event delivery, and recheck both teaching handlers and system Back gesture.

**TalkBack is only partially verified.** Opening the tip left the visible accessibility focus on the fixture header; no automatic focus transfer was demonstrated. Home's action could be double-tapped. Swipe traversal did not establish a complete reading sequence; the Chart attempt dismissed via scrim, so it is not counted as a Got it or traversal pass. Spoken announcements were not listened to. The accessibility trees include underlying fixture content; focus containment and the highlighted action's accessibility must be checked manually. Treat these as open accessibility acceptance items rather than inferred success from an announcement call or tree labels. VoiceOver was not executed: no iOS device/simulator was used.

The widgets were native previews, not launcher-hosted instances. Terminology rendering passed at preview scope. Launcher insertion, sizing, updates and cached older instances remain pending. The Large preview appears pale in the captured renderer; no appearance acceptance or unrelated widget styling fix is claimed.

Real screen navigation, celebration animations/receipts, real account persistence, iOS touch edges, maximum accessibility text sizes and release-like behavior remain unverified. Details evidence covers an exact extracted row, not the complete Details screen.

## Device and environment restoration

System font scale was restored from 1.3 to the original 1.0. Enabled accessibility services returned to the original null value; accessibility_enabled and touch_exploration_enabled both returned to 0. The first-use TalkBack tutorial was completed and its notification prompt declined. No account content, teaching history, practice or award was reset. The original development server on 8081 was not stopped or reconfigured. After testing, the QA project was closed to the development launcher, both QA servers were stopped, and only the QA reverse mappings (8093/8094) were removed; the original 8081 mapping remains.

The retained [results](results.json) distinguish passed component checks, partial checks and unresolved items. The harness sources and local event recorder are retained for reproduction; their absolute paths target this workspace. They are QA artifacts outside the mobile application and do not add a teaching architecture or Phase 2 code. Logs include exploratory attempts, remounts during font-scale changes and an early helper argument error; only the outcomes listed above are acceptance evidence. Screenshots containing the personal app or launcher inventory were excluded.
