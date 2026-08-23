import {
  applyDailyDecay,
  calculatePracticeGain,
  compareStages,
  getCanonicalThreadStage,
  getMemoryFloorForStage,
  getSameDaySessionMultiplier,
  getStageDecayMultiplier,
  getStrengthMultiplier,
  getThreadStrengthState,
  getThreadStrengthTagline,
  getV2BaseDecayForMissedDay,
  maxStage,
} from '../threadStrength';
import { PRACTICE_THREAD_STRENGTH_V2_BASE_GAINS } from '@/types/practice';

describe('Thread Strength V2 Pure Functions & Curves', () => {
  describe('Canonical Stages', () => {
    it('maps scores to correct canonical stages', () => {
      expect(getCanonicalThreadStage(0)).toBe('nascent');
      expect(getCanonicalThreadStage(10)).toBe('nascent');
      expect(getCanonicalThreadStage(24)).toBe('nascent');

      expect(getCanonicalThreadStage(25)).toBe('kindling');
      expect(getCanonicalThreadStage(40)).toBe('kindling');
      expect(getCanonicalThreadStage(69)).toBe('kindling');

      expect(getCanonicalThreadStage(70)).toBe('tempered');
      expect(getCanonicalThreadStage(80)).toBe('tempered');
      expect(getCanonicalThreadStage(89)).toBe('tempered');

      expect(getCanonicalThreadStage(90)).toBe('forged');
      expect(getCanonicalThreadStage(100)).toBe('forged');
    });

    it('determines thread strength UI state correctly', () => {
      expect(getThreadStrengthState(90).stage).toBe('forged');
      expect(getThreadStrengthState(70).stage).toBe('tempered');
      expect(getThreadStrengthState(69).stage).toBe('kindling');
      expect(getThreadStrengthState(20).stage).toBe('nascent');
    });

    it('compares and finds max stages correctly', () => {
      expect(compareStages('nascent', 'kindling')).toBeLessThan(0);
      expect(compareStages('tempered', 'kindling')).toBeGreaterThan(0);
      expect(compareStages('forged', 'forged')).toBe(0);

      expect(maxStage('nascent', 'kindling')).toBe('kindling');
      expect(maxStage('tempered', 'forged')).toBe('forged');
      expect(maxStage('tempered', 'kindling')).toBe('tempered');
    });
  });

  describe('Durable Memory Floors & Stage Resilience Multipliers', () => {
    it('returns correct memory floors for each historical stage reached', () => {
      expect(getMemoryFloorForStage('nascent')).toBe(0);
      expect(getMemoryFloorForStage('kindling')).toBe(15);
      expect(getMemoryFloorForStage('tempered')).toBe(30);
      expect(getMemoryFloorForStage('forged')).toBe(45);
    });

    it('returns correct stage decay resilience multipliers', () => {
      expect(getStageDecayMultiplier('nascent')).toBe(1.0);
      expect(getStageDecayMultiplier('kindling')).toBe(1.0);
      expect(getStageDecayMultiplier('tempered')).toBe(0.85);
      expect(getStageDecayMultiplier('forged')).toBe(0.70);
    });
  });

  describe('Diminishing Returns & Same-Day Practice Multipliers', () => {
    it('returns correct diminishing return multiplier by pre-session strength bracket', () => {
      expect(getStrengthMultiplier(0)).toBe(1.0);
      expect(getStrengthMultiplier(24)).toBe(1.0);
      expect(getStrengthMultiplier(25)).toBe(0.80);
      expect(getStrengthMultiplier(49)).toBe(0.80);
      expect(getStrengthMultiplier(50)).toBe(0.65);
      expect(getStrengthMultiplier(69)).toBe(0.65);
      expect(getStrengthMultiplier(70)).toBe(0.45);
      expect(getStrengthMultiplier(89)).toBe(0.45);
      expect(getStrengthMultiplier(90)).toBe(0.25);
      expect(getStrengthMultiplier(100)).toBe(0.25);
    });

    it('returns correct same-day session multiplier', () => {
      expect(getSameDaySessionMultiplier(1)).toBe(1.0);
      expect(getSameDaySessionMultiplier(2)).toBe(0.50);
      expect(getSameDaySessionMultiplier(3)).toBe(0.25);
      expect(getSameDaySessionMultiplier(4)).toBe(0.0);
      expect(getSameDaySessionMultiplier(5)).toBe(0.0);
    });

    it('calculates practice gains with base values, rounding, and +1 minimum rule', () => {
      // Base gains: Focus 12, Visualize 15, Deep Prime 18, Release 0
      expect(PRACTICE_THREAD_STRENGTH_V2_BASE_GAINS.focus).toBe(12);
      expect(PRACTICE_THREAD_STRENGTH_V2_BASE_GAINS.visualize).toBe(15);
      expect(PRACTICE_THREAD_STRENGTH_V2_BASE_GAINS.deep_prime).toBe(18);
      expect(PRACTICE_THREAD_STRENGTH_V2_BASE_GAINS.release).toBe(0);

      // Session 1 at 0 strength:
      // Focus: 12 * 1.0 * 1.0 = 12
      expect(calculatePracticeGain({ mode: 'focus', currentStrength: 0, sessionIndexToday: 1 })).toBe(12);
      // Visualize: 15 * 1.0 * 1.0 = 15
      expect(calculatePracticeGain({ mode: 'visualize', currentStrength: 0, sessionIndexToday: 1 })).toBe(15);
      // Deep Prime: 18 * 1.0 * 1.0 = 18
      expect(calculatePracticeGain({ mode: 'deep_prime', currentStrength: 0, sessionIndexToday: 1 })).toBe(18);
      // Release: 0
      expect(calculatePracticeGain({ mode: 'release', currentStrength: 0, sessionIndexToday: 1 })).toBe(0);

      // Session 2 same day for Focus at strength 50 (bracket 50-69 -> 0.65 multiplier):
      // 12 * 0.65 * 0.50 = 3.9 -> rounded to 4
      expect(calculatePracticeGain({ mode: 'focus', currentStrength: 50, sessionIndexToday: 2 })).toBe(4);

      // Session 4 same day yields 0
      expect(calculatePracticeGain({ mode: 'deep_prime', currentStrength: 50, sessionIndexToday: 4 })).toBe(0);

      // Session 1 at strength 90 for focus: 12 * 0.25 * 1.0 = 3
      expect(calculatePracticeGain({ mode: 'focus', currentStrength: 90, sessionIndexToday: 1 })).toBe(3);

      // Minimum +1 guarantee when multiplier > 0 and strength < 100
      // 12 * 0.25 (for strength 95) * 0.25 (session 3) = 0.75 -> round(0.75)=1
      expect(calculatePracticeGain({ mode: 'focus', currentStrength: 95, sessionIndexToday: 3 })).toBe(1);

      // If already at 100, gain is 0
      expect(calculatePracticeGain({ mode: 'deep_prime', currentStrength: 100, sessionIndexToday: 1 })).toBe(0);
    });
  });

  describe('V2 Daily Decay Curves', () => {
    it('returns correct base decay for Lenient (2 grace days: 0, 0, 3, 4)', () => {
      expect(getV2BaseDecayForMissedDay(1, 'lenient')).toBe(0);
      expect(getV2BaseDecayForMissedDay(2, 'lenient')).toBe(0);
      expect(getV2BaseDecayForMissedDay(3, 'lenient')).toBe(3);
      expect(getV2BaseDecayForMissedDay(4, 'lenient')).toBe(4);
      expect(getV2BaseDecayForMissedDay(10, 'lenient')).toBe(4);
    });

    it('returns correct base decay for Balanced (1 grace day: 0, 4, 6)', () => {
      expect(getV2BaseDecayForMissedDay(1, 'balanced')).toBe(0);
      expect(getV2BaseDecayForMissedDay(2, 'balanced')).toBe(4);
      expect(getV2BaseDecayForMissedDay(3, 'balanced')).toBe(6);
      expect(getV2BaseDecayForMissedDay(5, 'balanced')).toBe(6);
    });

    it('returns correct base decay for Strict (0 grace days: 5, 8)', () => {
      expect(getV2BaseDecayForMissedDay(1, 'strict')).toBe(5);
      expect(getV2BaseDecayForMissedDay(2, 'strict')).toBe(8);
      expect(getV2BaseDecayForMissedDay(4, 'strict')).toBe(8);
    });

    it('applies daily decay with stage resilience and enforces memory floors', () => {
      // Balanced: missedDayIndex 2 (2nd missed day) -> base decay is 4.
      // Current strength = 32 (kindling -> resilience 1.0).
      // Highest stage reached = Tempered -> floor = 30.
      const result = applyDailyDecay({
        currentStrength: 32,
        highestStageReached: 'tempered',
        missedDayIndex: 2,
        sensitivity: 'balanced',
      });
      // 32 - 4 = 28, but clamped to floor 30
      expect(result.newStrength).toBe(30);

      // Forged resilience (0.70 multiplier):
      // Strict: missedDayIndex 2 -> base decay = 8.
      // 8 * 0.70 = 5.6 -> round = 6 decay.
      const forgedDecay = applyDailyDecay({
        currentStrength: 90,
        highestStageReached: 'forged',
        missedDayIndex: 2,
        sensitivity: 'strict',
      });
      expect(forgedDecay.newStrength).toBe(84);
    });
  });

  describe('Observational Taglines', () => {
    it('returns accurate taglines matching stage progression', () => {
      expect(getThreadStrengthTagline({ score: 0, totalSessions: 0 }).tagline).toBe(
        'No sessions yet. Forge the first prime.',
      );
      expect(getThreadStrengthTagline({ score: 15, totalSessions: 2 }).tagline).toBe(
        'Thread is beginning.',
      );
      expect(getThreadStrengthTagline({ score: 30, totalSessions: 5 }).tagline).toBe(
        'Thread is lightly held.',
      );
      expect(getThreadStrengthTagline({ score: 55, totalSessions: 10 }).tagline).toBe(
        'Thread is holding.',
      );
      expect(getThreadStrengthTagline({ score: 75, totalSessions: 15 }).tagline).toBe(
        'Thread is holding strong.',
      );
      expect(getThreadStrengthTagline({ score: 95, totalSessions: 20 }).tagline).toBe(
        'Thread is fully tensioned.',
      );
    });
  });
});
