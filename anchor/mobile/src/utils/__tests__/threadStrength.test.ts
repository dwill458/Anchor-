import {
  calculateOptimisticPracticeGain,
  calculateThreadDecay,
  getThreadDecayStartDay,
  THREAD_STRENGTH_CONSTANTS,
} from '../threadStrength';

describe('threadStrength utilities', () => {
  describe('decay calculations', () => {
    it('returns correct decay start day for sensitivities', () => {
      expect(getThreadDecayStartDay('lenient')).toBe(3);
      expect(getThreadDecayStartDay('balanced')).toBe(2);
      expect(getThreadDecayStartDay('strict')).toBe(1);
    });

    it('calculates thread decay based on missed days and sensitivity', () => {
      expect(calculateThreadDecay(0, 'balanced')).toBe(0);
      expect(calculateThreadDecay(1, 'balanced')).toBe(0);
      expect(calculateThreadDecay(2, 'balanced')).toBe(3);
      expect(calculateThreadDecay(3, 'balanced')).toBe(6);
    });
  });

  describe('calculateOptimisticPracticeGain', () => {
    it('awards activation bonus (12) + daily return bonus (1.5) + duration on first practice ever (10s)', () => {
      const result = calculateOptimisticPracticeGain({
        currentStrength: null,
        practiceType: 'focus',
        durationSeconds: 10,
        isFirstPracticeEver: true,
        isFirstSessionToday: true,
        priorEligibleSecondsToday: 0,
      });

      expect(result.beforeStrength).toBe(0);
      expect(result.activationBonus).toBe(12);
      expect(result.delta).toBeCloseTo(13.5833, 4);
      expect(result.afterStrength).toBeCloseTo(13.5833, 4);
    });

    it('awards only duration points on second 10s practice today without daily or activation bonus', () => {
      const result = calculateOptimisticPracticeGain({
        currentStrength: 13.5833,
        practiceType: 'focus',
        durationSeconds: 10,
        isFirstPracticeEver: false,
        isFirstSessionToday: false,
        priorEligibleSecondsToday: 10,
      });

      expect(result.beforeStrength).toBe(13.5833);
      expect(result.activationBonus).toBe(0);
      expect(result.delta).toBeCloseTo(0.0833, 3);
      expect(result.afterStrength).toBeCloseTo(13.6667, 3);
    });

    it('awards 1.0 point for a 2-minute repeat practice (120s)', () => {
      const result = calculateOptimisticPracticeGain({
        currentStrength: 20,
        practiceType: 'deep_prime',
        durationSeconds: 120,
        isFirstPracticeEver: false,
        isFirstSessionToday: false,
        priorEligibleSecondsToday: 60,
      });

      expect(result.beforeStrength).toBe(20);
      expect(result.delta).toBe(1.0);
      expect(result.afterStrength).toBe(21.0);
    });

    it('caps eligible seconds at 10 minutes (600s) total for the day', () => {
      // 8 minutes (480s) already used today; 5 minutes (300s) practiced now => only 2 minutes (120s) credited
      const result = calculateOptimisticPracticeGain({
        currentStrength: 30,
        practiceType: 'focus',
        durationSeconds: 300,
        isFirstPracticeEver: false,
        isFirstSessionToday: false,
        priorEligibleSecondsToday: 480,
      });

      expect(result.delta).toBe(1.0); // 120s / 60 * 0.5 = 1.0 pt
      expect(result.afterStrength).toBe(31.0);
    });

    it('awards 0 points when 10 minutes has already been fully used today on repeat sessions', () => {
      const result = calculateOptimisticPracticeGain({
        currentStrength: 35,
        practiceType: 'focus',
        durationSeconds: 60,
        isFirstPracticeEver: false,
        isFirstSessionToday: false,
        priorEligibleSecondsToday: THREAD_STRENGTH_CONSTANTS.dailyDurationCapSeconds,
      });

      expect(result.delta).toBe(0);
      expect(result.afterStrength).toBe(35);
    });

    it('awards 0 points for release mode', () => {
      const result = calculateOptimisticPracticeGain({
        currentStrength: 40,
        practiceType: 'release',
        durationSeconds: 60,
        isFirstPracticeEver: false,
        isFirstSessionToday: false,
        priorEligibleSecondsToday: 0,
      });

      expect(result.delta).toBe(0);
      expect(result.afterStrength).toBe(40);
    });

    it('caps afterStrength at 100 max', () => {
      const result = calculateOptimisticPracticeGain({
        currentStrength: 99.8,
        practiceType: 'focus',
        durationSeconds: 120,
        isFirstPracticeEver: false,
        isFirstSessionToday: false,
        priorEligibleSecondsToday: 0,
      });

      expect(result.afterStrength).toBe(100);
      expect(result.delta).toBe(0.2);
    });
  });
});
