/**
 * Anchor App - Anchor Selection Screen
 *
 * Second step in the anchor creation flow.
 * Users view and select from 3 generated anchor variations.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Animated,
    Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { colors, spacing, typography } from '@/theme';
import { generateSigil, SigilVariant } from '@/utils/sigil/traditional-generator';
import { SvgXml } from 'react-native-svg';
import { AnchorCategory, RootStackParamList } from '@/types';
import { StackNavigationProp } from '@react-navigation/stack';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import { ScreenHeader, ZenBackground } from '@/components/common';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Data Types
type SigilSelectionRouteParams = {
    intentionText: string;
    category: AnchorCategory;
    distilledLetters: string[];
};

interface StyleOption {
    id: SigilVariant;
    name: string;
    description: string;
    aesthetic: string;
}

const STYLE_OPTIONS: StyleOption[] = [
    {
        id: 'dense',
        name: 'Dense',
        description: 'Bold and powerful, maximum visual impact',
        aesthetic: 'Geometric · Angular · Bold',
    },
    {
        id: 'balanced',
        name: 'Balanced',
        description: 'Harmonious blend of strength and clarity',
        aesthetic: 'Classic · Elegant · Traditional',
    },
    {
        id: 'minimal',
        name: 'Minimal',
        description: 'Clean and focused, subtle elegance',
        aesthetic: 'Simplified · Abstract · Essential',
    },
];

/**
 * SigilSelectionScreen Component
 */
export const SigilSelectionScreen: React.FC = () => {
    const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
    const route = useRoute<RouteProp<{ params: SigilSelectionRouteParams }, 'params'>>();
    const { intentionText, distilledLetters, category } = route.params;

    // State
    const [selectedStyle, setSelectedStyle] = useState<SigilVariant>('balanced');
    const [sigilResult, setSigilResult] = useState<ReturnType<typeof generateSigil> | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Animations
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;
    const scaleAnim = useRef(new Animated.Value(0.9)).current;

    /**
     * Generate sigils on mount
     */
    useEffect(() => {
        try {
            const result = generateSigil(distilledLetters);
            setSigilResult(result);
            setError(null);

            // Start entrance animations
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 600,
                    useNativeDriver: true,
                }),
                Animated.spring(slideAnim, {
                    toValue: 0,
                    tension: 50,
                    friction: 8,
                    useNativeDriver: true,
                }),
                Animated.spring(scaleAnim, {
                    toValue: 1,
                    tension: 40,
                    friction: 7,
                    useNativeDriver: true,
                }),
            ]).start();

        } catch (error) {
            console.error('Failed to generate sigil:', error);
            setError(error instanceof Error ? error.message : 'Failed to forge Anchor. Please try again.');
        }
    }, [distilledLetters]);

    const handleRetry = (): void => {
        setError(null);
        setSigilResult(null);
        try {
            const result = generateSigil(distilledLetters);
            setSigilResult(result);
        } catch (error) {
            setError(error instanceof Error ? error.message : 'Failed');
        }
    };

    const handleStyleSelect = (style: SigilVariant) => {
        setSelectedStyle(style);
        // Small scale animation on selection
        Animated.sequence([
            Animated.timing(scaleAnim, {
                toValue: 0.95,
                duration: 100,
                useNativeDriver: true,
            }),
            Animated.spring(scaleAnim, {
                toValue: 1,
                tension: 60,
                friction: 6,
                useNativeDriver: true,
            }),
        ]).start();
    };

    const handleContinue = () => {
        if (!sigilResult) return;
        const selectedSvg = sigilResult.svgs[selectedStyle];

        navigation.navigate('MantraCreation', {
            intentionText,
            category,
            distilledLetters,
            sigilSvg: selectedSvg,
            sigilVariant: selectedStyle,
        });
    };

    const handleBack = () => {
        navigation.goBack();
    };

    // Error State
    if (error) {
        return (
            <SafeAreaView style={styles.container}>
                <StatusBar style="light" />
                <View style={styles.errorContainer}>
                    <Text style={styles.errorIcon}>⚠️</Text>
                    <Text style={styles.errorTitle}>Generation Failed</Text>
                    <Text style={styles.errorText}>{error}</Text>
                    <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
                        <Text style={styles.buttonText}>Try Again</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.backButtonSimple} onPress={handleBack}>
                        <Text style={styles.backButtonTextSimple}>Go Back</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    // Loading State
    if (!sigilResult) {
        return (
            <View style={styles.container}>
                <StatusBar style="light" />
                <LinearGradient
                    colors={[colors.navy, colors.deepPurple, colors.charcoal]}
                    style={styles.background}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                />
                <View style={styles.loadingContainer}>
                    <Text style={styles.loadingText}>Forging your Anchor...</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar style="light" />

            <ZenBackground />

            <SafeAreaView style={styles.safeArea}>
                <ScreenHeader title="Select Your Symbol" />

                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Title Section */}
                    <Animated.View
                        style={[
                            styles.titleSection,
                            {
                                opacity: fadeAnim,
                                transform: [{ translateY: slideAnim }],
                            },
                        ]}
                    >
                        <Text style={styles.title}>Choose Your Anchor</Text>
                        <Text style={styles.subtitle}>
                            Each style creates a unique visual expression of your intention.
                            Select the one that resonates with you.
                        </Text>
                    </Animated.View>

                    {/* Intention Card - Compact */}
                    <Animated.View
                        style={[
                            styles.intentionSection,
                            {
                                opacity: fadeAnim,
                                transform: [
                                    {
                                        translateY: slideAnim.interpolate({
                                            inputRange: [0, 30],
                                            outputRange: [0, 40],
                                        }),
                                    },
                                ],
                            },
                        ]}
                    >
                        <BlurView intensity={10} tint="dark" style={styles.intentionCard}>
                            <View style={styles.intentionContent}>
                                <Text style={styles.intentionLabel}>YOUR INTENTION</Text>
                                <Text style={styles.intentionText}>"{intentionText}"</Text>
                            </View>
                            <View style={styles.intentionBorder} />
                        </BlurView>
                    </Animated.View>

                    {/* Distilled Letters - Flowing Pills */}
                    <Animated.View
                        style={[
                            styles.lettersSection,
                            {
                                opacity: fadeAnim,
                                transform: [
                                    {
                                        translateY: slideAnim.interpolate({
                                            inputRange: [0, 30],
                                            outputRange: [0, 45],
                                        }),
                                    },
                                ],
                            },
                        ]}
                    >
                        <Text style={styles.sectionLabel}>DISTILLED LETTERS</Text>
                        <View style={styles.lettersContainer}>
                            {distilledLetters.map((letter, index) => (
                                <View key={index} style={styles.letterPill}>
                                    <LinearGradient
                                        colors={[
                                            'rgba(212, 175, 55, 0.2)',
                                            'rgba(212, 175, 55, 0.05)',
                                        ]}
                                        style={styles.letterGradient}
                                    >
                                        <Text style={styles.letterText}>{letter}</Text>
                                    </LinearGradient>
                                </View>
                            ))}
                        </View>
                    </Animated.View>

                    {/* Large Sigil Preview */}
                    <Animated.View
                        style={[
                            styles.previewSection,
                            {
                                opacity: fadeAnim,
                                transform: [
                                    {
                                        translateY: slideAnim.interpolate({
                                            inputRange: [0, 30],
                                            outputRange: [0, 50],
                                        }),
                                    },
                                    { scale: scaleAnim },
                                ],
                            },
                        ]}
                    >
                        <BlurView intensity={8} tint="dark" style={styles.previewCard}>
                            <View style={styles.previewContainer}>
                                <LinearGradient
                                    colors={[colors.gold, colors.bronze]}
                                    style={styles.sigilPlaceholder}
                                >
                                    {/* ACTUAL SVG RENDER */}
                                    <View style={styles.svgWrapper}>
                                        <SvgXml
                                            xml={sigilResult.svgs[selectedStyle]}
                                            width={SCREEN_WIDTH * 0.5}
                                            height={SCREEN_WIDTH * 0.5}
                                            color={colors.charcoal} // Dark color for visibility on gold bg
                                        />
                                    </View>
                                </LinearGradient>
                            </View>

                            {/* Style Badge */}
                            <View style={styles.styleBadge}>
                                <LinearGradient
                                    colors={[colors.gold, colors.bronze]}
                                    style={styles.styleBadgeGradient}
                                >
                                    <Text style={styles.styleBadgeText}>
                                        {selectedStyle.toUpperCase()}
                                    </Text>
                                </LinearGradient>
                            </View>
                        </BlurView>
                    </Animated.View>

                    {/* Style Options */}
                    <Animated.View
                        style={[
                            styles.stylesSection,
                            {
                                opacity: fadeAnim,
                                transform: [
                                    {
                                        translateY: slideAnim.interpolate({
                                            inputRange: [0, 30],
                                            outputRange: [0, 60],
                                        }),
                                    },
                                ],
                            },
                        ]}
                    >
                        <Text style={styles.sectionLabel}>SELECT STYLE</Text>
                        {STYLE_OPTIONS.map((style, index) => (
                            <TouchableOpacity
                                key={style.id}
                                onPress={() => handleStyleSelect(style.id)}
                                activeOpacity={0.8}
                                style={styles.styleOptionWrapper}
                            >
                                <BlurView
                                    intensity={selectedStyle === style.id ? 18 : 10}
                                    tint="dark"
                                    style={[
                                        styles.styleCard,
                                        selectedStyle === style.id && styles.styleCardSelected,
                                    ]}
                                >
                                    {/* Mini Preview Circle */}
                                    <View style={styles.miniPreview}>
                                        <LinearGradient
                                            colors={
                                                selectedStyle === style.id
                                                    ? [colors.gold, colors.bronze]
                                                    : ['rgba(192, 192, 192, 0.3)', 'rgba(158, 158, 158, 0.2)']
                                            }
                                            style={styles.miniPreviewGradient}
                                        >
                                            {/* Mini SVG Preview */}
                                            <SvgXml
                                                xml={sigilResult.svgs[style.id]}
                                                width={32}
                                                height={32}
                                                color={selectedStyle === style.id ? colors.charcoal : colors.silver}
                                            />
                                        </LinearGradient>
                                    </View>

                                    {/* Style Info */}
                                    <View style={styles.styleInfo}>
                                        <Text
                                            style={[
                                                styles.styleName,
                                                selectedStyle === style.id && styles.styleNameSelected,
                                            ]}
                                        >
                                            {style.name}
                                        </Text>
                                        <Text style={styles.styleDescription}>
                                            {style.description}
                                        </Text>
                                        <View style={styles.aestheticTags}>
                                            {style.aesthetic.split(' · ').map((tag, i) => (
                                                <View key={i} style={styles.aestheticTag}>
                                                    <Text style={styles.aestheticText}>{tag}</Text>
                                                </View>
                                            ))}
                                        </View>
                                    </View>

                                    {/* Selection Indicator */}
                                    <View style={styles.selectionIndicator}>
                                        {selectedStyle === style.id ? (
                                            <View style={styles.selectedCircle}>
                                                <LinearGradient
                                                    colors={[colors.gold, colors.bronze]}
                                                    style={styles.selectedCircleGradient}
                                                >
                                                    <Text style={styles.checkIcon}>✓</Text>
                                                </LinearGradient>
                                            </View>
                                        ) : (
                                            <View style={styles.unselectedCircle} />
                                        )}
                                    </View>

                                    {/* Glow Effect */}
                                    {selectedStyle === style.id && (
                                        <View style={styles.selectedGlow} />
                                    )}
                                </BlurView>
                            </TouchableOpacity>
                        ))}
                    </Animated.View>

                    {/* Bottom Spacer */}
                    <View style={styles.bottomSpacer} />
                </ScrollView>

                {/* Continue Button - Fixed */}
                <Animated.View
                    style={[
                        styles.continueContainer,
                        {
                            opacity: fadeAnim,
                            transform: [
                                {
                                    translateY: slideAnim.interpolate({
                                        inputRange: [0, 30],
                                        outputRange: [0, 50],
                                    }),
                                },
                            ],
                        },
                    ]}
                >
                    <TouchableOpacity
                        onPress={handleContinue}
                        activeOpacity={0.9}
                        style={styles.continueButton}
                    >
                        <LinearGradient
                            colors={[colors.gold, '#B8941F']}
                            style={styles.continueGradient}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                        >
                            <Text style={styles.continueText}>
                                Continue with {selectedStyle}
                            </Text>
                            <Text style={styles.continueArrow}>→</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </Animated.View>
            </SafeAreaView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.navy,
    },
    safeArea: {
        flex: 1,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 24,
        paddingBottom: 120,
    },
    titleSection: {
        paddingTop: 8,
        paddingBottom: 24,
    },
    title: {
        fontSize: 28,
        // fontFamily: 'Cinzel-Regular', // Revert to system font if custom font not loaded
        fontWeight: 'bold',
        color: colors.gold,
        marginBottom: 12,
        letterSpacing: 0.5,
    },
    subtitle: {
        fontSize: 15,
        color: colors.silver,
        lineHeight: 22,
    },
    intentionSection: {
        marginBottom: 24,
    },
    intentionCard: {
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.2)',
        backgroundColor: 'rgba(26, 26, 29, 0.4)',
        position: 'relative',
    },
    intentionContent: {
        padding: 16,
    },
    intentionLabel: {
        fontSize: 10,
        fontWeight: '700',
        color: colors.silver,
        letterSpacing: 1.2,
        marginBottom: 8,
        opacity: 0.6,
    },
    intentionText: {
        fontSize: 15,
        fontStyle: 'italic',
        color: colors.bone,
        lineHeight: 22,
    },
    intentionBorder: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: 3,
        backgroundColor: colors.gold,
    },
    lettersSection: {
        marginBottom: 32,
    },
    sectionLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: colors.silver,
        letterSpacing: 1.5,
        marginBottom: 16,
        opacity: 0.7,
    },
    lettersContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    letterPill: {
        borderRadius: 12,
        overflow: 'hidden',
    },
    letterGradient: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.3)',
        borderRadius: 12,
    },
    letterText: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.gold,
        letterSpacing: 1,
    },
    previewSection: {
        marginBottom: 32,
    },
    previewCard: {
        borderRadius: 24,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.2)',
        backgroundColor: 'rgba(26, 26, 29, 0.3)',
        position: 'relative',
    },
    previewContainer: {
        aspectRatio: 1,
        padding: 32,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sigilPlaceholder: {
        width: '100%',
        height: '100%',
        borderRadius: 200,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: colors.gold,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 24,
        elevation: 12,
    },
    svgWrapper: {
        opacity: 0.85,
    },
    sigilEmoji: {
        fontSize: 96,
        opacity: 0.8,
    },
    styleBadge: {
        position: 'absolute',
        bottom: 20,
        right: 20,
        borderRadius: 12,
        overflow: 'hidden',
    },
    styleBadgeGradient: {
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    styleBadgeText: {
        fontSize: 12,
        fontWeight: '700',
        color: colors.charcoal,
        letterSpacing: 1.5,
    },
    stylesSection: {
        marginBottom: 24,
    },
    styleOptionWrapper: {
        marginBottom: 16,
    },
    styleCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 20,
        borderWidth: 2,
        borderColor: 'rgba(192, 192, 192, 0.15)',
        backgroundColor: 'rgba(26, 26, 29, 0.3)',
        position: 'relative',
    },
    styleCardSelected: {
        borderColor: colors.gold,
        backgroundColor: 'rgba(212, 175, 55, 0.08)',
    },
    miniPreview: {
        width: 64,
        height: 64,
        marginRight: 16,
        borderRadius: 32,
        overflow: 'hidden',
    },
    miniPreviewGradient: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    miniSigilEmoji: {
        fontSize: 32,
        opacity: 0.8,
    },
    styleInfo: {
        flex: 1,
    },
    styleName: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.bone,
        marginBottom: 4,
        letterSpacing: 0.3,
    },
    styleNameSelected: {
        color: colors.gold,
    },
    styleDescription: {
        fontSize: 13,
        color: colors.silver,
        lineHeight: 18,
        marginBottom: 8,
    },
    aestheticTags: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    aestheticTag: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
        backgroundColor: 'rgba(192, 192, 192, 0.1)',
    },
    aestheticText: {
        fontSize: 10,
        fontWeight: '600',
        color: colors.silver,
        opacity: 0.8,
    },
    selectionIndicator: {
        marginLeft: 12,
    },
    selectedCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        overflow: 'hidden',
    },
    selectedCircleGradient: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    checkIcon: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.charcoal,
    },
    unselectedCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        borderWidth: 2,
        borderColor: 'rgba(192, 192, 192, 0.3)',
    },
    selectedGlow: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        borderRadius: 20,
        shadowColor: colors.gold,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.4,
        shadowRadius: 16,
        elevation: 8,
    },
    bottomSpacer: {
        height: 20,
    },
    continueContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingHorizontal: 24,
        paddingBottom: 100,
        paddingTop: 16,
    },
    continueButton: {
        borderRadius: 20,
        overflow: 'hidden',
        shadowColor: colors.gold,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 16,
        elevation: 10,
    },
    continueGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 18,
        paddingHorizontal: 32,
    },
    continueText: {
        fontSize: 17,
        fontWeight: '700',
        color: colors.charcoal,
        letterSpacing: 0.5,
        marginRight: 8,
    },
    continueArrow: {
        fontSize: 20,
        color: colors.charcoal,
        fontWeight: '300',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        fontSize: typography.sizes.body1,
        color: colors.bone,
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
        color: colors.error,
        marginBottom: spacing.md,
        textAlign: 'center',
    },
    errorText: {
        fontSize: typography.sizes.body1,
        color: colors.silver,
        textAlign: 'center',
        marginBottom: spacing.xl,
    },
    retryButton: {
        backgroundColor: colors.gold,
        borderRadius: 12,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.xl,
        marginBottom: spacing.md,
        minWidth: 200,
    },
    buttonText: {
        fontSize: typography.sizes.button,
        color: colors.charcoal,
        textAlign: 'center',
        fontWeight: 'bold',
    },
    backButtonSimple: {
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.xl,
    },
    backButtonTextSimple: {
        fontSize: typography.sizes.button,
        color: colors.silver,
        textAlign: 'center',
    },
});
