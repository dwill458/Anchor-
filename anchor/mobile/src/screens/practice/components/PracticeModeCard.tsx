import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { colors, spacing, typography } from '@/theme';
import { safeHaptics } from '@/utils/haptics';

interface PracticeModeCardProps {
    title: string;
    subtext: string;
    meta?: string;
    isLocked?: boolean;
    lockCopy?: string;
    onPress?: () => void;
    cta?: string;
}

export const PracticeModeCard: React.FC<PracticeModeCardProps> = ({
    title,
    subtext,
    meta,
    isLocked,
    lockCopy,
    onPress,
    cta,
}) => {
    const handlePress = () => {
        if (isLocked) {
            safeHaptics.notification(Haptics.NotificationFeedbackType.Warning);
            return;
        }

        safeHaptics.selection();
        onPress?.();
    };

    return (
        <TouchableOpacity
            style={styles.container}
            onPress={handlePress}
            activeOpacity={isLocked ? 1 : 0.7}
        >
            <View style={[
                styles.card,
                Platform.OS === 'android' && styles.androidCard,
                isLocked && styles.lockedCard
            ]}>
                {Platform.OS === 'ios' && (
                    <BlurView intensity={10} tint="dark" style={StyleSheet.absoluteFill} />
                )}

                <View style={styles.content}>
                    <View style={styles.headerRow}>
                        <Text style={[styles.title, isLocked && styles.lockedText]}>{title}</Text>
                        {meta && <Text style={styles.meta}>{meta}</Text>}
                    </View>

                    <Text style={styles.subtext}>{subtext}</Text>

                    {cta && !isLocked && (
                        <View style={styles.ctaContainer}>
                            <Text style={styles.ctaText}>{cta}</Text>
                        </View>
                    )}

                    {isLocked && lockCopy && (
                        <View style={styles.lockContainer}>
                            <Text style={styles.lockText}>🔒 {lockCopy}</Text>
                        </View>
                    )}
                </View>
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: spacing.md,
    },
    card: {
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        backgroundColor: 'rgba(255, 255, 255, 0.02)',
    },
    androidCard: {
        backgroundColor: 'rgba(37, 37, 41, 0.8)',
    },
    lockedCard: {
        opacity: 0.6,
        borderColor: 'rgba(255, 255, 255, 0.03)',
    },
    content: {
        padding: spacing.lg,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.xs,
    },
    title: {
        fontSize: 18,
        fontFamily: typography.fonts.bodyBold,
        color: colors.bone,
    },
    lockedText: {
        color: colors.text.tertiary,
    },
    meta: {
        fontSize: 12,
        fontFamily: typography.fonts.body,
        color: colors.text.tertiary,
    },
    subtext: {
        fontSize: 14,
        fontFamily: typography.fonts.body,
        color: colors.text.secondary,
        lineHeight: 20,
    },
    ctaContainer: {
        marginTop: spacing.md,
        alignSelf: 'flex-start',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: 8,
        backgroundColor: 'rgba(212, 175, 55, 0.15)',
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.3)',
    },
    ctaText: {
        fontSize: 12,
        fontFamily: typography.fonts.bodyBold,
        color: colors.gold,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    lockContainer: {
        marginTop: spacing.md,
    },
    lockText: {
        fontSize: 12,
        fontFamily: typography.fonts.bodyBold,
        color: colors.text.tertiary,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
});
