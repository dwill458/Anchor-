import { useMemo, useState } from 'react';
import { useAnchorStore } from '@/stores/anchorStore';
import type { Anchor } from '@/types';

export type AnchorLibraryFilter = 'all' | 'active' | 'released';

export type AnchorLibraryEntry = {
  anchor: Anchor;
  released: boolean;
  isSelected: boolean;
};

/**
 * Read model for the standalone Your Anchors gallery. Uses real Anchor records
 * only. "Released" is derived from the existing local `isReleased` flag; no
 * release history is fabricated where the backend cannot yet supply it.
 */
export function useV2AnchorLibrary(): {
  filter: AnchorLibraryFilter;
  setFilter: (filter: AnchorLibraryFilter) => void;
  entries: AnchorLibraryEntry[];
  activeCount: number;
  releasedCount: number;
  hasReleased: boolean;
} {
  const anchors = useAnchorStore((s) => s.anchors);
  const currentAnchorId = useAnchorStore((s) => s.currentAnchorId);
  const [filter, setFilter] = useState<AnchorLibraryFilter>('all');

  return useMemo(() => {
    const decorated = anchors.map<AnchorLibraryEntry>((anchor) => ({
      anchor,
      released: Boolean(anchor.isReleased),
      isSelected:
        !anchor.isReleased &&
        (anchor.id === currentAnchorId || anchor.localId === currentAnchorId),
    }));

    const active = decorated.filter((e) => !e.released && !e.anchor.archivedAt);
    const released = decorated.filter((e) => e.released);

    const sortByRecency = (a: AnchorLibraryEntry, b: AnchorLibraryEntry) =>
      b.anchor.updatedAt.getTime() - a.anchor.updatedAt.getTime();
    active.sort(sortByRecency);
    released.sort(
      (a, b) =>
        (b.anchor.releasedAt?.getTime() ?? 0) - (a.anchor.releasedAt?.getTime() ?? 0),
    );

    const entries =
      filter === 'active' ? active : filter === 'released' ? released : [...active, ...released];

    return {
      filter,
      setFilter,
      entries,
      activeCount: active.length,
      releasedCount: released.length,
      hasReleased: released.length > 0,
    };
  }, [anchors, currentAnchorId, filter]);
}
