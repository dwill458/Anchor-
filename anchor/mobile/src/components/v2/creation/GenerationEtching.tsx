import React, { useEffect } from 'react';
import { useFrameCallback, useSharedValue } from 'react-native-reanimated';
import type { AnchorPoint } from '@/components/v2/anchor/anchorStructure';
import { EtchedStroke } from './EtchedStroke';
import { ETCHING, etchingStartedAt } from './generationPerformance';

export function GenerationEtching({ points, size, color, requestId, running, reduceMotion }: {
  points: AnchorPoint[]; size: number; color: string; requestId?: string; running: boolean; reduceMotion: boolean;
}) {
  const progress = useSharedValue(reduceMotion ? 1 : 0);
  const start = useSharedValue(etchingStartedAt(requestId));
  useEffect(() => { start.value = etchingStartedAt(requestId); if (reduceMotion) progress.value = 1; }, [progress, reduceMotion, requestId, start]);
  const frame = useFrameCallback(() => {
    const elapsed = Date.now() - start.value - ETCHING.entrance;
    const phase = Math.max(0, elapsed) % ETCHING.cycle;
    const t = Math.min(1, phase / ETCHING.draw);
    progress.value = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }, false);
  useEffect(() => { frame.setActive(running && !reduceMotion); return () => frame.setActive(false); }, [frame, reduceMotion, running]);
  return <EtchedStroke points={points} size={size} color={color} progress={progress} width={size * 0.01} />;
}
