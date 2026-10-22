import {
  formatThresholdPercentage,
  normalizeThresholdValue,
} from '../notificationFormatting';

describe('notificationFormatting', () => {
  describe('normalizeThresholdValue', () => {
    it('normalizes float percentages (0..1) to integer percentages (0..100)', () => {
      expect(normalizeThresholdValue(0.25)).toBe(25);
      expect(normalizeThresholdValue(0.5)).toBe(50);
      expect(normalizeThresholdValue(0.7)).toBe(70);
      expect(normalizeThresholdValue(1.0)).toBe(100);
    });

    it('handles integer percentages (0..100) directly', () => {
      expect(normalizeThresholdValue(0)).toBe(0);
      expect(normalizeThresholdValue(25)).toBe(25);
      expect(normalizeThresholdValue(50)).toBe(50);
      expect(normalizeThresholdValue(70)).toBe(70);
      expect(normalizeThresholdValue(100)).toBe(100);
    });

    it('clamps values beyond 0..100', () => {
      expect(normalizeThresholdValue(-10)).toBe(0);
      expect(normalizeThresholdValue(150)).toBe(100);
      expect(normalizeThresholdValue(7000)).toBe(100);
    });

    it('falls back to default 70 on null/undefined/NaN', () => {
      expect(normalizeThresholdValue(null)).toBe(70);
      expect(normalizeThresholdValue(undefined)).toBe(70);
      expect(normalizeThresholdValue('invalid')).toBe(70);
    });

    it('parses numeric string inputs', () => {
      expect(normalizeThresholdValue('70')).toBe(70);
      expect(normalizeThresholdValue('0.7')).toBe(70);
      expect(normalizeThresholdValue('50')).toBe(50);
    });
  });

  describe('formatThresholdPercentage', () => {
    it('formats 0%, 25%, 50%, 70%, 100% correctly', () => {
      expect(formatThresholdPercentage(0)).toBe('0%');
      expect(formatThresholdPercentage(25)).toBe('25%');
      expect(formatThresholdPercentage(50)).toBe('50%');
      expect(formatThresholdPercentage(70)).toBe('70%');
      expect(formatThresholdPercentage(100)).toBe('100%');
    });

    it('formats 0.70 to 70% instead of 7000%', () => {
      expect(formatThresholdPercentage(0.7)).toBe('70%');
      expect(formatThresholdPercentage(0.70)).toBe('70%');
      expect(formatThresholdPercentage('0.7')).toBe('70%');
      expect(formatThresholdPercentage(70)).toBe('70%');
      expect(formatThresholdPercentage('70')).toBe('70%');
    });
  });
});
