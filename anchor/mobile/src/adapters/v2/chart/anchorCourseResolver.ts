import { chartApiClient } from '@/services/ChartApiClient';

export async function resolveV2ChartCourse(anchorId: string, idempotencyKey: string): Promise<string> {
  return (await chartApiClient.resolveForAnchor({ anchorId, idempotencyKey })).data.id;
}
