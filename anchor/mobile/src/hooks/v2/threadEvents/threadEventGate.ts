import type { V2PersistedThreadEvent } from '@/adapters/v2/threadEvents';
import { resolveEvolutionStage } from '@/adapters/v2/progress/progressAdapter';
import type { AnchorCelebrationRecord, CelebratedStageId } from '@/stores/v2/celebrationRecordsStore';

/**
 * The local stage a server stage event refers to. The server names its stages Grounded, Rooted,
 * Embedded and Sovereign at 10, 25, 50 and 100; the device celebrates Building, Established,
 * Integrated and Reinforced at 25, 50, 75 and 90. The two vocabularies do not map one to one, so the
 * match is made on the Thread value the server persisted with the event, through the rule Progress
 * uses. Null when the event has no value, or the value is not a celebrated stage.
 */
export function localStageForServerEvent(event: V2PersistedThreadEvent): CelebratedStageId | null {
  if (event.eventType !== 'EVOLUTION_STAGE_REACHED') return null;
  const value = event.metadata.threadValue;
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  switch (resolveEvolutionStage(value)) {
    case 'Building':
      return 'building';
    case 'Established':
      return 'established';
    case 'Integrated':
      return 'integrated';
    case 'Reinforced':
      return 'reinforced';
    default:
      return null;
  }
}

/** True when the device has already celebrated the stage this event refers to, for this Anchor. */
export function isAlreadyCelebrated(
  event: V2PersistedThreadEvent,
  records: Record<string, AnchorCelebrationRecord>,
): boolean {
  const stage = localStageForServerEvent(event);
  if (!stage || !event.anchorId) return false;
  return Boolean(records[event.anchorId]?.stages[stage]);
}
