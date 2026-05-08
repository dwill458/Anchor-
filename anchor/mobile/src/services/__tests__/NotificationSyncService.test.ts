import { apiClient } from '@/services/ApiClient';
import { syncNotificationStateToServer } from '../NotificationSyncService';

jest.mock('@/services/ApiClient', () => ({
  apiClient: {
    put: jest.fn(),
  },
}));

describe('NotificationSyncService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('syncs notification state through the authenticated backend route', async () => {
    (apiClient.put as jest.Mock).mockResolvedValue({ data: { success: true } });

    await syncNotificationStateToServer({
      notification_enabled: true,
      current_primes: 2,
    } as any);

    expect(apiClient.put).toHaveBeenCalledWith('/api/auth/notification-state', {
      notificationState: {
        notification_enabled: true,
        current_primes: 2,
      },
    });
  });

  it('swallows backend sync failures', async () => {
    (apiClient.put as jest.Mock).mockRejectedValue(new Error('permission denied'));

    await expect(
      syncNotificationStateToServer({
        notification_enabled: false,
      } as any)
    ).resolves.toBeUndefined();
  });
});
