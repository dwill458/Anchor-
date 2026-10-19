import React, { useEffect, useRef, useLayoutEffect, useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Animated,
    ActivityIndicator,
    ScrollView,
    useWindowDimensions,
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
import { useSettingsStore } from '@/stores/settingsStore';
import { analyzeIntention, getGuidanceText } from '@/utils/intentionPatterns';
import { OptimizedImage, SigilSvg } from '@/components/common';
import { DailyReminderPrompt } from '@/components/notifications';
import { useSaveAnchor } from '@/hooks/useSaveAnchor';
import { useTempStore } from '@/stores/anchorStore';
import { isCompactPhoneViewport, isShortPhoneViewport } from '@/utils/layout';

type AnchorRevealRouteProp = RouteProp<RootStackParamList, 'AnchorReveal'>;
type AnchorRevealNavigationProp = StackNavigationProp<RootStackParamList, 'AnchorReveal'>;

export const AnchorRevealScreen: React.FC = () => {
    const navigation = useNavigation<AnchorRevealNavigationProp>();
    const route = useRoute<AnchorRevealRouteProp>();
    const insets = useSafeAreaInsets();
    const { width: screenWidth, height: screenHeight } = useWindowDimensions();
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

    // Persistence and post-save routing live in the shared hook (also used by the creation
    // flow's Seal). The screen only decides when to call it.
    const { isSaving, reminderCardVisible, saveAnchor, handleReminderDismiss } = useSaveAnchor({
        intentionText,
        category,
        distilledLetters,
        baseSigilSvg,
        reinforcedSigilSvg,
        structureVariant,
        reinforcementMetadata,
        enhancementMetadata,
        enhancedImageUrl,
    });

    // Analyze intention for pattern detection
    const intentionAnalysis = analyzeIntention(intentionText);
    const guidanceText = getGuidanceText(
        intentionAnalysis.hasFutureTense,
        intentionAnalysis.hasNegation
    );
    const isCompactLayout = isCompactPhoneViewport(screenWidth, screenHeight);
    const isShortLayout = isShortPhoneViewport(screenHeight);
    const contentHorizontal = isCompactLayout ? spacing.lg : spacing.xl;
    const imageSize = Math.min(
        screenWidth - (isCompactLayout ? 56 : 64),
        isCompactLayout ? 248 : isShortLayout ? 272 : 320
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

    const handleContinue = async () => {
        const outcome = await saveAnchor();
        if (outcome.status === 'saved') {
            outcome.proceed();
        }
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

                <ScrollView
                    bounces={false}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={[
                        styles.scrollContent,
                        isCompactLayout && styles.scrollContentCompact,
                        { paddingBottom: Math.max(insets.bottom, 20) },
                    ]}
                >
                <View
                    style={[
                        styles.content,
                        { paddingHorizontal: contentHorizontal },
                        isCompactLayout && styles.contentCompact,
                    ]}
                >
                    <Animated.View
                        style={[
                            styles.imageContainer,
                            isCompactLayout && styles.imageContainerCompact,
                            {
                                width: imageSize,
                                height: imageSize,
                                opacity: fadeAnim,
                                transform: [{ scale: scaleAnim }],
                            },
                        ]}
                    >
                        <View
                            style={[
                                styles.imageCard,
                                { borderRadius: imageSize / 2 },
                            ]}
                        >
                            {enhancedImageUrl ? (
                                <OptimizedImage
                                    uri={enhancedImageUrl}
                                    style={styles.image}
                                    resizeMode="cover"
                                />
                            ) : (
                                <View style={styles.sigilWrapper}>
                                    <SigilSvg
                                        xml={reinforcedSigilSvg || baseSigilSvg}
                                        width={imageSize - (isCompactLayout ? 64 : 80)}
                                        height={imageSize - (isCompactLayout ? 64 : 80)}
                                        color={colors.gold}
                                    />
                                </View>
                            )}
                            <View style={[styles.glowOverlay, { borderRadius: imageSize / 2 }]} />
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
                        <Text style={[styles.label, isCompactLayout && styles.labelCompact]}>
                            ROOTED IN YOUR INTENTION
                        </Text>
                        <BlurView intensity={20} tint="dark" style={[styles.intentionCard, isCompactLayout && styles.intentionCardCompact]}>
                            <View style={styles.intentionBorder} />
                            <Text style={[styles.intentionText, isCompactLayout && styles.intentionTextCompact]}>
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
                        isCompactLayout && styles.footerCompact,
                        { opacity: fadeAnim },
                    ]}
                >
                    {/* Guide Mode Helper Text */}
                    {guideMode && (
                        <Text style={[styles.ctaHelperText, isCompactLayout && styles.ctaHelperTextCompact]}>
                            Take in the symbol, then choose how you want to prime it.
                        </Text>
                    )}

                    <TouchableOpacity
                        onPress={handleContinue}
                        activeOpacity={isSaving ? 1 : 0.9}
                        disabled={isSaving}
                        style={styles.continueButton}
                        accessibilityRole="button"
                        accessibilityLabel="Begin Priming"
                        testID="begin-priming-button"
                    >
                        <LinearGradient
                            colors={[colors.gold, '#B8941F']}
                            style={[styles.continueGradient, isCompactLayout && styles.continueGradientCompact]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                        >
                            {isSaving ? (
                                <ActivityIndicator color={colors.charcoal} size="small" />
                            ) : (
                                <>
                                    <Text style={[styles.continueText, isCompactLayout && styles.continueTextCompact]}>BEGIN PRIMING</Text>
                                    <Text style={[styles.continueArrow, isCompactLayout && styles.continueArrowCompact]}>→</Text>
                                </>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>
                </Animated.View>
                </ScrollView>
            </SafeAreaView>

            <DailyReminderPrompt
                visible={reminderCardVisible}
                variant="first_anchor"
                onDismiss={handleReminderDismiss}
            />
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
    scrollContent: {
        flexGrow: 1,
    },
    scrollContentCompact: {
        paddingTop: spacing.xs,
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
        justifyContent: 'flex-start',
        paddingTop: spacing.md,
    },
    contentCompact: {
        paddingTop: spacing.sm,
    },
    imageContainer: {
        marginBottom: 20,
        shadowColor: colors.gold,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.4,
        shadowRadius: 30,
        elevation: 20,
    },
    imageContainerCompact: {
        marginBottom: 16,
        shadowRadius: 22,
    },
    imageCard: {
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.3)',
        backgroundColor: colors.charcoal,
    },
    image: {
        width: '100%',
        height: '100%',
    },
    sigilWrapper: {
        ...StyleSheet.absoluteFill,
        alignItems: 'center',
        justifyContent: 'center',
    },
    glowOverlay: {
        ...StyleSheet.absoluteFill,
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
    labelCompact: {
        fontSize: 10,
        marginBottom: spacing.sm,
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
    intentionCardCompact: {
        padding: 18,
        borderRadius: 14,
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
    intentionTextCompact: {
        fontSize: 16,
        lineHeight: 24,
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
        paddingBottom: 20,
    },
    footerCompact: {
        paddingHorizontal: spacing.md + 4,
        paddingBottom: 16,
    },
    ctaHelperText: {
        ...typography.caption,
        fontSize: 13,
        color: colors.text.secondary,
        textAlign: 'center',
        marginBottom: spacing.sm,
        fontStyle: 'italic',
        letterSpacing: 0.3,
    },
    ctaHelperTextCompact: {
        fontSize: 12,
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
    continueGradientCompact: {
        paddingVertical: 16,
        paddingHorizontal: 24,
    },
    continueText: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.charcoal,
        letterSpacing: 0.5,
        marginRight: 8,
    },
    continueTextCompact: {
        fontSize: 15,
    },
    continueArrow: {
        fontSize: 20,
        color: colors.charcoal,
        fontWeight: '300',
    },
    continueArrowCompact: {
        fontSize: 18,
    },
});
