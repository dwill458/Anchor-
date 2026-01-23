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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '@/types';
import { distillIntention } from '@/utils/sigil/distillation';
import { colors, spacing, typography } from '@/theme';
import { ZenBackground } from '@/components/common';

const { height } = Dimensions.get('window');

type NavigationProp = StackNavigationProp<RootStackParamList, 'CreateAnchor'>;

export default function IntentionInputScreen() {
    const navigation = useNavigation<NavigationProp>();

    const [intention, setIntention] = useState('');
    const [charCount, setCharCount] = useState(0);
    const [placeholder, setPlaceholder] = useState('');

    const fadeAnim = useRef(new Animated.Value(0)).current;

    const PLACEHOLDER_POOL = [
        "Stay focused during training",
        "Respond calmly under pressure",
        "Be present with my family",
        "Trust my decisions",
        "Listen before reacting"
    ];

    // Entrance animation with locked system easing + Random Placeholder
    useEffect(() => {
        // Pick random placeholder
        const randomIndex = Math.floor(Math.random() * PLACEHOLDER_POOL.length);
        setPlaceholder(`e.g. ${PLACEHOLDER_POOL[randomIndex]}`);

        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 800,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
        }).start();
    }, []);

    const [isFocused, setIsFocused] = useState(false);
    const [canSubmit, setCanSubmit] = useState(false);
    const focusAnim = useRef(new Animated.Value(0)).current;

    // Subtle focus glow animation (locked system easing)
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

    // 300ms delay before enabling CTA (as per requirements)
    useEffect(() => {
        if (isValid) {
            const timer = setTimeout(() => {
                setCanSubmit(true);
            }, 300);
            return () => clearTimeout(timer);
        } else {
            setCanSubmit(false);
        }
    }, [isValid]);

    const handleIntentionChange = (text: string) => {
        if (text.length <= maxChars) {
            setIntention(text);
            setCharCount(text.length);
        }
    };

    const handleContinue = () => {
        if (canSubmit) {
            const distillation = distillIntention(intention);
            navigation.navigate('DistillationAnimation', {
                intentionText: intention,
                category: 'personal_growth',
                distilledLetters: distillation.finalLetters,
            });
        }
    };

    // Animated styles for the input - subtle glow only
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
                        <Animated.View
                            style={[
                                styles.titleSection,
                                { opacity: fadeAnim },
                            ]}
                        >
                            <Text style={styles.title}>What are you anchoring right now?</Text>
                            <Text style={styles.subtitle}>
                                Write a short, clear intention.{'\n'}One sentence is enough.
                            </Text>
                        </Animated.View>

                        {/* Intention Input */}
                        <Animated.View
                            style={[
                                styles.section,
                                { opacity: fadeAnim },
                            ]}
                        >
                            <Animated.View
                                style={[
                                    styles.inputContainer,
                                    { borderColor: inputBorderColor }
                                ]}
                            >
                                <TextInput
                                    style={styles.textInput}
                                    value={intention}
                                    onChangeText={handleIntentionChange}
                                    onFocus={() => setIsFocused(true)}
                                    onBlur={() => setIsFocused(false)}
                                    placeholder={placeholder}
                                    placeholderTextColor={'rgba(192, 192, 192, 0.4)'}
                                    multiline
                                    maxLength={maxChars}
                                    autoCapitalize="sentences"
                                    autoCorrect={true}
                                    returnKeyType="none"
                                    blurOnSubmit={false}
                                    enablesReturnKeyAutomatically={false}
                                />
                            </Animated.View>

                            {/* Reassurance Micro-copy */}
                            <Text style={styles.microCopy}>
                                You can refine or release this later.
                            </Text>
                        </Animated.View>

                    </ScrollView>

                    {/* Continue Button */}
                    <Animated.View
                        style={[
                            styles.continueContainer,
                            { opacity: fadeAnim },
                        ]}
                    >
                        <TouchableOpacity
                            onPress={handleContinue}
                            activeOpacity={0.8}
                            disabled={!canSubmit}
                            style={[
                                styles.continueButton,
                                !canSubmit && styles.continueButtonDisabled
                            ]}
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
        paddingHorizontal: spacing.xl, // 32px - locked system
    },
    titleSection: {
        paddingTop: height * 0.15, // 15% screen height - locked system
        paddingBottom: spacing.xl,
    },
    title: {
        ...typography.heading,
        fontSize: 34, // Locked system headline
        lineHeight: 44,
        color: colors.gold,
        marginBottom: spacing.lg, // 24px
        letterSpacing: 0.3, // Locked system
    },
    subtitle: {
        ...typography.body,
        fontSize: 17, // Locked system body
        lineHeight: 28,
        color: colors.text.secondary,
        opacity: 0.85,
    },
    section: {
        marginBottom: spacing.xl,
    },
    inputContainer: {
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.15)', // Default subtle gold
        backgroundColor: 'rgba(26, 26, 29, 0.3)',
        padding: spacing.lg, // 24px
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
        fontSize: 13, // Locked system micro
        color: colors.text.tertiary,
        marginTop: spacing.lg,
        letterSpacing: 0.3,
        opacity: 0.7,
        textAlign: 'left', // Left-aligned per locked system
    },
    continueContainer: {
        paddingHorizontal: spacing.xl, // 32px
        paddingBottom: spacing.xxl, // 48px
        paddingTop: spacing.md,
    },
    continueButton: {
        backgroundColor: colors.gold,
        alignItems: 'flex-start', // Left-aligned per locked system
        borderRadius: 8, // Locked system
        paddingVertical: spacing.md + 2, // 18px - locked system
        paddingHorizontal: spacing.lg, // 24px - locked system
    },
    continueButtonDisabled: {
        backgroundColor: 'rgba(192, 192, 192, 0.15)',
        opacity: 0.5,
    },
    continueText: {
        ...typography.heading,
        fontSize: 17, // Locked system button
        color: colors.navy,
        letterSpacing: 0.5, // Locked system
        fontWeight: '600', // Locked system
    },
    continueTextDisabled: {
        color: 'rgba(255, 255, 255, 0.3)',
    },
});
