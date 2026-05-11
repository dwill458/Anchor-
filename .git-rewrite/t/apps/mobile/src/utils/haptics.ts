import * as Haptics from 'expo-haptics';

/**
 * Safe haptics wrapper that won't crash if haptics fail
 */
export const safeHaptics = {
    impact: async (style: Haptics.ImpactFeedbackStyle) => {
        try {
            await Haptics.impactAsync(style);
        } catch (error) {
            // Silently fail on devices that don't support haptics
            console.warn('Haptics not supported:', error);
        }
    },

    selection: async () => {
        try {
            await Haptics.selectionAsync();
        } catch (error) {
            console.warn('Haptics not supported:', error);
        }
    },

    notification: async (type: Haptics.NotificationFeedbackType) => {
        try {
            await Haptics.notificationAsync(type);
        } catch (error) {
            console.warn('Haptics not supported:', error);
        }
    },
};
