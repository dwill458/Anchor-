/**
 * Anchor App - Practice Screen
 *
 * Daily practice hub for activating anchors and building streaks
 * TODO: Implement full activation flow and streak tracking
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '@/theme';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export const PracticeScreen: React.FC = () => {
    const navigation = useNavigation<NavigationProp>();

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.title}>Practice</Text>
                    <Text style={styles.subtitle}>
                        Activate an anchor, build your streak
                    </Text>
                </View>

                {/* Streak Card (Placeholder) */}
                <View style={styles.streakCard}>
                    <Text style={styles.streakLabel}>Current Streak</Text>
                    <Text style={styles.streakValue}>0 days</Text>
                    <Text style={styles.streakSubtext}>
                        Start your daily practice to build momentum
                    </Text>
                </View>

                {/* Quick Actions (Placeholder) */}
                <View style={styles.actionsContainer}>
                    <Text style={styles.sectionTitle}>Quick Practice</Text>

                    {/* Disabled CTA - will be enabled once anchors exist */}
                    <View style={[styles.actionCard, styles.disabledCard]}>
                        <Text style={styles.actionTitle}>Activate Last Anchor</Text>
                        <Text style={styles.actionSubtext}>
                            No active anchors yet
                        </Text>
                    </View>
                </View>

                {/* Info Section */}
                <View style={styles.infoSection}>
                    <Text style={styles.infoText}>
                        Create your first anchor to begin your practice journey.
                    </Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background.primary,
    },
    scrollContent: {
        padding: spacing.lg,
    },
    header: {
        marginBottom: spacing.xl,
    },
    title: {
        fontSize: 36,
        fontWeight: 'bold',
        color: colors.text.primary,
        marginBottom: spacing.xs,
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 16,
        color: colors.text.secondary,
        lineHeight: 24,
    },
    streakCard: {
        backgroundColor: colors.background.card,
        borderRadius: 16,
        padding: spacing.xl,
        marginBottom: spacing.xl,
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.2)',
        alignItems: 'center',
    },
    streakLabel: {
        fontSize: 14,
        color: colors.text.secondary,
        textTransform: 'uppercase',
        letterSpacing: 1.2,
        marginBottom: spacing.xs,
    },
    streakValue: {
        fontSize: 48,
        fontWeight: 'bold',
        color: colors.gold,
        marginBottom: spacing.sm,
    },
    streakSubtext: {
        fontSize: 14,
        color: colors.text.tertiary,
        textAlign: 'center',
    },
    actionsContainer: {
        marginBottom: spacing.xl,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: colors.text.primary,
        marginBottom: spacing.md,
    },
    actionCard: {
        backgroundColor: colors.background.card,
        borderRadius: 12,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.3)',
    },
    disabledCard: {
        opacity: 0.5,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    actionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.text.primary,
        marginBottom: spacing.xs,
    },
    actionSubtext: {
        fontSize: 14,
        color: colors.text.secondary,
    },
    infoSection: {
        padding: spacing.md,
        backgroundColor: 'rgba(62, 44, 91, 0.3)',
        borderRadius: 12,
        borderLeftWidth: 3,
        borderLeftColor: colors.gold,
    },
    infoText: {
        fontSize: 14,
        color: colors.text.secondary,
        lineHeight: 20,
    },
});
