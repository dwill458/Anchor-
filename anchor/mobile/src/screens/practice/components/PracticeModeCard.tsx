import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
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
        <Pressable
            style={({ pressed }) => [
                styles.container,
                pressed && !isLocked && styles.pressed,
            ]}
            onPress={handlePress}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityState={{ disabled: Boolean(isLocked) }}
        >
            <View pointerEvents="none" style={[
                styles.card,
                Platform.OS === 'android' && styles.androidCard,
                isLocked && styles.lockedCard
            ]}>
                {Platform.OS === 'ios' && (
                    <BlurView
                        intensity={10}
                        tint="dark"
                        style={StyleSheet.absoluteFill}
                        pointerEvents="none"
                    />
                )}

                <View pointerEvents="none" style={styles.content}>
                    <View pointerEvents="none" style={styles.headerRow}>
                        <Text style={[styles.title, isLocked && styles.lockedText]}>{title}</Text>
                        {meta && <Text style={styles.meta}>{meta}</Text>}
                    </View>

                    <Text pointerEvents="none" style={styles.subtext}>{subtext}</Text>

                    {cta && !isLocked && (
                        <View pointerEvents="none" style={styles.ctaContainer}>
                            <Text pointerEvents="none" style={styles.ctaText}>{cta}</Text>
                        </View>
                    )}

                    {isLocked && lockCopy && (
                        <View pointerEvents="none" style={styles.lockContainer}>
                            <Text pointerEvents="none" style={styles.lockText}>🔒 {lockCopy}</Text>
                        </View>
                    )}
                </View>
            </View>
        </Pressable>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: spacing.md,
    },
    pressed: {
        opacity: 0.7,
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
