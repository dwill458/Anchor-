import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getMilestoneDates,
  checkAndRecordMilestones,
  backfillMilestoneDates,
  subscribeToMilestoneDates,
} from '../milestoneTracking';

// Cast AsyncStorage functions to jest.Mock
const mockGetItem = AsyncStorage.getItem as jest.Mock;
const mockSetItem = AsyncStorage.setItem as jest.Mock;

describe('milestoneTracking', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getMilestoneDates', () => {
    it('returns empty structure if nothing is stored in AsyncStorage', async () => {
      mockGetItem.mockResolvedValueOnce(null);
      const res = await getMilestoneDates();
      expect(res).toEqual({ rank: {}, depth: {} });
      expect(mockGetItem).toHaveBeenCalledWith('anchor-milestone-dates');
    });

    it('returns parsed and sanitized dates if stored in AsyncStorage', async () => {
      const storedData = {
        rank: { Initiate: '2026-01-01' },
        depth: { Surface: '2026-01-02' },
      };
      mockGetItem.mockResolvedValueOnce(JSON.stringify(storedData));
      const res = await getMilestoneDates();
      expect(res).toEqual(storedData);
    });

    it('sanitizes corrupt or invalid data structures correctly', async () => {
      // rank is invalid format (array instead of object)
      const corruptData = {
        rank: ['Initiate'],
        depth: null,
      };
      mockGetItem.mockResolvedValueOnce(JSON.stringify(corruptData));
      const res = await getMilestoneDates();
      expect(res).toEqual({ rank: {}, depth: {} });
    });

    it('returns empty structure on AsyncStorage read error', async () => {
      mockGetItem.mockRejectedValueOnce(new Error('Read error'));
      const res = await getMilestoneDates();
      expect(res).toEqual({ rank: {}, depth: {} });
    });
  });

  describe('checkAndRecordMilestones', () => {
    it('records new milestones based on totalPrimes', async () => {
      // Start with empty milestones
      mockGetItem.mockResolvedValueOnce(null);
      
      // Let's check with 15 primes: Initiate (0) and Practitioner (10) for rank,
      // and Surface (0) for depth.
      await checkAndRecordMilestones(15);

      expect(mockSetItem).toHaveBeenCalled();
      const storedArg = JSON.parse(mockSetItem.mock.calls[0][1]);
      
      const today = new Date().toISOString().split('T')[0];
      expect(storedArg.rank['Initiate']).toBe(today);
      expect(storedArg.rank['Practitioner']).toBe(today);
      expect(storedArg.rank['Architect']).toBeUndefined();
      
      expect(storedArg.depth['Surface']).toBe(today);
      expect(storedArg.depth['Grounded']).toBeUndefined();
    });

    it('does not write or notify if no milestones are new', async () => {
      const today = new Date().toISOString().split('T')[0];
      const existingData = {
        rank: { Initiate: today, Practitioner: today },
        depth: { Surface: today },
      };
      mockGetItem.mockResolvedValueOnce(JSON.stringify(existingData));

      // Check again with 15 primes (no new thresholds crossed)
      await checkAndRecordMilestones(15);
      expect(mockSetItem).not.toHaveBeenCalled();
    });

    it('gracefully handles write failure without throwing', async () => {
      mockGetItem.mockResolvedValueOnce(null);
      mockSetItem.mockRejectedValueOnce(new Error('Write error'));

      // Should not throw an exception
      await expect(checkAndRecordMilestones(5)).resolves.not.toThrow();
    });
  });

  describe('backfillMilestoneDates', () => {
    it('backfills milestones with pre-launch sentinel', async () => {
      mockGetItem.mockResolvedValueOnce(null);

      // Backfill with 15 primes
      await backfillMilestoneDates(15);

      expect(mockSetItem).toHaveBeenCalled();
      const storedArg = JSON.parse(mockSetItem.mock.calls[0][1]);
      
      expect(storedArg.rank['Initiate']).toBe('pre-launch');
      expect(storedArg.rank['Practitioner']).toBe('pre-launch');
      expect(storedArg.depth['Surface']).toBe('pre-launch');
    });

    it('does not overwrite existing milestone dates during backfill', async () => {
      const existingData = {
        rank: { Initiate: '2026-05-01' },
        depth: {},
      };
      mockGetItem.mockResolvedValueOnce(JSON.stringify(existingData));

      // Backfill with 15 primes (Practitioner and Surface should be backfilled, Initiate remains unchanged)
      await backfillMilestoneDates(15);

      expect(mockSetItem).toHaveBeenCalled();
      const storedArg = JSON.parse(mockSetItem.mock.calls[0][1]);
      expect(storedArg.rank['Initiate']).toBe('2026-05-01');
      expect(storedArg.rank['Practitioner']).toBe('pre-launch');
      expect(storedArg.depth['Surface']).toBe('pre-launch');
    });
  });

  describe('subscribeToMilestoneDates', () => {
    it('notifies subscribers on milestone update', async () => {
      mockGetItem.mockResolvedValueOnce(null);
      
      const listener = jest.fn();
      const unsubscribe = subscribeToMilestoneDates(listener);

      await checkAndRecordMilestones(10);
      expect(listener).toHaveBeenCalledTimes(1);

      // Unsubscribe and trigger update again
      unsubscribe();
      mockGetItem.mockResolvedValueOnce(null);
      await checkAndRecordMilestones(200);
      expect(listener).toHaveBeenCalledTimes(1); // Still 1
    });

    it('handles subscriber notifications gracefully even if listener throws', async () => {
      mockGetItem.mockResolvedValueOnce(null);
      
      const listenerError = jest.fn().mockImplementation(() => {
        throw new Error('Listener crash');
      });
      const listenerNormal = jest.fn();
      
      subscribeToMilestoneDates(listenerError);
      subscribeToMilestoneDates(listenerNormal);

      await expect(checkAndRecordMilestones(10)).resolves.not.toThrow();
      expect(listenerError).toHaveBeenCalled();
      expect(listenerNormal).toHaveBeenCalled();
    });
  });
});
