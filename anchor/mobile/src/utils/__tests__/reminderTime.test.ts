import { deviceUses24Hour, formatDisplay, fromHHmm, toHHmm } from '../reminderTime';

describe('reminderTime', () => {
  describe('toHHmm', () => {
    it('maps 12 AM to 00 and 12 PM to 12', () => {
      expect(toHHmm({ hour12: 12, minute: 0, meridiem: 'AM' })).toBe('00:00');
      expect(toHHmm({ hour12: 12, minute: 30, meridiem: 'PM' })).toBe('12:30');
    });

    it('zero-pads and offsets PM hours', () => {
      expect(toHHmm({ hour12: 8, minute: 30, meridiem: 'PM' })).toBe('20:30');
      expect(toHHmm({ hour12: 5, minute: 45, meridiem: 'AM' })).toBe('05:45');
      expect(toHHmm({ hour12: 7, minute: 17, meridiem: 'AM' })).toBe('07:17');
      expect(toHHmm({ hour12: 10, minute: 52, meridiem: 'PM' })).toBe('22:52');
    });
  });

  describe('fromHHmm', () => {
    it('round-trips every minute of the day', () => {
      for (let h = 0; h < 24; h += 1) {
        for (let m = 0; m < 60; m += 1) {
          const s = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
          const wheel = fromHHmm(s);
          expect(wheel.hour12).toBeGreaterThanOrEqual(1);
          expect(wheel.hour12).toBeLessThanOrEqual(12);
          expect(toHHmm(wheel)).toBe(s);
        }
      }
    });

    it('falls back to 9:00 PM for invalid input', () => {
      const fallback = { hour12: 9, minute: 0, meridiem: 'PM' };
      expect(fromHHmm('')).toEqual(fallback);
      expect(fromHHmm('nope')).toEqual(fallback);
      expect(fromHHmm('24:00')).toEqual(fallback);
      expect(fromHHmm('12:60')).toEqual(fallback);
      expect(fromHHmm(undefined as unknown as string)).toEqual(fallback);
    });
  });

  describe('formatDisplay', () => {
    it('formats 12-hour and 24-hour', () => {
      expect(formatDisplay('20:30', false)).toBe('8:30 PM');
      expect(formatDisplay('20:30', true)).toBe('20:30');
      expect(formatDisplay('00:05', false)).toBe('12:05 AM');
      expect(formatDisplay('12:00', false)).toBe('12:00 PM');
      expect(formatDisplay('07:17', true)).toBe('07:17');
    });
  });

  describe('deviceUses24Hour', () => {
    const original = Intl.DateTimeFormat;
    afterEach(() => {
      Intl.DateTimeFormat = original;
    });

    it('returns a boolean', () => {
      expect(typeof deviceUses24Hour()).toBe('boolean');
    });

    it('reads hour12 from Intl', () => {
      Intl.DateTimeFormat = (() => ({
        resolvedOptions: () => ({ hour12: false }),
      })) as unknown as typeof Intl.DateTimeFormat;
      expect(deviceUses24Hour()).toBe(true);
    });

    it('falls back to false when Intl throws', () => {
      Intl.DateTimeFormat = (() => {
        throw new Error('no intl');
      }) as unknown as typeof Intl.DateTimeFormat;
      expect(deviceUses24Hour()).toBe(false);
    });
  });
});
