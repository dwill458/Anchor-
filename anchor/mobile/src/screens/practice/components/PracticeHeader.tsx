import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '@/theme';

interface PracticeHeaderProps {
    subhead?: string;
}

export const PracticeHeader: React.FC<PracticeHeaderProps> = ({
    subhead = 'Return to your signal'
}) => {
    return (
        <View style={styles.container}>
            <Text style={styles.title}>Practice</Text>
            <Text style={styles.subhead}>{subhead}</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: spacing.xl,
        paddingHorizontal: spacing.lg,
    },
    title: {
        fontSize: 42,
        fontFamily: typography.fonts.heading,
        color: colors.bone,
        letterSpacing: -1,
        marginBottom: spacing.xs,
    },
    subhead: {
        fontSize: 16,
        fontFamily: typography.fonts.body,
        color: colors.text.secondary,
        letterSpacing: 0.5,
    },
});
