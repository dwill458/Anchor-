# Direct observations — October 18, 2026

These are compact transcriptions of tool results from this audit, not new runtime instrumentation.

- Metro process 3632 command: Node in `C:/Users/dwill/.codex/worktrees/expo58-upgrade/Anchor/anchor/mobile`, `expo start --dev-client -c`.
- Metro Android manifest: `sdkVersion=58.0.0`, `runtimeVersion=2.0`, `sqlCipherLab=null`, `sqlCipherOwnerPilot=null`; launch asset query includes `dev=true`.
- Installed APK DEX version strings: `classes9.dex` contains `0.88.0`; `classes2.dex` and `classes12.dex` contain `4.7.1`. No RN 0.81.5 match was printed by the bounded version-string check.
- Release APK native entries observed: `lib/x86_64/libexpo-sqlite.so`, `lib/x86_64/libhermesvm.so`, `lib/x86_64/libreactnative.so`; S24 install failed with `INSTALL_FAILED_NO_MATCHING_ABIS`.
- Force-stop/reopen Activity result: COLD; target `expo.modules.devlauncher.launcher.DevLauncherActivity`; TotalTime 2377 ms, WaitTime 2382 ms. Reconnected via existing `anchor-sqlcipher-qa` dev-client URI, local Metro port 8081.
- Existing JS marker output: `{"event":"app-ready","t":38127,"msSinceAppStart":36328}`. Reconnect emitted more than one JS initialization context; not an independent benchmark distribution.
- Existing Focus UI was resolving at first inspection. After reopen, later UI trail read `36:26.195 beginEnding`, `36:26.198 save start`, `36:28.525 timer fired -> onComplete`, `36:28.527 handleFocusComplete enter`; resolving copy remained visible on repeated inspection. The trail did not contain `persistence settled -> complete`. No exact hang-duration metric or clean-account reproduction was obtained.
- A hardware Back action did not leave the initial observed resolving surface. No data clear, uninstall or sign-out was used.
- Package-private filename-only search did not return `anchor-private-v1.db*`; no database bytes or encryption keys were read.
- Phone power sample at trace end: AC powered true, USB powered false, battery level 14, battery temperature 396 tenths °C. Adaptive display mode list includes 120 Hz; active mode ID 1 was reported. No fixed-refresh or controlled thermal assumption made.
- Native Perfetto capture reported 16,666,427 bytes; trace processor analysis not performed.
- Physical phone interaction ceased following the user's question about phone control. The 20-cycle script and 10 s trace had already completed when their sessions were checked/stopped. No subsequent ADB interaction was used.
