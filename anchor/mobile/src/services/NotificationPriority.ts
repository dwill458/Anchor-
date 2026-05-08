import type { NotificationType } from '@/services/NotificationEligibility';

export interface EligibleNotifications {
  alchemist: boolean;
  weaver: boolean;
  mirror: boolean;
  microPrime: boolean;
}

export const resolvePriority = (eligible: EligibleNotifications): NotificationType => {
  if (eligible.alchemist) return 'ALCHEMIST';
  if (eligible.weaver) return 'WEAVER';
  if (eligible.mirror) return 'MIRROR';
  if (eligible.microPrime) return 'MICRO_PRIME';
  return null;
};

export const isSovereign = (
  total_primes_all_time: number,
  alchemist_milestones_count: number
): boolean =>
  total_primes_all_time >= 50 || alchemist_milestones_count >= 3;
