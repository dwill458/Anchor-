import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  backfillMilestoneDates,
  checkAndRecordMilestones,
  getMilestoneDates,
  subscribeToMilestoneDates,
} from '../milestoneTracking';

const mockGetItem = AsyncStorage.getItem as jest.Mock;
const mockSetItem = AsyncStorage.setItem as jest.Mock;

describe('milestoneTracking', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getMilestoneDates', () => {
    it('returns an empty structure when nothing is stored', async () => {
      mockGetItem.mockResolvedValueOnce(null);

      await expect(getMilestoneDates()).resolves.toEqual({
        rank: {},
        mark: {},
      });
      expect(mockGetItem).toHaveBeenCalledWith('anchor-milestone-dates');
    });

    it('sanitizes corrupt structures', async () => {
      mockGetItem.mockResolvedValueOnce(
        JSON.stringify({
          rank: ['Initiate'],
          mark: null,
        })
      );

      await expect(getMilestoneDates()).resolves.toEqual({
        rank: {},
        mark: {},
      });
    });
  });

  describe('checkAndRecordMilestones', () => {
    it('records newly earned rank and mark milestones', async () => {
      mockGetItem.mockResolvedValueOnce(null);

      const result = await checkAndRecordMilestones({
        totalPrimes: 10,
        practiceDays: 3,
        releasedAnchors: 0,
      });

      expect(result).toEqual({
        rank: ['Initiate', 'Practitioner'],
        mark: ['First Return Mark'],
      });

      const stored = JSON.parse(mockSetItem.mock.calls[0][1]);
      const today = new Date().toISOString().split('T')[0];
      expect(stored.rank.Initiate).toBe(today);
      expect(stored.rank.Practitioner).toBe(today);
      expect(stored.mark['First Return Mark']).toBe(today);
    });

    it('does not rewrite when there are no new milestones', async () => {
      mockGetItem.mockResolvedValueOnce(
        JSON.stringify({
          rank: {
            Initiate: '2026-05-01',
            Practitioner: '2026-05-10',
          },
          mark: {
            'First Return Mark': '2026-05-10',
          },
        })
      );

      const result = await checkAndRecordMilestones({
        totalPrimes: 12,
        practiceDays: 4,
        releasedAnchors: 0,
      });

      expect(result).toEqual({ rank: [], mark: [] });
      expect(mockSetItem).not.toHaveBeenCalled();
    });

    it('adds newly crossed marks without replaying earlier ones', async () => {
      mockGetItem.mockResolvedValueOnce(
        JSON.stringify({
          rank: {
            Initiate: '2026-05-01',
            Practitioner: '2026-05-10',
          },
          mark: {
            'First Return Mark': '2026-05-10',
          },
        })
      );

      const result = await checkAndRecordMilestones({
        totalPrimes: 18,
        practiceDays: 7,
        releasedAnchors: 0,
      });

      expect(result).toEqual({
        rank: [],
        mark: ['Steady Thread Mark'],
      });
    });
  });

  describe('backfillMilestoneDates', () => {
    it('backfills earned milestones with the pre-launch sentinel', async () => {
      mockGetItem.mockResolvedValueOnce(null);

      await backfillMilestoneDates({
        totalPrimes: 50,
        practiceDays: 30,
        releasedAnchors: 1,
      });

      const stored = JSON.parse(mockSetItem.mock.calls[0][1]);
      expect(stored.rank.Initiate).toBe('pre-launch');
      expect(stored.rank.Practitioner).toBe('pre-launch');
      expect(stored.rank.Architect).toBe('pre-launch');
      expect(stored.mark['First Return Mark']).toBe('pre-launch');
      expect(stored.mark['Steady Thread Mark']).toBe('pre-launch');
      expect(stored.mark['Discipline Mark']).toBe('pre-launch');
    });

    it('preserves existing dates while backfilling later milestones', async () => {
      mockGetItem.mockResolvedValueOnce(
        JSON.stringify({
          rank: {
            Initiate: '2026-05-01',
          },
          mark: {},
        })
      );

      await backfillMilestoneDates({
        totalPrimes: 10,
        practiceDays: 3,
        releasedAnchors: 0,
      });

      const stored = JSON.parse(mockSetItem.mock.calls[0][1]);
      expect(stored.rank.Initiate).toBe('2026-05-01');
      expect(stored.rank.Practitioner).toBe('pre-launch');
      expect(stored.mark['First Return Mark']).toBe('pre-launch');
    });
  });

  describe('subscribeToMilestoneDates', () => {
    it('notifies subscribers on milestone updates', async () => {
      mockGetItem.mockResolvedValueOnce(null);

      const listener = jest.fn();
      const unsubscribe = subscribeToMilestoneDates(listener);

      await checkAndRecordMilestones({
        totalPrimes: 10,
        practiceDays: 3,
        releasedAnchors: 0,
      });
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();
      mockGetItem.mockResolvedValueOnce(null);
      await checkAndRecordMilestones({
        totalPrimes: 200,
        practiceDays: 100,
        releasedAnchors: 3,
      });
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });
});
