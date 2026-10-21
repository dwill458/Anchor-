import { queueMilestoneAction } from './queueMilestoneAction';

/** Called only after persisted Vision content has completed board arrival. */
export async function queueVisionMilestones(anchorId: string, visionId: string, isActive: () => boolean = () => true): Promise<void> {
  if (visionId) await queueMilestoneAction(anchorId, { kind: 'vision', sourceEntityId: visionId }, isActive);
}
