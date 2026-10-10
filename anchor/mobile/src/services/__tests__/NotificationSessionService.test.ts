import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearNotificationSession } from '../NotificationSessionService';
import { NOTIFICATION_STATE_STORAGE_KEY } from '../NotificationState';
import { useReminderInvitationStore } from '@/stores/v2/reminderInvitationStore';

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

  it('clears the pending notification sync state', async () => {
    await clearNotificationSession();

    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@anchor_notification_state_pending_sync');
  });

  it('resets the reminder invitation session flag so the next account can be shown it', async () => {
    useReminderInvitationStore.getState().markShown();
    expect(useReminderInvitationStore.getState().shownThisSession).toBe(true);

    await clearNotificationSession();

    expect(useReminderInvitationStore.getState().shownThisSession).toBe(false);
  });
});
