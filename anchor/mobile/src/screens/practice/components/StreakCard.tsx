import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { colors, spacing, typography } from '@/theme';

interface StreakCardProps {
    streakDays: number;
    hasStabilizedToday: boolean;
}

export const StreakCard: React.FC<StreakCardProps> = ({ streakDays, hasStabilizedToday }) => {
    const primaryLabel =
        streakDays === 0
            ? 'Fresh Start'
            : `${streakDays} ${streakDays === 1 ? 'day' : 'days'}`;

    return (
        <View style={styles.container}>
            <View style={[styles.card, Platform.OS === 'android' && styles.androidCard]}>
                {Platform.OS === 'ios' && (
                    <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
                )}

                <View style={styles.content}>
                    <Text style={styles.label}>SANCTUARY CANDLE</Text>

                    <Text style={[styles.primaryText, streakDays === 0 ? styles.primaryTextSmall : null]}>
                        {primaryLabel}
                    </Text>

                    <Text style={styles.supportCopy}>
                        {hasStabilizedToday
                            ? 'Flame lit today.'
                            : 'Keep the flame lit with a 30s return.'}
                    </Text>

                    <View style={styles.microFeedbackContainer}>
                        <Text style={styles.microFeedback}>
                            {hasStabilizedToday
                                ? 'Return complete. Hold what matters.'
                                : 'A single return is enough.'}
                        </Text>
                    </View>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: spacing.lg,
        marginBottom: spacing.xl,
    },
    card: {
        borderRadius: 24,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.2)',
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
    },
    androidCard: {
        backgroundColor: 'rgba(26, 26, 29, 0.95)',
    },
    content: {
        padding: spacing.xl,
        alignItems: 'center',
    },
    label: {
        fontSize: 12,
        fontFamily: typography.fonts.bodyBold,
        color: colors.text.tertiary,
        letterSpacing: 2,
        marginBottom: spacing.sm,
    },
    primaryText: {
        fontSize: 56,
        fontFamily: typography.fonts.heading,
        color: colors.gold,
        marginBottom: spacing.xs,
    },
    primaryTextSmall: {
        fontSize: 34,
    },
    supportCopy: {
        fontSize: 14,
        fontFamily: typography.fonts.body,
        color: colors.text.secondary,
        textAlign: 'center',
    },
    microFeedbackContainer: {
        marginTop: spacing.lg,
        paddingTop: spacing.md,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.05)',
        width: '100%',
        alignItems: 'center',
    },
    microFeedback: {
        fontSize: 12,
        fontFamily: typography.fonts.body,
        color: colors.text.tertiary,
        fontStyle: 'italic',
    },
});
