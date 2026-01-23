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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '@/types';
import { distillIntention } from '@/utils/sigil/distillation';
import { colors } from '@/theme';
import { ZenBackground } from '@/components/common';

type NavigationProp = StackNavigationProp<RootStackParamList, 'CreateAnchor'>;

export default function IntentionInputScreen() {
    const navigation = useNavigation<NavigationProp>();

    const [intention, setIntention] = useState('');
    const [charCount, setCharCount] = useState(0);
    const [placeholder, setPlaceholder] = useState('');

    const fadeAnim = useRef(new Animated.Value(0)).current;

    const PLACEHOLDER_POOL = [
        "Stay focused during training",
        "Finish what I start",
        "Respond calmly under pressure",
        "Be present with my family",
        "Trust my decisions"
    ];

    // Slower fade as requested + Random Placeholder
    useEffect(() => {
        // Pick random placeholder
        const randomIndex = Math.floor(Math.random() * PLACEHOLDER_POOL.length);
        setPlaceholder(`e.g. ${PLACEHOLDER_POOL[randomIndex]}`);

        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
        }).start();
    }, []);

    const [isFocused, setIsFocused] = useState(false);
    const focusAnim = useRef(new Animated.Value(0)).current;

    // Focus animation effect
    useEffect(() => {
        Animated.timing(focusAnim, {
            toValue: isFocused ? 1 : 0,
            duration: 400, // Gentle transition
            useNativeDriver: false, // Creating color/layout animations
        }).start();
    }, [isFocused]);

    const maxChars = 100;
    const minChars = 3;
    const isValid = charCount >= minChars && charCount <= maxChars;

    const handleIntentionChange = (text: string) => {
        if (text.length <= maxChars) {
            setIntention(text);
            setCharCount(text.length);
        }
    };

    const handleContinue = () => {
        if (isValid) {
            const distillation = distillIntention(intention);
            navigation.navigate('DistillationAnimation', {
                intentionText: intention,
                category: 'personal_growth',
                distilledLetters: distillation.finalLetters,
            });
        }
    };

    // Animated styles for the input card
    const inputBorderColor = focusAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['rgba(212, 175, 55, 0.2)', 'rgba(212, 175, 55, 0.6)'] // Subtle gold -> brighter gold
    });

    const inputScale = focusAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 1.02] // Very subtle expansion
    });

    const inputShadowOpacity = focusAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 0.2] // Glow effect
    });

    const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);

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
                                    {
                                        transform: [{ scale: inputScale }],
                                        shadowOpacity: inputShadowOpacity,
                                    }
                                ]}
                            >
                                <Animated.View
                                    style={[
                                        styles.inputBorder,
                                        { borderColor: inputBorderColor }
                                    ]}
                                >
                                    <BlurView intensity={12} tint="dark" style={styles.blurContent}>
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
                                            returnKeyType="none" // No "Done" button
                                            blurOnSubmit={false} // Keep keyboard open to encourage manual "Continue"
                                            enablesReturnKeyAutomatically={false}
                                        />
                                    </BlurView>
                                </Animated.View>
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
                            activeOpacity={0.9}
                            disabled={!isValid}
                            style={[
                                styles.continueButton,
                                !isValid && styles.continueButtonDisabled
                            ]}
                        >
                            <Text style={[
                                styles.continueText,
                                !isValid && styles.continueTextDisabled
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
        paddingHorizontal: 24,
    },
    titleSection: {
        paddingTop: 40,
        paddingBottom: 32,
    },
    title: {
        fontSize: 28,
        fontWeight: '600',
        color: colors.gold,
        marginBottom: 16,
        letterSpacing: 0.5,
        lineHeight: 36,
    },
    subtitle: {
        fontSize: 16,
        color: colors.silver,
        lineHeight: 24,
        opacity: 0.8,
    },
    section: {
        marginBottom: 32,
    },
    inputContainer: {
        borderRadius: 20,
        shadowColor: colors.gold,
        shadowOffset: { width: 0, height: 0 },
        shadowRadius: 15,
        backgroundColor: 'transparent',
    },
    inputBorder: {
        borderRadius: 20,
        borderWidth: 1,
        overflow: 'hidden',
        backgroundColor: 'rgba(26, 26, 29, 0.4)',
    },
    blurContent: {
        padding: 24,
        minHeight: 160,
    },
    textInput: {
        fontSize: 20, // Larger, more prominent
        color: colors.bone,
        lineHeight: 30,
        minHeight: 100, // Room to write
        textAlignVertical: 'top',
        // fontFamily: 'System', // Default is fine
    },
    microCopy: {
        marginTop: 16,
        fontSize: 14,
        color: colors.silver,
        textAlign: 'center',
        opacity: 0.5,
    },
    continueContainer: {
        paddingHorizontal: 24,
        paddingBottom: 20,
        paddingTop: 16,
    },
    continueButton: {
        backgroundColor: colors.gold,
        borderRadius: 16,
        paddingVertical: 18,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: colors.gold,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 6,
    },
    continueButtonDisabled: {
        backgroundColor: 'rgba(192, 192, 192, 0.2)', // Faded grey
        shadowOpacity: 0,
        elevation: 0,
    },
    continueText: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.navy,
        letterSpacing: 0.5,
    },
    continueTextDisabled: {
        color: 'rgba(255, 255, 255, 0.3)',
    },
});
