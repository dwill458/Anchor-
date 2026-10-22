import React, { useEffect } from 'react';
import { runOnJS, useFrameCallback, useSharedValue } from 'react-native-reanimated';
import type { AnchorPoint } from '@/components/v2/anchor/anchorStructure';
import { EtchedStroke } from './EtchedStroke';
import { etchingSample, etchingStartedAt, registerEtchingCycle, acknowledgeEtchingCut } from './generationPerformance';

export function GenerationEtching({ points, size, color, requestId, running, reduceMotion }: {
  points: AnchorPoint[]; size: number; color: string; requestId?: string; running: boolean; reduceMotion: boolean;
}) {
  const progress = useSharedValue(reduceMotion ? 1 : 0);
  const start = useSharedValue(etchingStartedAt(requestId));
  const ready = useSharedValue(false);
  const frozen = useSharedValue(false);
  useEffect(() => {
    start.value = etchingStartedAt(requestId); ready.value = false; frozen.value = false;
    if (reduceMotion) progress.value = 1;
  }, [frozen, progress, ready, reduceMotion, requestId, start]);
  useEffect(() => {
    if (!requestId || !running || reduceMotion) return;
    return registerEtchingCycle(requestId, () => { ready.value = true; });
  }, [ready, reduceMotion, requestId, running]);
  const frame = useFrameCallback(() => {
    if (frozen.value) return;
    const sample = etchingSample(Date.now() - start.value);
    progress.value = sample.progress;
    if (ready.value && sample.finished) {
      progress.value = 1; frozen.value = true;
      runOnJS(acknowledgeEtchingCut)(requestId ?? '');
    }
  }, false);
  useEffect(() => { frame.setActive(running && !reduceMotion); return () => frame.setActive(false); }, [frame, reduceMotion, running]);
  return <EtchedStroke points={points} size={size} color={color} progress={progress} width={size * 0.01} />;
}
