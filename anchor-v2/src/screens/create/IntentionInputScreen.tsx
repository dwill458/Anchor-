/**
 * Anchor App - Intention Input Screen
 *
 * First step in the anchor creation flow.
 * Users enter their intention and see live distillation preview.
 */

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { colors, spacing, typography } from '@/theme';
import { distillIntention, validateIntention } from '@/utils/sigil/distillation';
import { IntentFormatFeedback } from '@/components/IntentFormatFeedback';

/**
 * IntentionInputScreen Component
 */
export const IntentionInputScreen: React.FC = () => {
    const navigation = useNavigation();

    // State
    const [intentionText, setIntentionText] = useState('');
    const [showPreview, setShowPreview] = useState(false);
    const [validationError, setValidationError] = useState<string | null>(null);
    const [showTips, setShowTips] = useState(false);

    // Live distillation preview
    const distillationResult = intentionText.length > 0
        ? distillIntention(intentionText)
        : null;

    /**
     * Validate input whenever it changes
     */
    useEffect(() => {
        if (intentionText.length === 0) {
            setValidationError(null);
            setShowPreview(false);
            return;
        }

        const validation = validateIntention(intentionText);
        if (!validation.isValid) {
            setValidationError(validation.error || 'Invalid intention');
            setShowPreview(false);
        } else {
            setValidationError(null);
            setShowPreview(true);
        }
    }, [intentionText]);

    /**
     * Handle continue button press
     */
    const handleContinue = (): void => {
        const validation = validateIntention(intentionText);

        if (!validation.isValid) {
            setValidationError(validation.error || 'Please enter a valid intention');
            return;
        }

        // Navigate to sigil selection screen (to be created)
        // @ts-expect-error - Navigation will be properly typed once we set up the stack
        navigation.navigate('SigilSelection', {
            intentionText,
            distilledLetters: distillationResult?.finalLetters || [],
        });
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.title}>What is your intention?</Text>
                        <Text style={styles.subtitle}>
                            Enter a clear, focused intention. This could be a goal, affirmation, or desire.
                        </Text>
                    </View>

                    {/* Input Section */}
                    <View style={styles.inputSection}>
                        {/* Intent Formatting Warning - Always visible */}
                        <View style={styles.warningBanner}>
                            <Text style={styles.warningBannerIcon}>⚠️</Text>
                            <View style={styles.warningBannerContent}>
                                <Text style={styles.warningBannerTitle}>Intent Formatting Tips</Text>
                                <Text style={styles.warningBannerText}>
                                    Use present tense: "I am" not "I will"{'\n'}
                                    Be declarative: "I have" not "I want"{'\n'}
                                    Remove doubt: Avoid "maybe/might/try"
                                </Text>
                            </View>
                        </View>

                        <TextInput
                            style={[
                                styles.input,
                                validationError ? styles.inputError : undefined,
                            ]}
                            value={intentionText}
                            onChangeText={setIntentionText}
                            placeholder="e.g., Close the deal, Find inner peace"
                            placeholderTextColor={colors.text.tertiary}
                            multiline
                            maxLength={100}
                            autoFocus
                            returnKeyType="done"
                        />

                        {/* Character count */}
                        <Text style={styles.charCount}>
                            {intentionText.length} / 100
                        </Text>

                        {/* Real-time feedback - shows warnings when weak language detected */}
                        {intentionText.length > 0 && (
                            <IntentFormatFeedback intentionText={intentionText} />
                        )}

                        {/* Validation Error */}
                        {validationError && (
                            <View style={styles.errorContainer}>
                                <Text style={styles.errorText}>⚠️ {validationError}</Text>
                            </View>
                        )}
                    </View>

                    {/* Live Preview */}
                    {showPreview && distillationResult && (
                        <View style={styles.preview}>
                            <Text style={styles.previewTitle}>Distillation Preview</Text>

                            {/* Original */}
                            <View style={styles.previewRow}>
                                <Text style={styles.previewLabel}>Original:</Text>
                                <Text style={styles.previewText}>
                                    {distillationResult.original}
                                </Text>
                            </View>

                            {/* Final Letters */}
                            <View style={styles.previewRow}>
                                <Text style={styles.previewLabel}>Letters:</Text>
                                <View style={styles.lettersContainer}>
                                    {distillationResult.finalLetters.map((letter, index) => (
                                        <View key={index} style={styles.letterBox}>
                                            <Text style={styles.letterText}>{letter}</Text>
                                        </View>
                                    ))}
                                </View>
                            </View>

                            {/* Stats */}
                            <View style={styles.statsRow}>
                                <Text style={styles.statText}>
                                    🗑️ {distillationResult.removedVowels.length} vowels removed
                                </Text>
                                <Text style={styles.statText}>
                                    ♻️ {distillationResult.removedDuplicates.length} duplicates removed
                                </Text>
                            </View>
                        </View>
                    )}

                    {/* Examples */}
                    <View style={styles.examples}>
                        <Text style={styles.examplesTitle}>Example intentions:</Text>
                        <TouchableOpacity
                            style={styles.exampleItem}
                            onPress={() => setIntentionText('Launch my startup')}
                        >
                            <Text style={styles.exampleText}>💼 Launch my startup</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.exampleItem}
                            onPress={() => setIntentionText('Find inner peace')}
                        >
                            <Text style={styles.exampleText}>🧘 Find inner peace</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.exampleItem}
                            onPress={() => setIntentionText('Attract abundance')}
                        >
                            <Text style={styles.exampleText}>💰 Attract abundance</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Continue Button - at bottom of scroll content */}
                    <View style={styles.continueButtonContainer}>
                        <TouchableOpacity
                            style={[
                                styles.continueButton,
                                (!showPreview || validationError) ? styles.continueButtonDisabled : undefined,
                            ]}
                            onPress={handleContinue}
                            disabled={!showPreview || !!validationError}
                        >
                            <Text style={styles.continueButtonText}>
                                Continue
                            </Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background.primary,
    },
    keyboardView: {
        flex: 1,
    },
    scrollContent: {
        padding: spacing.lg,
        paddingBottom: spacing.xxxl,
    },
    header: {
        marginBottom: spacing.xl,
    },
    title: {
        fontSize: typography.sizes.h2,
        fontFamily: typography.fonts.heading,
        color: colors.gold,
        marginBottom: spacing.sm,
    },
    subtitle: {
        fontSize: typography.sizes.body1,
        fontFamily: typography.fonts.body,
        color: colors.text.secondary,
        lineHeight: typography.lineHeights.body1,
    },
    inputSection: {
        marginBottom: spacing.xl,
    },
    input: {
        backgroundColor: colors.background.card,
        borderRadius: 12,
        padding: spacing.md,
        fontSize: typography.sizes.body1,
        fontFamily: typography.fonts.body,
        color: colors.text.primary,
        minHeight: 100,
        textAlignVertical: 'top',
        borderWidth: 2,
        borderColor: 'transparent',
    },
    inputError: {
        borderColor: colors.error,
    },
    charCount: {
        fontSize: typography.sizes.caption,
        fontFamily: typography.fonts.body,
        color: colors.text.tertiary,
        textAlign: 'right',
        marginTop: spacing.xs,
    },
    errorContainer: {
        marginTop: spacing.sm,
        padding: spacing.sm,
        backgroundColor: `${colors.error}20`,
        borderRadius: 8,
    },
    errorText: {
        fontSize: typography.sizes.body2,
        fontFamily: typography.fonts.body,
        color: colors.error,
    },
    preview: {
        backgroundColor: colors.background.card,
        borderRadius: 12,
        padding: spacing.md,
        marginBottom: spacing.xl,
        borderWidth: 1,
        borderColor: colors.gold,
    },
    previewTitle: {
        fontSize: typography.sizes.h4,
        fontFamily: typography.fonts.heading,
        color: colors.gold,
        marginBottom: spacing.md,
    },
    previewRow: {
        marginBottom: spacing.md,
    },
    previewLabel: {
        fontSize: typography.sizes.body2,
        fontFamily: typography.fonts.body,
        color: colors.text.tertiary,
        marginBottom: spacing.xs,
    },
    previewText: {
        fontSize: typography.sizes.body1,
        fontFamily: typography.fonts.body,
        color: colors.text.primary,
    },
    lettersContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    letterBox: {
        backgroundColor: colors.deepPurple,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: 8,
        marginRight: spacing.sm,
        marginBottom: spacing.sm,
    },
    letterText: {
        fontSize: typography.sizes.h4,
        fontFamily: typography.fonts.heading,
        color: colors.gold,
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: spacing.sm,
        paddingTop: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: colors.navy,
    },
    statText: {
        fontSize: typography.sizes.caption,
        fontFamily: typography.fonts.body,
        color: colors.text.secondary,
    },
    examples: {
        marginBottom: spacing.xl,
    },
    examplesTitle: {
        fontSize: typography.sizes.body2,
        fontFamily: typography.fonts.body,
        color: colors.text.tertiary,
        marginBottom: spacing.sm,
    },
    exampleItem: {
        padding: spacing.sm,
        marginBottom: spacing.xs,
    },
    exampleText: {
        fontSize: typography.sizes.body2,
        fontFamily: typography.fonts.body,
        color: colors.text.secondary,
    },
    continueButtonContainer: {
        marginTop: spacing.xl,
        paddingBottom: 100, // Clear the floating tab bar
    },
    continueButton: {
        backgroundColor: colors.gold,
        borderRadius: 12,
        padding: spacing.md,
        alignItems: 'center',
        height: 56,
        justifyContent: 'center',
    },
    continueButtonDisabled: {
        backgroundColor: colors.navy,
        opacity: 0.5,
    },
    continueButtonText: {
        fontSize: typography.sizes.button,
        fontFamily: typography.fonts.bodyBold,
        color: colors.charcoal,
    },
    formattingSection: {
        marginTop: spacing.md,
    },
    tipsHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        backgroundColor: colors.background.card,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.gold,
    },
    tipsTitle: {
        fontSize: typography.sizes.body2,
        fontFamily: typography.fonts.body,
        color: colors.gold,
        fontWeight: '600',
    },
    expandIcon: {
        fontSize: typography.sizes.body2,
        color: colors.gold,
    },
    tipsContent: {
        marginTop: spacing.sm,
        padding: spacing.md,
        backgroundColor: `${colors.gold}10`,
        borderRadius: 8,
    },
    tipsLabel: {
        fontSize: typography.sizes.body2,
        fontFamily: typography.fonts.body,
        color: colors.text.primary,
        fontWeight: '600',
        marginTop: spacing.sm,
    },
    tipsExample: {
        fontSize: typography.sizes.body2,
        fontFamily: typography.fonts.body,
        color: colors.text.secondary,
        marginTop: spacing.xs,
        marginLeft: spacing.md,
        fontStyle: 'italic',
    },
    warningBanner: {
        flexDirection: 'row',
        backgroundColor: 'rgba(244, 67, 54, 0.1)',
        borderWidth: 1,
        borderColor: '#F44336',
        borderRadius: 8,
        padding: spacing.md,
        marginBottom: spacing.md,
    },
    warningBannerIcon: {
        fontSize: 24,
        marginRight: spacing.sm,
    },
    warningBannerContent: {
        flex: 1,
    },
    warningBannerTitle: {
        fontSize: typography.sizes.body1,
        fontFamily: typography.fonts.bodyBold,
        color: '#F44336',
        marginBottom: spacing.xs,
    },
    warningBannerText: {
        fontSize: typography.sizes.caption,
        fontFamily: typography.fonts.body,
        color: colors.text.secondary,
        lineHeight: 18,
    },
});
