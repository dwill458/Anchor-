# Anchor 2.0 UI-F — Practice + Recommended Today

## A. HTML references audited

- `Anchor 2.0 Light Redesign - Standalone.html` — the archive index identifies the Practice, Focus, Deep Prime, and Visualize standalone references.
- `Anchor_Design_System_Living_Spec_v0_4_Recommended_Today_LOCKED.docx` — compact editorial-ribbon treatment, selected-Anchor scope, server priority, and exact why-copy.
- `Anchor_Design_System_Living_Spec_v0_4_BRUSH_LANGUAGE_LOCKED.docx` — low-density Practice surface and Prepare-only restrained mode color.

## B–D. Files created, modified, and shared files

Created the UI-F-owned Practice constants, recommendation adapter, model hook, V2 Practice components/screens/routes, focused tests, and this report. Modified `screens/v2/practice/index.ts` only. Shared files touched: **none**.

## E–H. Hierarchy, selected Anchor, recommendation, and ACK

The hub is Back/Practice → fixed selected-Anchor context → presentation-only Thread Strength → one compact Recommended Today ribbon → All Practices (Focus, Deep Prime, Visualize, Release). There is no Anchor switcher or persistent tab bar.

The ribbon maps the backend's one `recommendation.action` to one mode and uses the locked why-copy: Release “Reached a meaningful milestone”; Visualize “Reconnect with your Vision today”; Deep Prime “Thread has softened over the last 7 days”; Focus “Daily reinforcement for your Anchor.” It performs no client priority calculation, including no Thread-strength, streak, or session-count proxy. A null/unavailable server `delta7d` is represented by the server's Focus response.

The recommendation GET is non-consuming. ACK is available only from an explicit Recommended Today press and is never called on mount, refresh, background fetch, or ordinary mode-row selection.

## I–M. Mode list, Prepare, and handoffs

All four modes remain visible and selectable. Focus offers 10/30/60 sec; Deep Prime offers 2/5/10 min; Visualize offers 1/3/5 min; Release presents a preservation-focused handoff. Focus and Deep Prime only emit an `onBeginPractice` intent, leaving proven session/audio engines untouched.

Visualize uses the real persisted Vision scene when available; without one it renders the create-Vision bridge and emits `onCreateVision(anchorId)`. Release emits `onReleaseRequested(anchorId, 'practice_prepare')` and never calls the legacy burn endpoint. An unavailable premium mode emits `onPremiumCapabilityRequired({ capability, anchorId, source })`; no paywall UI was added.

## N. Required integration changes

Register the exported `V2_PRACTICE_ROUTE_MANIFEST` in the central navigator, render `V2PracticeScreen`, and connect its typed intents to the existing session, Vision, Release, and paywall flows. No central-navigation edit is included here.

## O. Test results

- `npm test -- --testPathPattern=practice` — passed.
- `npm test -- --runInBand src/screens/v2/practice/__tests__/V2PracticeScreen.test.tsx` — 12 passed.
- `npm test -- --runInBand` — 171 suites passed; 1,373 tests passed; 1 skipped.
- `npx tsc --noEmit` — passed.
- `npm run test:v2-boundary` — passed.
- `git diff --check` — passed.

## P–Q. Branch, commit, merge notes

Branch: `anchor-2/ui-f-practice`. Commit hash: reported with the final handoff. Do not merge directly into integration; wire the manifest/intents in the owning navigation integration change.
