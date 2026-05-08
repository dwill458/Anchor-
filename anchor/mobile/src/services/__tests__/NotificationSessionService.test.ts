import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearNotificationSession } from '../NotificationSessionService';
import { NOTIFICATION_STATE_STORAGE_KEY } from '../NotificationState';

const mockCancelAllNotifications = jest.fn();

jest.mock('../NotificationService', () => ({
  __esModule: true,
  default: {
    cancelAllNotifications: (...args: unknown[]) => mockCancelAllNotifications(...args),
  },
}));

describe('NotificationSessionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);
    mockCancelAllNotifications.mockResolvedValue(undefined);
  });

  it('cancels scheduled notifications and clears persisted notification state', async () => {
    await clearNotificationSession();

    expect(mockCancelAllNotifications).toHaveBeenCalledTimes(1);
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(NOTIFICATION_STATE_STORAGE_KEY);
  });
});
