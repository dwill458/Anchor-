import { getProgressionHourForTimezone } from '@/utils/progressionTimezone';

function extractFirstName(name?: string | null): string | null {
  const trimmed = name?.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.split(/\s+/)[0] || null;
}

function getHourForTimezone(now: Date, timezoneLabel?: string | null): number {
  return getProgressionHourForTimezone(now, timezoneLabel);
}

export function buildProfileGreeting(
  name?: string | null,
  timezoneLabel?: string | null,
  now: Date = new Date()
): string {
  const hour = getHourForTimezone(now, timezoneLabel);
  const salutation =
    hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = extractFirstName(name);

  return firstName ? `${salutation}, ${firstName}` : salutation;
}
