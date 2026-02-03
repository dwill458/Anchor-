/**
 * NarrativeOnboardingScreen
 * 
 * A 5-screen narrative flow that replaces the traditional multi-screen setup.
 * Uses a single component with state transitions for a seamless, premium feel.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Dimensions,
    Animated,
    StatusBar,
    StatusBarProps,
    Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '@/stores/authStore';
import { ONBOARDING_FLOW } from '@/config/onboarding';
import { colors, spacing, typography } from '@/theme';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '@/types';
import { safeHaptics } from '@/utils/haptics';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Welcome'>; // Reusing Welcome alias for now

const { width, height } = Dimensions.get('window');

// Animation constants
// Screen 1-2: Slower fades
// Screen 3-4: Faster transitions
// Screen 5: Firm
const getFadeDuration = (index: number) => index < 2 ? 800 : (index === 4 ? 1200 : 500); // Slower for first 2, fast for 3-4, Slow/Heavy for 5

export const NarrativeOnboardingScreen: React.FC<Props> = ({ navigation }) => {
    const { completeOnboarding, setShouldRedirectToCreation } = useAuthStore();
    const [stepIndex, setStepIndex] = useState(0);

    // Lock Swipe Back on Screen 3 (Index 2)
    useEffect(() => {
        if (stepIndex >= 2) {
            navigation.setOptions({ gestureEnabled: false });
        }
    }, [stepIndex, navigation]);

    // Animation values
    const contentOpacity = useRef(new Animated.Value(0)).current;
    const contentTranslateY = useRef(new Animated.Value(20)).current;

    const currentStep = ONBOARDING_FLOW[stepIndex];
    const isLastStep = stepIndex === ONBOARDING_FLOW.length - 1;

    // Run animation when step changes
    useEffect(() => {
        // Reset values
        contentOpacity.setValue(0);
        contentTranslateY.setValue(20);

        const duration = getFadeDuration(stepIndex);

        // Sequence: Fade Out (if not first) -> Wait -> Fade In
        const fadeIn = Animated.parallel([
            Animated.timing(contentOpacity, {
                toValue: 1,
                duration: duration,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
            }),
            Animated.timing(contentTranslateY, {
                toValue: 0,
                duration: duration,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
            }),
        ]);

        fadeIn.start();

        // NO Haptic on simple "Continue" progress - only on meaning/action
        // Handled in handleNext for specific buttons

        // Special case: Micro-haptic on ARRIVAL at Screen 5 (Index 4)
        if (stepIndex === 4) {
            void safeHaptics.impact(Haptics.ImpactFeedbackStyle.Light);
        }
    }, [stepIndex]);

    const handleNext = async () => {
        if (isLastStep) {
            // "Begin" - Significant action
            await safeHaptics.notification(Haptics.NotificationFeedbackType.Success);

            // Mark as done and signal redirect
            setShouldRedirectToCreation(true);
            completeOnboarding();
        } else {
            // "Create your first Anchor" (Step 0) - Significant action
            if (stepIndex === 0) {
                void safeHaptics.impact(Haptics.ImpactFeedbackStyle.Medium);
            }
            // Standard "Continue" screens - No Haptics (Silent flow)

            // Fade out current content before changing state
            Animated.parallel([
                Animated.timing(contentOpacity, {
                    toValue: 0,
                    duration: 300,
                    easing: Easing.in(Easing.cubic),
                    useNativeDriver: true,
                }),
                Animated.timing(contentTranslateY, {
                    toValue: -10,
                    duration: 300,
                    easing: Easing.in(Easing.cubic),
                    useNativeDriver: true,
                }),
            ]).start(() => {
                setStepIndex((prev) => prev + 1);
            });
        }
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />

            {/* Background - Static atmospheric gradient */}
            <LinearGradient
                colors={[
                    colors.background.primary,
                    '#1A1625',
                    colors.background.primary
                ]}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            />

            {/* Content Container */}
            <View style={styles.contentContainer}>
                <Animated.View
                    style={[
                        styles.textBlock,
                        {
                            opacity: contentOpacity,
                            transform: [{ translateY: contentTranslateY }]
                        }
                    ]}
                >
                    {/* Headline */}
                    <Text style={styles.headline}>
                        {currentStep.headline}
                    </Text>

                    {/* Body */}
                    <Text style={styles.body}>
                        {currentStep.body}
                    </Text>

                    {/* Micro-copy (if exists) */}
                    {!!currentStep.micro && (
                        <Text style={styles.micro}>
                            {currentStep.micro}
                        </Text>
                    )}
                </Animated.View>
            </View>

            {/* Footer / CTA area */}
            <View style={styles.footer}>
                <Animated.View style={{ opacity: contentOpacity }}>
                    {/* Progress Indication */}
                    <View style={styles.pagination}>
                        {ONBOARDING_FLOW.map((_, idx) => {
                            const isLastDot = idx === ONBOARDING_FLOW.length - 1;
                            const isActive = idx === stepIndex;
                            const isFinalStepActive = stepIndex === ONBOARDING_FLOW.length - 1;

                            // Dynamic styles based on completion status
                            let dotColor = colors.text.tertiary;
                            let opacity = 0.3;
                            let width = 4;
                            let height = 4; // Default small
                            let borderRadius = 2;

                            if (isActive) {
                                // Active logic - subtle elongation
                                width = 16;
                                opacity = 0.7;

                                if (isLastDot) {
                                    // Final step active: Gold, subtle
                                    dotColor = colors.gold;
                                    opacity = 0.8;
                                } else {
                                    // Normal step active: Muted gold
                                    dotColor = colors.gold;
                                }
                            } else {
                                // Inactive logic
                                if (isFinalStepActive) {
                                    // If we are on the final step, previous dots fade to neutral
                                    dotColor = colors.text.tertiary;
                                    opacity = 0.15; // Very faded
                                }

                                if (isLastDot) {
                                    // The "Goal" dot when not active yet
                                    dotColor = colors.text.tertiary;
                                    width = 4;
                                    height = 4;
                                    borderRadius = 2;
                                    opacity = 0.4;
                                }
                            }

                            return (
                                <View
                                    key={idx}
                                    style={[
                                        styles.dot,
                                        {
                                            backgroundColor: dotColor,
                                            width,
                                            height,
                                            borderRadius,
                                            opacity
                                        }
                                    ]}
                                />
                            );
                        })}
                    </View>

                    {/* Primary CTA */}
                    <TouchableOpacity
                        style={[
                            styles.button,
                            isLastStep && styles.buttonCommit
                        ]}
                        onPress={handleNext}
                        activeOpacity={0.8}
                    >
                        <Text
                            style={[
                                styles.buttonText,
                                isLastStep && styles.buttonTextCommit
                            ]}
                        >
                            {currentStep.cta}
                        </Text>
                    </TouchableOpacity>

                    {/* Secondary CTA (for first screen) */}
                    {/* @ts-ignore - Dynamic property check */}
                    {!!currentStep.secondaryCta && (
                        <TouchableOpacity
                            style={styles.secondaryButton}
                            onPress={() => {
                                // For now, simple haptic feedback as placeholder for "How it works"
                                void safeHaptics.impact(Haptics.ImpactFeedbackStyle.Light);
                                // In future: Navigation or Modal logic here
                            }}
                            activeOpacity={0.6}
                        >
                            <Text style={styles.secondaryButtonText}>
                                {/* @ts-ignore */}
                                {currentStep.secondaryCta}
                            </Text>
                        </TouchableOpacity>
                    )}
                </Animated.View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background.primary,
    },
    contentContainer: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: spacing.xl,
        paddingTop: height * 0.15, // Push down for breathing room
    },
    textBlock: {
        alignItems: 'flex-start',
    },
    headline: {
        ...typography.heading,
        fontSize: 34,
        lineHeight: 44,
        color: colors.gold,
        marginBottom: spacing.lg,
        letterSpacing: 0.3,
    },
    body: {
        ...typography.body,
        fontSize: 17,
        lineHeight: 28,
        color: colors.text.secondary,
        maxWidth: width * 0.85,
    },
    micro: {
        ...typography.body,
        fontSize: 13,
        color: colors.text.tertiary,
        marginTop: spacing.lg,
        fontFamily: typography.fonts.body,
        letterSpacing: 0.3,
        opacity: 0.7,
    },
    footer: {
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.xxl + 20,
    },
    pagination: {
        flexDirection: 'row',
        marginBottom: spacing.xl,
        gap: 8,
        alignItems: 'center',
    },
    dot: {
        height: 4,
        width: 4,
        borderRadius: 2,
    },
    button: {
        paddingVertical: spacing.md,
        alignItems: 'flex-start', // Intentionally minimal alignment
    },
    buttonCommit: {
        backgroundColor: colors.gold,
        alignItems: 'flex-start',
        borderRadius: 8,
        paddingVertical: spacing.md + 2,
        paddingHorizontal: spacing.lg,
    },
    buttonText: {
        ...typography.heading,
        fontSize: 17,
        color: colors.text.primary,
        letterSpacing: 0.5,
    },
    buttonTextCommit: {
        color: colors.navy,
        fontWeight: '600',
    },
    secondaryButton: {
        marginTop: spacing.md,
        paddingBottom: spacing.sm,
        alignItems: 'flex-start',
    },
    secondaryButtonText: {
        ...typography.body,
        fontSize: 14,
        color: colors.text.secondary,
        textDecorationLine: 'underline',
        opacity: 0.6,
    },
});
