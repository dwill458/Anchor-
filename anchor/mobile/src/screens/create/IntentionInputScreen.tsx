import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    Animated,
    Dimensions,
    Easing,
    AccessibilityInfo,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '@/types';
import { distillIntention } from '@/utils/sigil/distillation';
import { detectCategoryFromText } from '@/utils/categoryDetection';
import { colors, spacing, typography } from '@/theme';
import { ZenBackground, UndertoneLine } from '@/components/common';
import { useTeachingGate } from '@/utils/useTeachingGate';
import { useTeachingStore } from '@/stores/teachingStore';
import { AnalyticsService } from '@/services/AnalyticsService';
import { TEACHINGS } from '@/constants/teaching';
import { useIntentionValidation } from '@/hooks/useIntentionValidation';

const { height } = Dimensions.get('window');

type NavigationProp = StackNavigationProp<RootStackParamList, 'CreateAnchor'>;

export default function IntentionInputScreen() {
    const navigation = useNavigation<NavigationProp>();
    const insets = useSafeAreaInsets();
    const { recordShown } = useTeachingStore();

    const scrollViewRef = useRef<ScrollView>(null);
    const [intention, setIntention] = useState('');
    const [placeholder, setPlaceholder] = useState('');
    const [isFocused, setIsFocused] = useState(false);
    const [delayedCanSubmit, setDelayedCanSubmit] = useState(false);
    const intentionValidation = useIntentionValidation(intention);

    // Teaching: Undertone state
    const [undertoneText, setUndertoneText] = useState<string | null>(null);
    const undertoneOpacity = useRef(new Animated.Value(0)).current;
    const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const firstTimeShownRef = useRef(false);
    const hesitationShownRef = useRef(false);

    // Reduced motion
    const [reduceMotion, setReduceMotion] = useState(false);

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const focusAnim = useRef(new Animated.Value(0)).current;

    // Teaching gate — evaluated once per render cycle; gates enforce lifetime limits
    const firstTimeTeaching = useTeachingGate({
        screenId: 'intention_input',
        candidateIds: ['intention_input_first_time_v1'],
    });
    const hesitationTeaching = useTeachingGate({
        screenId: 'intention_input',
        candidateIds: ['intention_input_hesitation_v1'],
    });

    const showUndertone = (text: string, teachingId: string) => {
        const content = TEACHINGS[teachingId];
        setUndertoneText(text);
        recordShown(teachingId, 'inline_whisper', content?.maxShows ?? 1);
        AnalyticsService.track('teaching_shown', {
            teaching_id: teachingId,
            pattern: 'inline_whisper',
            screen: 'intention_input',
            trigger: content?.trigger ?? 'first_time',
            guide_mode: true,
        });
        // Respect reduced motion preference
        if (reduceMotion) {
            undertoneOpacity.setValue(1);
        } else {
            Animated.timing(undertoneOpacity, {
                toValue: 1,
                duration: 400,
                useNativeDriver: true,
            }).start();
        }
    };

    const PLACEHOLDER_POOL = [
        "Stay focused during training",
        "Respond calmly under pressure",
        "Be present with my family",
        "Trust my decisions",
        "Listen before reacting"
    ];

    // Entrance animation + random placeholder
    useEffect(() => {
        const randomIndex = Math.floor(Math.random() * PLACEHOLDER_POOL.length);
        setPlaceholder(`e.g. ${PLACEHOLDER_POOL[randomIndex]}`);

        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 800,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
        }).start();
    }, []);

    useFocusEffect(
        React.useCallback(() => {
            setIntention('');
            setDelayedCanSubmit(false);
            setIsFocused(false);
            setUndertoneText(null);

            if (idleTimerRef.current) clearTimeout(idleTimerRef.current);

            undertoneOpacity.setValue(0);
            focusAnim.setValue(0);

            return () => {
                if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
            };
        }, [focusAnim, idleTimerRef, undertoneOpacity])
    );

    // Cleanup idle timer on unmount
    useEffect(() => () => {
        if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    }, []);

    // Check reduced motion accessibility setting on mount
    useEffect(() => {
        AccessibilityInfo.isReduceMotionEnabled().then((v) => setReduceMotion(v));
    }, []);

    // Subtle focus glow animation
    useEffect(() => {
        Animated.timing(focusAnim, {
            toValue: isFocused ? 1 : 0,
            duration: 400,
            easing: isFocused ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
            useNativeDriver: false,
        }).start();
    }, [isFocused]);

    const maxChars = 100;

    // 300ms delay before enabling CTA
    useEffect(() => {
        if (intentionValidation.canSubmit) {
            const timer = setTimeout(() => setDelayedCanSubmit(true), 300);
            return () => clearTimeout(timer);
        } else {
            setDelayedCanSubmit(false);
        }
    }, [intentionValidation.canSubmit]);

    const handleFocus = () => {
        setIsFocused(true);
        // First-time undertone: show after 1.2s of focus with no keystrokes
        if (firstTimeTeaching && !firstTimeShownRef.current) {
            idleTimerRef.current = setTimeout(() => {
                if (firstTimeTeaching && !firstTimeShownRef.current) {
                    firstTimeShownRef.current = true;
                    showUndertone(firstTimeTeaching.copy, firstTimeTeaching.teachingId);
                }
            }, 1200);
        }
        // Scroll to end of ScrollView to make sure text box is visible above the keyboard
        setTimeout(() => {
            scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 150);
    };

    const handleBlur = () => {
        setIsFocused(false);
        if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };

    const handleIntentionChange = (text: string) => {
        if (text.length <= maxChars) {
            setIntention(text);

            // Reset idle timer on every keystroke
            if (idleTimerRef.current) clearTimeout(idleTimerRef.current);

            // Dismiss first-time timer (user is typing, no longer idle)
            // Schedule hesitation hint after 8s idle (only if user has typed something)
            if (isFocused && hesitationTeaching && !hesitationShownRef.current && text.length > 0) {
                idleTimerRef.current = setTimeout(() => {
                    if (hesitationTeaching && !hesitationShownRef.current) {
                        hesitationShownRef.current = true;
                        showUndertone(hesitationTeaching.copy, hesitationTeaching.teachingId);
                    }
                }, 8000);
            }

        }
    };

    const handleContinue = () => {
        if (delayedCanSubmit) {
            const distillation = distillIntention(intention);
            const category = detectCategoryFromText(intention);
            navigation.navigate('LetterDistillation', {
                intentionText: intention,
                category,
                distilledLetters: distillation.finalLetters,
            });
        }
    };

    const inputBorderColor = focusAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['rgba(212, 175, 55, 0.15)', 'rgba(212, 175, 55, 0.4)']
    });

    return (
        <View style={styles.container}>
            <StatusBar style="light" />
            <ZenBackground />

            <SafeAreaView style={styles.safeArea}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + spacing.sm : 0}
                    style={styles.keyboardView}
                >
                    <ScrollView
                        ref={scrollViewRef}
                        style={styles.scrollView}
                        contentContainerStyle={styles.scrollContent}
                        contentInsetAdjustmentBehavior="always"
                        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                    >
                        {/* Title Section */}
                        <Animated.View style={[
                            styles.titleSection,
                            isFocused && styles.titleSectionFocused,
                            { opacity: fadeAnim }
                        ]}>
                            <Text style={[styles.title, isFocused && styles.titleFocused]}>
                                What are you anchoring right now?
                            </Text>
                            {!isFocused && (
                                <Text style={styles.subtitle}>
                                    Write a short, clear intention.{'\n'}One sentence is enough.
                                </Text>
                            )}
                        </Animated.View>

                        {/* Intention Input */}
                        <Animated.View style={[styles.section, { opacity: fadeAnim }]}>
                            <Animated.View style={[styles.inputContainer, { borderColor: inputBorderColor }]}>
                                <TextInput
                                    style={styles.textInput}
                                    value={intention}
                                    onChangeText={handleIntentionChange}
                                    onFocus={handleFocus}
                                    onBlur={handleBlur}
                                    placeholder={placeholder}
                                    placeholderTextColor={'rgba(192, 192, 192, 0.4)'}
                                    multiline
                                    maxLength={maxChars}
                                    autoCapitalize="sentences"
                                    autoCorrect={true}
                                    returnKeyType="none"
                                    blurOnSubmit={false}
                                    enablesReturnKeyAutomatically={false}
                                    selectionColor={colors.gold}
                                    accessibilityLabel="What are you anchoring right now?"
                                />
                            </Animated.View>

                            {/* Reassurance Micro-copy */}
                            <Text style={styles.microCopy}>
                                You can refine or release this later.
                            </Text>

                            {/* Undertone (Pattern 1) — prioritized display: guidance > teaching > default */}
                            {intentionValidation.guidanceText ? (
                                <View style={styles.undertoneRow}>
                                    <UndertoneLine text={intentionValidation.guidanceText} variant="emphasis" />
                                </View>
                            ) : undertoneText ? (
                                <Animated.View style={[styles.undertoneRow, { opacity: undertoneOpacity }]}>
                                    <UndertoneLine text={undertoneText} variant="default" />
                                </Animated.View>
                            ) : (
                                <View style={styles.undertoneRow}>
                                    <UndertoneLine text="Short. Present. Felt." variant="default" />
                                </View>
                            )}
                        </Animated.View>

                    </ScrollView>

                    {/* Continue Button */}
                    <Animated.View style={[styles.continueContainer, { opacity: fadeAnim }]}>
                        <TouchableOpacity
                            onPress={handleContinue}
                            activeOpacity={0.8}
                            disabled={!delayedCanSubmit}
                            style={[
                                styles.continueButton,
                                !delayedCanSubmit && styles.continueButtonDisabled
                            ]}
                            accessibilityRole="button"
                            accessibilityLabel="Continue"
                            accessibilityState={{ disabled: !delayedCanSubmit }}
                        >
                            <Text style={[
                                styles.continueText,
                                !delayedCanSubmit && styles.continueTextDisabled
                            ]}>
                                Continue
                            </Text>
                        </TouchableOpacity>
                    </Animated.View>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.navy,
    },
    safeArea: {
        flex: 1,
    },
    keyboardView: {
        flex: 1,
        justifyContent: 'space-between',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: spacing.xl,
        paddingBottom: spacing.lg,  // 24px — breathing room above CTA when keyboard open
    },
    titleSection: {
        paddingTop: height * 0.15,
        paddingBottom: spacing.xl,
    },
    titleSectionFocused: {
        paddingTop: Platform.OS === 'ios' ? spacing.md : spacing.sm,
        paddingBottom: spacing.sm,
    },
    title: {
        ...typography.heading,
        fontSize: 34,
        lineHeight: 44,
        color: colors.gold,
        marginBottom: spacing.lg,
        letterSpacing: 0.3,
    },
    titleFocused: {
        fontSize: 22,
        lineHeight: 28,
        marginBottom: spacing.xs,
    },
    subtitle: {
        ...typography.body,
        fontSize: 17,
        lineHeight: 28,
        color: colors.text.secondary,
        opacity: 0.85,
    },
    section: {
        marginBottom: spacing.xl,
    },
    inputContainer: {
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.15)',
        backgroundColor: 'rgba(26, 26, 29, 0.3)',
        padding: spacing.lg,
        minHeight: 140,
    },
    textInput: {
        ...typography.body,
        fontSize: 17,
        color: colors.text.primary,
        lineHeight: 28,
        minHeight: 90,
        paddingTop: spacing.xs,
        paddingBottom: spacing.xs,
        paddingHorizontal: 0,
        textAlignVertical: 'top',
    },
    microCopy: {
        ...typography.body,
        fontSize: 13,
        color: colors.text.tertiary,
        marginTop: spacing.lg,
        letterSpacing: 0.3,
        opacity: 0.7,
        textAlign: 'left',
    },
    undertoneRow: {
        marginTop: spacing.sm,  // 8px
    },
    continueContainer: {
        paddingHorizontal: spacing.xl,
        paddingBottom: spacing.xxl,
        paddingTop: spacing.md,
    },
    continueButton: {
        backgroundColor: colors.gold,
        alignItems: 'center',
        borderRadius: 8,
        paddingVertical: spacing.md + 2,
        paddingHorizontal: spacing.lg,
    },
    continueButtonDisabled: {
        backgroundColor: 'rgba(192, 192, 192, 0.15)',
        opacity: 0.5,
    },
    continueText: {
        ...typography.heading,
        fontSize: 17,
        color: colors.navy,
        letterSpacing: 0.5,
        fontWeight: '600',
    },
    continueTextDisabled: {
        color: 'rgba(255, 255, 255, 0.3)',
    },
});
