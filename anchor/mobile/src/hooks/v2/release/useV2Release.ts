import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAnchorStore } from '@/stores/anchorStore';
import { useCourseStore } from '@/stores/courseStore';
import {
  buildReleaseConsequenceSnapshot,
  createReleaseIdempotencyKey,
  v2ReleaseApiAdapter,
  type V2ReleaseAdapter,
  type V2ReleaseConsequenceSnapshot,
  type V2ReleaseLinkedCourse,
  type V2ReleaseResult,
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
  reason?: string;
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
  const { anchorId, adapter = v2ReleaseApiAdapter, reason, hasLinkedVision } = options;

  const anchor = useAnchorStore((s) =>
    s.anchors.find((a) => a.id === anchorId || a.localId === anchorId) ?? null,
  );
  const releaseAnchor = useAnchorStore((s) => s.releaseAnchor);
  const activeCourse = useCourseStore((s) => s.activeCourse);

  const [started, setStarted] = useState(false);
  const [dissolutionDone, setDissolutionDone] = useState(false);
  const [submissionState, setSubmissionState] = useState<SubmissionState>('idle');
  const [result, setResult] = useState<V2ReleaseResult | null>(null);

  const idempotencyKeyRef = useRef<string | null>(null);
  const submitLockRef = useRef(false);
  const reconciledRef = useRef(false);

  const linkedCourse: V2ReleaseLinkedCourse | null = useMemo(() => {
    if (!activeCourse) return null;
    const linkedId =
      activeCourse.destinationAnchorLink?.anchorId ??
      activeCourse.waypoints.find((w) => w.anchorLink?.anchorId === anchorId)?.anchorLink
        ?.anchorId ??
      null;
    if (linkedId !== anchorId) return null;
    return {
      status: activeCourse.status,
      waypointCount: activeCourse.waypointCount,
      reachedCount: activeCourse.reachedCount,
    };
  }, [activeCourse, anchorId]);

  const snapshot = useMemo(() => {
    if (!anchor) return null;
    return buildReleaseConsequenceSnapshot({
      anchor,
      linkedCourse,
      hasLinkedVision,
    });
  }, [anchor, linkedCourse, hasLinkedVision]);

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
        reason,
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
  }, [adapter, anchorId, reason]);

  const startRelease = useCallback(() => {
    if (started) return;
    setStarted(true);
    void runSubmission();
  }, [started, runSubmission]);

  const markDissolutionComplete = useCallback(() => {
    setDissolutionDone(true);
  }, []);

  const retry = useCallback(() => {
    void runSubmission();
  }, [runSubmission]);

  const reset = useCallback(() => {
    idempotencyKeyRef.current = null;
    reconciledRef.current = false;
    submitLockRef.current = false;
    setStarted(false);
    setDissolutionDone(false);
    setSubmissionState('idle');
    setResult(null);
  }, []);

  // Non-destructive local reconciliation: flip the record to released exactly
  // once the server confirms. History, Thread, and Course events are untouched.
  useEffect(() => {
    if (submissionState === 'confirmed' && !reconciledRef.current) {
      reconciledRef.current = true;
      releaseAnchor(anchorId);
    }
  }, [submissionState, anchorId, releaseAnchor]);

  const stage: V2ReleaseStage = useMemo(() => {
    if (!started) return 'preflight';
    if (!dissolutionDone) return 'dissolving';
    if (submissionState === 'confirmed') return 'completed';
    if (submissionState === 'failed') return 'failed';
    return 'confirming';
  }, [started, dissolutionDone, submissionState]);

  return {
    snapshot,
    stage,
    message: result?.message ?? null,
    retryable: result?.retryable ?? false,
    result,
    anchorMissing: !anchor,
    startRelease,
    markDissolutionComplete,
    retry,
    reset,
  };
}
