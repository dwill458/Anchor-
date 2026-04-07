import * as Haptics from 'expo-haptics';
import { logger } from '@/utils/logger';

/**
 * Safe haptics wrapper that won't crash if haptics fail
 */
export const safeHaptics = {
    impact: async (style: Haptics.ImpactFeedbackStyle) => {
        try {
            await Haptics.impactAsync(style);
        } catch (error) {
            // Silently fail on devices that don't support haptics
            logger.warn('Haptics not supported:', error);
        }
    },

    selection: async () => {
        try {
            await Haptics.selectionAsync();
        } catch (error) {
            logger.warn('Haptics not supported:', error);
        }
    },

    notification: async (type: Haptics.NotificationFeedbackType) => {
        try {
            await Haptics.notificationAsync(type);
        } catch (error) {
            logger.warn('Haptics not supported:', error);
        }
    },
};
