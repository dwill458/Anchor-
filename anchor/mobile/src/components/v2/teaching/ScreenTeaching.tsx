import React, { useCallback, useRef } from 'react';
import { TEACHING_COPY, type BeatId } from '@/constants/v2/teachingCopy';
import { trackTeaching } from '@/utils/v2/teachingAnalytics';
import { SpotlightCoach, type TeachingStep } from './SpotlightCoach';
import { TeachingWhisper } from './TeachingWhisper';

export type TeachingTarget = Pick<TeachingStep, 'targetRef' | 'getRect'> & { title?: string; body?: string; accessibilityLabel?: string };
export function ScreenTeaching({ screen, queue, targets, reducedMotion }: {
  screen: string;
  queue: { steps: BeatId[]; ready: boolean; markShown: (beat?: BeatId) => void; dismiss: (beatsToCommit?: BeatId[]) => void };
  targets: Partial<Record<BeatId, TeachingTarget>>;
  reducedMotion: boolean;
}) {
  const active = useRef<BeatId | null>(null);
  const presented = useRef<{ beat: BeatId; step: number; total: number } | null>(null);
  const lastDismissed = useRef(false);
  const shown = useRef(new Set<BeatId>());
  const skipped = useRef(new Set<BeatId>());
  const previousBatch = useRef(queue.steps);
  if (previousBatch.current !== queue.steps) {
    previousBatch.current = queue.steps;
    shown.current.clear();
    skipped.current.clear();
  }
  const onReady = useCallback((beat: BeatId) => {
    active.current = beat;
    presented.current = { beat, step: queue.steps.indexOf(beat) + 1, total: queue.steps.length };
    lastDismissed.current = false;
    queue.markShown(beat);
    if (shown.current.has(beat)) return;
    shown.current.add(beat);
    trackTeaching('teaching_beat_shown', { screen, beat, step: queue.steps.indexOf(beat) + 1, total: queue.steps.length, reason: 'ready' });
  }, [queue.markShown, queue.steps, screen]);
  const onSkip = useCallback((beat: BeatId) => {
    skipped.current.add(beat);
  }, []);
  const onDismiss = useCallback((reason: string) => {
    lastDismissed.current = true;
    if (reason === 'unmeasurable') {
      if (active.current) {
        trackTeaching('teaching_beat_dismissed', { screen, beat: active.current, step: queue.steps.indexOf(active.current) + 1, total: queue.steps.length, reason });
      }
      queue.dismiss(Array.from(shown.current));
      return;
    }
    const beat = active.current ?? queue.steps[0];
    if (beat) trackTeaching('teaching_beat_dismissed', { screen, beat, step: queue.steps.indexOf(beat) + 1, total: queue.steps.length, reason });
    queue.dismiss(Array.from(shown.current));
  }, [queue.dismiss, queue.steps, screen]);
  React.useEffect(() => {
    if (queue.steps.length) return;
    if (presented.current && !lastDismissed.current) {
      trackTeaching('teaching_beat_dismissed', { screen, ...presented.current, reason: 'interrupted' });
    }
    presented.current = null;
    active.current = null;
  }, [queue.steps.length, screen]);
  React.useEffect(() => () => {
    if (presented.current && !lastDismissed.current) {
      trackTeaching('teaching_beat_dismissed', { screen, ...presented.current, reason: 'blur' });
    }
  }, [screen]);
  if (!queue.ready || !queue.steps.length) return null;
  if (queue.steps[0] === 'vision.first') return <WhisperBeat onReady={onReady} onDismiss={onDismiss} reducedMotion={reducedMotion} />;
  return <SpotlightCoach visible steps={queue.steps.map(id => ({ id, ...TEACHING_COPY.beats[id], ...targets[id] }))} reducedMotion={reducedMotion}
    onReady={onReady} onSkip={onSkip} onDismiss={onDismiss} onAdvance={beat => trackTeaching('teaching_beat_advanced', { screen, beat, step: queue.steps.indexOf(beat) + 1, total: queue.steps.length, reason: 'next' })} />;
}
function WhisperBeat({ onReady, onDismiss, reducedMotion }: { onReady: (beat: BeatId) => void; onDismiss: (reason: string) => void; reducedMotion: boolean }) {
  React.useEffect(() => { onReady('vision.first'); }, [onReady]);
  return <TeachingWhisper body={TEACHING_COPY.beats['vision.first'].body} reducedMotion={reducedMotion} onDismiss={onDismiss} />;
}
