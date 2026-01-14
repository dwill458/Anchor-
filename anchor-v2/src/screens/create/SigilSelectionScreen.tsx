/**
 * Anchor App - Sigil Selection Screen
 *
 * Second step in the anchor creation flow.
 * Users view and select from 3 generated sigil variations.
 */

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Platform,
    Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { colors, spacing, typography } from '@/theme';
import { generateSigil, SigilVariant } from '@/utils/sigil/traditional-generator';
import { SvgXml } from 'react-native-svg';
import { AnchorCategory, RootStackParamList } from '@/types';
import { StackNavigationProp } from '@react-navigation/stack';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SIGIL_SIZE = SCREEN_WIDTH - spacing.xl * 2;

/**
 * Route params for this screen
 */
type SigilSelectionRouteParams = {
    intentionText: string;
    category: AnchorCategory;
    distilledLetters: string[];
};

/**
 * Variant info for display
 */
const VARIANT_INFO: Record<SigilVariant, { title: string; description: string }> = {
    dense: {
        title: 'Dense',
        description: 'Bold and powerful, maximum visual impact',
    },
    balanced: {
        title: 'Balanced',
        description: 'Harmonious blend of strength and clarity',
    },
    minimal: {
        title: 'Minimal',
        description: 'Clean and focused, subtle elegance',
    },
};

/**
 * SigilSelectionScreen Component
 */
export const SigilSelectionScreen: React.FC = () => {
    const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
    const route = useRoute<RouteProp<{ params: SigilSelectionRouteParams }, 'params'>>();

    const { intentionText, distilledLetters, category } = route.params;

    // State
    const [selectedVariant, setSelectedVariant] = useState<SigilVariant>('balanced');
    const [sigilResult, setSigilResult] = useState<ReturnType<typeof generateSigil> | null>(null);
    const [error, setError] = useState<string | null>(null);

    /**
     * Generate sigils on mount
     */
    useEffect(() => {
        try {
            const result = generateSigil(distilledLetters);
            setSigilResult(result);
            setError(null);
        } catch (error) {
            console.error('Failed to generate sigil:', error);
            setError(error instanceof Error ? error.message : 'Failed to forge Anchor. Please try again.');
        }
    }, [distilledLetters]);

    /**
     * Handle retry after error
     */
    const handleRetry = (): void => {
        setError(null);
        setSigilResult(null);
        try {
            const result = generateSigil(distilledLetters);
            setSigilResult(result);
        } catch (error) {
            console.error('Failed to generate sigil on retry:', error);
            setError(error instanceof Error ? error.message : 'Failed to forge Anchor. Please try again.');
        }
    };

    /**
     * Handle continue button press
     */
    const handleContinue = (): void => {
        if (!sigilResult) return;

        const selectedSvg = sigilResult.svgs[selectedVariant];

        // Navigate to Enhancement Choice screen (Phase 2)
        navigation.navigate('EnhancementChoice', {
            intentionText,
            category,
            distilledLetters,
            sigilSvg: selectedSvg,
            sigilVariant: selectedVariant,
        });
    };

    /**
     * Render individual sigil variant card
     */
    const renderVariantCard = (variant: SigilVariant): React.JSX.Element => {
        const isSelected = selectedVariant === variant;
        const info = VARIANT_INFO[variant];

        return (
            <TouchableOpacity
                key={variant}
                style={[
                    styles.variantCard,
                    isSelected && styles.variantCardSelected,
                ]}
                onPress={() => setSelectedVariant(variant)}
                activeOpacity={0.8}
            >
                {/* Sigil Preview */}
                <View style={styles.sigilContainer}>
                    {sigilResult && (
                        <SvgXml
                            xml={sigilResult.svgs[variant]}
                            width={120}
                            height={120}
                            color={isSelected ? colors.gold : colors.text.primary}
                        />
                    )}
                </View>

                {/* Variant Info */}
                <View style={styles.variantInfo}>
                    <Text style={[styles.variantTitle, isSelected && styles.variantTitleSelected]}>
                        {info.title}
                    </Text>
                    <Text style={styles.variantDescription}>
                        {info.description}
                    </Text>
                </View>

                {/* Selection Indicator */}
                {isSelected && (
                    <View style={styles.selectedIndicator}>
                        <Text style={styles.selectedIcon}>✓</Text>
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    // Show error state if generation failed
    if (error) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.errorContainer}>
                    <Text style={styles.errorIcon}>⚠️</Text>
                    <Text style={styles.errorTitle}>Generation Failed</Text>
                    <Text style={styles.errorText}>{error}</Text>
                    <TouchableOpacity
                        style={styles.retryButton}
                        onPress={handleRetry}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.retryButtonText}>Try Again</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => navigation.goBack()}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.backButtonText}>Go Back</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    // Show loading state while generating
    if (!sigilResult) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <Text style={styles.loadingText}>Forging your Anchor...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
            {/* Animated Background */}
            <View style={StyleSheet.absoluteFill}>
                <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.navy }]} />
                {Platform.OS === 'ios' && (
                    <View style={StyleSheet.absoluteFill}>
                        <View style={[styles.orb, { width: 300, height: 300, borderRadius: 150, backgroundColor: colors.deepPurple, top: -100, right: -100, opacity: 0.1 }]} />
                        <View style={[styles.orb, { width: 200, height: 200, borderRadius: 100, backgroundColor: colors.gold, bottom: -50, left: -50, opacity: 0.1 }]} />
                    </View>
                )}
            </View>
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.title}>Choose Your Anchor</Text>
                    <Text style={styles.subtitle}>
                        Each variation channels your intention "{intentionText}" in a unique visual form.
                    </Text>
                </View>

                {/* Distilled Letters Display */}
                <View style={styles.lettersSection}>
                    <Text style={styles.lettersLabel}>Your Distilled Letters</Text>
                    <View style={styles.lettersContainer}>
                        {distilledLetters.map((letter, index) => (
                            <View key={index} style={styles.letterBox}>
                                <Text style={styles.letterText}>{letter}</Text>
                            </View>
                        ))}
                    </View>
                </View>

                {/* Large Preview of Selected Sigil */}
                <View style={styles.previewSection}>
                    <View style={styles.previewContainer}>
                        <SvgXml
                            xml={sigilResult.svgs[selectedVariant]}
                            width={SIGIL_SIZE}
                            height={SIGIL_SIZE}
                            color={colors.gold}
                        />
                    </View>
                    <Text style={styles.previewLabel}>
                        {VARIANT_INFO[selectedVariant].title} Style
                    </Text>
                </View>

                {/* Variant Selection Grid */}
                <View style={styles.variantsSection}>
                    <Text style={styles.variantsTitle}>Select a Style</Text>
                    <View style={styles.variantsGrid}>
                        {(['dense', 'balanced', 'minimal'] as SigilVariant[]).map(renderVariantCard)}
                    </View>
                </View>
            </ScrollView>

            {/* Continue Button */}
            <View style={styles.footer}>
                <TouchableOpacity
                    style={styles.continueButton}
                    onPress={handleContinue}
                >
                    <Text style={styles.continueButtonText}>
                        Continue
                    </Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.navy,
    },
    orb: {
        position: 'absolute',
    },
    scrollContent: {
        padding: spacing.lg,
        paddingBottom: spacing.xxxl,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        fontSize: typography.sizes.body1,
        fontFamily: typography.fonts.body,
        color: colors.text.secondary,
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: spacing.xl,
    },
    errorIcon: {
        fontSize: 64,
        marginBottom: spacing.lg,
    },
    errorTitle: {
        fontSize: typography.sizes.h2,
        fontFamily: typography.fonts.heading,
        color: colors.error,
        marginBottom: spacing.md,
        textAlign: 'center',
    },
    errorText: {
        fontSize: typography.sizes.body1,
        fontFamily: typography.fonts.body,
        color: colors.text.secondary,
        textAlign: 'center',
        marginBottom: spacing.xl,
        lineHeight: typography.lineHeights.body1,
    },
    retryButton: {
        backgroundColor: colors.gold,
        borderRadius: 12,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.xl,
        marginBottom: spacing.md,
        minWidth: 200,
    },
    retryButtonText: {
        fontSize: typography.sizes.button,
        fontFamily: typography.fonts.bodyBold,
        color: colors.charcoal,
        textAlign: 'center',
    },
    backButton: {
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.xl,
    },
    backButtonText: {
        fontSize: typography.sizes.button,
        fontFamily: typography.fonts.body,
        color: colors.text.secondary,
        textAlign: 'center',
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
    lettersSection: {
        marginBottom: spacing.xl,
    },
    lettersLabel: {
        fontSize: typography.sizes.body2,
        fontFamily: typography.fonts.body,
        color: colors.text.tertiary,
        marginBottom: spacing.sm,
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
    previewSection: {
        alignItems: 'center',
        marginBottom: spacing.xl,
    },
    previewContainer: {
        width: SIGIL_SIZE,
        height: SIGIL_SIZE,
        backgroundColor: colors.background.card,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.md,
        borderWidth: 2,
        borderColor: colors.gold,
    },
    previewLabel: {
        fontSize: typography.sizes.body1,
        fontFamily: typography.fonts.bodyBold,
        color: colors.gold,
    },
    variantsSection: {
        marginBottom: spacing.xl,
    },
    variantsTitle: {
        fontSize: typography.sizes.h3,
        fontFamily: typography.fonts.heading,
        color: colors.text.primary,
        marginBottom: spacing.md,
    },
    variantsGrid: {
        gap: spacing.md,
    },
    variantCard: {
        backgroundColor: colors.background.card,
        borderRadius: 12,
        padding: spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'transparent',
        position: 'relative',
    },
    variantCardSelected: {
        borderColor: colors.gold,
        backgroundColor: `${colors.gold}10`,
    },
    sigilContainer: {
        width: 120,
        height: 120,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
    },
    variantInfo: {
        flex: 1,
    },
    variantTitle: {
        fontSize: typography.sizes.h4,
        fontFamily: typography.fonts.heading,
        color: colors.text.primary,
        marginBottom: spacing.xs,
    },
    variantTitleSelected: {
        color: colors.gold,
    },
    variantDescription: {
        fontSize: typography.sizes.body2,
        fontFamily: typography.fonts.body,
        color: colors.text.secondary,
        lineHeight: typography.lineHeights.body2,
    },
    selectedIndicator: {
        position: 'absolute',
        top: spacing.sm,
        right: spacing.sm,
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: colors.gold,
        justifyContent: 'center',
        alignItems: 'center',
    },
    selectedIcon: {
        fontSize: 18,
        color: colors.charcoal,
    },
    footer: {
        padding: spacing.lg,
        paddingBottom: 110, // Account for floating tab bar (height 70 + bottom 25 + padding)
        backgroundColor: colors.background.secondary,
        borderTopWidth: 1,
        borderTopColor: colors.navy,
    },
    continueButton: {
        backgroundColor: colors.gold,
        borderRadius: 12,
        padding: spacing.md,
        alignItems: 'center',
        height: 56,
        justifyContent: 'center',
    },
    continueButtonText: {
        fontSize: typography.sizes.button,
        fontFamily: typography.fonts.bodyBold,
        color: colors.charcoal,
    },
});
