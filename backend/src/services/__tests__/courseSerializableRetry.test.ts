const mockTransaction = jest.fn();
jest.mock('../../lib/prisma', () => ({ prisma: { $transaction: (...args: unknown[]) => mockTransaction(...args) } }));
import { runSerializable } from '../CourseService';

describe('serializable transaction retries', () => {
  beforeEach(() => mockTransaction.mockReset());
  it.each(['P2034', '40001'])('retries %s and succeeds', async code => {
    mockTransaction.mockRejectedValueOnce({ code }).mockResolvedValueOnce('saved');
    await expect(runSerializable(async () => 'saved')).resolves.toBe('saved');
    expect(mockTransaction).toHaveBeenCalledTimes(2);
  });
  it.each(['P2034', '40001'])('returns a typed conflict after three %s failures', async code => {
    mockTransaction.mockRejectedValue({ code });
    await expect(runSerializable(async () => 'saved')).rejects.toMatchObject({ code: 'SYNC_CONFLICT', statusCode: 409 });
    expect(mockTransaction).toHaveBeenCalledTimes(3);
  });
  it('does not retry unrelated failures', async () => {
    const error = new Error('other');
    mockTransaction.mockRejectedValue(error);
    await expect(runSerializable(async () => 'saved')).rejects.toBe(error);
    expect(mockTransaction).toHaveBeenCalledTimes(1);
  });
});
