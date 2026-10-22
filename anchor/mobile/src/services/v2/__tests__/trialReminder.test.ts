const mockRequestPermissions = jest.fn();
const mockScheduleLocal = jest.fn();

jest.mock('@/services/NotificationService', () => ({
  __esModule: true,
  default: {
    requestPermissions: (...a: unknown[]) => mockRequestPermissions(...a),
    scheduleLocalNotification: (...a: unknown[]) => mockScheduleLocal(...a),
  },
}));

import {
  TRIAL_END_REMINDER_ID,
  scheduleTrialEndReminder,
  trialEndReminderCopy,
  trialEndReminderFireDate,
} from '../trialReminder';

const START = new Date('2026-10-05T09:00:00.000Z');

beforeEach(() => {
  jest.clearAllMocks();
  mockRequestPermissions.mockResolvedValue(true);
  mockScheduleLocal.mockResolvedValue(TRIAL_END_REMINDER_ID);
});

describe('trial end reminder', () => {
  it('fires on day 5 of the trial', () => {
    expect(trialEndReminderFireDate(START).toISOString()).toBe('2026-10-10T09:00:00.000Z');
  });

  it('names the store price when it is known and stays honest when it is not', () => {
    expect(trialEndReminderCopy('$59.99').body).toContain('$59.99');
    expect(trialEndReminderCopy(null).body).not.toMatch(/\$/);
  });

  it('schedules one replaceable local notification', async () => {
    await expect(scheduleTrialEndReminder('$59.99', START)).resolves.toBe(TRIAL_END_REMINDER_ID);
    expect(mockScheduleLocal).toHaveBeenCalledWith(
      expect.objectContaining({ id: TRIAL_END_REMINDER_ID, fireDate: trialEndReminderFireDate(START) }),
    );
  });

  it('does nothing without permission and never throws into the purchase', async () => {
    mockRequestPermissions.mockResolvedValueOnce(false);
    await expect(scheduleTrialEndReminder('$59.99', START)).resolves.toBeNull();
    expect(mockScheduleLocal).not.toHaveBeenCalled();

    mockRequestPermissions.mockRejectedValueOnce(new Error('boom'));
    await expect(scheduleTrialEndReminder('$59.99', START)).resolves.toBeNull();
  });
});
