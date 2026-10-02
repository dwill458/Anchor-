import { useCallback, useEffect, useRef, useState } from 'react';

import { applyPickedStyle } from './creationStyles';

/** The scene fades in over ~0.6 s; the countdown starts once it is 90% there. */
export const STYLE_COUNTDOWN_DELAY_MS = 540;
const TICK_MS = 100;

interface UseStyleStepOptions {
  defaultStyleId: string;
  initialChipIds: string[];
  /** Auto-commit countdown in seconds (4.0 first anchor, 2.2 repeat). */
  countdownSeconds: number;
  /** False while another phase owns the screen; the countdown only runs when active. */
  active: boolean;
  /**
   * Start forming with this style. Return `false` if the request was refused (e.g. a sign-in or
   * paywall gate): the step then stays open and shows the "Form it" pill so it can be retried.
   */
  onCommit: (styleId: string) => boolean | void;
  /** Fired when a style is picked (chip or sheet), for haptics. */
  onSelect?: (styleId: string) => void;
}

export interface StyleStepState {
  chipIds: string[];
  selectedId: string;
  defaultId: string;
  /** Any touch ends the auto-commit for this visit, permanently. */
  touched: boolean;
  /** Whole seconds left, rounded up (the "Forms in N…" label), or null once touched. */
  secondsLeft: number | null;
  /** 0..1 of the countdown that remains (drives the hairline). */
  remainingFraction: number;
  sheetOpen: boolean;
  /** A non-default selection means a different generation, which takes a little longer. */
  showsLongerWait: boolean;
  markTouched: () => void;
  select: (styleId: string) => void;
  openSheet: () => void;
  closeSheet: () => void;
  commit: () => void;
}

/**
 * Behaviour of the Style beat, separate from how it looks:
 * - the default is pre-selected and, untouched, commits itself when the countdown ends;
 * - any touch anywhere stops that for good and reveals the "Form it" pill;
 * - picking from the sheet puts the style into the third chip, never over the default.
 */
export function useStyleStep({
  defaultStyleId,
  initialChipIds,
  countdownSeconds,
  active,
  onCommit,
  onSelect,
}: UseStyleStepOptions): StyleStepState {
  const [chipIds, setChipIds] = useState(initialChipIds);
  const [selectedId, setSelectedId] = useState(defaultStyleId);
  const [touched, setTouched] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
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
    if (accepted === false) {
      committedRef.current = false;
      setTouched(true);
    }
  }, []);

  // Countdown: runs only while active and untouched.
  useEffect(() => {
    if (!active || touched || committedRef.current) return undefined;

    const startedAt = Date.now() + STYLE_COUNTDOWN_DELAY_MS;
    const total = countdownSeconds * 1000;
    const timer = setInterval(() => {
      const elapsed = Math.max(0, Date.now() - startedAt);
      setElapsedMs(Math.min(total, elapsed));
      if (elapsed >= total) {
        clearInterval(timer);
        commit();
      }
    }, TICK_MS);

    return () => clearInterval(timer);
  }, [active, touched, countdownSeconds, commit]);

  const markTouched = useCallback(() => setTouched(true), []);

  const select = useCallback(
    (styleId: string) => {
      setTouched(true);
      setSelectedId(styleId);
      selectedRef.current = styleId;
      setChipIds((current) => applyPickedStyle(current, styleId));
      onSelect?.(styleId);
    },
    [onSelect]
  );

  const openSheet = useCallback(() => {
    setTouched(true);
    setSheetOpen(true);
  }, []);
  const closeSheet = useCallback(() => setSheetOpen(false), []);

  const total = countdownSeconds * 1000;
  const remainingMs = Math.max(0, total - elapsedMs);

  return {
    chipIds,
    selectedId,
    defaultId: defaultStyleId,
    touched,
    secondsLeft: touched ? null : Math.max(1, Math.ceil(remainingMs / 1000)),
    remainingFraction: touched ? 0 : total > 0 ? remainingMs / total : 0,
    sheetOpen,
    showsLongerWait: touched && selectedId !== defaultStyleId,
    markTouched,
    select,
    openSheet,
    closeSheet,
    commit,
  };
}
