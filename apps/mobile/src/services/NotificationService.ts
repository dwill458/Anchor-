import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure notification behavior
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
    }),
});

export const NOTIFICATION_CHANNELS = {
    DAILY_REMINDERS: 'daily-reminders',
    STREAK_PROTECTION: 'streak-protection',
    WEEKLY_SUMMARY: 'weekly-summary',
};

export const NOTIFICATION_IDS = {
    DAILY_REMINDER: 'daily-reminder-id',
    STREAK_PROTECTION: 'streak-protection-id',
    WEEKLY_SUMMARY: 'weekly-summary-id',
};

class NotificationService {
    /**
     * Request notification permissions
     */
    async requestPermissions(): Promise<boolean> {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }

        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNELS.DAILY_REMINDERS, {
                name: 'Daily Reminders',
                importance: Notifications.AndroidImportance.HIGH,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#D4AF37',
            });

            await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNELS.STREAK_PROTECTION, {
                name: 'Streak Protection',
                importance: Notifications.AndroidImportance.DEFAULT,
                lightColor: '#D4AF37',
            });

            await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNELS.WEEKLY_SUMMARY, {
                name: 'Weekly Summary',
                importance: Notifications.AndroidImportance.LOW,
                lightColor: '#D4AF37',
            });
        }

        return finalStatus === 'granted';
    }

    /**
     * Schedule the main daily reminder
     */
    async scheduleDailyReminder(time: string): Promise<string | null> {
        await this.cancelDailyReminder();

        const [hourStr, minuteStr] = time.split(':');
        const hour = parseInt(hourStr, 10);
        const minute = parseInt(minuteStr, 10);

        try {
            const id = await Notifications.scheduleNotificationAsync({
                identifier: NOTIFICATION_IDS.DAILY_REMINDER,
                content: {
                    title: 'Return to Your Anchor',
                    body: 'A moment to return to your anchor.',
                    sound: true,
                    data: { type: 'daily_reminder' },
                },
                trigger: {
                    type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
                    hour,
                    minute,
                    repeats: true,
                },
            });
            return id;
        } catch (error) {
            console.error('Error scheduling daily reminder:', error);
            return null;
        }
    }

    /**
     * Cancel the daily reminder
     */
    async cancelDailyReminder() {
        await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_IDS.DAILY_REMINDER);
    }

    /**
     * Schedule streak protection alert
     * Typically set for evening, e.g., 20:00 (8 PM)
     */
    async scheduleStreakProtectionAlert(): Promise<string | null> {
        await this.cancelStreakProtectionAlert();

        try {
            const id = await Notifications.scheduleNotificationAsync({
                identifier: NOTIFICATION_IDS.STREAK_PROTECTION,
                content: {
                    title: 'Streak Protection',
                    body: 'You haven’t met your ritual goal today. A quick activation will keep your momentum.',
                    sound: true,
                    data: { type: 'streak_protection' },
                },
                trigger: {
                    type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
                    hour: 20, // 8 PM
                    minute: 0,
                    repeats: true,
                },
            });
            return id;
        } catch (error) {
            console.error('Error scheduling streak protection alert:', error);
            return null;
        }
    }

    /**
     * Cancel streak protection alert
     */
    async cancelStreakProtectionAlert() {
        await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_IDS.STREAK_PROTECTION);
    }

    /**
     * Schedule weekly summary
     * Default: Sunday evening at 19:00 (7 PM)
     */
    async scheduleWeeklySummary(): Promise<string | null> {
        await this.cancelWeeklySummary();

        try {
            const id = await Notifications.scheduleNotificationAsync({
                identifier: NOTIFICATION_IDS.WEEKLY_SUMMARY,
                content: {
                    title: 'Your Weekly Reflection',
                    body: 'A short overview of your practice this week is ready.',
                    sound: true,
                    data: { type: 'weekly_summary' },
                },
                trigger: {
                    type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
                    weekday: 1, // Sunday (1-7, 1 is Sunday in some libs, but expo docs say 1 is Sunday)
                    hour: 19,
                    minute: 0,
                    repeats: true,
                },
            });
            return id;
        } catch (error) {
            console.error('Error scheduling weekly summary:', error);
            return null;
        }
    }

    /**
     * Cancel weekly summary
     */
    async cancelWeeklySummary() {
        await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_IDS.WEEKLY_SUMMARY);
    }

    /**
     * Get all scheduled notifications (for debugging)
     */
    async getScheduledNotifications() {
        return await Notifications.getAllScheduledNotificationsAsync();
    }

    /**
     * Cancel all notifications
     */
    async cancelAllNotifications() {
        await Notifications.cancelAllScheduledNotificationsAsync();
    }
}

export default new NotificationService();
