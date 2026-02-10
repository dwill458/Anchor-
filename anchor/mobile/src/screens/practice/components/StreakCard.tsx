import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { colors, spacing, typography } from '@/theme';

interface StreakCardProps {
    streakCount: number;
    isPro: boolean;
}

export const StreakCard: React.FC<StreakCardProps> = ({ streakCount, isPro }) => {
    const getPhase = (count: number) => {
        if (count <= 7) return 'Foundation';
        if (count <= 21) return 'Alignment';
        if (count <= 90) return 'Momentum';
        return 'Integration';
    };

    const phase = getPhase(streakCount);

    return (
        <View style={styles.container}>
            <View style={[styles.card, Platform.OS === 'android' && styles.androidCard]}>
                {Platform.OS === 'ios' && (
                    <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
                )}

                <View style={styles.content}>
                    <Text style={styles.label}>CURRENT PATTERN</Text>

                    <Text style={styles.primaryText}>
                        {streakCount === 0 ? 'Fresh Start' : `${streakCount} ${streakCount === 1 ? 'day' : 'days'}`}
                    </Text>

                    {isPro && streakCount > 0 && (
                        <Text style={styles.phaseLine}>Phase: {phase}</Text>
                    )}

                    <Text style={styles.supportCopy}>
                        {streakCount === 0
                            ? 'A fresh moment to return.'
                            : isPro
                                ? 'Your pattern is strengthening.'
                                : 'Consistency compounds quietly.'}
                    </Text>

                    <View style={styles.microFeedbackContainer}>
                        <Text style={styles.microFeedback}>
                            {streakCount === 0
                                ? 'Every ritual begins with a single return.'
                                : isPro
                                    ? 'You usually practice in the evening. Welcome back.'
                                    : `You've returned for ${streakCount} ${streakCount === 1 ? 'day' : 'days'} in a row.`}
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
    phaseLine: {
        fontSize: 14,
        fontFamily: typography.fonts.bodyBold,
        color: colors.bone,
        marginBottom: spacing.sm,
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
