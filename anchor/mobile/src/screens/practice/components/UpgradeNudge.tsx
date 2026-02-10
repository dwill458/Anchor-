import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, typography } from '@/theme';

export const UpgradeNudge: React.FC = () => {
    return (
        <TouchableOpacity style={styles.container} activeOpacity={0.9}>
            <LinearGradient
                colors={['rgba(212, 175, 55, 0.15)', 'rgba(15, 20, 25, 0)']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={styles.gradient}
            />
            <View style={styles.content}>
                <View style={styles.textContainer}>
                    <Text style={styles.title}>Expand Your Sanctuary</Text>
                    <Text style={styles.body}>
                        Explore more resonant rituals and pattern tracking.
                    </Text>
                </View>
                <View style={styles.cta}>
                    <Text style={styles.ctaText}>Evolve</Text>
                </View>
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        marginHorizontal: spacing.lg,
        marginTop: spacing.xl,
        marginBottom: spacing.xxl,
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.2)',
        backgroundColor: 'rgba(15, 20, 25, 0.6)',
    },
    gradient: {
        ...StyleSheet.absoluteFillObject,
    },
    content: {
        padding: spacing.lg,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    textContainer: {
        flex: 1,
        marginRight: spacing.md,
    },
    title: {
        fontSize: 16,
        fontFamily: typography.fonts.bodyBold,
        color: colors.gold,
        marginBottom: 4,
    },
    body: {
        fontSize: 13,
        fontFamily: typography.fonts.body,
        color: colors.text.secondary,
        lineHeight: 18,
    },
    cta: {
        backgroundColor: colors.gold,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: 8,
    },
    ctaText: {
        fontSize: 12,
        fontFamily: typography.fonts.bodyBold,
        color: colors.navy,
    },
});
