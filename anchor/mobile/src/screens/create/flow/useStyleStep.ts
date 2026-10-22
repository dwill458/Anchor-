import { useCallback, useRef, useState } from 'react';

import { applyPickedStyle } from './creationStyles';

interface UseStyleStepOptions {
  defaultStyleId: string;
  initialChipIds: string[];
  /**
   * Start forming with this style. Return `false` if the request was refused (e.g. a sign-in or
   * paywall gate): the step then stays open so "Form it" can be pressed again.
   */
  onCommit: (styleId: string) => boolean | void;
  /** Fired when a style is picked (chip or sheet), for haptics and sound. */
  onSelect?: (styleId: string) => void;
}

export interface StyleStepState {
  chipIds: string[];
  selectedId: string;
  defaultId: string;
  sheetOpen: boolean;
  /** A non-default selection means a different generation, which takes a little longer. */
  showsLongerWait: boolean;
  select: (styleId: string) => void;
  openSheet: () => void;
  closeSheet: () => void;
  commit: () => void;
  reset: () => void;
}

/**
 * Behaviour of the Style beat, separate from how it looks:
 * - the default is pre-selected, and nothing happens until "Form it →" is pressed — there is no
 *   timer on a choice;
 * - picking from the sheet puts the style into the third chip, never over the default.
 */
export function useStyleStep({
  defaultStyleId,
  initialChipIds,
  onCommit,
  onSelect,
}: UseStyleStepOptions): StyleStepState {
  const [chipIds, setChipIds] = useState(initialChipIds);
  const [selectedId, setSelectedId] = useState(defaultStyleId);
  const [sheetOpen, setSheetOpen] = useState(false);

  const committedRef = useRef(false);
  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;
  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;

  const commit = useCallback(() => {
    if (committedRef.current) return;
    committedRef.current = true;
    const accepted = onCommitRef.current(selectedRef.current);
    if (accepted === false) committedRef.current = false;
  }, []);

  /** Back from a failed or abandoned Form: "Form it" works again. */
  const reset = useCallback(() => {
    committedRef.current = false;
  }, []);

  const select = useCallback(
    (styleId: string) => {
      setSelectedId(styleId);
      selectedRef.current = styleId;
      setChipIds((current) => applyPickedStyle(current, styleId));
      onSelect?.(styleId);
    },
    [onSelect]
  );

  const openSheet = useCallback(() => setSheetOpen(true), []);
  const closeSheet = useCallback(() => setSheetOpen(false), []);

  return {
    chipIds,
    selectedId,
    defaultId: defaultStyleId,
    sheetOpen,
    showsLongerWait: selectedId !== defaultStyleId,
    select,
    openSheet,
    closeSheet,
    commit,
    reset,
  };
}
