import { useCallback, useMemo } from 'react';
import { useAnchorStore } from '@/stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';
import type { Anchor } from '@/types';

/**
 * V2 selected-Anchor access. There is deliberately ONE selection authority:
 * the existing `anchorStore.currentAnchorId`. This hook adapts it for Home and
 * falls back to the most recently updated active Anchor when the stored
 * selection is missing or points at a released/removed Anchor. Selecting an
 * Anchor writes straight back to the shared store — no parallel V2 selection
 * state is introduced.
 */
export function useV2SelectedAnchor(): {
  selectedAnchor: Anchor | null;
  activeAnchors: Anchor[];
  selectAnchor: (anchorId: string) => void;
} {
  const anchors = useAnchorStore((s) => s.anchors);
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const currentAnchorId = useAnchorStore((s) => s.currentAnchorId);
  const setCurrentAnchor = useAnchorStore((s) => s.setCurrentAnchor);

  const activeAnchors = useMemo(
    () => userId
      ? anchors.filter((anchor) => anchor.userId === userId && !anchor.isReleased && !anchor.archivedAt)
      : [],
    [anchors, userId],
  );

  const selectedAnchor = useMemo(() => {
    if (activeAnchors.length === 0) return null;
    const stored = currentAnchorId
      ? activeAnchors.find((a) => a.id === currentAnchorId || a.localId === currentAnchorId)
      : undefined;
    return stored ?? activeAnchors[0];
  }, [activeAnchors, currentAnchorId]);

  const selectAnchor = useCallback(
    (anchorId: string) => {
      setCurrentAnchor(anchorId);
    },
    [setCurrentAnchor],
  );

  return { selectedAnchor, activeAnchors, selectAnchor };
}
