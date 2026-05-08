import AsyncStorage from '@react-native-async-storage/async-storage';
import NotificationService from '@/services/NotificationService';
import { NOTIFICATION_STATE_STORAGE_KEY } from '@/services/NotificationState';

export async function clearNotificationSession(): Promise<void> {
  await NotificationService.cancelAllNotifications();
  await AsyncStorage.removeItem(NOTIFICATION_STATE_STORAGE_KEY);
}
