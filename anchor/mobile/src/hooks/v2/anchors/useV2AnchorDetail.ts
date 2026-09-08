import { useMemo } from 'react';
import { useAnchorStore } from '@/stores/anchorStore';
import { useSessionStore } from '@/stores/sessionStore';
import { STRUCTURE_SYSTEM_COPY, LETTER_REDUCTION_EXPLAINER } from '@/constants/v2/home';
import { toThreadPresentation, type V2ThreadPresentation } from '@/adapters/v2/home';
import type { Anchor } from '@/types';
import type { PracticeMode } from '@/types/practice';

export type V2RecentPracticeEntry = {
  id: string;
  mode: PracticeMode;
  label: string;
  completedAt: string;
  durationSeconds: number;
};

export type V2FormationProvenance = {
  originalIntention: string;
  distilledForm: string;
  reductionExplainer: string;
  structureName: string;
  structureQualities: string;
  structureDescription: string;
  structureRationale: string;
  category: string;
  createdAt: Date;
};

const MODE_LABEL: Record<PracticeMode, string> = {
  focus: 'Focus',
  deep_prime: 'Deep Prime',
  visualize: 'Visualize',
  release: 'Release',
};

export type V2AnchorDetailModel = {
  anchor: Anchor | null;
  thread: V2ThreadPresentation | null;
  isSelected: boolean;
  provenance: V2FormationProvenance | null;
  recentPractice: V2RecentPracticeEntry[];
  practiceCount: number;
};

/** Read model for the permanent Anchor profile. Real records only. */
export function useV2AnchorDetail(anchorId: string): V2AnchorDetailModel {
  const anchors = useAnchorStore((s) => s.anchors);
  const currentAnchorId = useAnchorStore((s) => s.currentAnchorId);
  const practiceHistory = useSessionStore((s) => s.practiceHistory);

  return useMemo(() => {
    const anchor =
      anchors.find((a) => a.id === anchorId || a.localId === anchorId) ?? null;
    if (!anchor) {
      return {
        anchor: null,
        thread: null,
        isSelected: false,
        provenance: null,
        recentPractice: [],
        practiceCount: 0,
      };
    }

    const structure = STRUCTURE_SYSTEM_COPY[anchor.structureVariant] ?? STRUCTURE_SYSTEM_COPY.balanced;
    const provenance: V2FormationProvenance = {
      originalIntention: anchor.intentionText,
      distilledForm: (anchor.distilledLetters ?? []).join(' '),
      reductionExplainer: LETTER_REDUCTION_EXPLAINER,
      structureName: structure.name,
      structureQualities: structure.qualities,
      structureDescription: structure.description,
      structureRationale: structure.rationale,
      category: anchor.category,
      createdAt: anchor.createdAt,
    };

    const sessions = practiceHistory
      .filter((s) => s.anchorId === anchor.id || s.anchorLocalId === (anchor.localId ?? anchor.id))
      .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());

    const recentPractice = sessions.slice(0, 3).map<V2RecentPracticeEntry>((s) => ({
      id: s.id,
      mode: s.practiceMode,
      label: MODE_LABEL[s.practiceMode] ?? s.practiceMode,
      completedAt: s.completedAt,
      durationSeconds: s.completedDurationSeconds,
    }));

    return {
      anchor,
      thread: toThreadPresentation(anchor),
      isSelected:
        anchor.id === currentAnchorId || anchor.localId === currentAnchorId,
      provenance,
      recentPractice,
      practiceCount: sessions.length,
    };
  }, [anchors, anchorId, currentAnchorId, practiceHistory]);
}
