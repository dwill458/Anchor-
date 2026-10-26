import { useCallback, useMemo } from 'react';
import type { BeatId } from '@/constants/v2/teachingCopy';
import { guidanceForBeat } from '@/constants/v2/guidanceRegistry';
import { useGuidanceHost } from '@/hooks/v2/guidance/useGuidanceHost';

type Options = { screenId: string; accountId: string | null; eligible: BeatId[]; cap: number; blocked: boolean; isFocused: boolean; contextKey?: string };
/** Existing features retain eligibility and visuals; ownership is app-wide. */
export function useTeachingQueue(options: Options) {
  const host = useGuidanceHost({ ...options, eligible: options.eligible.flatMap(beat => {
    const def = guidanceForBeat(beat); return def ? [def.id] : [];
  }) });
  const id = host.presentation?.id;
  const steps = useMemo(() => id ? options.eligible.filter(beat => guidanceForBeat(beat)?.id === id).slice(0, 1) : [], [id, options.eligible.join('|')]);
  const dismiss = useCallback((_beats?: BeatId[], reason?: string) => host.dismiss(reason), [host.dismiss]);
  return { steps, ready: Boolean(host.presentation), markShown: host.markShown, markHidden: host.markHidden, dismiss };
}
