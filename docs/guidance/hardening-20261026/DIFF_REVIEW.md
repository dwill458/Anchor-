# Hardening diff review

Scope: self-review of the coordinator/measurement hardening only. This is not a clean-checkout review of the owner's Thread or Chart UI work, and is not release approval.

- Correctness: the original same-visit loss and duplicate Spotlight scheduler callbacks have regression coverage. Recovery requires pre-visible measurement failure plus a changed revision and stops after three selections. Tests cover timeout-window events, visibility, completion, navigation, locks, background, candidate loss and unrelated scoped replay. The newly introduced scoped-replay bound issue was caught during review, reproduced in a failing test and corrected before the final sweep.
- Readability: the added in-memory measurement state is separate from settled history, discovery and session accounting. Cancellation restores a reserved visit before dropping retry state, preventing a queued recovery from reopening a cancelled visit.
- Architecture: no new teaching, persisted queue, backend/API change, celebration hold or second completion model. Hosts supply target revisions; arbitration retains ownership and limits.
- Security/privacy: account/record identity checks remain in place; no owner history reset or milestone completion. Temporary diagnostic hooks were removed. Saved native evidence contains generic UI and allowlisted timing events, with no account content.
- Performance: the Chart measurement interval was removed. Actual readiness/layout/detent events and one deferred attempt drive measurement. This is a mechanism change, not measured startup-performance acceptance. Host/device benchmark and interaction/frame acceptance remain open.

Validation and release blockers are in REPORT.md. Nothing was staged, committed, merged or deployed.
