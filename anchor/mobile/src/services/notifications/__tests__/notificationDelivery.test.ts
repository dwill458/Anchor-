import AsyncStorage from '@react-native-async-storage/async-storage';
import { recordNotificationDelivery } from '../notificationDelivery';
import {
  NOTIFICATION_STATE_STORAGE_KEY,
  initializeNotificationState,
} from '@/services/NotificationState';

type AsyncStorageMock = {
  getItem: jest.Mock;
  setItem: jest.Mock;
};

const asyncStorage = AsyncStorage as unknown as AsyncStorageMock;

const lastWrittenState = () =>
  JSON.parse(asyncStorage.setItem.mock.calls.at(-1)?.[1] ?? '{}');

describe('recordNotificationDelivery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    asyncStorage.getItem.mockResolvedValue(JSON.stringify(initializeNotificationState()));
    asyncStorage.setItem.mockResolvedValue(undefined);
  });

  it('ignores payloads without a known category', async () => {
    await recordNotificationDelivery({ foo: 'bar' });
    expect(asyncStorage.setItem).not.toHaveBeenCalled();
  });

  it('stamps lastNotificationSentAt for a delivered category', async () => {
    await recordNotificationDelivery({ category: 'thread_strength' });
    expect(lastWrittenState().lastNotificationSentAt.thread_strength).toEqual(expect.any(String));
  });

  it('does not count daily_prime against the global send caps', async () => {
    await recordNotificationDelivery({ category: 'daily_prime' });
    expect(lastWrittenState().lastNotificationSentAt.daily_prime).toBeUndefined();
  });

  it('records a delivered milestone so it is not re-sent', async () => {
    await recordNotificationDelivery({ category: 'milestone', milestone: 'sessions_3' });
    expect(lastWrittenState().sentMilestones).toContain('sessions_3');
  });

  it('records the sentAt for an unfinished anchor reminder', async () => {
    await recordNotificationDelivery({ category: 'unfinished_anchor', anchorId: 'anchor-1' });
    expect(lastWrittenState().unfinishedAnchorReminders['anchor-1'].sentAt).toEqual(
      expect.any(String)
    );
  });

  it('persists even when no prior state exists', async () => {
    asyncStorage.getItem.mockResolvedValue(null);
    await recordNotificationDelivery({ category: 'weekly_recap' });
    expect(asyncStorage.setItem).toHaveBeenCalledWith(
      NOTIFICATION_STATE_STORAGE_KEY,
      expect.any(String)
    );
  });
});
