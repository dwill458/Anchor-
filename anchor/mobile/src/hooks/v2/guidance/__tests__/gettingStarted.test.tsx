import React from 'react';
import { act, fireEvent, render, renderHook, waitFor } from '@testing-library/react-native';
import { GUIDANCE_REGISTRY } from '@/constants/v2/guidanceRegistry';
import { GETTING_STARTED_COPY } from '@/constants/v2/gettingStartedCopy';
import { TEACHING_COPY } from '@/constants/v2/teachingCopy';
import { createGuidanceCoordinator, DISPLAY_DWELL_MS } from '@/stores/v2/guidanceCoordinator';
import { guidanceRecords } from '@/stores/v2/guidanceRecords';
import { bindGuidanceAccount, discoverGuidance, guidanceCoordinator, replayGuidance } from '../guidanceRuntime';
import { useGettingStarted } from '../useGettingStarted';
import { V2HomeGettingStarted } from '@/components/v2/home/V2HomeGettingStarted';
import { useTeachingQueue } from '@/hooks/v2/teaching/useTeachingQueue';
import { homeTeachingBeats } from '@/hooks/v2/teaching/homeTeaching';
import { detailsTeachingBeats, DETAILS_BEATS_PER_VISIT } from '@/hooks/v2/teaching/detailsTeaching';
import { useAuthStore } from '@/stores/authStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useAnchorStore } from '@/stores/anchorStore';
import { useCourseStore } from '@/stores/courseStore';
import { useMilestoneCelebrationStore } from '@/stores/v2/milestoneCelebrationStore';
import { useCelebrationStore } from '@/stores/v2/celebrationStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { primeAnchorChart, resetAnchorChartCache } from '@/hooks/v2/chart/useAnchorChart';
import { resetV2VisionReadCache } from '@/hooks/v2/vision';

jest.mock('@/stores/encryptedPersistStorage', () => ({
  readSecureValue: jest.fn(async () => null),
  writeSecureValue: jest.fn(async () => undefined),
  encryptedPersistStorage: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => undefined),
    removeItem: jest.fn(async () => undefined),
  },
}));
jest.mock('@/utils/scheduleAfterInteractions', () => ({
  scheduleAfterInteractions: (action: () => void) => {
    action();
    return { cancel: jest.fn() };
  },
}));

let accountSeq = 0;
let accountId = '';

beforeEach(async () => {
  accountSeq += 1;
  accountId = `gs-test-${accountSeq}`;
  useAuthStore.setState({ user: { id: accountId } as never });
  useSessionStore.setState({ sessionLog: [], practiceHistory: [], totalSessionsCount: 0 });
  useAnchorStore.setState({ anchors: [{ id: 'a1', userId: accountId, intentionText: 'Run a marathon', category: 'health', createdAt: new Date(), updatedAt: new Date() } as never] });
  useCourseStore.setState({ accountId, courses: [], activeCourse: null, initializationStatus: 'ready' });
  useMilestoneCelebrationStore.setState({ queue: [], holds: [] });
  useCelebrationStore.getState().reset();
  useSettingsStore.setState({ showTips: true });
  resetAnchorChartCache();
  resetV2VisionReadCache();
  await bindGuidanceAccount(accountId);
  const fresh = { records: {}, discovery: {}, hadPracticeBeforeGuidance: false };
  guidanceRecords.save(accountId, fresh);
  await guidanceRecords.flush();
  guidanceCoordinator.bind('reset', null);
  guidanceCoordinator.bind(accountId, fresh);
});

describe('Getting started derivation & card lifecycle', () => {
  it('derives each step from its real source, keeps Progress locked until practice, and persists Hide + Replay', async () => {
    const hook = renderHook(
      (props: { hasVision?: boolean; hasChart?: boolean }) =>
        useGettingStarted({
          accountId,
          hasVisionOnSelected: props.hasVision,
          hasChartOnSelected: props.hasChart,
          recommendedDurationSeconds: 180,
        }),
      { initialProps: { hasVision: false, hasChart: false } },
    );

    expect(hook.result.current.visible).toBe(true);
    expect(hook.result.current.completedCount).toBe(0);
    const stepById = (id: string) => hook.result.current.steps.find(s => s.id === id)!;

    // Step 1 uses recommended duration; Step 2 is locked before practice
    expect(stepById('practice').description).toBe('Tap Today above · 3 min');
    expect(stepById('progress').locked).toBe(true);
    expect(stepById('progress').description).toBe(GETTING_STARTED_COPY.steps.progress.beforeVisionDesc);

    // Step 1 flips when practice completes; Step 2 unlocks
    act(() => {
      useSessionStore.setState({ sessionLog: [{ id: 's1' } as never], totalSessionsCount: 1 });
    });
    expect(stepById('practice').done).toBe(true);
    expect(stepById('progress').locked).toBe(false);

    // Step 2 flips on progress.opened discovery
    act(() => {
      discoverGuidance(accountId, 'progress.opened');
    });
    await waitFor(() => expect(stepById('progress').done).toBe(true));

    // Step 3 flips on home.open_anchor discovery
    act(() => {
      discoverGuidance(accountId, 'home.open_anchor');
    });
    await waitFor(() => expect(stepById('anchor').done).toBe(true));
    expect(hook.result.current.anchorStepIncomplete).toBe(false);

    // Step 4 flips when Vision has content; Progress description updates for post-Vision
    hook.rerender({ hasVision: true, hasChart: false });
    expect(stepById('vision').done).toBe(true);
    expect(stepById('progress').description).toBe(GETTING_STARTED_COPY.steps.progress.afterVisionDesc);

    // Step 5 flips when Chart exists
    act(() => {
      primeAnchorChart('a1', { anchor: { id: 'a1' }, chart: { id: 'c1' } } as never);
      useCourseStore.setState({ courses: [{ id: 'c1' } as never] });
    });
    expect(stepById('chart').done).toBe(true);

    // Step 6 flips when creation is opened (or 2nd anchor exists)
    act(() => {
      discoverGuidance(accountId, 'creation.opened');
    });
    await waitFor(() => expect(stepById('another').done).toBe(true));
    expect(hook.result.current.allComplete).toBe(true);
    expect(hook.result.current.completedCount).toBe(6);

    // Hide persists dismissedAt and hides the card
    act(() => {
      hook.result.current.dismiss();
    });
    await waitFor(() => expect(hook.result.current.visible).toBe(false));
    expect(guidanceCoordinator.data().gettingStarted?.dismissedAt).toBeDefined();

    // Replay app tips restores the card while retaining discovered steps
    await act(async () => {
      await replayGuidance(accountId);
    });
    expect(hook.result.current.visible).toBe(true);
    expect(guidanceCoordinator.data().gettingStarted?.dismissedAt).toBeUndefined();
  });

  it('hides the Getting started card for accounts with practice history prior to guidance', () => {
    act(() => {
      guidanceCoordinator.bind(accountId, {
        records: {},
        discovery: {},
        hadPracticeBeforeGuidance: true,
      });
    });
    const hook = renderHook(() => useGettingStarted({ accountId }));
    expect(hook.result.current.visible).toBe(false);
  });

  it('renders V2HomeGettingStarted rows, locked state, and done state', () => {
    const onShowMe = jest.fn();
    const onDismiss = jest.fn();
    const hook = renderHook(() => useGettingStarted({ accountId }));
    const view = render(
      <V2HomeGettingStarted
        visible={hook.result.current.visible}
        steps={hook.result.current.steps}
        completedCount={hook.result.current.completedCount}
        totalCount={hook.result.current.totalCount}
        allComplete={hook.result.current.allComplete}
        reduceMotion
        onShowMe={onShowMe}
        onDismiss={onDismiss}
      />,
    );
    expect(view.getByText('Get to know Anchor')).toBeTruthy();
    expect(view.getByText('After practice')).toBeTruthy();
    fireEvent.press(view.getByTestId('v2-getting-started-step-progress'));
    expect(onShowMe).not.toHaveBeenCalled();
    fireEvent.press(view.getByTestId('v2-getting-started-step-anchor'));
    expect(onShowMe).toHaveBeenCalledWith('anchor');
  });

  it('enforces vocabulary rules across Getting started and teaching copy', () => {
    const allCopy = JSON.stringify({
      gettingStarted: GETTING_STARTED_COPY,
      beats: {
        glow: TEACHING_COPY.beats['home.glow'],
        progress: TEACHING_COPY.beats['home.progress'],
        thread: TEACHING_COPY.beats['home.thread'],
        anchor: TEACHING_COPY.beats['home.anchor'],
        vision: TEACHING_COPY.beats['details.vision'],
        chart: TEACHING_COPY.beats['details.chart'],
        create: TEACHING_COPY.beats['home.create'],
        swipe: TEACHING_COPY.beats['home.swipe'],
      },
    });
    expect(allCopy).not.toMatch(/\b(prime|streak|ritual|sigil|course)\b/i);
  });
});

describe('Follow-through budget & celebration priority', () => {
  it('allows Show me and follow-through beats after today.recommended spends the session budget, while blocking spontaneous practice.switch_anchor', () => {
    jest.useFakeTimers();
    const coordinator = createGuidanceCoordinator(GUIDANCE_REGISTRY, jest.fn());
    coordinator.bind('qa', { records: {}, discovery: {}, hadPracticeBeforeGuidance: false });
    const tick = () => jest.advanceTimersByTime(0);

    // 1. today.recommended uses the session bubble budget
    const removeToday = coordinator.register({
      key: 'home:1',
      account: 'qa',
      ready: true,
      candidates: ['today.recommended'],
      present: jest.fn(),
      hide: jest.fn(),
    });
    tick();
    expect(coordinator.snapshot()?.id).toBe('today.recommended');
    const todayToken = coordinator.snapshot()!.token;
    coordinator.visible(todayToken);
    coordinator.finish(todayToken, 'acknowledged');
    removeToday();

    // 2. Spontaneous practice.switch_anchor is blocked by the spent session budget
    const removeSwitch = coordinator.register({
      key: 'practice:1',
      account: 'qa',
      ready: true,
      candidates: ['practice.switch_anchor'],
      present: jest.fn(),
      hide: jest.fn(),
    });
    tick();
    expect(coordinator.snapshot()).toBeNull();
    removeSwitch();

    // 3. Follow-through beats still present in the same session
    for (const followId of ['home.thread_glow', 'details.chart_next', 'home.swipe_anchors'] as const) {
      const removeFollow = coordinator.register({
        key: `host:${followId}`,
        account: 'qa',
        ready: true,
        candidates: [followId],
        present: jest.fn(),
        hide: jest.fn(),
      });
      tick();
      expect(coordinator.snapshot()?.id).toBe(followId);
      const token = coordinator.snapshot()!.token;
      coordinator.visible(token);
      coordinator.finish(token, 'acknowledged');
      removeFollow();
    }

    // 4. User-requested Show me also presents
    coordinator.request('home.create_anchor');
    const removeCreate = coordinator.register({
      key: 'home:create',
      account: 'qa',
      ready: true,
      candidates: ['home.create_anchor'],
      present: jest.fn(),
      hide: jest.fn(),
    });
    tick();
    expect(coordinator.snapshot()?.id).toBe('home.create_anchor');
    removeCreate();
    coordinator.dispose();
    jest.useRealTimers();
  });

  it('interrupts an active follow-through bubble when a celebration queues and leaves it unsettled for the next visit', () => {
    jest.useFakeTimers();
    const coordinator = createGuidanceCoordinator(GUIDANCE_REGISTRY, jest.fn());
    coordinator.bind('qa', { records: {}, discovery: {}, hadPracticeBeforeGuidance: false });
    const tick = () => jest.advanceTimersByTime(0);

    const hide = jest.fn();
    coordinator.register({
      key: 'home:glow',
      visitKey: 'home:visit-1',
      account: 'qa',
      ready: true,
      candidates: ['home.thread_glow'],
      present: jest.fn(),
      hide,
    });
    tick();
    const active = coordinator.snapshot()!;
    expect(active.id).toBe('home.thread_glow');
    coordinator.visible(active.token);
    jest.advanceTimersByTime(DISPLAY_DWELL_MS - 100);

    // Milestone celebration locks the coordinator
    coordinator.lock('celebration', true, true);
    expect(hide).toHaveBeenCalledWith(active.token);
    expect(coordinator.snapshot()).toBeNull();
    expect(coordinator.data().records['home.thread_glow'].outcome).toBeUndefined();

    coordinator.lock('celebration', false, true);
    tick();
    // Quiet on the same visit
    expect(coordinator.snapshot()).toBeNull();

    // Presents on the next visit
    coordinator.register({
      key: 'home:glow-2',
      visitKey: 'home:visit-2',
      account: 'qa',
      ready: true,
      candidates: ['home.thread_glow'],
      present: jest.fn(),
      hide: jest.fn(),
    });
    tick();
    expect(coordinator.snapshot()?.id).toBe('home.thread_glow');
    coordinator.dispose();
    jest.useRealTimers();
  });
});

describe('Details chain & Progress moved flows', () => {
  it('chains details.vision -> details.chart in the same visit once Vision ceremony returns with content', async () => {
    const { requestGuidance } = require('../guidanceRuntime');
    const hook = renderHook(
      (props: { hasVision: boolean; chartEmpty: boolean }) =>
        useTeachingQueue({
          screenId: 'details',
          accountId,
          contextKey: `a1:${props.hasVision ? 'v1' : 'v0'}`,
          eligible: detailsTeachingBeats(!props.hasVision, props.chartEmpty),
          cap: DETAILS_BEATS_PER_VISIT,
          blocked: false,
          isFocused: true,
        }),
      { initialProps: { hasVision: false, chartEmpty: true } },
    );

    await waitFor(() => expect(hook.result.current.steps).toEqual(['details.vision']));
    act(() => {
      hook.result.current.markShown();
      discoverGuidance(accountId, 'details.vision_chart');
      requestGuidance(accountId, 'details.chart_next');
    });

    // Vision ceremony returns with saved Vision while Chart is still empty
    hook.rerender({ hasVision: true, chartEmpty: true });
    await waitFor(() => expect(hook.result.current.steps).toEqual(['details.chart']));
  });

  it('presents home.thread (Progress moved here) on Home once Vision is added and Today was already seen', async () => {
    // Today was already acknowledged earlier in the session
    const home = renderHook(
      (props: { hasVision: boolean; hasCompletedPractice: boolean; visit: number }) =>
        useTeachingQueue({
          screenId: 'home',
          accountId,
          contextKey: `a1:${props.visit}`,
          eligible: homeTeachingBeats({
            hasAnchor: true,
            todayReady: true,
            doneToday: false,
            mode: 'focus',
            hasCompletedPractice: props.hasCompletedPractice,
            hasVision: props.hasVision,
            anchorCount: 1,
          }),
          cap: 1,
          blocked: false,
          isFocused: props.visit > 0,
        }),
      { initialProps: { hasVision: false, hasCompletedPractice: false, visit: 1 } },
    );

    await waitFor(() => expect(home.result.current.steps).toEqual(['home.today']));
    act(() => {
      home.result.current.markShown();
      home.result.current.dismiss(['home.today'], 'complete');
    });

    // User leaves Home, saves first Vision image, and returns to Home
    home.rerender({ hasVision: true, hasCompletedPractice: false, visit: 0 });
    home.rerender({ hasVision: true, hasCompletedPractice: false, visit: 2 });

    await waitFor(() => expect(home.result.current.steps).toEqual(['home.thread']));
  });
});
