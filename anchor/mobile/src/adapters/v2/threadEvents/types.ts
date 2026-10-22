import type { V2ThreadEventChannel, V2ThreadEventReceiptStatus, V2ThreadEventSignificance, V2ThreadEventSource, V2ThreadEventType } from '@/constants/v2/threadEvents';

export type V2ThreadEventMetadata = {
  anchorName?: string;
  waypointTitle?: string;
  stageName?: string;
  thresholdValue?: number;
  practiceType?: string;
  practiceCount?: number;
  /** A value persisted by the server at event creation; it is not a client calculation. */
  threadValue?: number;
  [key: string]: unknown;
};

/** Read model returned by the canonical append-only event ledger. */
export type V2PersistedThreadEvent = {
  eventId: string;
  ledgerSequence: string;
  anchorId?: string | null;
  courseId?: string | null;
  waypointId?: string | null;
  practiceSessionId?: string | null;
  eventType: V2ThreadEventType;
  significance: V2ThreadEventSignificance;
  occurredAt: string;
  sourceKind: V2ThreadEventSource;
  sourceDomainEventId?: string | null;
  causationId?: string | null;
  correlationId: string;
  correlationSequence: number;
  eventVersion: number;
  detectorVersion: string;
  metadata: V2ThreadEventMetadata;
  createdAt: string;
};

export type V2ThreadEventReceipt = {
  eventId: string;
  channel: V2ThreadEventChannel;
  status: V2ThreadEventReceiptStatus;
  claimToken?: string | null;
  claimExpiresAt?: string | null;
  bundleKey?: string | null;
  firstPresentedAt?: string | null;
  acknowledgedAt?: string | null;
  dismissedAt?: string | null;
};

export type V2ThreadEventBundle = {
  bundleKey: string;
  primary: V2PersistedThreadEvent;
  supporting: V2PersistedThreadEvent[];
  channel: V2ThreadEventChannel;
};

export type V2ThreadEventIntake = {
  completionType?: string | null;
  events: V2PersistedThreadEvent[];
};
