import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, within } from '@testing-library/react-native';
import type { V2ReleaseAdapter, V2ReleaseResult } from '@/adapters/v2/release';

const mockReleaseAnchor = jest.fn();
const mockLinkEvolvedFrom = jest.fn();
const mockAnchorStoreState: { anchors: Array<Record<string, unknown>>; releaseAnchor: jest.Mock; linkEvolvedFrom: jest.Mock } = {
  anchors: [],
  releaseAnchor: mockReleaseAnchor,
  linkEvolvedFrom: mockLinkEvolvedFrom,
};
const mockCourseStoreState: { activeCourse: unknown } = { activeCourse: null };
const mockReduceMotion = jest.fn(() => false);

jest.mock('@/services/CreationSounds', () => ({ playCreationSound: () => ({ stop: jest.fn() }) }));
jest.mock('@/stores/anchorStore', () => ({
  useAnchorStore: (selector: (s: unknown) => unknown) => selector(mockAnchorStoreState),
}));
jest.mock('@/stores/courseStore', () => ({
  useCourseStore: (selector: (s: unknown) => unknown) => selector(mockCourseStoreState),
}));
const OPEN_ENTITLEMENTS = {
  canCreateAnchor: true, anchorCreationLimitReason: null, entitlementReady: true,
  anchorsCreatedToday: 1, anchorsCreatedDuringTrial: 0, tier: 'pro',
};
let mockEntitlements: Record<string, unknown> = OPEN_ENTITLEMENTS;
jest.mock('@/hooks/useEntitlements', () => ({ useEntitlements: () => mockEntitlements }));
const mockTrack = jest.fn();
jest.mock('@/services/AnalyticsService', () => ({ AnalyticsService: { track: (...args: unknown[]) => mockTrack(...args) } }));
jest.mock('@/hooks/v2', () => ({
  useV2ReduceMotion: () => mockReduceMotion(),
  useCreationReduceMotion: () => mockReduceMotion(),
  v2Haptics: { selection: jest.fn(), completion: jest.fn(), confirmation: jest.fn(), warning: jest.fn(), destructiveCommit: jest.fn() },
}));

// eslint-disable-next-line import/first
import { V2ReleaseScreen } from '../V2ReleaseScreen';
import { RELEASE_COPY, RELEASE_ENDINGS, RELEASE_EVOLVE_COPY, RELEASE_SUCCESSOR_LINK_NOTE } from '@/constants/v2/release';
import { useEvolveSessionStore } from '@/stores/v2/evolveSessionStore';
import { useCelebrationStore } from '@/stores/v2/celebrationStore';
import { Skia } from '@shopify/react-native-skia';

const BANNED = /sigil|ritual|charge|spell|streak|attract|mindfulness|meditation|vision board|occult|prime/i;

const oldAnchor = {
  id: 'anchor-1', localId: 'anchor-1', intentionText: 'Publish my novel', category: 'creativity',
  baseSigilSvg: '<svg />', reinforcedSigilSvg: null,
};
const newAnchor = {
  id: 'anchor-2', localId: 'anchor-2', intentionText: 'Finish my novel this year', category: 'creativity',
  baseSigilSvg: '<svg />', reinforcedSigilSvg: null,
};
const successor = { anchorId: 'anchor-2', intentionText: 'Finish my novel this year' };

function fakeAdapter(result: V2ReleaseResult = { status: 'released', anchorId: 'anchor-1', lifecycleState: 'released' }): V2ReleaseAdapter {
  return { submitRelease: jest.fn(async () => result) };
}
const flush = () => act(async () => { await Promise.resolve(); });
const noop = { onReleaseCompleted: jest.fn(), onCancel: jest.fn() };

async function holdToRelease(view: ReturnType<typeof render>) {
  act(() => fireEvent(view.getByTestId('v2-hold-to-release-target'), 'pressIn'));
  act(() => jest.advanceTimersByTime(1850));
  await flush();
}

describe('V2ReleaseScreen: Evolve at Release', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    useCelebrationStore.getState().reset();
    useEvolveSessionStore.getState().clear();
    mockReleaseAnchor.mockClear();
    mockLinkEvolvedFrom.mockClear();
    mockTrack.mockClear();
    mockEntitlements = OPEN_ENTITLEMENTS;
    mockReduceMotion.mockReturnValue(false);
    mockAnchorStoreState.anchors = [oldAnchor];
    mockCourseStoreState.activeCourse = null;
    noop.onReleaseCompleted.mockClear();
    noop.onCancel.mockClear();
    Object.defineProperty(Skia.Data, 'fromURI', { configurable: true, value: jest.fn().mockResolvedValue({}) });
    Object.defineProperty(Skia.Image, 'MakeImageFromEncoded', {
      configurable: true, value: jest.fn(() => ({ width: () => 132, height: () => 132 })),
    });
  });
  afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });

  describe('when the choice is asked', () => {
    it.each([
      ['no reason (manual)', undefined],
      ['a free string from another screen', 'practice_prepare'],
      ['no_longer_aligned', 'no_longer_aligned'],
      ['evolve', 'evolve'],
    ])('is shown for %s', (_label, reason) => {
      const view = render(<V2ReleaseScreen anchorId="anchor-1" reason={reason} releaseAdapter={fakeAdapter()} {...noop} />);
      expect(view.getByTestId('v2-release-choice')).toBeTruthy();
      expect(view.getByText(RELEASE_EVOLVE_COPY.releaseLabel)).toBeTruthy();
      expect(view.getByText(RELEASE_EVOLVE_COPY.evolveLabel)).toBeTruthy();
    });

    it.each(['outcome_completed', 'waypoint_completed', 'destination_completed'])('is not shown when the reason is already %s', (reason) => {
      const view = render(<V2ReleaseScreen anchorId="anchor-1" reason={reason} releaseAdapter={fakeAdapter()} {...noop} />);
      expect(view.queryByTestId('v2-release-choice')).toBeNull();
      expect(view.queryByText(RELEASE_EVOLVE_COPY.evolveLabel)).toBeNull();
    });

    it('selects "Release it" by default and keeps the standard hold hint', () => {
      const view = render(<V2ReleaseScreen anchorId="anchor-1" releaseAdapter={fakeAdapter()} {...noop} />);
      expect(view.getByTestId('v2-release-choice-release').props.accessibilityState.selected).toBe(true);
      expect(view.getByTestId('v2-release-choice-evolve').props.accessibilityState.selected).toBe(false);
      expect(view.getByTestId('v2-hold-to-release-target').props.accessibilityHint).toBe(RELEASE_COPY.holdHint);
    });
  });

  describe('choosing Evolve it with nothing attached', () => {
    it('opens creation with the old intention and releases nothing', () => {
      const adapter = fakeAdapter();
      const onBeginEvolve = jest.fn();
      const view = render(<V2ReleaseScreen anchorId="anchor-1" releaseAdapter={adapter} onBeginEvolve={onBeginEvolve} {...noop} />);
      fireEvent.press(view.getByTestId('v2-release-choice-evolve'));

      expect(onBeginEvolve).toHaveBeenCalledWith({ anchorId: 'anchor-1', intentionText: 'Publish my novel' });
      expect(useEvolveSessionStore.getState().pending).toEqual({ fromAnchorId: 'anchor-1', fromIntention: 'Publish my novel' });
      expect(useEvolveSessionStore.getState().successor).toBeNull();
      expect(adapter.submitRelease).not.toHaveBeenCalled();
      expect(mockReleaseAnchor).not.toHaveBeenCalled();
      expect(noop.onCancel).not.toHaveBeenCalled();
    });

    it('cancelling creation clears the pending state, attaches nothing and leaves Release as it was', () => {
      const adapter = fakeAdapter();
      const element = (focused: boolean) => (
        <V2ReleaseScreen anchorId="anchor-1" releaseAdapter={adapter} onBeginEvolve={jest.fn()} focused={focused} {...noop} />
      );
      const view = render(element(true));
      fireEvent.press(view.getByTestId('v2-release-choice-evolve'));
      expect(useEvolveSessionStore.getState().pending).not.toBeNull();

      // Creation covers Release, then is backed out of: Release is focused again with no new params.
      view.rerender(element(false));
      expect(useEvolveSessionStore.getState().pending).not.toBeNull();
      view.rerender(element(true));

      expect(useEvolveSessionStore.getState().pending).toBeNull();
      expect(useEvolveSessionStore.getState().successor).toBeNull();
      expect(view.getByTestId('v2-release-choice-release').props.accessibilityState.selected).toBe(true);
      expect(view.queryByTestId('v2-release-evolving-into')).toBeNull();
      expect(view.getByTestId('v2-hold-to-release-target').props.accessibilityHint).toBe(RELEASE_COPY.holdHint);
      expect(adapter.submitRelease).not.toHaveBeenCalled();
      expect(mockReleaseAnchor).not.toHaveBeenCalled();
      expect(mockAnchorStoreState.anchors).toEqual([oldAnchor]);
    });

    it('cannot be triggered mid-hold', () => {
      const onBeginEvolve = jest.fn();
      const view = render(<V2ReleaseScreen anchorId="anchor-1" releaseAdapter={fakeAdapter()} onBeginEvolve={onBeginEvolve} {...noop} />);
      act(() => fireEvent(view.getByTestId('v2-hold-to-release-target'), 'pressIn'));
      act(() => jest.advanceTimersByTime(400));
      fireEvent.press(view.getByTestId('v2-release-choice-evolve'));
      expect(onBeginEvolve).not.toHaveBeenCalled();
    });
  });

  describe('Evolve is a paid path: the paywall appears on the choice', () => {
    const FREE_LOCKED = { ...OPEN_ENTITLEMENTS, canCreateAnchor: false, anchorCreationLimitReason: 'create_anchor_free_locked', tier: 'free' };
    const DAILY_CAP = { ...OPEN_ENTITLEMENTS, canCreateAnchor: false, anchorCreationLimitReason: 'pro_daily_anchor_cap_reached' };
    const NOT_READY = { ...OPEN_ENTITLEMENTS, canCreateAnchor: false, anchorCreationLimitReason: null, entitlementReady: false };

    it('a free user choosing Evolve it goes to the Paywall with the gate params; no session, no creation, nothing released', () => {
      mockEntitlements = FREE_LOCKED;
      const adapter = fakeAdapter();
      const onBeginEvolve = jest.fn();
      const onCreateSuccessor = jest.fn();
      const onEvolvePaywall = jest.fn();
      const view = render(<V2ReleaseScreen anchorId="anchor-1" releaseAdapter={adapter} onBeginEvolve={onBeginEvolve}
        onCreateSuccessor={onCreateSuccessor} onEvolvePaywall={onEvolvePaywall} {...noop} />);
      fireEvent.press(view.getByTestId('v2-release-choice-evolve'));

      expect(onEvolvePaywall).toHaveBeenCalledTimes(1);
      expect(onEvolvePaywall).toHaveBeenCalledWith({ source: 'create_anchor_free_locked', preferredPlanId: 'annual' });
      expect(onBeginEvolve).not.toHaveBeenCalled();
      expect(onCreateSuccessor).not.toHaveBeenCalled();
      expect(useEvolveSessionStore.getState().pending).toBeNull();
      expect(useEvolveSessionStore.getState().successor).toBeNull();
      expect(adapter.submitRelease).not.toHaveBeenCalled();
      expect(mockReleaseAnchor).not.toHaveBeenCalled();
      expect(noop.onCancel).not.toHaveBeenCalled();
      // The choice stays on Release it, so coming back from the Paywall leaves Release as it was.
      expect(view.getByTestId('v2-release-choice-release').props.accessibilityState.selected).toBe(true);
      expect(mockTrack).toHaveBeenCalledWith('create_anchor_free_locked', expect.objectContaining({ source: 'release_evolve', tier: 'free' }));
    });

    it('the missing-successor button is gated the same way', () => {
      mockEntitlements = FREE_LOCKED;
      const onBeginEvolve = jest.fn();
      const onEvolvePaywall = jest.fn();
      const view = render(<V2ReleaseScreen anchorId="anchor-1" reason="evolve" releaseAdapter={fakeAdapter()}
        onBeginEvolve={onBeginEvolve} onEvolvePaywall={onEvolvePaywall} {...noop} />);
      fireEvent.press(view.getByTestId('v2-release-create-successor'));
      expect(onEvolvePaywall).toHaveBeenCalledWith({ source: 'create_anchor_free_locked', preferredPlanId: 'annual' });
      expect(onBeginEvolve).not.toHaveBeenCalled();
      expect(useEvolveSessionStore.getState().pending).toBeNull();
    });

    it('the Pro daily cap keeps its alert path and does not open the Paywall', () => {
      mockEntitlements = DAILY_CAP;
      const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
      const onBeginEvolve = jest.fn();
      const onEvolvePaywall = jest.fn();
      const view = render(<V2ReleaseScreen anchorId="anchor-1" releaseAdapter={fakeAdapter()} onBeginEvolve={onBeginEvolve}
        onEvolvePaywall={onEvolvePaywall} {...noop} />);
      fireEvent.press(view.getByTestId('v2-release-choice-evolve'));
      expect(alert).toHaveBeenCalledTimes(1);
      expect(alert.mock.calls[0][0]).toBe('Daily creation limit reached');
      expect(onEvolvePaywall).not.toHaveBeenCalled();
      expect(onBeginEvolve).not.toHaveBeenCalled();
      expect(useEvolveSessionStore.getState().pending).toBeNull();
      alert.mockRestore();
    });

    it('an entitlement that has not settled begins nothing, like the creation gate', () => {
      mockEntitlements = NOT_READY;
      const onBeginEvolve = jest.fn();
      const onEvolvePaywall = jest.fn();
      const view = render(<V2ReleaseScreen anchorId="anchor-1" releaseAdapter={fakeAdapter()} onBeginEvolve={onBeginEvolve}
        onEvolvePaywall={onEvolvePaywall} {...noop} />);
      fireEvent.press(view.getByTestId('v2-release-choice-evolve'));
      expect(onEvolvePaywall).not.toHaveBeenCalled();
      expect(onBeginEvolve).not.toHaveBeenCalled();
      expect(useEvolveSessionStore.getState().pending).toBeNull();
    });

    it('an entitled user proceeds exactly as before: session begun, creation opened, no Paywall', () => {
      mockEntitlements = OPEN_ENTITLEMENTS;
      const onBeginEvolve = jest.fn();
      const onEvolvePaywall = jest.fn();
      const view = render(<V2ReleaseScreen anchorId="anchor-1" releaseAdapter={fakeAdapter()} onBeginEvolve={onBeginEvolve}
        onEvolvePaywall={onEvolvePaywall} {...noop} />);
      fireEvent.press(view.getByTestId('v2-release-choice-evolve'));
      expect(onBeginEvolve).toHaveBeenCalledWith({ anchorId: 'anchor-1', intentionText: 'Publish my novel' });
      expect(useEvolveSessionStore.getState().pending).toEqual({ fromAnchorId: 'anchor-1', fromIntention: 'Publish my novel' });
      expect(onEvolvePaywall).not.toHaveBeenCalled();
      expect(mockTrack).not.toHaveBeenCalled();
    });

    it('choosing Release it never asks the gate, whatever the entitlement', async () => {
      mockEntitlements = FREE_LOCKED;
      mockReduceMotion.mockReturnValue(true);
      const adapter = fakeAdapter();
      const onEvolvePaywall = jest.fn();
      const view = render(<V2ReleaseScreen anchorId="anchor-1" releaseAdapter={adapter} onEvolvePaywall={onEvolvePaywall} {...noop} />);
      await holdToRelease(view);
      expect(adapter.submitRelease).toHaveBeenCalledTimes(1);
      expect(onEvolvePaywall).not.toHaveBeenCalled();
    });
  });

  describe('a sealed successor is attached', () => {
    const attached = (extra: Partial<React.ComponentProps<typeof V2ReleaseScreen>> = {}) => (
      <V2ReleaseScreen anchorId="anchor-1" reason="evolve" successor={successor} releaseAdapter={fakeAdapter()} {...noop} {...extra} />
    );
    beforeEach(() => { mockAnchorStoreState.anchors = [oldAnchor, newAnchor]; });

    it('shows "Evolving into" the real Anchor, the successor row and the evolve hold hint', () => {
      const view = render(attached());
      expect(view.getByTestId('v2-release-choice-evolve').props.accessibilityState.selected).toBe(true);
      expect(view.getByTestId('v2-release-evolving-into').props.children).toBe(`${RELEASE_EVOLVE_COPY.evolvingInto} “Finish my novel this year”`);
      expect(view.getByTestId('v2-release-consequence-successor')).toBeTruthy();
      expect(view.getByTestId('v2-hold-to-release-target').props.accessibilityHint).toBe(RELEASE_COPY.holdHintEvolve);
      expect(view.queryByTestId('v2-release-successor-missing')).toBeNull();
    });

    it('picks the attached successor up when the route re-reads its params after creation', () => {
      const adapter = fakeAdapter();
      const view = render(<V2ReleaseScreen anchorId="anchor-1" releaseAdapter={adapter} {...noop} />);
      expect(view.getByTestId('v2-release-choice-release').props.accessibilityState.selected).toBe(true);
      view.rerender(<V2ReleaseScreen anchorId="anchor-1" reason="evolve" successor={successor} releaseAdapter={adapter} {...noop} />);
      expect(view.getByTestId('v2-release-choice-evolve').props.accessibilityState.selected).toBe(true);
      expect(view.getByTestId('v2-release-evolving-into')).toBeTruthy();
    });

    it('also works from the evolve session alone', () => {
      useEvolveSessionStore.getState().attach(successor);
      const view = render(<V2ReleaseScreen anchorId="anchor-1" releaseAdapter={fakeAdapter()} {...noop} />);
      expect(view.getByTestId('v2-release-choice-evolve').props.accessibilityState.selected).toBe(true);
      expect(view.getByTestId('v2-release-evolving-into')).toBeTruthy();
    });

    it('choosing Evolve again shows the line without reopening creation', () => {
      const onBeginEvolve = jest.fn();
      const view = render(attached({ onBeginEvolve }));
      fireEvent.press(view.getByTestId('v2-release-choice-release'));
      expect(view.queryByTestId('v2-release-evolving-into')).toBeNull();
      fireEvent.press(view.getByTestId('v2-release-choice-evolve'));
      expect(view.getByTestId('v2-release-evolving-into')).toBeTruthy();
      expect(onBeginEvolve).not.toHaveBeenCalled();
    });

    it('releases only after the hold: the real successor reaches the release, with reason evolve', async () => {
      mockReduceMotion.mockReturnValue(true);
      const adapter = fakeAdapter();
      const view = render(attached({ releaseAdapter: adapter }));
      // Attached, but nothing is released or linked before the hold completes.
      expect(adapter.submitRelease).not.toHaveBeenCalled();
      expect(mockReleaseAnchor).not.toHaveBeenCalled();
      expect(mockLinkEvolvedFrom).not.toHaveBeenCalled();

      await holdToRelease(view);
      expect(adapter.submitRelease).toHaveBeenCalledTimes(1);
      expect(adapter.submitRelease).toHaveBeenCalledWith(expect.objectContaining({ anchorId: 'anchor-1', reason: 'evolve' }));

      act(() => jest.advanceTimersByTime(1000));
      await flush();
      await flush();
      expect(view.getByTestId('v2-release-completion')).toBeTruthy();
      expect(mockReleaseAnchor).toHaveBeenCalledWith('anchor-1');
      expect(mockReleaseAnchor).not.toHaveBeenCalledWith('anchor-2');
      // The link is recorded once, on the successor, when the release completes.
      expect(mockLinkEvolvedFrom).toHaveBeenCalledTimes(1);
      expect(mockLinkEvolvedFrom).toHaveBeenCalledWith('anchor-2', { anchorId: 'anchor-1', intention: 'Publish my novel' });
      // The existing Evolved ending, unchanged: its successor and the link note.
      expect(view.getByText(`“${successor.intentionText}”`, { includeHiddenElements: true })).toBeTruthy();
      expect(view.getByText(RELEASE_SUCCESSOR_LINK_NOTE, { includeHiddenElements: true })).toBeTruthy();
    });

    it('"Release it" with a successor attached is a plain manual release', async () => {
      mockReduceMotion.mockReturnValue(true);
      const adapter = fakeAdapter();
      const view = render(attached({ releaseAdapter: adapter }));
      fireEvent.press(view.getByTestId('v2-release-choice-release'));
      await holdToRelease(view);
      expect(adapter.submitRelease).toHaveBeenCalledWith(expect.objectContaining({ reason: 'no_longer_aligned' }));
      expect(mockLinkEvolvedFrom).not.toHaveBeenCalled();
    });

    it('the Evolved ending keeps its Continue with new Anchor behaviour', async () => {
      mockReduceMotion.mockReturnValue(true);
      const onContinueWithSuccessor = jest.fn();
      const view = render(attached({ onContinueWithSuccessor }));
      await holdToRelease(view);
      act(() => jest.advanceTimersByTime(1000));
      await flush();
      await flush();
      act(() => jest.advanceTimersByTime(300));
      fireEvent.press(view.getByTestId('v2-release-completion-primary'));
      // The released Anchor's artwork travels with it, from the release snapshot, for the Evolved arrival's ghost.
      expect(onContinueWithSuccessor).toHaveBeenCalledWith('anchor-2', { svg: '<svg />', imageUrl: undefined, category: 'creativity', expression: undefined });
      // Taken once: the ending is leaving, so a second tap starts nothing more.
      fireEvent.press(view.getByTestId('v2-release-completion-primary', { includeHiddenElements: true }));
      expect(onContinueWithSuccessor).toHaveBeenCalledTimes(1);
    });
  });

  describe('safeguards that stay in force', () => {
    it('a successor that does not exist as an Anchor cannot start a release', () => {
      mockAnchorStoreState.anchors = [oldAnchor];
      const adapter = fakeAdapter();
      const view = render(<V2ReleaseScreen anchorId="anchor-1" reason="evolve" successor={successor} releaseAdapter={adapter} {...noop} />);
      expect(view.getByTestId('v2-release-successor-missing')).toBeTruthy();
      expect(view.queryByTestId('v2-hold-to-release-target')).toBeNull();
      expect(adapter.submitRelease).not.toHaveBeenCalled();
    });

    it('the Anchor itself cannot be its own successor', () => {
      const view = render(<V2ReleaseScreen anchorId="anchor-1" reason="evolve"
        successor={{ anchorId: 'anchor-1', intentionText: 'Publish my novel' }} releaseAdapter={fakeAdapter()} {...noop} />);
      expect(view.getByTestId('v2-release-successor-missing')).toBeTruthy();
    });

    it('the missing-successor button opens creation through the same evolve path', () => {
      const onBeginEvolve = jest.fn();
      const view = render(<V2ReleaseScreen anchorId="anchor-1" reason="evolve" releaseAdapter={fakeAdapter()} onBeginEvolve={onBeginEvolve} {...noop} />);
      fireEvent.press(view.getByTestId('v2-release-create-successor'));
      expect(onBeginEvolve).toHaveBeenCalledWith({ anchorId: 'anchor-1', intentionText: 'Publish my novel' });
      expect(useEvolveSessionStore.getState().pending).not.toBeNull();
    });

    it('leaving Release ends the session and deletes nothing (two active Anchors remain)', () => {
      mockAnchorStoreState.anchors = [oldAnchor, newAnchor];
      const view = render(<V2ReleaseScreen anchorId="anchor-1" reason="evolve" successor={successor} releaseAdapter={fakeAdapter()} {...noop} />);
      fireEvent.press(view.getByTestId('v2-release-keep-active'));
      expect(noop.onCancel).toHaveBeenCalledTimes(1);
      view.unmount();
      expect(useEvolveSessionStore.getState().pending).toBeNull();
      expect(useEvolveSessionStore.getState().successor).toBeNull();
      expect(mockAnchorStoreState.anchors).toEqual([oldAnchor, newAnchor]);
      expect(mockReleaseAnchor).not.toHaveBeenCalled();
    });
  });

  describe('copy', () => {
    it('every string the choice shows comes from RELEASE_EVOLVE_COPY', () => {
      mockAnchorStoreState.anchors = [oldAnchor, newAnchor];
      const view = render(<V2ReleaseScreen anchorId="anchor-1" reason="evolve" successor={successor} releaseAdapter={fakeAdapter()} {...noop} />);
      const allowed = new Set<string>([
        RELEASE_EVOLVE_COPY.releaseLabel, RELEASE_EVOLVE_COPY.releaseDescriptor,
        RELEASE_EVOLVE_COPY.evolveLabel, RELEASE_EVOLVE_COPY.evolveDescriptor,
        `${RELEASE_EVOLVE_COPY.evolvingInto} “${successor.intentionText}”`,
      ]);
      const shown = within(view.getByTestId('v2-release-choice')).queryAllByText(/.+/).map((n) => String(n.props.children));
      expect(shown).toHaveLength(5);
      for (const text of shown) expect(allowed.has(text)).toBe(true);
    });

    it('the new copy block has exactly the allowed entries and no banned words', () => {
      expect(Object.keys(RELEASE_EVOLVE_COPY).sort()).toEqual(['evolveDescriptor', 'evolveLabel', 'evolvingInto', 'releaseDescriptor', 'releaseLabel']);
      expect(RELEASE_EVOLVE_COPY.releaseLabel).toBe('Release it');
      expect(RELEASE_EVOLVE_COPY.evolveLabel).toBe('Evolve it');
      for (const value of Object.values(RELEASE_EVOLVE_COPY)) expect(value).not.toMatch(BANNED);
    });

    it('leaves the locked ending and hold copy as they were', () => {
      expect(RELEASE_ENDINGS.evolve).toEqual({
        eyebrow: 'Evolved', body: 'This intention has moved into history.',
        primary: { id: 'successor', label: 'Continue with new Anchor' },
      });
      expect(RELEASE_COPY.holdHintEvolve).toBe('Press and hold to move this intention into history and continue with your new Anchor. Your history will remain available.');
      expect(RELEASE_SUCCESSOR_LINK_NOTE).toBe('Linked to your previous intention.');
    });
  });
});
