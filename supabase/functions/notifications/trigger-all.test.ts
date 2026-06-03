import { assertEquals } from 'jsr:@std/assert';
import {
  alreadySentToday,
  isAllowedSendHour,
  localHourForTimezone,
  notificationDateString,
} from './trigger-all.ts';

Deno.test('notificationDateString respects timezone and 2am buffer', () => {
  const justAfterMidnightUtc = new Date('2026-05-29T06:30:00.000Z');

  assertEquals(notificationDateString(justAfterMidnightUtc, 'America/Chicago'), '2026-05-28');
  assertEquals(notificationDateString(justAfterMidnightUtc, 'UTC'), '2026-05-29');
});

Deno.test('alreadySentToday uses the timezone-adjusted notification day', () => {
  const now = new Date('2026-05-29T06:30:00.000Z');

  assertEquals(
    alreadySentToday(
      {
        timezone: 'America/Chicago',
        last_sent_utc_date: '2026-05-28',
      },
      now
    ),
    true
  );
});

Deno.test('isAllowedSendHour gates sends to the user local reminder hour', () => {
  const now = new Date('2026-05-30T02:00:00.000Z');

  assertEquals(localHourForTimezone(now, 'America/Chicago'), 21);
  assertEquals(
    isAllowedSendHour(
      {
        timezone: 'America/Chicago',
        active_hours_end: 21,
      },
      now
    ),
    true
  );
  assertEquals(
    isAllowedSendHour(
      {
        timezone: 'America/Chicago',
        active_hours_end: 20,
      },
      now
    ),
    false
  );
});
