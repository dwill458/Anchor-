import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  isPostPrimeTraceEligible,
  markPostPrimeTraceAttemptStarted,
  POST_PRIME_TRACE_STORAGE_KEY,
} from '../postPrimeTraceEligibility';

describe('postPrimeTraceEligibility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
  });

  it('returns eligible when no timestamp exists', async () => {
    await expect(isPostPrimeTraceEligible(new Date('2026-05-05T12:00:00.000Z'))).resolves.toBe(true);
  });

  it('returns ineligible inside 24 hours', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
      '2026-05-05T00:00:00.000Z'
    );

    await expect(isPostPrimeTraceEligible(new Date('2026-05-05T23:59:59.000Z'))).resolves.toBe(false);
  });

  it('returns eligible at or after 24 hours', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
      '2026-05-05T00:00:00.000Z'
    );

    await expect(isPostPrimeTraceEligible(new Date('2026-05-06T00:00:00.000Z'))).resolves.toBe(true);
  });

  it('writes the attempt timestamp only when explicitly marked', async () => {
    await markPostPrimeTraceAttemptStarted(new Date('2026-05-05T15:30:00.000Z'));

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      POST_PRIME_TRACE_STORAGE_KEY,
      '2026-05-05T15:30:00.000Z'
    );
  });
});
