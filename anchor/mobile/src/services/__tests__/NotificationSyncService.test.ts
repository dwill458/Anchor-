import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from '@/services/ApiClient';
import {
  getPendingNotificationStateSync,
  syncNotificationStateToServer,
} from '../NotificationSyncService';

jest.mock('@/services/ApiClient', () => ({
  apiClient: {
    put: jest.fn(),
  },
}));

type AsyncStorageMock = {
  getItem: jest.Mock;
  setItem: jest.Mock;
  removeItem: jest.Mock;
};

const asyncStorage = AsyncStorage as unknown as AsyncStorageMock;

describe('NotificationSyncService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const storage = new Map<string, string>();

    asyncStorage.getItem.mockImplementation(async (key: string) =>
      storage.has(key) ? storage.get(key)! : null
    );
    asyncStorage.setItem.mockImplementation(async (key: string, value: string) => {
      storage.set(key, value);
    });
    asyncStorage.removeItem.mockImplementation(async (key: string) => {
      storage.delete(key);
    });
  });

  it('syncs notification state through the authenticated backend route', async () => {
    (apiClient.put as jest.Mock).mockResolvedValue({
      data: {
        notificationState: {
          notification_enabled: true,
          current_primes: 2,
          last_sent_type: 'WEAVER',
          last_sent_utc_date: '2026-04-23',
        },
      },
    });

    const syncedState = await syncNotificationStateToServer({
      notification_enabled: true,
      current_primes: 2,
    } as any);

    expect(apiClient.put).toHaveBeenCalledWith('/api/auth/notification-state', {
      notificationState: {
        notification_enabled: true,
        current_primes: 2,
      },
    });
    expect(syncedState).toMatchObject({
      notification_enabled: true,
      current_primes: 2,
      last_sent_type: 'WEAVER',
      last_sent_utc_date: '2026-04-23',
    });
  });

  it('persists a pending sync when the backend request fails', async () => {
    (apiClient.put as jest.Mock).mockRejectedValue(new Error('permission denied'));

    await expect(
      syncNotificationStateToServer({
        notification_enabled: false,
      } as any)
    ).resolves.toBeNull();

    expect(await getPendingNotificationStateSync()).toEqual({
      notification_enabled: false,
    });
  });

  it('never sends server-managed notification fields back to the API', async () => {
    (apiClient.put as jest.Mock).mockResolvedValue({
      data: {
        notificationState: {
          notification_enabled: true,
          current_primes: 2,
          last_sent_type: 'ALCHEMIST',
        },
      },
    });

    await syncNotificationStateToServer({
      notification_enabled: true,
      current_primes: 2,
      last_sent_type: 'WEAVER',
      last_sent_utc_date: '2026-04-22',
    } as any);

    expect(apiClient.put).toHaveBeenCalledWith('/api/auth/notification-state', {
      notificationState: {
        notification_enabled: true,
        current_primes: 2,
      },
    });
  });

  it('clears a pending sync after a later successful sync', async () => {
    (apiClient.put as jest.Mock)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({
        data: {
          notificationState: {
            notification_enabled: true,
          },
        },
      });

    await syncNotificationStateToServer({
      notification_enabled: true,
    } as any);
    expect(await getPendingNotificationStateSync()).toEqual({
      notification_enabled: true,
    });

    await syncNotificationStateToServer({
      notification_enabled: true,
    } as any);

    expect(await AsyncStorage.getItem('@anchor_notification_state_pending_sync')).toBeNull();
  });
});
