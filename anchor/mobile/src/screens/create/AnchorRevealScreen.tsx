import React, { useEffect, useRef, useLayoutEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Animated,
    Dimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '@/types';
import { colors, spacing, typography } from '@/theme';
import { ZenBackground, GlassIconButton, UndertoneLine } from '@/components/common';
import { BlurView } from 'expo-blur';
import { useTempStore } from '@/stores/anchorStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { analyzeIntention, getGuidanceText } from '@/utils/intentionPatterns';
import { OptimizedImage } from '@/components/common/OptimizedImage';
import { ErrorTrackingService } from '@/services/ErrorTrackingService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IMAGE_SIZE = SCREEN_WIDTH - 64; // Large centered image

type AnchorRevealRouteProp = RouteProp<RootStackParamList, 'AnchorReveal'>;
type AnchorRevealNavigationProp = StackNavigationProp<RootStackParamList, 'AnchorReveal'>;

export const AnchorRevealScreen: React.FC = () => {
    const navigation = useNavigation<AnchorRevealNavigationProp>();
    const route = useRoute<AnchorRevealRouteProp>();
    const insets = useSafeAreaInsets();
    const guideMode = useSettingsStore((state) => state.guideMode);

    const {
        intentionText,
        category,
        distilledLetters,
        baseSigilSvg,
        reinforcedSigilSvg,
        structureVariant,
        enhancedImageUrl: paramImageUrl,
        reinforcementMetadata,
        enhancementMetadata,
    } = route.params;

    // Retrieve from store if not in params (handle large base64)
    const tempEnhancedImage = useTempStore((state) => state.tempEnhancedImage);
    const setTempEnhancedImage = useTempStore((state) => state.setTempEnhancedImage);
    const enhancedImageUrl = paramImageUrl || tempEnhancedImage;

    // Analyze intention for pattern detection
    const intentionAnalysis = analyzeIntention(intentionText);
    const guidanceText = getGuidanceText(
        intentionAnalysis.hasFutureTense,
        intentionAnalysis.hasNegation
    );

    // Animations
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(0.95)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 1000,
                useNativeDriver: true,
            }),
            Animated.spring(scaleAnim, {
                toValue: 1,
                friction: 8,
                tension: 40,
                useNativeDriver: true,
            }),
        ]).start();
    }, []);

    useLayoutEffect(() => {
        navigation.setOptions({
            headerShown: false,
        });
    }, [navigation]);

    useEffect(() => {
        return () => {
            setTempEnhancedImage(null);
        };
    }, [setTempEnhancedImage]);

    const handleBack = () => {
        navigation.goBack();
    };

    const handleContinue = () => {
        ErrorTrackingService.addBreadcrumb('Anchor reveal continued', 'create.anchor_reveal', {
            has_image: Boolean(enhancedImageUrl),
        });

        (navigation as any).navigate('MantraCreation', {
            intentionText,
            category,
            distilledLetters,
            baseSigilSvg,
            reinforcedSigilSvg,
            structureVariant,
            reinforcementMetadata,
            enhancementMetadata,
            finalImageUrl: enhancedImageUrl || '',
        });

        // Clear heavy temporary data once passed to final creation step.
        setTempEnhancedImage(null);
    };

    return (
        <View style={styles.container}>
            <StatusBar style="light" />
            <ZenBackground orbOpacity={0.2} />

            <SafeAreaView style={styles.safeArea}>
                {/* Custom Header with Back Button */}
                <View style={[styles.header, { paddingTop: Math.max(insets.top, spacing.md) }]}>
                    <GlassIconButton
                        onPress={handleBack}
                        accessibilityLabel="Back"
                        size="md"
                        testID="back-button"
                    >
                        <Text style={styles.backIcon}>←</Text>
                    </GlassIconButton>
                    <Text style={styles.headerTitle}>Your Anchor</Text>
                    <View style={styles.headerSpacer} />
                </View>

                <View style={styles.content}>
                    <Animated.View
                        style={[
                            styles.imageContainer,
                            {
                                opacity: fadeAnim,
                                transform: [{ scale: scaleAnim }],
                            },
                        ]}
                    >
                        <View style={styles.imageCard}>
                            <OptimizedImage
                                uri={enhancedImageUrl || ''}
                                style={styles.image}
                                resizeMode="cover"
                            />
                            <View style={styles.glowOverlay} />
                        </View>
                    </Animated.View>

                    <Animated.View
                        style={[
                            styles.textContainer,
                            {
                                opacity: fadeAnim,
                                transform: [{ translateY: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
                            },
                        ]}
                    >
                        <Text style={styles.label}>ROOTED IN YOUR INTENTION</Text>
                        <BlurView intensity={20} tint="dark" style={styles.intentionCard}>
                            <View style={styles.intentionBorder} />
                            <Text
                                style={styles.intentionText}
                                numberOfLines={2}
                                ellipsizeMode="tail"
                            >
                                {intentionText}
                            </Text>
                        </BlurView>

                        {/* Guide Hint for Future Tense / Negation */}
                        {guideMode && intentionAnalysis.shouldShowGuidance && guidanceText && (
                            <View style={styles.guideHintContainer}>
                                <UndertoneLine
                                    text={guidanceText}
                                    variant="emphasis"
                                />
                            </View>
                        )}

                        {/* Seal Micro-Teaching Line */}
                        <View style={styles.sealLineContainer}>
                            <UndertoneLine
                                text="Return to this symbol to train recall."
                                variant="default"
                            />
                        </View>
                    </Animated.View>
                </View>

                <Animated.View
                    style={[
                        styles.footer,
                        { opacity: fadeAnim },
                    ]}
                >
                    {/* Guide Mode Helper Text */}
                    {guideMode && (
                        <Text style={styles.ctaHelperText}>
                            60 seconds. Look at the symbol. Repeat your phrase.
                        </Text>
                    )}

                    <TouchableOpacity
                        onPress={handleContinue}
                        activeOpacity={0.9}
                        style={styles.continueButton}
                        accessibilityRole="button"
                        accessibilityLabel="Begin Mantra"
                    >
                        <LinearGradient
                            colors={[colors.gold, '#B8941F']}
                            style={styles.continueGradient}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                        >
                            <Text style={styles.continueText}>Begin Mantra</Text>
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
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.md,
    },
    headerTitle: {
        ...typography.h3,
        color: colors.gold,
        letterSpacing: 0.5,
        flex: 1,
        textAlign: 'center',
    },
    backIcon: {
        fontSize: 20,
        color: colors.gold,
        fontWeight: '300',
    },
    headerSpacer: {
        width: 44,
        height: 44,
    },
    content: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: spacing.xl,
    },
    imageContainer: {
        width: IMAGE_SIZE,
        height: IMAGE_SIZE,
        marginBottom: 40,
        shadowColor: colors.gold,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.4,
        shadowRadius: 30,
        elevation: 20,
    },
    imageCard: {
        width: '100%',
        height: '100%',
        borderRadius: IMAGE_SIZE / 2,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.3)',
        backgroundColor: colors.charcoal,
    },
    image: {
        width: '100%',
        height: '100%',
    },
    glowOverlay: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: IMAGE_SIZE / 2,
        borderWidth: 2,
        borderColor: 'rgba(212, 175, 55, 0.1)',
    },
    textContainer: {
        width: '100%',
    },
    label: {
        fontSize: 11,
        fontWeight: '700',
        color: colors.silver,
        letterSpacing: 1.5,
        marginBottom: spacing.md,
        textAlign: 'center',
        opacity: 0.8,
    },
    intentionCard: {
        borderRadius: 16,
        padding: 24,
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.2)',
        backgroundColor: 'rgba(26, 26, 29, 0.4)',
        position: 'relative',
        overflow: 'hidden',
    },
    intentionBorder: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: 3,
        backgroundColor: colors.gold,
    },
    intentionText: {
        ...typography.body,
        fontSize: 18,
        fontStyle: 'italic',
        color: colors.bone,
        lineHeight: 28,
        textAlign: 'center',
    },
    guideHintContainer: {
        marginTop: spacing.md,
        paddingHorizontal: spacing.sm,
        alignItems: 'flex-start',
    },
    sealLineContainer: {
        marginTop: spacing.md,
        paddingHorizontal: spacing.sm,
        alignItems: 'flex-start',
    },
    footer: {
        paddingHorizontal: spacing.lg,
        paddingBottom: 40,
    },
    ctaHelperText: {
        ...typography.caption,
        fontSize: 13,
        color: colors.text.secondary,
        textAlign: 'center',
        marginBottom: spacing.md,
        fontStyle: 'italic',
        letterSpacing: 0.3,
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
        fontSize: 16,
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
});
