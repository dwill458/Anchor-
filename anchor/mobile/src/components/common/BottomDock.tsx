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

interface BottomDockProps {
    /** Whether dock is visible (animates in/out) */
    visible?: boolean;
    /** Selected item label (e.g. "Focused") */
    selectedLabel?: string;
    /** CTA button text */
    ctaLabel: string;
    /** Whether CTA is disabled */
    disabled?: boolean;
    /** CTA press handler */
    onPress: () => void;
}

/**
 * BottomDock
 * 
 * A luxury glassmorphic docked bar with outline CTA.
 * Apple Pay vibe meets calm ritual UI.
 * 
 * Design: Transparent button with gold border (not filled gold block).
 */
export const BottomDock: React.FC<BottomDockProps> = ({
    visible = true,
    selectedLabel,
    ctaLabel,
    disabled = false,
    onPress,
}) => {
    const insets = useSafeAreaInsets();
    const slideAnim = useRef(new Animated.Value(visible ? 0 : 120)).current;
    const fadeAnim = useRef(new Animated.Value(visible ? 1 : 0)).current;
    const scaleAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(slideAnim, {
                toValue: visible ? 0 : 120,
                duration: 240,
                useNativeDriver: true,
            }),
            Animated.timing(fadeAnim, {
                toValue: visible ? 1 : 0,
                duration: 240,
                useNativeDriver: true,
            }),
        ]).start();
    }, [visible]);

    const handlePressIn = () => {
        Animated.spring(scaleAnim, {
            toValue: 0.98,
            useNativeDriver: true,
        }).start();
    };

    const handlePressOut = () => {
        Animated.spring(scaleAnim, {
            toValue: 1,
            useNativeDriver: true,
        }).start();
    };

    const bottomPosition = insets.bottom + 12;

    return (
        <Animated.View
            style={[
                styles.container,
                {
                    bottom: bottomPosition,
                    transform: [{ translateY: slideAnim }],
                    opacity: fadeAnim,
                },
            ]}
            pointerEvents={visible ? 'auto' : 'none'}
        >
            <BlurView intensity={24} tint="dark" style={styles.blurContainer}>
                <View style={styles.content}>
                    {/* Selected Line */}
                    {selectedLabel ? (
                        <Text style={styles.selectedLine}>
                            <Text style={styles.selectedLabel}>Selected</Text>
                            <Text style={styles.selectedDot}> · </Text>
                            <Text style={styles.selectedValue}>{selectedLabel}</Text>
                        </Text>
                    ) : (
                        <Text style={styles.helperText}>Choose a structure</Text>
                    )}

                    {/* Outline CTA Button */}
                    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
                        <TouchableOpacity
                            style={[
                                styles.ctaButton,
                                disabled && styles.ctaButtonDisabled,
                            ]}
                            onPress={onPress}
                            onPressIn={handlePressIn}
                            onPressOut={handlePressOut}
                            disabled={disabled}
                            activeOpacity={0.85}
                            accessibilityRole="button"
                            accessibilityLabel={ctaLabel}
                            accessibilityState={{ disabled }}
                        >
                            {/* Subtle internal highlight */}
                            <View style={styles.buttonHighlight} />

                            <Text
                                style={[
                                    styles.ctaText,
                                    disabled && styles.ctaTextDisabled,
                                ]}
                            >
                                {ctaLabel}
                            </Text>
                        </TouchableOpacity>
                    </Animated.View>
                </View>
            </BlurView>
        </Animated.View>
    );
};

// Export dock height for layout calculations
// Height breakdown: 14px selected text + 8px gap + 54px button + 16px top padding + 16px bottom padding = 108px
export const DOCK_HEIGHT = 108;

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        left: 16,
        right: 16,
        zIndex: 10,
    },
    blurContainer: {
        borderRadius: 26,
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.22)', // Subtle gold edge
        overflow: 'hidden',
        // Soft shadow for depth
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 12,
    },
    content: {
        paddingHorizontal: spacing.lg, // 24px
        paddingTop: spacing.md, // 16px
        paddingBottom: spacing.md, // 16px
    },
    selectedLine: {
        marginBottom: spacing.sm, // 8px gap before button
        textAlign: 'center',
    },
    selectedLabel: {
        fontFamily: typography.fonts.body,
        fontSize: 13,
        color: colors.text.tertiary, // Silver
        letterSpacing: 0.3,
    },
    selectedDot: {
        fontFamily: typography.fonts.body,
        fontSize: 13,
        color: colors.text.tertiary,
    },
    selectedValue: {
        fontFamily: typography.fonts.body,
        fontSize: 13,
        color: colors.bone, // Bone for emphasis
        letterSpacing: 0.3,
    },
    helperText: {
        fontFamily: typography.fonts.body,
        fontSize: 13,
        color: colors.text.tertiary,
        textAlign: 'center',
        marginBottom: spacing.sm,
        opacity: 0.6,
    },
    ctaButton: {
        height: 54,
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: 'rgba(212, 175, 55, 0.70)', // Gold outline
        backgroundColor: 'transparent',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
        overflow: 'hidden',
    },
    ctaButtonDisabled: {
        borderColor: 'rgba(212, 175, 55, 0.25)',
        opacity: 0.35,
    },
    buttonHighlight: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.08)', // Subtle internal highlight
    },
    ctaText: {
        fontFamily: typography.fonts.body,
        fontSize: typography.sizes.body1,
        fontWeight: '600',
        color: colors.bone, // Bone text, not charcoal
        letterSpacing: 0.5,
    },
    ctaTextDisabled: {
        // Opacity handled by parent
    },
});
