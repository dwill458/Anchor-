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
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
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

const { height } = Dimensions.get('window');

// Tense & negation detection patterns for real-time feedback
const FUTURE_WORDS = /\b(will\b|going to|i'll|i'm going to|shall\b|plan to|want to\b|would like|i want)\b/i;
const NEGATION_WORDS = /\b(don't|dont|do not|stop\b|avoid\b|not\b|never\b|won't|wont|can't|cant|no longer|give up)\b/i;
const TENSE_NUDGE_COPY = "Make it present tense: 'I choose…' 'I return…'";

type NavigationProp = StackNavigationProp<RootStackParamList, 'CreateAnchor'>;

export default function IntentionInputScreen() {
    const navigation = useNavigation<NavigationProp>();
    const { recordShown } = useTeachingStore();

    const [intention, setIntention] = useState('');
    const [charCount, setCharCount] = useState(0);
    const [placeholder, setPlaceholder] = useState('');
    const [isFocused, setIsFocused] = useState(false);
    const [canSubmit, setCanSubmit] = useState(false);

    // Teaching: Undertone state
    const [undertoneText, setUndertoneText] = useState<string | null>(null);
    const undertoneOpacity = useRef(new Animated.Value(0)).current;
    const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const firstTimeShownRef = useRef(false);
    const hesitationShownRef = useRef(false);

    // Reduced motion & tense nudge
    const [reduceMotion, setReduceMotion] = useState(false);
    const [tenseNudge, setTenseNudge] = useState(false);
    const tenseDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

    // Cleanup idle timer on unmount
    useEffect(() => () => {
        if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
        if (tenseDebounceRef.current) clearTimeout(tenseDebounceRef.current);
    }, []);

    // Check reduced motion accessibility setting on mount
    useEffect(() => {
        AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
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
    const minChars = 3;
    const isValid = charCount >= minChars && charCount <= maxChars;

    // 300ms delay before enabling CTA
    useEffect(() => {
        if (isValid) {
            const timer = setTimeout(() => setCanSubmit(true), 300);
            return () => clearTimeout(timer);
        } else {
            setCanSubmit(false);
        }
    }, [isValid]);

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
    };

    const handleBlur = () => {
        setIsFocused(false);
        if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
        // Immediate tense check on blur
        setTenseNudge(FUTURE_WORDS.test(intention) || NEGATION_WORDS.test(intention));
    };

    const handleIntentionChange = (text: string) => {
        if (text.length <= maxChars) {
            setIntention(text);
            setCharCount(text.length);

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

            // Tense / negation debounce: check after 1.2s idle
            if (tenseDebounceRef.current) clearTimeout(tenseDebounceRef.current);
            tenseDebounceRef.current = setTimeout(() => {
                setTenseNudge(FUTURE_WORDS.test(text) || NEGATION_WORDS.test(text));
            }, 1200);
        }
    };

    const handleContinue = () => {
        if (canSubmit) {
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
                    style={styles.keyboardView}
                >
                    <ScrollView
                        style={styles.scrollView}
                        contentContainerStyle={styles.scrollContent}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                    >
                        {/* Title Section */}
                        <Animated.View style={[styles.titleSection, { opacity: fadeAnim }]}>
                            <Text style={styles.title}>What are you anchoring right now?</Text>
                            <Text style={styles.subtitle}>
                                Write a short, clear intention.{'\n'}One sentence is enough.
                            </Text>
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
                                    accessibilityLabel="What are you anchoring right now?"
                                />
                            </Animated.View>

                            {/* Reassurance Micro-copy */}
                            <Text style={styles.microCopy}>
                                You can refine or release this later.
                            </Text>

                            {/* Undertone (Pattern 1) — prioritized display: tense nudge > teaching > default */}
                            {tenseNudge ? (
                                <View style={styles.undertoneRow}>
                                    <UndertoneLine text={TENSE_NUDGE_COPY} variant="emphasis" />
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
                            disabled={!canSubmit}
                            style={[
                                styles.continueButton,
                                !canSubmit && styles.continueButtonDisabled
                            ]}
                            accessibilityRole="button"
                            accessibilityLabel="Continue"
                            accessibilityState={{ disabled: !canSubmit }}
                        >
                            <Text style={[
                                styles.continueText,
                                !canSubmit && styles.continueTextDisabled
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
        paddingHorizontal: spacing.xl,
        paddingBottom: spacing.lg,  // 24px — breathing room above CTA when keyboard open
    },
    titleSection: {
        paddingTop: height * 0.15,
        paddingBottom: spacing.xl,
    },
    title: {
        ...typography.heading,
        fontSize: 34,
        lineHeight: 44,
        color: colors.gold,
        marginBottom: spacing.lg,
        letterSpacing: 0.3,
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
