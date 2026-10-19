import { AnalyticsService } from '@/services/AnalyticsService';
import type { BeatId } from '@/constants/v2/teachingCopy';

type Event = 'teaching_beat_shown' | 'teaching_beat_advanced' | 'teaching_beat_dismissed';
export function trackTeaching(event: Event, properties: { screen: string; beat: BeatId | string; step: number; total: number; reason: string }) {
  try { AnalyticsService.track(event, properties); } catch { /* Presentation must work without analytics. */ }
}
