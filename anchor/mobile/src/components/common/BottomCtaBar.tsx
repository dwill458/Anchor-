import React, { useEffect, useRef } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Animated,
    Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, typography } from '@/theme';

interface BottomCtaBarProps {
    /** Primary CTA button text */
    ctaText: string;
    /** Optional helper text shown above CTA */
    helperText?: string;
    /** Whether CTA is disabled */
    disabled?: boolean;
    /** CTA press handler */
    onPress: () => void;
    /** Whether to show the bar (animates in/out) */
    visible?: boolean;
}

/**
 * BottomCtaBar
 * 
 * A glassmorphic bottom bar with CTA button.
 * Respects safe area insets and animates visibility.
 * Part of the Zen Architect design system.
 */
export const BottomCtaBar: React.FC<BottomCtaBarProps> = ({
    ctaText,
    helperText,
    disabled = false,
    onPress,
    visible = true,
}) => {
    const insets = useSafeAreaInsets();
    const slideAnim = useRef(new Animated.Value(visible ? 0 : 100)).current;
    const fadeAnim = useRef(new Animated.Value(visible ? 1 : 0)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(slideAnim, {
                toValue: visible ? 0 : 100,
                duration: 220,
                useNativeDriver: true,
            }),
            Animated.timing(fadeAnim, {
                toValue: visible ? 1 : 0,
                duration: 220,
                useNativeDriver: true,
            }),
        ]).start();
    }, [visible]);

    const bottomPadding = Math.max(insets.bottom, spacing.md);

    return (
        <Animated.View
            style={[
                styles.container,
                {
                    paddingBottom: bottomPadding,
                    transform: [{ translateY: slideAnim }],
                    opacity: fadeAnim,
                },
            ]}
            pointerEvents={visible ? 'auto' : 'none'}
        >
            <BlurView intensity={20} tint="dark" style={styles.blurContainer}>
                <View style={[styles.content, { paddingBottom: bottomPadding }]}>
                    {helperText && (
                        <Text style={styles.helperText} accessibilityLabel={helperText}>
                            {helperText}
                        </Text>
                    )}

                    <TouchableOpacity
                        style={[
                            styles.ctaButton,
                            disabled && styles.ctaButtonDisabled,
                        ]}
                        onPress={onPress}
                        disabled={disabled}
                        activeOpacity={0.8}
                        accessibilityRole="button"
                        accessibilityLabel={ctaText}
                        accessibilityState={{ disabled }}
                    >
                        <Text
                            style={[
                                styles.ctaText,
                                disabled && styles.ctaTextDisabled,
                            ]}
                        >
                            {ctaText}
                        </Text>
                    </TouchableOpacity>
                </View>
            </BlurView>
        </Animated.View>
    );
};

// Export bar height for layout calculations
export const BOTTOM_BAR_HEIGHT = 100; // Base height without safe area

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 10,
    },
    blurContainer: {
        borderTopWidth: 1,
        borderTopColor: 'rgba(212, 175, 55, 0.2)', // Subtle gold border
        overflow: 'hidden',
    },
    content: {
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.md,
    },
    helperText: {
        fontFamily: typography.fonts.body,
        fontSize: 13,
        color: colors.text.tertiary,
        textAlign: 'center',
        marginBottom: spacing.sm,
        letterSpacing: 0.3,
    },
    ctaButton: {
        backgroundColor: colors.gold,
        height: 56,
        borderRadius: spacing.sm,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: colors.gold,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    ctaButtonDisabled: {
        backgroundColor: 'rgba(192, 192, 192, 0.2)',
        shadowOpacity: 0,
        elevation: 0,
    },
    ctaText: {
        fontFamily: typography.fonts.body,
        fontSize: typography.sizes.body1,
        fontWeight: '600',
        color: colors.charcoal,
        letterSpacing: 0.5,
    },
    ctaTextDisabled: {
        color: 'rgba(255, 255, 255, 0.3)',
    },
});
