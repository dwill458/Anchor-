# Anchor 2.0 release execution report — 2026-10-30

## Release status

**iOS: NO-GO pending selected internal testers, subscription/device acceptance, and the Apple weekly catalog issue. Android: NO-GO pending upload-certificate match, signed AAB, internal testing, and physical-device acceptance.** No production database write, reconciliation application, production backend deployment/restart, OTA, public submission/release, or customer purchase change was performed.

| Task | Result | Evidence |
|---|---|---|
| RevenueCat `pro` entitlement | **Corrected additively.** Created identifier `pro` (display name `Pro`) and retained the existing `Anchor Pro` entitlement unchanged. | RevenueCat project `Anchor` Product Catalog displayed `pro`; dashboard confirmation toast showed successful product attachment. [Entitlement page](https://app.revenuecat.com/projects/251d73e3/product-catalog/entitlements/entl4214bf9676). |
| Apple product attachments | **Attached additively.** `anchor_pro_weekly`, `anchor_pro_monthly`, `anchor_pro_annual`, and `rc_lifetime` are mapped to `pro`. Legacy `rc_monthly` / `rc_annual` were already attached to `Anchor Pro`, so were also mapped to `pro` for compatibility; they are not in the current App Store subscription group or current offerings. Apple weekly is flagged **Missing Metadata** in RevenueCat; monthly and annual show Approved in App Store Connect. | RevenueCat `pro` and preserved `Anchor Pro` pages; App Store Connect subscription group lists three products. No store products, prices, or trials were changed. Resolve weekly metadata/catalog mismatch before Apple subscription acceptance. |
| Android product attachments | **Attached and verified.** `anchor_weekly:weekly`, `anchor_monthly:monthly`, `anchor_annual:annually`, and `rc_lifetime`. | `pro` page showed Google Play product and base-plan associations; excluded Test Store products. |
| Existing subscriber access | **Read-only spot checks passed.** Two active subscriber profiles resolved to `Pro` (one monthly, one annual). | RevenueCat customer aggregate showed 513 customers, 2 paid subscribers, 0 trialing; active profiles had `Pro` active. Names, emails, and IDs omitted. |
| RevenueCat offers/trial | **Offering mappings remain available.** Four current packages remain mapped to weekly, monthly, annual, and lifetime products on both stores. Apple and Play monthly subscription dashboards each showed a one-week free introductory period. | Read-only `offerings.current`, App Store Connect subscription pricing, and Play base-plan/offer screens. No pricing/trial edits and no sandbox transactions. |
| Railway production variable preparation | **Prepared, not applied.** Backend reads `REVENUECAT_API_KEY`; entitlement variable `REVENUECAT_ENTITLEMENT_ID` is optional and defaults to `pro`. Production currently lacks both. Existing RevenueCat server key is present in its dashboard but API validity could not be confirmed. | Railway production `Anchor-` read-only inspection; no production variables changed because saving may redeploy. Cutover values to set: verified secret at `REVENUECAT_API_KEY`, `REVENUECAT_ENTITLEMENT_ID=pro`. |
| Railway staging deployment | **Isolated resources provisioned; backend deployment attempted and blocked at startup.** `Postgres-MlUt`, `Redis-W0yG`, and object bucket `anchor-staging` are separate staging resources. Firebase project `anchor-staging-d2a1e` uses Spark; Analytics and Gemini are off; email/password Auth is enabled with no users. | Railway deployment `60c73bb0-4161-4f5d-8a90-21c9b9319e3b` ran from local HEAD `3044c6f4883120bc8a08a5a316fe4f30d7b8b7a8`. Logs show staging Postgres host `postgres-mlut.railway.internal`, 59 migrations found, and no pending migrations; startup then failed because production-mode validation requires `FIREBASE_PRIVATE_KEY`. No production database/storage references or production data clone were used. A staging Firebase service-account credential is still required before health/API write smoke tests. |
| Android signed AAB | **Not started.** Candidate versionCode baseline corrected from 40 to 44 after Play Console confirmed production code 43. | Local `app.json` and Gradle use code 44, package `com.anchorintentions.app`, target SDK 36; QA app IDs remain separate. Play production is version code 43. EAS upload certificate is not matched to Play’s accepted certificate, so no AAB was started. Source `AndroidManifest.xml` lists storage/media permissions that `app.json` marks blocked; the generated release manifest and 16 KB compatibility remain unverified until a candidate build. |
| iOS signed IPA | **Built and inspected.** EAS production build `9513796a-123e-4591-86be-2bfb467377c1`, version `2.0.0 (21)`, finished. | [IPA artifact](https://expo.dev/artifacts/eas/rUkMsPXEdP203jCFHTR6axSba4l842fiYdjgiXvo-FQ.ipa). Bundle `com.anchorintentions.app`, build 21, minimum iOS 16.4, 32 privacy manifests including the app-root manifest; camera/photo-library/microphone/speech usage descriptions are present, signed App Store profile for team `GZAHS664L8`, `get-task-allow=false`, profile expires 2027-06-08. Embedded distribution certificate serial `20B24339B306D0304F402F1A81ADC85D` matches active EAS credential metadata. Local inspection copy: `%TEMP%\anchor-ios-2.0.0-build21-9513796a.ipa` (201,225,544 bytes). A scan of bundled JS/plist/text found 0 common private-key/API-token marker hits. |
| TestFlight preparation | **Build 21 is Ready to Submit and assigned to the internal QA group.** | `Anchor 2.0 Internal QA` has automatic distribution disabled and 0 testers. [EAS submission `dbd29cb4-625d-4a85-a565-0927fa1c4027`](https://expo.dev/accounts/dwill458/projects/anchor/submissions/dbd29cb4-625d-4a85-a565-0927fa1c4027) uploaded the build; App Store Connect shows 2.0.0 (21) as Ready to Submit and assigned. No testers were invited; no public review or release was initiated. |
| Google Play Internal Testing | **Track exists; prior build is stale.** | Play Console shows internal release `4 (1.0.0)` from May 16, 2026 and the configured tester list. No 2.0 AAB was available; no upload or rollout performed. EAS Play submission service-account configuration is absent. |
| Subscription sandbox acceptance | **Not completed.** | After the RevenueCat SDK update, mobile TypeScript and 3 focused suites / 49 tests passed. Dashboard checks confirm weekly/monthly/annual/lifetime packages and one-week monthly introductory periods; StoreKit/Play Billing transactions, restoration, cancellation, and expiry were not exercised. No real-payment purchase was made. |
| Physical-device QA | **MANUAL DEVICE QA REQUIRED.** | No physical iOS/Android device or real sandbox transaction was available. |
| Production cutover preparation | **Procedure prepared; not executed.** | No production database changes, reconciliation application, production backend deploy/restart, customer purchase change, OTA, public submission, or public release occurred. |

## Repository and local verification

- Local branch `release/anchor-2.0-p0-gates`; HEAD `b42e9df393bd65d51747b7d04438b524dfe2c9c7` (new local release commit; parent `3044c6f4883120bc8a08a5a316fe4f30d7b8b7a8`). The local release history includes the creation ledger, guest authentication, reconciliation, and recent app changes. The branch is not present on GitHub `origin`, so no remote checkout was used to build or deploy staging.
- Preserved release-specific local work in `anchor/mobile/android/app/build.gradle` and `anchor/mobile/app.json`; Android production version code is 44 and iOS build number is 21. Added exact `node-gyp@13.1.0` to resolve the EAS install failure and pinned `react-native-purchases@10.16.0` after build 20 failed compiling the old SDK against Xcode 27.1. Build 21 completed; EAS build logs report two Expo Doctor checks failing (native config sync and 22 SDK package-version mismatches), but the iOS build continued. Committed the four reviewed release files as `b42e9df393bd65d51747b7d04438b524dfe2c9c7` on `release/anchor-2.0-p0-gates`; no push or merge was made. The iOS candidate source tree now matches that commit. `git diff --check` passed after the release config edits.
- Mobile TypeScript, backend type-check, V2 boundary verification (39 integrations), Prisma validation, and focused subscription/entitlement tests (35 passing) passed in this execution. Creation-ledger/reconciliation PostgreSQL suites were skipped here (10 skipped tests).
- Standalone `npx expo config --json --type introspect` reports an Android manifest `MainActivity` assertion; EAS used its bundled config fallback and the retry's app-config and iOS prebuild phases both passed.
- Existing audit/checklist documents earlier isolated-local evidence of 63/63 creation HTTP cases, 6/6 reconciliation cases, all 59 migrations from zero, and trial 7/8 plus Pro 10/11 limits. These are not staging or production acceptance and were not rerun in this dashboard session.
- EAS build 19 failed during install because `sharp` fell back to source compilation without a locally resolvable `node-gyp`; build 20 fixed install but failed compiling the old RevenueCat SDK under Xcode 27.1. Build 21 completed after the exact RevenueCat SDK update. It was produced from the local release checkout (fingerprint `859b6d9881a6c32aaf84520672329d59338c7725`) and submitted to App Store Connect for internal testing only.

## Remaining blockers (9)

1. Create a staging Firebase service-account credential for project `anchor-staging-d2a1e`, store it only in Railway staging, and redeploy. This credential step is held for explicit action-time approval; no key has been created.
2. Once staging Firebase credentials are configured, verify `/health`, authenticated creation-session API smoke tests, and staging-only storage wiring. The staging DB reports all 59 migrations present with none pending.
3. Validate the existing RevenueCat server secret without exposing it; set `REVENUECAT_API_KEY` and `REVENUECAT_ENTITLEMENT_ID=pro` only during the approved production cutover. Neither production variable was changed.
4. Resolve Apple’s `anchor_pro_weekly` Missing Metadata state and the missing legacy `rc_monthly` / `rc_annual` catalog entries; then run Apple sandbox purchase/restore tests. No store metadata or product changes were made.
5. Obtain the Google Play accepted upload-certificate fingerprint and compare it to the EAS production keystore. Then build/inspect an Android AAB, verify the generated manifest applies the configured storage-permission blocks, and check 16 KB compatibility.
6. Add owner-selected testers to `Anchor 2.0 Internal QA`; build 21 is already assigned and Ready to Submit. No tester emails were supplied.
7. Upload the verified Android AAB to the existing Google Play Internal Testing track; no AAB or Play submission credential is available yet.
8. Run real Apple/Google sandbox lifecycle and restoration tests; verify annual trial, weekly/monthly, restore, cancellation/expiry, and trial 7/8 plus Pro 10/11 creation limits.
9. Complete manual physical-device acceptance on iPhone and Android, then obtain final approval for production cutover and public release.

## Production cutover sequence (not executed)

1. Create and verify a restorable production database backup; retain point-in-time and restore evidence.
2. Deploy only reviewed additive Prisma migrations in the approved window; verify migration status and DB health.
3. Run `reconcile-creation-ledger.ts` against the confirmed production DB in dry-run mode; record totals and classifications.
4. Review uncertain/affected accounts, including unavailable generation history, counter discrepancies, unverified trials, and cached premium status.
5. Obtain owner authorization, then run reconciliation apply mode with `--confirm-database=<exact production database name>`; verify monotonic counters and audit rows.
6. Set Railway production `REVENUECAT_API_KEY` to the validated secret and `REVENUECAT_ENTITLEMENT_ID=pro`; expect a redeploy and perform only in the approved window.
7. Deploy the reviewed backend commit with the approved `ANCHOR_LEGACY_CREATION_COMPAT_UNTIL`; verify health, migrations, Firebase, RevenueCat, Redis, and storage.
8. Verify authenticated 1.5 clients preserve ledger metering and the known unauthenticated legacy guest path returns the expected HTTP 426.
9. Coordinate store release controls for iOS and Android; do not assume public availability at precisely the same time.
10. Run production smoke checks for auth, guest Anchor creation, save/recovery, entitlement refresh/restore, and account boundaries using approved test accounts.
11. Monitor Sentry, RevenueCat events/entitlements, onboarding completion, API health, database pool, Redis, and creation denials against baseline.
12. Stop rollout on data integrity issues, entitlement loss, auth/creation failures, error-rate or latency threshold breaches; preserve forward-compatible migrations and use the documented rollback.

## Manual physical-device acceptance (required)

Use internal TestFlight and Google Play Internal Testing builds on a real iPhone and Android device. Use only designated StoreKit/Play Billing sandbox tester accounts; do not use real payment methods. For each platform: clean-install, authenticate as a disposable test account, confirm the annual offer shows the seven-day introductory trial, complete sandbox purchase, verify `pro` becomes active in the app and backend, restore after reinstall, and verify premium access survives relaunch. Exercise weekly and monthly sandbox purchases separately. Cancel a sandbox renewal and use accelerated sandbox expiration to verify cancellation/expiry removes premium creation allowance while preserving owned content. On the trial account, perform seven successful creations and verify creation eight is denied without incrementing usage; on an active Pro account, perform ten successful creations and verify creation eleven is denied. Record store transaction status, app/backend entitlement state, counter values, and sanitized logs for each case. Repeat key sign-in, recovery, account-switch, offline/restart, and creation flows on both platforms.

## Completion counts

Completed actions: **23**

Remaining blockers: **9**

Actions requiring my approval: **2** — (1) action-time approval to create a staging Firebase service-account key and store it in Railway staging, and (2) final production cutover/public release decision after remaining gates close.

**iOS release status: NO-GO**

**Android release status: NO-GO**

**Exact next action for me:** Approve or decline creation of a staging-only Firebase service-account key for `anchor-staging-d2a1e` to unblock the staging backend redeploy. Choose the internal TestFlight testers and provide the Play upload-certificate fingerprint; then complete sandbox and physical-device acceptance before production cutover approval.
