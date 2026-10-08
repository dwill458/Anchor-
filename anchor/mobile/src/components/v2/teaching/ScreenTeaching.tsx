import React, { useCallback, useRef } from 'react';
import { TEACHING_COPY, type BeatId } from '@/constants/v2/teachingCopy';
import { trackTeaching } from '@/utils/v2/teachingAnalytics';
import { SpotlightCoach, type TeachingStep } from './SpotlightCoach';
import { TeachingWhisper } from './TeachingWhisper';

export type TeachingTarget = Pick<TeachingStep, 'targetRef' | 'getRect'>;
export function ScreenTeaching({ screen, queue, targets, reducedMotion }: {
  screen: string;
  queue: { steps: BeatId[]; ready: boolean; markShown: () => void; dismiss: () => void };
  targets: Partial<Record<BeatId, TeachingTarget>>;
  reducedMotion: boolean;
}) {
  const active = useRef<BeatId | null>(null);
  const shown = useRef(new Set<BeatId>());
  const previousBatch = useRef(queue.steps);
  if (previousBatch.current !== queue.steps) { previousBatch.current = queue.steps; shown.current.clear(); }
  const onReady = useCallback((beat: BeatId) => {
    active.current = beat;
    queue.markShown();
    if (shown.current.has(beat)) return;
    shown.current.add(beat);
    trackTeaching('teaching_beat_shown', { screen, beat, step: queue.steps.indexOf(beat) + 1, total: queue.steps.length, reason: 'ready' });
  }, [queue.markShown, queue.steps, screen]);
  const onDismiss = useCallback((reason: string) => {
    const beat = active.current ?? queue.steps[0];
    if (beat) trackTeaching('teaching_beat_dismissed', { screen, beat, step: queue.steps.indexOf(beat) + 1, total: queue.steps.length, reason });
    queue.dismiss();
  }, [queue.dismiss, queue.steps, screen]);
  if (!queue.ready || !queue.steps.length) return null;
  if (queue.steps[0] === 'vision.first') return <WhisperBeat onReady={onReady} onDismiss={onDismiss} reducedMotion={reducedMotion} />;
  return <SpotlightCoach visible steps={queue.steps.map(id => ({ id, ...TEACHING_COPY.beats[id], ...targets[id] }))} reducedMotion={reducedMotion}
    onReady={onReady} onDismiss={onDismiss} onAdvance={beat => trackTeaching('teaching_beat_advanced', { screen, beat, step: queue.steps.indexOf(beat) + 1, total: queue.steps.length, reason: 'next' })} />;
}
function WhisperBeat({ onReady, onDismiss, reducedMotion }: { onReady: (beat: BeatId) => void; onDismiss: (reason: string) => void; reducedMotion: boolean }) {
  React.useEffect(() => { onReady('vision.first'); }, [onReady]);
  return <TeachingWhisper body={TEACHING_COPY.beats['vision.first'].body} reducedMotion={reducedMotion} onDismiss={onDismiss} />;
}
