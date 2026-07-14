# Milestone and Lifetime Progression Architecture Decisions

**Date:** 2026-07-12  
**Status:** Accepted rules and first implementation slice

## Decision summary

Anchor will not use `PrimingHistoryEntry` as a universal authority and will not combine entitlement with practice progression. The system has four explicit responsibilities:

1. **Practice facts** say what happened: a Focus session, Prime, Deep Prime, Stabilize, or release.
2. **Progression projections** calculate current Rank, per-anchor Depth, practice days, and Thread Strength from those facts.
3. **Milestone awards and delivery** remember immutable awards and whether their presentation is pending, shown, or dismissed.
4. **Entitlement authority** determines trial and Pro access only from verified account, purchase, and billing state.

A read-only account timeline may combine events from these domains for display or support tooling. The write models, authorization rules, retention rules, and idempotency keys remain separate.

## 1. Role of `PrimingHistoryEntry`

`PrimingHistoryEntry` is a normalized practice-history read model. It became a bridge because a local-first session log was the only common, time-aware representation available to Rank, Depth, Thread Strength, Guide Mode, and hydration. Reusing that projection was convenient, but it blurred historical facts with the authority to award or deliver product state.

Final rules:

- It describes a completed practice event: kind, anchor reference, duration, and completion time.
- It may be consumed to calculate Rank, Depth, practice days, Thread Strength, and teaching eligibility.
- It is not the authority for entitlement, milestone identity, milestone delivery status, stored Rank state, or stored Depth state.
- Rank and Depth remain derived projections. Rank is account-scoped and lifetime; Depth is anchor-scoped.
- Milestone award identity and delivery state live in the milestone ledger.
- Guide Mode may consume practice facts but owns teaching selection and acknowledgement separately.
- Hydration reconstructs this read model from authoritative active and archived practice history; it must not silently fabricate missing events.

Longer term, the server-side practice event record should be the durable source and `PrimingHistoryEntry` should remain its mobile projection. This does not require an application-wide event bus.

## 2. Progression and entitlement ledgers

Entitlement and progression must not share one authority ledger.

### Progression domain

The future server-authoritative progression ledger may contain events such as:

- anchor created;
- Focus, Prime, Deep Prime, or Stabilize session completed;
- anchor released;
- milestone awarded; and
- Rank advanced.

It should be append-only for durable facts, use stable event IDs, and build account and anchor projections idempotently. A milestone award may reference its originating practice event.

### Entitlement domain

Entitlement remains a separate verified state/ledger for:

- trial started or expired;
- purchase and purchase restoration;
- Pro activated or expired; and
- compensation or administrative access.

Only verified server/billing inputs may mutate this domain. A practice event, Rank, Depth, milestone, teaching flag, or local ledger entry can never grant paid access. The client may show an optimistic UX state, but it cannot become authorization authority.

### Unified timeline

A combined account timeline is allowed only as a read model. It can order progression and entitlement events for the user or support staff without allowing one domain to write into the other.

## 3. Prime-only cleanup policy

### Safe to delete now

- The unused prime-only Rank and Depth tiers, helper, and `primeRank`/`primeDepth` fields in `useProgressionData.ts`.
- The unused `SheetMilestoneDates` subsystem and its prime-count-only thresholds in `milestoneTracking.ts`.
- The old sheet key may remain orphaned; no product behavior reads it.

These deletions are included in this implementation slice. Canonical multi-factor Rank and per-anchor Depth remain intact.

### Replace first

- Replace notification `isSovereign`/`sovereign_rank` with canonical Rank or rename it as an internal notification segment. Its 50-prime/Alchemist meaning conflicts with canonical Sovereign.
- Keep the one-time, versioned progression baseline until every existing account has migrated. Opening Progression Sheet must remain read-only.
- If Depth achievement dates are desired, add an anchor-scoped history model; do not revive the global prime-only sheet dates.

### Keep only for migration

- `anchor-milestone-dates` is discarded during verified-account baseline because the old device-global record has no trustworthy owner. Its dates must not be assigned to the first account that happens to upgrade.
- `anchor-sheet-milestone-dates` only as optional storage-cleanup housekeeping; its data is not authoritative.
- Teaching IDs such as `milestone_first_charge_v1` as aliases for persisted presentation content. Permanent journey IDs are reserved in the registry, but teaching delivery remains on its compatibility store until it gains explicit award/acknowledgement transitions.
- Persisted `sovereign_rank`, `alchemist_milestones_count`, and legacy notification type names until their server/client contracts have explicit aliases.

### Keep for backwards compatibility

- `practiceRank.ts` and `practiceDepth.ts` while old import paths may be used externally.
- Charge/Activation field names, route names, API payloads, and stored session discriminators until a contract migration exists. User-facing copy can evolve independently.

### Needs more investigation

- Stabilize: its data path and backend contract are live, while its standalone UI route is not.
- Visualize: currently a Deep Prime phase, not an independently completed progression event.
- Old notification eligibility/priority modules: dead pieces can be removed separately, but live Sovereign logic cannot.
- Archived Depth presentation and whether it should show a final tier, a historical maximum, or both.

## 4. Burned-anchor lifetime progression

Burn is an archive/release operation, not erasure. Account deletion is the separate destructive operation.

Final product rules:

| Concern | Rule after burn |
|---|---|
| Active anchor list | Remove the anchor from active practice. |
| Archived history | Show the released anchor in archived history. |
| Lifetime sessions | Continue counting every preserved session. |
| Practice days | Continue counting historical unique practice days. |
| Rank | Continue counting sessions, days, and the release; burning cannot reduce lifetime Rank. |
| Release requirements | The release counts permanently toward Rank requirements. |
| Milestone history | Preserve awarded milestones and their original dates/status. |
| Active-anchor Depth | Exclude the burned anchor from the current active Depth selection. |
| Archived Depth | Preserve enough session history to display its historical/final Depth later. |
| Thread Strength | Keep account-level historical session contributions; normal recency decay continues. |

The burn transaction therefore snapshots activation and Deep Prime charge history before cascade deletion. Hydration restores those facts and represents the burned anchor as released/archived. Burns that occurred before this schema change retain release and aggregate activation count, but missing dates and Deep Prime classification are not reconstructed with invented data.

## Milestone award and delivery rules

- Rank/Mark award IDs are permanent, copy-independent identifiers such as `rank.practitioner` and `mark.first_return`; the same registry reserves permanent journey and notification namespaces for their later migrations.
- The account-scoped ledger is versioned and encrypted on the device. Two alternating journal generations and read-back verification preserve the last valid ledger if a write is interrupted.
- Award creation and outbox insertion occur in one serialized mutation.
- A stored award is immutable in identity and award time; only delivery state advances.
- Presentation reads the persisted outbox and explicitly records shown/dismissed state.
- An unpersisted award is not presented.
- Account switching clears the in-memory presenter and changes ledger scope without deleting the previous account's history.
- Existing earned milestones are baselined as already shown exactly once; later crossings enter the outbox normally.
- Session completion handlers guard in-process re-entry and reuse one stable client event ID across local session storage, backend activation/charge writes, milestone attribution, deferred first-anchor sync, export, and hydration.

## Current implementation boundary

This patch intentionally avoids a giant event-bus rewrite. It adds the account-scoped mobile Rank/Mark ledger/outbox, permanent IDs, serialized journal writes, one-time migration baseline, completion re-entry guards, and server-restorable burned/Deep Prime history. Burn transactions use serializable isolation, progression-critical v2 exports fail closed, and hydration aborts if the active account changes.

The shared completion ID makes retries and restored completion screens idempotent without approximating identity from timestamps. A server-authoritative progression event ledger and milestone sync remain a later, compatible step. Entitlement authority is unchanged.
