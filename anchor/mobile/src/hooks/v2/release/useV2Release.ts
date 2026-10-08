import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAnchorStore } from '@/stores/anchorStore';
import { useCourseStore } from '@/stores/courseStore';
import {
  buildReleaseConsequenceSnapshot,
  buildReleaseEnding,
  createReleaseIdempotencyKey,
  normalizeReleaseReason,
  v2ReleaseApiAdapter,
  type V2ReleaseAdapter,
  type V2ReleaseConsequenceSnapshot,
  type V2ReleaseEnding,
  type V2ReleaseLinkedCourse,
  type V2ReleaseResult,
  type V2ReleaseSuccessor,
} from '@/adapters/v2/release';

export type V2ReleaseStage =
  | 'preflight'
  | 'dissolving'
  | 'confirming'
  | 'completed'
  | 'failed';

type SubmissionState = 'idle' | 'submitting' | 'pending' | 'confirmed' | 'failed';

export interface UseV2ReleaseOptions {
  anchorId: string;
  adapter?: V2ReleaseAdapter;
  /** Route-supplied reason; verified against server-synced Chart state before it is shown or sent. */
  reason?: string;
  /** Required for 'evolve'. Must be an existing Anchor other than the one being released. */
  successor?: V2ReleaseSuccessor | null;
  /** Screen may already know a Vision is linked (it requires an async lookup). */
  hasLinkedVision?: boolean;
}

export interface UseV2ReleaseResult {
  snapshot: V2ReleaseConsequenceSnapshot | null;
  stage: V2ReleaseStage;
  /** Detail message for the confirming / failed panels. */
  message: string | null;
  /** True while the offline/timeout retry is safe to attempt with the same key. */
  retryable: boolean;
  result: V2ReleaseResult | null;
  anchorMissing: boolean;
  /** False when the release cannot honestly start (evolve without a valid successor). */
  canRelease: boolean;
  /** The completion config for the verified reason. */
  ending: V2ReleaseEnding | null;
  /** The relationships changed after the hold began; the hold was rejected and must be repeated. */
  stale: boolean;
  /** Record the consequences the user is looking at when a hold begins. */
  beginHold: () => void;
  /** Begin the dissolution ceremony and submit the idempotent release request. */
  startRelease: () => void;
  /** The ceremony component calls this once its visual timeline (incl. empty pause) has finished. */
  markDissolutionComplete: () => void;
  /** Re-submit the same release attempt (same idempotency key). */
  retry: () => void;
  /** Return to the resting preflight state with a fresh attempt. */
  reset: () => void;
}

/**
 * Orchestrates the Release experience: the preflight consequence snapshot, the
 * idempotent non-destructive submission, and post-release state reconciliation.
 * It never calls the legacy destructive `/burn` endpoint and never deletes
 * Anchor history or Course events — reconciliation only flips the local record
 * to `released` via the shared store.
 */
export function useV2Release(options: UseV2ReleaseOptions): UseV2ReleaseResult {
  const { anchorId, adapter = v2ReleaseApiAdapter, reason: rawReason, hasLinkedVision, successor: suppliedSuccessor } = options;
  const requestedReason = useMemo(() => normalizeReleaseReason(rawReason), [rawReason]);

  const anchor = useAnchorStore((s) =>
    s.anchors.find((a) => a.id === anchorId || a.localId === anchorId) ?? null,
  );
  const releaseAnchor = useAnchorStore((s) => s.releaseAnchor);
  const linkEvolvedFrom = useAnchorStore((s) => s.linkEvolvedFrom);
  const anchors = useAnchorStore((s) => s.anchors);
  const activeCourse = useCourseStore((s) => s.activeCourse);

  const [started, setStarted] = useState(false);
  const [dissolutionDone, setDissolutionDone] = useState(false);
  const [submissionState, setSubmissionState] = useState<SubmissionState>('idle');
  const [result, setResult] = useState<V2ReleaseResult | null>(null);
  const [stale, setStale] = useState(false);

  const idempotencyKeyRef = useRef<string | null>(null);
  const submitLockRef = useRef(false);
  const reconciledRef = useRef(false);
  const committedSnapshot = useRef<V2ReleaseConsequenceSnapshot | null>(null);
  const holdRevisionRef = useRef<string | null>(null);

  // Server-synced Chart state only: link kind, reached/completed flags and the next waypoint.
  const linkedCourse: V2ReleaseLinkedCourse | null = useMemo(() => {
    if (!activeCourse) return null;
    const ids = new Set([anchorId, anchor?.id, anchor?.localId].filter(Boolean) as string[]);
    const isDestination = Boolean(activeCourse.destinationAnchorLink?.anchorId && ids.has(activeCourse.destinationAnchorLink.anchorId));
    const ordered = [...activeCourse.waypoints].sort((a, b) => a.position - b.position);
    const waypoint = ordered.find((w) => w.anchorLink?.anchorId && ids.has(w.anchorLink.anchorId));
    if (!isDestination && !waypoint) return null;
    const next = waypoint
      ? ordered.find((w) => w.position > waypoint.position && (w.state === 'CURRENT' || w.state === 'UPCOMING'))
      : null;
    return {
      status: activeCourse.status,
      waypointCount: activeCourse.waypointCount,
      reachedCount: activeCourse.reachedCount,
      linkKind: isDestination ? 'destination' : 'waypoint',
      waypointReached: waypoint?.state === 'REACHED',
      courseCompleted: activeCourse.status === 'COMPLETED',
      courseId: activeCourse.id,
      nextWaypointTitle: next?.title ?? null,
      revision: activeCourse.version,
    };
  }, [activeCourse, anchor?.id, anchor?.localId, anchorId]);

  // An evolved intention needs a real, different Anchor to continue into.
  const successor = useMemo(() => {
    if (!suppliedSuccessor) return null;
    const own = new Set([anchorId, anchor?.id, anchor?.localId].filter(Boolean) as string[]);
    if (own.has(suppliedSuccessor.anchorId)) return null;
    const found = anchors.find((a) => a.id === suppliedSuccessor.anchorId || a.localId === suppliedSuccessor.anchorId);
    return found ? { anchorId: found.id, intentionText: found.intentionText || suppliedSuccessor.intentionText } : null;
  }, [suppliedSuccessor, anchors, anchor?.id, anchor?.localId, anchorId]);

  const snapshot = useMemo(() => {
    if (!anchor) return null;
    return buildReleaseConsequenceSnapshot({
      anchor,
      linkedCourse,
      hasLinkedVision,
      reason: requestedReason,
      successor,
    });
  }, [anchor, linkedCourse, hasLinkedVision, requestedReason, successor]);
  const activeReason = (started ? committedSnapshot.current ?? snapshot : snapshot)?.reason;
  const canRelease = Boolean(snapshot) && !(snapshot?.reason === 'evolve' && !snapshot.successor);

  const runSubmission = useCallback(async () => {
    if (submitLockRef.current) return;
    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = createReleaseIdempotencyKey(anchorId);
    }
    submitLockRef.current = true;
    setSubmissionState('submitting');

    try {
      const res = await adapter.submitRelease({
        anchorId,
        idempotencyKey: idempotencyKeyRef.current,
        reason: activeReason,
      });
      setResult(res);
      setSubmissionState(
        res.status === 'released'
          ? 'confirmed'
          : res.status === 'pending'
            ? 'pending'
            : 'failed',
      );
    } catch {
      // The adapter is contracted to resolve, never reject; treat a throw as a
      // retryable pending state rather than claiming failure.
      setResult({ status: 'pending', anchorId, message: 'Release is still being confirmed.', retryable: true });
      setSubmissionState('pending');
    } finally {
      submitLockRef.current = false;
    }
  }, [adapter, anchorId, activeReason]);

  const beginHold = useCallback(() => {
    holdRevisionRef.current = snapshot?.revision ?? null;
    setStale(false);
  }, [snapshot?.revision]);

  const startRelease = useCallback(() => {
    if (started || !canRelease) return;
    // The relationships changed under the hold: reject it, show the refreshed rows, require a new hold.
    if (snapshot && holdRevisionRef.current !== null && holdRevisionRef.current !== snapshot.revision) {
      holdRevisionRef.current = null;
      setStale(true);
      return;
    }
    committedSnapshot.current = snapshot;
    setStarted(true);
    void runSubmission();
  }, [started, canRelease, runSubmission, snapshot]);

  const markDissolutionComplete = useCallback(() => {
    setDissolutionDone(true);
  }, []);

  const retry = useCallback(() => {
    void runSubmission();
  }, [runSubmission]);

  const reset = useCallback(() => {
    committedSnapshot.current = null;
    holdRevisionRef.current = null;
    idempotencyKeyRef.current = null;
    reconciledRef.current = false;
    submitLockRef.current = false;
    setStarted(false);
    setDissolutionDone(false);
    setSubmissionState('idle');
    setResult(null);
    setStale(false);
  }, []);

  // Non-destructive local reconciliation: flip the record to released exactly
  // once the server confirms. History, Thread, and Course events are untouched.
  useEffect(() => {
    if (submissionState === 'confirmed' && !reconciledRef.current) {
      reconciledRef.current = true;
      releaseAnchor(anchorId);
      // The evolve link is made here and nowhere else: the release is server-confirmed and the
      // committed snapshot holds the successor the user attached. It is recorded on the successor
      // (never on the released Anchor), from the snapshot's own anchor id and intention.
      const committed = committedSnapshot.current;
      if (committed?.reason === 'evolve' && committed.successor) {
        linkEvolvedFrom(committed.successor.anchorId, { anchorId: committed.anchorId, intention: committed.intentionText });
      }
    }
  }, [submissionState, anchorId, releaseAnchor, linkEvolvedFrom]);

  const stage: V2ReleaseStage = useMemo(() => {
    if (!started) return 'preflight';
    if (!dissolutionDone) return 'dissolving';
    if (submissionState === 'confirmed') return 'completed';
    if (submissionState === 'failed') return 'failed';
    return 'confirming';
  }, [started, dissolutionDone, submissionState]);

  const shown = started ? committedSnapshot.current ?? snapshot : snapshot;
  const ending = useMemo(() => (shown
    ? buildReleaseEnding({ reason: shown.reason, intentionText: shown.intentionText, successor: shown.successor })
    : null), [shown]);

  return {
    snapshot: shown,
    stage,
    message: result?.message ?? null,
    retryable: result?.retryable ?? false,
    result,
    anchorMissing: !anchor && !committedSnapshot.current,
    canRelease,
    ending,
    stale,
    beginHold,
    startRelease,
    markDissolutionComplete,
    retry,
    reset,
  };
}
