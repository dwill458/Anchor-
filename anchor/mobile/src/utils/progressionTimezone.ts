export interface ProgressionTimezoneInfo {
  ianaTimeZone: string | null;
  utcOffsetMinutes: number | null;
}

function parseUtcOffsetMinutes(timezoneLabel?: string | null): number | null {
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
  const totalMinutes = parsedHours * 60 + parsedMinutes;

  return sign === '-' ? -totalMinutes : totalMinutes;
}

function extractIanaTimezone(timezoneLabel?: string | null): string | null {
  const trimmed = timezoneLabel?.trim();
  if (!trimmed || !trimmed.includes('·')) {
    return null;
  }

  const zone = trimmed.split('·')[1]?.trim();
  return zone || null;
}

function formatDateFromParts(parts: Intl.DateTimeFormatPart[]): string | null {
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (!year || !month || !day) {
    return null;
  }

  return `${year}-${month}-${day}`;
}

export function getProgressionTimezoneInfo(
  timezoneLabel?: string | null
): ProgressionTimezoneInfo {
  return {
    ianaTimeZone: extractIanaTimezone(timezoneLabel),
    utcOffsetMinutes: parseUtcOffsetMinutes(timezoneLabel),
  };
}

export function toProgressionLocalDateString(
  value: Date | string,
  timezoneLabel?: string | null
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const { ianaTimeZone, utcOffsetMinutes } = getProgressionTimezoneInfo(
    timezoneLabel
  );

  if (ianaTimeZone) {
    try {
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: ianaTimeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      const fromParts = formatDateFromParts(formatter.formatToParts(date));
      if (fromParts) {
        return fromParts;
      }
    } catch {
      // Fall through to offset or device-local formatting.
    }
  }

  if (utcOffsetMinutes != null) {
    const shifted = new Date(date.getTime() + utcOffsetMinutes * 60_000);
    return `${shifted.getUTCFullYear()}-${String(
      shifted.getUTCMonth() + 1
    ).padStart(2, '0')}-${String(shifted.getUTCDate()).padStart(2, '0')}`;
  }

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    '0'
  )}-${String(date.getDate()).padStart(2, '0')}`;
}

export function getProgressionHourForTimezone(
  value: Date,
  timezoneLabel?: string | null
): number {
  const { ianaTimeZone, utcOffsetMinutes } = getProgressionTimezoneInfo(
    timezoneLabel
  );

  if (ianaTimeZone) {
    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        hour12: false,
        timeZone: ianaTimeZone,
      });
      const formatted = formatter.format(value);
      const parsed = Number.parseInt(formatted, 10);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    } catch {
      // Fall through.
    }
  }

  if (utcOffsetMinutes != null) {
    const shifted = new Date(value.getTime() + utcOffsetMinutes * 60_000);
    return shifted.getUTCHours();
  }

  return value.getHours();
}
