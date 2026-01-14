/**
 * Anchor App - Intention Input Screen (Premium Redesign)
 */

import React, { useState, useEffect } from 'react';
import {
    View,
    ScrollView,
    TextInput,
    TouchableOpacity,
    Text,
    Animated,
    Platform,
    KeyboardAvoidingView,
    Dimensions,
    StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';

// Theme and types
import { colors, spacing, typography } from '@/theme';
import type { RootStackParamList, AnchorCategory } from '@/types';
import { distillIntention, validateIntention } from '@/utils/sigil/distillation';

type NavigationProp = StackNavigationProp<RootStackParamList, 'CreateAnchor'>;

interface FormattingFeedback {
    type: 'error' | 'warning' | 'success';
    message: string;
}

interface CategoryOption {
    id: AnchorCategory;
    label: string;
    icon: string;
    color: string;
}

const CATEGORIES: CategoryOption[] = [
    { id: 'career', label: 'Career', icon: '💼', color: colors.gold },
    { id: 'health', label: 'Health', icon: '🧘', color: colors.success },
    { id: 'wealth', label: 'Wealth', icon: '💰', color: colors.bronze },
    { id: 'relationships', label: 'Love', icon: '💕', color: colors.deepPurple },
    { id: 'personal_growth', label: 'Growth', icon: '🌱', color: colors.silver },
];

const EXAMPLE_INTENTIONS = [
    { text: 'I am confident and capable', category: 'personal_growth' as AnchorCategory },
    { text: 'My business thrives with abundance', category: 'wealth' as AnchorCategory },
    { text: 'I attract meaningful relationships', category: 'relationships' as AnchorCategory },
    { text: 'I am healthy and vibrant', category: 'health' as AnchorCategory },
    { text: 'I excel in my career', category: 'career' as AnchorCategory },
];

const FORMATTING_TIPS = [
    'Use present tense: "I am" not "I will be"',
    'Be declarative: "I attract" not "I want"',
    'Avoid uncertainty: "I am" not "I might be"',
    'Feel the emotion: Make it emotionally vivid',
    'Keep it concise: 3-15 words works best',
];

export const IntentionInputScreen: React.FC = () => {
    const navigation = useNavigation<NavigationProp>();
    const [intention, setIntention] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<AnchorCategory>('personal_growth');
    const [showTips, setShowTips] = useState(false);
    const [formattingFeedback, setFormattingFeedback] = useState<FormattingFeedback | null>(null);
    const [distillation, setDistillation] = useState<ReturnType<typeof distillIntention> | null>(null);

    const [tipsHeight] = useState(new Animated.Value(0));
    const [orbOpacity] = useState(new Animated.Value(0));

    // Animate floating orbs on mount (iOS Only)
    useEffect(() => {
        if (Platform.OS === 'ios') {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(orbOpacity, {
                        toValue: 0.3,
                        duration: 3000,
                        useNativeDriver: true,
                    }),
                    Animated.timing(orbOpacity, {
                        toValue: 0.1,
                        duration: 3000,
                        useNativeDriver: true,
                    }),
                ])
            ).start();
        }
    }, [orbOpacity]);

    // Check formatting and validation
    useEffect(() => {
        if (intention.length === 0) {
            setFormattingFeedback(null);
            setDistillation(null);
            return;
        }

        const validation = validateIntention(intention);

        if (!validation.isValid) {
            setFormattingFeedback({
                type: 'error',
                message: validation.error || 'Invalid intention',
            });
            setDistillation(null);
            return;
        }

        // Check formatting
        const weakPatterns = [
            { pattern: /\b(want|wish|hope|try|might|maybe|could|should)\b/i, message: 'Use present tense instead' },
            { pattern: /\bI will\b/i, message: 'Use "I am" instead of "I will"' },
            { pattern: /\b(possibly|probably|maybe)\b/i, message: 'Avoid uncertainty words' },
        ];

        let feedback: FormattingFeedback | null = null;
        for (const { pattern, message } of weakPatterns) {
            if (pattern.test(intention)) {
                feedback = { type: 'warning', message };
                break;
            }
        }

        if (!feedback) {
            feedback = { type: 'success', message: '✨ Perfect phrasing!' };
        }

        setFormattingFeedback(feedback);

        // Distill the intention
        const result = distillIntention(intention);
        setDistillation(result);
    }, [intention]);

    const toggleTips = () => {
        Animated.timing(tipsHeight, {
            toValue: showTips ? 0 : 1,
            duration: 300,
            useNativeDriver: false,
        }).start();
        setShowTips(!showTips);
    };

    const handleSelectExample = (example: (typeof EXAMPLE_INTENTIONS)[0]) => {
        setIntention(example.text);
        setSelectedCategory(example.category);
    };

    const handleContinue = () => {
        if (!distillation || !validateIntention(intention).isValid) {
            return;
        }

        navigation.navigate('SigilSelection', {
            intentionText: intention,
            category: selectedCategory,
            distilledLetters: distillation.finalLetters,
        });
    };

    const canContinue = !!(distillation && validateIntention(intention).isValid);
    const screenHeight = Dimensions.get('window').height;

    return (
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
            {/* Animated Background */}
            <View style={StyleSheet.absoluteFill}>
                <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.navy }]} />

                {/* Floating Orbs (iOS Only) */}
                {Platform.OS === 'ios' && (
                    <>
                        <Animated.View
                            style={[
                                styles.orb,
                                {
                                    width: 300,
                                    height: 300,
                                    borderRadius: 150,
                                    backgroundColor: colors.deepPurple,
                                    top: -100,
                                    right: -100,
                                    opacity: orbOpacity,
                                },
                            ]}
                        />
                        <Animated.View
                            style={[
                                styles.orb,
                                {
                                    width: 200,
                                    height: 200,
                                    borderRadius: 100,
                                    backgroundColor: colors.gold,
                                    bottom: -50,
                                    left: -50,
                                    opacity: orbOpacity,
                                },
                            ]}
                        />
                    </>
                )}
            </View>

            {/* Content */}
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <ScrollView
                    contentContainerStyle={{ flexGrow: 1, paddingBottom: 120 }}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
                        {/* Header */}
                        <View style={{ marginBottom: spacing.xl }}>
                            <Text style={styles.title}>What is your intention?</Text>
                            <Text style={styles.subtitle}>
                                Enter a clear, focused intention. This could be a goal, affirmation, or desire.
                            </Text>
                        </View>

                        {/* Category Selection */}
                        <View style={{ marginBottom: spacing.lg }}>
                            <Text style={styles.sectionLabel}>CATEGORY</Text>
                            <View style={styles.categoryContainer}>
                                {CATEGORIES.map((cat) => (
                                    <TouchableOpacity
                                        key={cat.id}
                                        onPress={() => setSelectedCategory(cat.id)}
                                        style={[
                                            styles.categoryButton,
                                            {
                                                backgroundColor: selectedCategory === cat.id ? cat.color : colors.background.secondary,
                                                borderColor: selectedCategory === cat.id ? colors.gold : colors.background.secondary,
                                            },
                                        ]}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={[styles.categoryText, { color: selectedCategory === cat.id ? colors.charcoal : colors.text.primary }]}>
                                            {cat.icon} {cat.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {/* Input Area - Glass Card */}
                        <View style={styles.glassContainer}>
                            {Platform.OS === 'ios' ? (
                                <BlurView intensity={20} tint="dark" style={styles.blurContainer}>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="e.g., I am confident and capable"
                                        placeholderTextColor={colors.text.tertiary}
                                        multiline
                                        maxLength={100}
                                        value={intention}
                                        onChangeText={setIntention}
                                    />
                                </BlurView>
                            ) : (
                                <View style={[styles.blurContainer, { backgroundColor: 'rgba(26,26,29,0.95)' }]}>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="e.g., I am confident and capable"
                                        placeholderTextColor={colors.text.tertiary}
                                        multiline
                                        maxLength={100}
                                        value={intention}
                                        onChangeText={setIntention}
                                    />
                                </View>
                            )}
                        </View>

                        {/* Character Count */}
                        <View style={styles.charCountContainer}>
                            <Text style={styles.charCountText}>
                                {intention.length} / 100
                            </Text>
                        </View>

                        {/* Formatting Feedback */}
                        {formattingFeedback && (
                            <View
                                style={[
                                    styles.feedbackBanner,
                                    {
                                        backgroundColor:
                                            formattingFeedback.type === 'error'
                                                ? 'rgba(244, 67, 54, 0.1)'
                                                : formattingFeedback.type === 'warning'
                                                    ? 'rgba(255, 152, 0, 0.1)'
                                                    : 'rgba(76, 175, 80, 0.1)',
                                        borderLeftColor:
                                            formattingFeedback.type === 'error'
                                                ? colors.error
                                                : formattingFeedback.type === 'warning'
                                                    ? colors.warning
                                                    : colors.success,
                                    },
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.feedbackText,
                                        {
                                            color:
                                                formattingFeedback.type === 'error'
                                                    ? colors.error
                                                    : formattingFeedback.type === 'warning'
                                                        ? colors.warning
                                                        : colors.success,
                                        },
                                    ]}
                                >
                                    {formattingFeedback.message}
                                </Text>
                            </View>
                        )}

                        {/* Distillation Preview */}
                        {distillation && (
                            <View style={styles.distillationContainer}>
                                {Platform.OS === 'ios' ? (
                                    <BlurView intensity={10} tint="dark" style={styles.distillationContent}>
                                        <Text style={styles.sectionLabel}>DISTILLED LETTERS</Text>
                                        <View style={styles.lettersGrid}>
                                            {distillation.finalLetters.map((letter, i) => (
                                                <View key={i} style={styles.letterBox}>
                                                    <Text style={styles.letterText}>{letter}</Text>
                                                </View>
                                            ))}
                                        </View>
                                        <View style={styles.distillationStats}>
                                            <Text style={styles.statText}>🗑️ {distillation.removedVowels.length} vowels</Text>
                                            <Text style={styles.statText}>♻️ {distillation.removedDuplicates.length} duplicates</Text>
                                        </View>
                                    </BlurView>
                                ) : (
                                    <View style={[styles.distillationContent, { backgroundColor: 'rgba(25,25,30,0.9)' }]}>
                                        <Text style={styles.sectionLabel}>DISTILLED LETTERS</Text>
                                        <View style={styles.lettersGrid}>
                                            {distillation.finalLetters.map((letter, i) => (
                                                <View key={i} style={styles.letterBox}>
                                                    <Text style={styles.letterText}>{letter}</Text>
                                                </View>
                                            ))}
                                        </View>
                                        <View style={styles.distillationStats}>
                                            <Text style={styles.statText}>🗑️ {distillation.removedVowels.length} vowels</Text>
                                            <Text style={styles.statText}>♻️ {distillation.removedDuplicates.length} duplicates</Text>
                                        </View>
                                    </View>
                                )}
                            </View>
                        )}

                        {/* Formatting Tips */}
                        <View style={{ marginBottom: spacing.lg }}>
                            <TouchableOpacity onPress={toggleTips} activeOpacity={0.7} style={styles.tipsToggle}>
                                <Text style={styles.tipsToggleText}>
                                    💡 Intent Formatting Tips {showTips ? '▼' : '▶'}
                                </Text>
                            </TouchableOpacity>

                            {showTips && (
                                <View style={styles.tipsContainer}>
                                    {FORMATTING_TIPS.map((tip, i) => (
                                        <View key={i} style={styles.tipRow}>
                                            <Text style={styles.tipBullet}>•</Text>
                                            <Text style={styles.tipText}>{tip}</Text>
                                        </View>
                                    ))}
                                </View>
                            )}
                        </View>

                        {/* Example Intentions */}
                        <View style={{ marginBottom: spacing.xl, paddingBottom: 40 }}>
                            <Text style={[styles.sectionLabel, { marginBottom: spacing.md }]}>EXAMPLE INTENTIONS</Text>
                            {EXAMPLE_INTENTIONS.map((example, i) => (
                                <TouchableOpacity
                                    key={i}
                                    onPress={() => handleSelectExample(example)}
                                    style={styles.exampleButton}
                                    activeOpacity={0.8}
                                >
                                    <View style={styles.exampleInner}>
                                        <Text style={styles.exampleText}>"{example.text}"</Text>
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </View>
                        {/* Continue Button - Moved inside ScrollView for better accessibility */}
                        <View style={styles.footer}>
                            <TouchableOpacity
                                onPress={handleContinue}
                                disabled={!canContinue}
                                style={[
                                    styles.continueButton,
                                    { backgroundColor: canContinue ? colors.gold : 'rgba(212, 175, 55, 0.2)' },
                                ]}
                                activeOpacity={0.8}
                            >
                                <Text style={[styles.continueButtonText, { color: canContinue ? colors.charcoal : colors.text.tertiary }]}>
                                    Continue to Anchor Selection
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.navy },
    orb: { position: 'absolute' },
    title: {
        fontSize: typography.sizes.h2,
        fontFamily: typography.fonts.heading,
        color: colors.gold,
        marginBottom: spacing.sm,
    },
    subtitle: {
        fontSize: typography.sizes.body2,
        fontFamily: typography.fonts.body,
        color: colors.text.secondary,
        lineHeight: 22,
    },
    sectionLabel: {
        fontSize: typography.sizes.caption,
        fontFamily: typography.fonts.bodyBold,
        color: colors.text.tertiary,
        marginBottom: spacing.sm,
        letterSpacing: 1,
    },
    categoryContainer: {
        flexDirection: 'row',
        gap: spacing.sm,
        flexWrap: 'wrap',
    },
    categoryButton: {
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: 8,
        borderWidth: 1,
    },
    categoryText: {
        fontSize: typography.sizes.body2,
        fontFamily: typography.fonts.body,
    },
    glassContainer: {
        marginBottom: spacing.lg,
        overflow: 'hidden',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.3)',
    },
    blurContainer: {
        padding: spacing.md,
        minHeight: 120,
    },
    input: {
        color: colors.text.primary,
        fontSize: typography.sizes.body1,
        fontFamily: typography.fonts.body,
        textAlignVertical: 'top',
        padding: 0,
        flex: 1,
    },
    charCountContainer: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginBottom: spacing.md,
    },
    charCountText: {
        fontSize: typography.sizes.caption,
        fontFamily: typography.fonts.body,
        color: colors.text.tertiary,
    },
    feedbackBanner: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: 8,
        marginBottom: spacing.lg,
        borderLeftWidth: 4,
    },
    feedbackText: {
        fontSize: typography.sizes.body2,
        fontFamily: typography.fonts.bodyBold,
    },
    distillationContainer: {
        marginBottom: spacing.lg,
        overflow: 'hidden',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.2)',
    },
    distillationContent: {
        padding: spacing.md,
    },
    lettersGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
    },
    letterBox: {
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.md,
        backgroundColor: colors.deepPurple,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.2)',
    },
    letterText: {
        fontSize: typography.sizes.body1,
        fontFamily: typography.fonts.heading,
        color: colors.gold,
    },
    distillationStats: {
        marginTop: spacing.md,
        paddingTop: spacing.md,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.05)',
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    statText: {
        fontSize: typography.sizes.caption,
        fontFamily: typography.fonts.body,
        color: colors.text.secondary,
    },
    tipsToggle: {
        marginBottom: spacing.sm,
    },
    tipsToggleText: {
        fontSize: typography.sizes.body2,
        fontFamily: typography.fonts.bodyBold,
        color: colors.gold,
    },
    tipsContainer: {
        borderRadius: 12,
        marginBottom: spacing.md,
        backgroundColor: 'rgba(255, 193, 7, 0.08)',
        padding: spacing.md,
        borderWidth: 1,
        borderColor: 'rgba(255, 193, 7, 0.2)',
    },
    tipRow: {
        marginBottom: spacing.sm,
        flexDirection: 'row',
    },
    tipBullet: {
        color: colors.warning,
        marginRight: spacing.sm,
        fontSize: 16,
    },
    tipText: {
        color: colors.text.secondary,
        fontSize: typography.sizes.body2,
        fontFamily: typography.fonts.body,
        flex: 1,
    },
    exampleButton: {
        marginBottom: spacing.sm,
        borderRadius: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
        overflow: 'hidden',
    },
    exampleInner: {
        padding: spacing.md,
    },
    exampleText: {
        fontSize: typography.sizes.body2,
        fontFamily: typography.fonts.body,
        color: colors.text.secondary,
        fontStyle: 'italic',
    },
    footer: {
        padding: spacing.lg,
        paddingBottom: spacing.xl,
        marginTop: spacing.md,
    },
    continueButton: {
        height: 56,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: colors.gold,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    continueButtonText: {
        fontSize: typography.sizes.button,
        fontFamily: typography.fonts.bodyBold,
    },
});

export default IntentionInputScreen;
