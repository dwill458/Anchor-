function extractFirstName(name?: string | null): string | null {
  const trimmed = name?.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.split(/\s+/)[0] || null;
}

function parseUtcOffsetHours(timezoneLabel?: string | null): number | null {
  const trimmed = timezoneLabel?.trim();
  if (!trimmed) {
    return null;
  }

  const normalized = trimmed.replace('UTC−', 'UTC-');
  const match = normalized.match(/^UTC([+-])(\d{1,2})(?::(\d{2}))?/);
  if (!match) {
    return null;
  }

  const [, sign, hours, minutes] = match;
  const parsedHours = Number.parseInt(hours, 10);
  const parsedMinutes = Number.parseInt(minutes ?? '0', 10);
  const total = parsedHours + parsedMinutes / 60;

  return sign === '-' ? -total : total;
}

function extractIanaTimezone(timezoneLabel?: string | null): string | null {
  const trimmed = timezoneLabel?.trim();
  if (!trimmed || !trimmed.includes('·')) {
    return null;
  }

  const zone = trimmed.split('·')[1]?.trim();
  return zone || null;
}

function getHourForTimezone(now: Date, timezoneLabel?: string | null): number {
  const ianaTimezone = extractIanaTimezone(timezoneLabel);
  if (ianaTimezone) {
    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        hour12: false,
        timeZone: ianaTimezone,
      });
      const formatted = formatter.format(now);
      const parsed = Number.parseInt(formatted, 10);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    } catch {
      // Fall through to UTC offset parsing.
    }
  }

  const utcOffsetHours = parseUtcOffsetHours(timezoneLabel);
  if (utcOffsetHours == null) {
    return now.getHours();
  }

  const utcMillis = now.getTime() + now.getTimezoneOffset() * 60_000;
  const offsetMillis = utcOffsetHours * 60 * 60_000;
  return new Date(utcMillis + offsetMillis).getHours();
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
