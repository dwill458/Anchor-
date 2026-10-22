type VisualEvent =
  | 'gestureStart'
  | 'gestureRelease'
  | 'snapStart'
  | 'snapFinished'
  | 'selectedIndexCommit'
  | 'activeAnchorIdCommit'
  | 'todayContentChange'
  | 'heroArtworkChange'
  | 'detailsNavigationStart'
  | 'detailsScreenMounted'
  | 'detailsLayoutReady'
  | 'sharedTransitionStart'
  | 'sharedTransitionEnd'
  | 'detailsTransitionLaunch'
  | 'detailsNavigationDispatched'
  | 'detailsTransitionFinished'
  | 'overlayMounted'
  | 'overlayRemoved'
  | 'homeMounted'
  | 'screenTransition'
  | 'backRequested'
  | 'commit';

const timestamps = new Map<VisualEvent, number>();

export const VisualProfiler = {
  record(event: VisualEvent, extra?: Record<string, unknown>) {
    if (!__DEV__) return;
    const now = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
    const prev = timestamps.get(event);
    timestamps.set(event, now);

    let deltaMsg = '';
    if (event === 'snapFinished' && timestamps.has('gestureRelease')) {
      deltaMsg = ` (snap duration: ${(now - timestamps.get('gestureRelease')!).toFixed(1)}ms)`;
    } else if (event === 'selectedIndexCommit' && timestamps.has('snapFinished')) {
      deltaMsg = ` (snapFinished -> commit: ${(now - timestamps.get('snapFinished')!).toFixed(1)}ms)`;
    } else if (event === 'todayContentChange' && timestamps.has('selectedIndexCommit')) {
      deltaMsg = ` (commit -> todayContent: ${(now - timestamps.get('selectedIndexCommit')!).toFixed(1)}ms)`;
    } else if (event === 'detailsLayoutReady' && timestamps.has('detailsNavigationStart')) {
      deltaMsg = ` (navStart -> layoutReady: ${(now - timestamps.get('detailsNavigationStart')!).toFixed(1)}ms)`;
    }

    // eslint-disable-next-line no-console
    console.log(`[VisualProfiler] ${event}${deltaMsg}`, extra ?? '');
  },

  get(event: VisualEvent): number | undefined {
    return timestamps.get(event);
  },

  reset() {
    timestamps.clear();
  },
};
