# Anchor 1.1 — Regression Checklist

Run on iOS + Android release-candidate builds. ✅ = pass, ❌ = fail (file issue), ⏭ = n/a.

## A. New user (fresh install, no account)
- [ ] Cold start → LogoBreath → narrative onboarding completes without stutter
- [ ] Skip through onboarding fast-tapping — no double-navigation or blank screen
- [ ] First anchor creation (manual forge) completes; anchor appears in Vault
- [ ] First anchor creation (AI path) completes; loading state never dead-ends if backend is slow
- [ ] Kill app mid-creation → relaunch → no corrupted draft, no crash
- [ ] Guest with first-anchor draft cannot reach Vault without hitting SaveProgress gate
- [ ] SaveProgress: sign up with email, Apple, Google — each lands back in the intended flow
- [ ] No notification permission prompt appears before the user opts in

## B. Returning user (existing account)
- [ ] Sign in restores anchors, streak, trial state
- [ ] Vault loads offline (persisted anchors render; calm error toast, not raw error text)
- [ ] Anchor created offline syncs when connectivity returns (retry queue)
- [ ] **Create anchor offline → delete it → reconnect → deleted anchor does not reappear (1.1 fix)**
- [ ] **Edit anchor offline → burn it → reconnect → burned anchor stays released, not back in active vault (1.1 fix)**
- [ ] **Delete one anchor while another has a pending offline sync → the other anchor still syncs (1.1 fix)**
- [ ] Sign out → sign in as different account → no data bleed between accounts

## C. No anchors vs. multiple anchors
- [ ] Empty Vault shows the forge invitation empty state (no spinner stuck, no dead space)
- [ ] 1 anchor: detail screen, activate, reinforce, charge all reachable
- [ ] 10+ anchors: Vault scroll performance, correct ordering (updatedAt desc)
- [ ] Release (burn) an anchor: 2-step confirm → animation → anchor archived; back-nav can't re-burn
- [ ] Burn while offline: clear failure state with "Try again", no half-burned state

## D. Sessions (focus / prime / charge)
- [ ] Prime session completes → streak increments once per day only
- [ ] Backgrounding mid-session → return → timer state sane (no negative/frozen countdown)
- [ ] Exit warning shows on early exit; "keep going" resumes correctly
- [ ] Completion modal saves reflection; failure shows "Save failed" copy, session not lost
- [ ] Reduce Motion enabled: sessions and burn animation degrade gracefully

## E. Notifications
- [ ] Accept flow: toggle in Settings → pre-prompt → OS prompt → daily reminder scheduled at chosen time
- [ ] Denied at OS level: Settings toggle explains and links out; no repeated OS prompt loops
- [ ] Revoke permission in OS Settings while app runs → app state stays consistent
- [ ] Notification tap routes to the correct screen (cold start + warm start)

## F. Subscription — free / trial / Pro
- [ ] Fresh account starts 7-day trial; countdown matches server (`trialStartedAt`)
- [ ] Device clock rollback does not extend trial (server expiry wins)
- [ ] Trial expiry → paywall appears at the gate; free tier features still work
- [ ] Purchase monthly and annual (sandbox): success → Main, tier = Pro immediately
- [ ] Cancel the store sheet mid-purchase → no error alert, paywall still usable
- [ ] **Settings → Restore Purchase with active sub → Pro applies immediately (1.1 fix)**
- [ ] **Settings → Restore Purchase with no sub → "No subscription found" (1.1 fix)**
- [ ] Paywall → Restore with no network → calm failure copy, no internal SDK text (1.1 fix)
- [ ] Store misconfig / offerings empty → paywall shows "Purchases unavailable", restore still offered

## G. Settings & account
- [ ] Sign out: confirm dialog → lands on correct screen; retry queue cleared
- [ ] Delete account: warning mentions subscriptions; deletion completes; relaunch = fresh state
- [ ] Set password (social-only account) works; errors shown inline
- [ ] Data export completes; Contact Support opens mail (or explains when unavailable)
- [ ] Session defaults (mode/duration/audio) persist across relaunch and sync to profile

## H. Cross-cutting
- [ ] Deep swipe between Sanctuary/Practice tabs mid-animation — no gesture lockup
- [ ] Rapid double-tap on every primary CTA (create, burn, purchase, restore) — no double-fire
- [ ] Low-end Android: Skia screens (sigil render, burn) don't drop to unusable frame rates
- [ ] Sentry receives no new crash groups during the full pass
