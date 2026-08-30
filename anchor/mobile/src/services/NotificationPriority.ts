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
