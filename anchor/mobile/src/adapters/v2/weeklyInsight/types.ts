/**
 * Types and DTOs for Anchor 2.0 Weekly Insight.
 *
 * Sourced from:
 * - Section 23 of Anchor_Design_System_Living_Spec_v0_4_WEEKLY_INSIGHT_LOCKED.docx
 * - Anchor_2.0_Weekly_Insight_Prototype.html
 */

import type {
  WeeklyInsightColorKey,
  WeeklyInsightRuleType,
  WeeklyInsightVisualType,
} from '@/constants/v2/weeklyInsightTaxonomy';
import type { WeeklyInsightFeedbackRating } from '@/constants/v2/weeklyInsightRoutes';

export type { WeeklyInsightColorKey, WeeklyInsightRuleType, WeeklyInsightVisualType };

export interface WeeklyPracticeSessionFact {
  id: string;
  anchorId: string;
  mode: 'Focus' | 'DeepPrime' | 'Visualize' | 'Release';
  durationSeconds: number;
  completedAt: string; // ISO string
  /** 0 = Monday, ..., 6 = Sunday in local calendar frame */
  dayOfWeekIndex: number;
  isLinkedToWaypoint?: boolean;
}

export interface WeeklyCanonicalEventFact {
  type: string;
  dayLabel: string; // e.g. "Thu", "Sat"
  occurredAt: string;
  metadata?: Record<string, any>;
}

export interface WeeklyAnchorFact {
  id: string;
  intention: string;
  category?: string | null;
  svg?: string | null;
  evolutionStage?: 'Forming' | 'Grounded' | 'Rooted' | 'Embedded' | 'Sovereign';
  unlockedStageThisWeek?: 'Rooted' | 'Embedded' | 'Sovereign' | null;
  isReleased?: boolean;
  releasedThisWeek?: boolean;
  releasedDay?: string;
  lifetimePracticesCount?: number;
  finalThreadScore?: number;
  practiceCountInWeek: number;
  sharePercent: number; // 0..100
}

export interface WeeklyChartFact {
  hasActiveCourse: boolean;
  currentWaypointTitle?: string;
  waypointReachedThisWeek: boolean;
  waypointReachedDay?: string;
  nextWaypointTitle?: string;
  oneMovesCompletedCount: number;
  destinationReachedThisWeek: boolean;
  practicesLinkedCount: number;
}

export interface WeeklyVisionFact {
  revisitsCount: number;
  visionTitle?: string;
  visionAnchorId?: string;
}

export interface PriorWeekComparisonFact {
  practiceCount: number;
  deepPrimeCount: number;
  deepPrimeSharePercent: number;
  activeDaysCount: number;
  primaryAnchorSharePercent?: number;
  waypointLinkedSharePercent?: number;
}

/**
 * Normalized facts DTO passed into the deterministic selector.
 * The selector performs ZERO database calls, ZERO network calls, and ZERO clock reads.
 */
export interface WeeklyInsightFacts {
  weekStart: string; // ISO string
  weekEnd: string; // ISO string
  weekLabel: string; // e.g. "Aug 31 – Sep 6"
  completedDateLabel: string; // "Completed week"
  sessions: WeeklyPracticeSessionFact[];
  activeDaysCount: number;
  /** 7-element boolean array for Mon..Sun */
  activeDays: boolean[];
  totalDurationSeconds: number;
  modeCounts: {
    focus: number;
    deepPrime: number;
    visualize: number;
    release: number;
  };
  /** 7-element thread score array Mon..Sun */
  threadPoints: number[];
  startThread: number;
  endThread: number;
  lowestThread?: {
    value: number;
    dayLabel: string;
    dayIndex: number;
  };
  practicesAfterLowCount: number;
  authoritativeThreadDelta: number;
  canonicalEvents: WeeklyCanonicalEventFact[];
  anchors: WeeklyAnchorFact[];
  primaryAnchorId?: string | null;
  chartContext: WeeklyChartFact | null;
  visionContext: WeeklyVisionFact | null;
  historyContext: {
    weeksOfHistoryCount: number;
    daysSincePriorPractice?: number;
    isFirstWeekEver?: boolean;
    priorWeek?: PriorWeekComparisonFact | null;
  };
}

export type WeeklyInsightVisualData =
  | {
      type: 'anchor';
      anchorName: string;
      category?: string | null;
      svg?: string | null;
    }
  | {
      type: 'evolution';
      anchorName: string;
      oldStage: string;
      newStage: string;
      transitionDay: string;
      category?: string | null;
      svg?: string | null;
    }
  | {
      type: 'release';
      anchorName: string;
      lifetimePractices: number;
      finalThread: number;
      releaseDay: string;
      category?: string | null;
      svg?: string | null;
    }
  | {
      type: 'thread';
      threadPoints: number[];
      note?: string;
      startScore: number;
      endScore: number;
    }
  | {
      type: 'chart' | 'chartReached';
      reached: boolean;
      currentWaypointTitle?: string;
      nextWaypointTitle?: string;
      reachedDay?: string;
      accentColor?: string;
    }
  | {
      type: 'activity';
      activeDays: boolean[];
      note?: string;
      activeDaysCount: number;
      completedPracticesCount: number;
    };

export interface WeeklyDetailedActivity {
  totalPractices: number;
  activeDays: number;
  totalMinutes: number;
  threadStart: number;
  threadEnd: number;
  threadPoints: number[];
  modeDistribution: {
    mode: string;
    count: number;
    percentage: number;
    color: string;
  }[];
  connectedActivity: {
    type: 'chart' | 'vision';
    title: string;
    subtitle: string;
    color?: string;
  }[];
  canonicalEvents: {
    label: string;
    day: string;
  }[];
}

/**
 * Persisted snapshot representing the single deterministic weekly understanding.
 * Once written or rendered, it does not recalculate on viewing.
 */
export interface WeeklyInsightSnapshot {
  id: string;
  weekLabel: string;
  completedDateLabel: string;
  ruleType: WeeklyInsightRuleType;
  headline: string;
  support: string;
  accentColor: string;
  accentKey: WeeklyInsightColorKey;
  visualType: WeeklyInsightVisualType;
  visualData: WeeklyInsightVisualData;
  /** Exactly 3 evidence tuples: [value, label, sub] */
  evidence: [string, string, string][];
  comparison: string;
  comparisonTone: 'neutral' | 'positive';
  interpretation: string;
  nextDirection: string;
  detailedActivity: WeeklyDetailedActivity;
  feedback?: WeeklyInsightFeedbackRating | null;
  createdAt: string;
}

export interface WeeklyInsightHistoryItem {
  id: string;
  dateRange: string;
  title: string;
  typeLabel: string;
  ruleType: WeeklyInsightRuleType;
  snapshot: WeeklyInsightSnapshot;
}
