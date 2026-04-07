import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '@/theme';

const DAILY_LINES = [
    'Clarity favors action.',
    'Momentum is available.',
    'Integration day.',
    'Low resistance window.',
];

export const DailyContext: React.FC = () => {
    // Rotate based on day of the year
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
    const displayLine = DAILY_LINES[dayOfYear % DAILY_LINES.length];

    return (
        <View style={styles.container}>
            <Text style={styles.label}>TODAY’S CURRENT</Text>
            <Text style={styles.line}>{displayLine}</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: spacing.lg,
        marginBottom: spacing.xl,
        paddingVertical: spacing.md,
        borderLeftWidth: 2,
        borderLeftColor: colors.gold,
        backgroundColor: 'rgba(212, 175, 55, 0.05)',
    },
    label: {
        fontSize: 10,
        fontFamily: typography.fonts.bodyBold,
        color: colors.gold,
        letterSpacing: 1.5,
        marginBottom: spacing.xs,
    },
    line: {
        fontSize: 18,
        fontFamily: typography.fonts.body,
        color: colors.bone,
        fontStyle: 'italic',
    },
});
