# Anchor 2 UI I Thread Events System

## A. Spec and HTML references audited

- `Anchor_2.0_Thread_Events_System_LIVING_COLOR_LOCKED_SPEC.md`
- `Anchor_Design_System_Living_Spec_v0_4_THREAD_EVENTS_LIVING_COLOR_LOCKED.docx`
- `Anchor_2.0_Thread_Events_Prototype_LOCKED.html`
- `Anchor_Design_System_Living_Spec_v0_4_BRUSH_LANGUAGE_LOCKED.docx`, Section 14

The implementation follows the locked separation: Thread Events are durable backend facts; this client code is only a read, queue, receipt-cache, and presentation layer. Living Color is semantic state, while Handmade Brush is static authored texture. No brush asset is used in a Thread Event treatment.

## B. Files created

- `anchor/mobile/src/constants/v2/threadEvents.ts`
- `anchor/mobile/src/adapters/v2/threadEvents/{types,threadEventAdapter,receiptStore,index}.ts`
- `anchor/mobile/src/hooks/v2/threadEvents/{useV2ThreadEventQueue,index}.ts`
- `anchor/mobile/src/components/v2/threadEvents/{V2ThreadEventCelebration,V2ThreadEventModal,V2ThreadEventDetailSheet,livingColor,index}.tsx`
- UI-I adapter, receipt, queue, Living Color, and detail-sheet tests under the same feature folders.

## C. Files modified

None. This workstream is additive and uses feature-local exports for its central-wiring handoff.

## D. Shared files touched

None. Navigation, shared V2 exports, themes, primitives, screens, and backend files remain untouched.

## E. Event ledger intake model

`V2PersistedThreadEvent` mirrors ledger read fields: stable event and sequence IDs, source/correlation data, persisted significance/version metadata, and typed persisted display metadata. Intake accepts canonical server-returned Practice completions (`FOCUS_SESSION`, `DEEP_PRIME_SESSION`, `VISUALIZE_SESSION`), Chart events, and lifecycle events; it rejects incomplete records. It never uses current client Thread Strength to invent an event.

`bundleV2ThreadEvents` groups by authoritative `correlationId`, selects the locked-priority primary event, retains at most two supporting facts, and preserves ledger order between bundles.

## F. Milestone tiers

Evolution presentation validates only the server-persisted threshold metadata:

| Persisted threshold | Stage |
|---:|---|
| 10 | Grounded |
| 25 | Rooted |
| 50 | Embedded |
| 100 | Sovereign |

Practice milestones remain the separate persisted counts of 10, 25, and 50. Neither mapping is an event detector or a client-side threshold crossing check.

## G. Queueing and crash-safe receipts

`useV2ThreadEventQueue` exposes one active bundle, holds later bundles in order, and settles exactly one at a time. It supports the Home deferred channel through `HOME_CONTEXT` and never interrupts a session simply because a Home event is available.

`V2ThreadEventReceiptStore` persists the local presentation cache in AsyncStorage and considers only acknowledged/dismissed receipts terminal. The API adapter defines the CCR-TE-01 claim, presented, acknowledged, and dismissed calls; server receipt state must remain authoritative for leases and cross-device deduplication. A client must claim a bundle before mounting its celebration and mark it presented only after the event view mounts.

## H. Living Color intensity mapping

| Significance | Intensity | Treatment |
|---|---:|---|
| LOW | 0 | No ambient glow |
| MEDIUM | 1 | One local object halo |
| HIGH | 2 | Bloom, object halo, and one structural ring |
| MAJOR | 3 | Temporary `#0E0C09` chamber with the same controlled three layers |

Reduced Motion uses final artwork and lower-opacity static color with no event motion. The event headline remains text, and the component deliberately avoids brush rings, shadows, decorative gradients, badges, confetti, and calculated Thread delta copy.

## I. Required integration changes

1. Approve CCR-TE-01 and implement the canonical ledger plus presentation-receipt endpoints consumed by `threadEventAdapter.ts`.
2. Add server-authoritative Thread engine, evolution detector, and Practice completion response event refs before invoking immediate intake.
3. In the Practice completion owner, call `queue.enqueue({ completionType, events })`, claim `queue.active`, and render `V2ThreadEventModal` with the real Anchor SVG/category. Call `markPresented` on modal mount and `acknowledge` or `dismiss` only after user action.
4. In the Home owner, instantiate the hook with `channel: 'HOME_CONTEXT'` on Home arrival and render at most one compact deferred context; do not alter Today’s existing recommendation ordering.
5. Export these feature-local modules from the appropriate central V2 surface only after the owning integration workstream accepts the API contract. Do not use the legacy Progress-derived `deriveThreadEvents` path for new presentation.

## J. Test results

- `npm test -- --testPathPattern=threadEvent --runInBand` — passed
- Explicit UI-I test set — 5 suites / 15 tests passed
- `npx tsc --noEmit` — passed
- `npm test -- --runInBand` — launched but did not produce a final Jest summary within the available foreground window; stopped after sustained high memory use. This needs a CI/local full-suite rerun before integration.
- `npm run test:v2-boundary` — passed
- `git diff --check` — passed

## K. Branch and commit hash

Branch: `anchor-2/ui-i-thread-events`.

Commit hash: see the repository commit associated with this report.

## L. Merge notes

This is intentionally additive and has no navigation wiring. Merge after CCR-TE-01 API ownership and the Practice/Home integration owners agree the endpoint names, receipt claim response shape, and presentation mount lifecycle.
