import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  GETTING_STARTED_COPY,
  formatGettingStartedPracticeDesc,
  formatGettingStartedProgressDesc,
  type GettingStartedStepId,
} from '@/constants/v2/gettingStartedCopy';
import {
  bindGuidanceAccount,
  dismissGettingStartedGuidance,
  guidanceCoordinator,
  requestGuidance,
} from './guidanceRuntime';
import { useAuthStore } from '@/stores/authStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useAnchorStore } from '@/stores/anchorStore';
import { useCourseStore } from '@/stores/courseStore';
import { peekV2Vision } from '@/hooks/v2/vision';
import { peekAnchorChart } from '@/hooks/v2/chart/useAnchorChart';
import { AnalyticsEvents, AnalyticsService } from '@/services/AnalyticsService';

export type GettingStartedStepState = {
  id: GettingStartedStepId;
  number: number;
  title: string;
  description: string;
  done: boolean;
  locked: boolean;
};

export type UseGettingStartedOptions = {
  accountId?: string | null;
  activeAnchorIds?: string[];
  hasVisionOnSelected?: boolean;
  hasChartOnSelected?: boolean;
  recommendedDurationSeconds?: number;
  isFocused?: boolean;
  onScrollToToday?: () => void;
};

const STEP_ORDER: readonly GettingStartedStepId[] = [
  'practice',
  'progress',
  'anchor',
  'vision',
  'chart',
  'another',
];

function visionReadHasContent(vision: ReturnType<typeof peekV2Vision>): boolean {
  if (!vision) return false;
  return Boolean(
    (vision.scenes && vision.scenes.length > 0) ||
      vision.title?.trim() ||
      vision.description?.trim() ||
      vision.notes?.some(note => note.content?.text?.trim()),
  );
}

export function useGettingStarted(options: UseGettingStartedOptions = {}) {
  const authUserId = useAuthStore(state => state.user?.id ?? null);
  const account = (options.accountId !== undefined ? options.accountId : authUserId) ?? 'guest';

  const [, setRevision] = useState(0);
  useEffect(() => {
    void bindGuidanceAccount(account);
    return guidanceCoordinator.subscribe(() => setRevision(value => value + 1));
  }, [account]);

  const sessionLogCount = useSessionStore(state => state.sessionLog?.length ?? 0);
  const practiceHistoryCount = useSessionStore(state => state.practiceHistory?.length ?? 0);
  const totalSessionsCount = useSessionStore(state => state.totalSessionsCount ?? 0);
  const hasCompletedPractice = sessionLogCount > 0 || practiceHistoryCount > 0 || totalSessionsCount > 0;

  const storeAnchors = useAnchorStore(state => state.anchors ?? []);
  const activeAnchorIds = useMemo(() => {
    if (options.activeAnchorIds && options.activeAnchorIds.length > 0) {
      return options.activeAnchorIds;
    }
    return storeAnchors
      .filter(anchor => !anchor.isReleased && !anchor.releasedAt && !anchor.archivedAt)
      .map(anchor => anchor.id)
      .filter(Boolean);
  }, [options.activeAnchorIds, storeAnchors]);

  const coursesCount = useCourseStore(state => state.courses?.length ?? 0);
  const hasActiveCourse = useCourseStore(state => Boolean(state.activeCourse));

  const data = guidanceCoordinator.data();
  const discovery = data.discovery ?? {};
  const records = data.records ?? {};

  const practiceDone = hasCompletedPractice;
  const progressDone = Boolean(
    discovery['progress.opened'] ||
      records['home.progress_section']?.outcome === 'action_performed' ||
      records['home.progress_moved']?.outcome === 'action_performed',
  );
  const anchorDone = Boolean(
    discovery['home.open_anchor'] || records['home.open_anchor']?.outcome === 'action_performed',
  );
  const visionDone = Boolean(
    options.hasVisionOnSelected ||
      discovery['vision.first_photo'] ||
      discovery['vision.lead_image'] ||
      activeAnchorIds.some(id => visionReadHasContent(peekV2Vision(id, account === 'guest' ? null : account)) || visionReadHasContent(peekV2Vision(id))),
  );
  const chartDone = Boolean(
    options.hasChartOnSelected ||
      coursesCount > 0 ||
      hasActiveCourse ||
      discovery['chart.next_move'] ||
      activeAnchorIds.some(id => Boolean(peekAnchorChart(id)?.chart)),
  );
  const anotherDone = Boolean(
    activeAnchorIds.length >= 2 ||
      discovery['creation.opened'] ||
      records['home.create_anchor']?.outcome === 'action_performed',
  );

  const steps = useMemo<GettingStartedStepState[]>(() => {
    const doneByStep: Record<GettingStartedStepId, boolean> = {
      practice: practiceDone,
      progress: progressDone,
      anchor: anchorDone,
      vision: visionDone,
      chart: chartDone,
      another: anotherDone,
    };
    return STEP_ORDER.map((id, idx) => {
      const done = doneByStep[id];
      const locked = id === 'progress' && !practiceDone && !done;
      let description = '';
      if (id === 'practice') {
        description = formatGettingStartedPracticeDesc(options.recommendedDurationSeconds);
      } else if (id === 'progress') {
        description = formatGettingStartedProgressDesc(Boolean(options.hasVisionOnSelected ?? visionDone));
      } else if (id === 'anchor') {
        description = GETTING_STARTED_COPY.steps.anchor.desc;
      } else if (id === 'vision') {
        description = GETTING_STARTED_COPY.steps.vision.desc;
      } else if (id === 'chart') {
        description = GETTING_STARTED_COPY.steps.chart.desc;
      } else {
        description = GETTING_STARTED_COPY.steps.another.desc;
      }
      return {
        id,
        number: idx + 1,
        title: GETTING_STARTED_COPY.steps[id].title,
        description,
        done,
        locked,
      };
    });
  }, [
    anchorDone,
    anotherDone,
    chartDone,
    options.hasVisionOnSelected,
    options.recommendedDurationSeconds,
    practiceDone,
    progressDone,
    visionDone,
  ]);

  const completedCount = useMemo(() => steps.filter(step => step.done).length, [steps]);
  const totalCount = STEP_ORDER.length;
  const allComplete = completedCount === totalCount;
  const dismissed = Boolean(data.gettingStarted?.dismissedAt);
  const visible = data.hadPracticeBeforeGuidance === false && !dismissed;

  const showMeIssuedRef = useRef<Set<GettingStartedStepId>>(new Set());
  const prevDoneRef = useRef<Record<GettingStartedStepId, boolean> | null>(null);
  const prevAllCompleteRef = useRef<boolean | null>(null);

  useEffect(() => {
    const currentMap: Record<GettingStartedStepId, boolean> = {
      practice: practiceDone,
      progress: progressDone,
      anchor: anchorDone,
      vision: visionDone,
      chart: chartDone,
      another: anotherDone,
    };
    const previous = prevDoneRef.current;
    if (!previous) {
      prevDoneRef.current = currentMap;
      prevAllCompleteRef.current = allComplete;
      return;
    }
    let newlyCompleted = false;
    for (const stepId of STEP_ORDER) {
      if (!previous[stepId] && currentMap[stepId]) {
        newlyCompleted = true;
        const source = showMeIssuedRef.current.has(stepId) ? 'show_me' : 'organic';
        showMeIssuedRef.current.delete(stepId);
        try {
          AnalyticsService.track(AnalyticsEvents.GETTING_STARTED_STEP_COMPLETED, { step: stepId, source });
        } catch {
          /* analytics must never break Getting started */
        }
      }
    }
    if (newlyCompleted && allComplete && !prevAllCompleteRef.current) {
      try {
        AnalyticsService.track(AnalyticsEvents.GETTING_STARTED_COMPLETED);
      } catch {
        /* analytics must never break Getting started */
      }
    }
    prevDoneRef.current = currentMap;
    prevAllCompleteRef.current = allComplete;
  }, [allComplete, anchorDone, anotherDone, chartDone, practiceDone, progressDone, visionDone]);

  const isFocused = options.isFocused ?? true;
  const viewedThisVisitRef = useRef(false);
  useEffect(() => {
    if (!isFocused) {
      viewedThisVisitRef.current = false;
      return;
    }
    if (visible && !viewedThisVisitRef.current) {
      viewedThisVisitRef.current = true;
      try {
        AnalyticsService.track(AnalyticsEvents.GETTING_STARTED_VIEWED, {
          completed: completedCount,
          total: totalCount,
        });
      } catch {
        /* analytics must never break Getting started */
      }
    }
  }, [completedCount, isFocused, totalCount, visible]);

  const showMe = useCallback(
    (stepId: GettingStartedStepId) => {
      const step = steps.find(item => item.id === stepId);
      if (!step || step.done || step.locked) return;
      showMeIssuedRef.current.add(stepId);
      try {
        AnalyticsService.track(AnalyticsEvents.GETTING_STARTED_SHOW_ME, { step: stepId });
      } catch {
        /* analytics must never break Getting started */
      }
      const hasVision = Boolean(options.hasVisionOnSelected ?? visionDone);
      if (stepId === 'practice') {
        options.onScrollToToday?.();
        requestGuidance(account, 'today.recommended');
      } else if (stepId === 'progress') {
        requestGuidance(account, hasVision ? 'home.progress_moved' : 'home.progress_section');
      } else if (stepId === 'anchor') {
        requestGuidance(account, 'home.open_anchor');
      } else if (stepId === 'vision') {
        requestGuidance(account, 'home.open_anchor', { pending: 'vision' });
      } else if (stepId === 'chart') {
        requestGuidance(account, 'home.open_anchor', { pending: 'chart' });
      } else if (stepId === 'another') {
        requestGuidance(account, 'home.create_anchor');
      }
    },
    [account, options, steps, visionDone],
  );

  const dismiss = useCallback(() => {
    try {
      AnalyticsService.track(AnalyticsEvents.GETTING_STARTED_DISMISSED, { completed: completedCount });
    } catch {
      /* analytics must never break Getting started */
    }
    dismissGettingStartedGuidance(account);
  }, [account, completedCount]);

  return {
    visible,
    steps,
    completedCount,
    totalCount,
    allComplete,
    anchorStepIncomplete: visible && !anchorDone,
    showMe,
    dismiss,
  };
}
