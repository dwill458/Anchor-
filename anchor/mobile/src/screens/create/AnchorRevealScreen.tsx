import React, { useEffect, useRef, useLayoutEffect, useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Animated,
    Alert,
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
import { useAnchorStore, useTempStore } from '@/stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { analyzeIntention, getGuidanceText } from '@/utils/intentionPatterns';
import { OptimizedImage, SigilSvg } from '@/components/common';
import { ErrorTrackingService } from '@/services/ErrorTrackingService';
import { AnalyticsEvents, AnalyticsService } from '@/services/AnalyticsService';
import { FrictionAnalytics } from '@/services/FrictionAnalytics';
import { ApiClientError, post } from '@/services/ApiClient';
import { isBackendAnchorId } from '@/services/BackendAnchorService';
import { useNotificationController } from '@/hooks/useNotificationController';
import { DailyReminderPrompt } from '@/components/notifications';
import { logger } from '@/utils/logger';
import { classifyToTierPreliminary } from '@/utils/tierClassifier';
import { isCompactPhoneViewport, isShortPhoneViewport } from '@/utils/layout';
import type { ApiResponse, Anchor } from '@/types';
import { useEntitlements } from '@/hooks/useEntitlements';
import { getAnchorCreationLimitCopy } from '@/utils/entitlements';
import { useFirstAnchorFlowStore } from '@/stores/firstAnchorFlowStore';

type AnchorRevealRouteProp = RouteProp<RootStackParamList, 'AnchorReveal'>;
type AnchorRevealNavigationProp = StackNavigationProp<RootStackParamList, 'AnchorReveal'>;

export const AnchorRevealScreen: React.FC = () => {
    const navigation = useNavigation<AnchorRevealNavigationProp>();
    const route = useRoute<AnchorRevealRouteProp>();
    const insets = useSafeAreaInsets();
    const { width: screenWidth, height: screenHeight } = useWindowDimensions();
    const guideMode = useSettingsStore((state) => state.guideMode);
    const addAnchor = useAnchorStore((state) => state.addAnchor);
    const setCurrentAnchor = useAnchorStore((state) => state.setCurrentAnchor);
    const incrementAnchorCount = useAuthStore((state) => state.incrementAnchorCount);
    const wallpaperPromptSeen = useAuthStore((state) => state.wallpaperPromptSeen);
    const authUser = useAuthStore((state) => state.user);
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
    const existingAnchorCount = useAuthStore((state) => state.anchorCount);
    const setPendingFirstAnchorDraft = useAuthStore((state) => state.setPendingFirstAnchorDraft);
    const enqueuePendingFirstAnchorMutation = useAuthStore(
        (state) => state.enqueuePendingFirstAnchorMutation
    );
    const clearPendingFirstAnchorState = useAuthStore((state) => state.clearPendingFirstAnchorState);
    const { handleAnchorSaved, canOfferFirstAnchorReminder } = useNotificationController();
    const entitlements = useEntitlements();
    const [isSaving, setIsSaving] = useState(false);
    const [reminderCardVisible, setReminderCardVisible] = useState(false);
    const pendingNavRef = useRef<{ anchorId: string; isGuestFirstAnchor: boolean } | null>(null);
    // State updates do not take effect until React re-renders. Keep a synchronous
    // guard across the whole create-and-reminder flow so a second tap cannot start
    // another request while an async continuation is still pending.
    const creationInFlightRef = useRef(false);

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

    const navigateAfterSave = (
        anchorId: string,
        isGuestFirstAnchor: boolean,
        isFirstAnchor: boolean,
    ) => {
        if (isGuestFirstAnchor) {
            // The creation record already exists locally. Passing it through is
            // more reliable than rereading a persisted store during the same
            // render turn, particularly immediately after a cold-start restore.
            const savedAnchor: Anchor = {
                id: anchorId,
                userId: authUser?.id || 'user-local',
                intentionText,
                category,
                distilledLetters,
                baseSigilSvg,
                reinforcedSigilSvg,
                structureVariant,
                reinforcementMetadata,
                enhancementMetadata,
                enhancedImageUrl: enhancedImageUrl || undefined,
                isCharged: false,
                activationCount: 0,
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            navigation.replace('SaveProgress', { anchor: savedAnchor });
            return;
        }

        if (isFirstAnchor) {
            navigation.replace('PrimeYourAnchor', { anchorId });
            return;
        }

        if (!wallpaperPromptSeen) {
            navigation.replace('WallpaperPrompt', {
                anchorId,
                intentionText,
                enhancedImageUrl: enhancedImageUrl || undefined,
                sigilSvg: reinforcedSigilSvg || baseSigilSvg,
                fromOnboarding: isGuestFirstAnchor,
            });
        } else {
            navigation.replace('ChargeSetup', {
                anchorId,
                autoStartOnSelection: true,
                returnTo: 'vault',
                fromOnboarding: isGuestFirstAnchor,
            });
        }
    };

    const handleReminderDismiss = () => {
        setReminderCardVisible(false);
        const pending = pendingNavRef.current;
        pendingNavRef.current = null;
        if (pending) {
            navigateAfterSave(pending.anchorId, pending.isGuestFirstAnchor, false);
        }
    };

    const handleContinue = async () => {
        if (isSaving || creationInFlightRef.current) return;
        const isGuestFirstAnchor = !isAuthenticated && existingAnchorCount === 0;
        const isFirstAnchor = existingAnchorCount === 0;
        if (!isGuestFirstAnchor && !entitlements.canCreateAnchor) {
            const reason = entitlements.anchorCreationLimitReason;
            if (!reason) return;

            AnalyticsService.track(reason, {
                source: 'anchor_reveal',
                anchors_created_today: entitlements.anchorsCreatedToday,
                anchors_created_during_trial: entitlements.anchorsCreatedDuringTrial,
                tier: entitlements.tier,
            });

            if (reason === 'pro_daily_anchor_cap_reached') {
                const copy = getAnchorCreationLimitCopy(reason);
                Alert.alert(copy?.title ?? 'Daily creation limit reached', copy?.body, [
                    { text: copy?.cta ?? 'Return to Sanctuary', onPress: () => navigation.goBack() },
                ]);
                return;
            }

            navigation.navigate('Paywall', {
                source: reason,
                preferredPlanId: 'annual',
            });
            return;
        }

        creationInFlightRef.current = true;
        setIsSaving(true);

        ErrorTrackingService.addBreadcrumb('Anchor reveal continued', 'create.anchor_reveal', {
            has_image: Boolean(enhancedImageUrl),
        });

        const idempotencyKey = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        let anchorId = isGuestFirstAnchor
            ? `pending-first-anchor-${idempotencyKey}`
            : `anchor-${idempotencyKey}`;

        const { tier, confidenceScore, isCustomFallback } = classifyToTierPreliminary(intentionText);

        try {
            if (isGuestFirstAnchor) {
                clearPendingFirstAnchorState();
                setPendingFirstAnchorDraft({
                    tempAnchorId: anchorId,
                    source: 'onboarding_first_anchor',
                    requiresAccountGate: false,
                    createdAt: new Date(),
                });
                enqueuePendingFirstAnchorMutation({
                    type: 'create_anchor',
                    tempAnchorId: anchorId,
                    queuedAt: new Date().toISOString(),
                });
            } else {
                // Persist anchor to backend — this is the source of truth.
                // idempotencyKey lets a retried request return the anchor that was
                // already created rather than creating a duplicate, so a single
                // network-only retry (no response received either way) is safe here.
                const anchorPayload = {
                    intentionText,
                    category,
                    distilledLetters,
                    baseSigilSvg,
                    structureVariant: structureVariant || 'balanced',
                    reinforcedSigilSvg: reinforcedSigilSvg || undefined,
                    reinforcementMetadata: reinforcementMetadata || undefined,
                    enhancedImageUrl: enhancedImageUrl || undefined,
                    enhancementMetadata: enhancementMetadata || undefined,
                    planetaryTier: tier,
                    classifierVersion: 2,
                    classifierMeta: { confidenceScore, isCustomFallback },
                    idempotencyKey,
                };

                let response: ApiResponse<Anchor> | undefined;
                try {
                    response = await post<ApiResponse<Anchor>>('/api/anchors', anchorPayload);
                } catch (firstAttemptErr) {
                    const isNetworkError =
                        !(firstAttemptErr instanceof ApiClientError) &&
                        firstAttemptErr instanceof Error &&
                        firstAttemptErr.message === 'Network error. Please check your connection.';
                    if (!isNetworkError) {
                        throw firstAttemptErr;
                    }
                    await new Promise(resolve => setTimeout(resolve, 500));
                    response = await post<ApiResponse<Anchor>>('/api/anchors', anchorPayload);
                }

                if (response?.success && response?.data?.id) {
                    anchorId = response.data.id;
                    logger.info('[AnchorReveal] Anchor saved to backend', { anchorId });
                } else {
                    logger.warn('[AnchorReveal] Backend returned unexpected response, using local ID', { response });
                }
            }
        } catch (err) {
            const serverLimitReason =
                err instanceof ApiClientError && err.code === 'PRO_DAILY_ANCHOR_CAP_REACHED'
                    ? 'pro_daily_anchor_cap_reached'
                    : err instanceof ApiClientError && err.code === 'TRIAL_ANCHOR_CAP_REACHED'
                        ? 'trial_anchor_cap_reached'
                        : err instanceof ApiClientError && err.code === 'CREATE_ANCHOR_FREE_LOCKED'
                            ? 'create_anchor_free_locked'
                            : null;

            if (serverLimitReason) {
                AnalyticsService.track(serverLimitReason, {
                    source: 'anchor_reveal_server',
                    tier: entitlements.tier,
                });

                if (serverLimitReason === 'pro_daily_anchor_cap_reached') {
                    const copy = getAnchorCreationLimitCopy(serverLimitReason);
                    Alert.alert(copy?.title ?? 'Daily creation limit reached', copy?.body, [
                        { text: copy?.cta ?? 'Return to Sanctuary', onPress: () => navigation.goBack() },
                    ]);
                } else {
                    navigation.navigate('Paywall', {
                        source: serverLimitReason,
                        preferredPlanId: 'annual',
                    });
                }
                creationInFlightRef.current = false;
                setIsSaving(false);
                return;
            }

            logger.warn('[AnchorReveal] Failed to save anchor to backend, proceeding locally', err);
            FrictionAnalytics.flowError('anchor_creation', 'anchor_reveal', 'backend_save_failed', {
                is_first_anchor: isGuestFirstAnchor,
                category,
                has_enhanced_image: Boolean(enhancedImageUrl),
                error_code: err instanceof ApiClientError ? err.code : undefined,
                error_status: err instanceof ApiClientError ? err.status : undefined,
                error_message: err instanceof Error ? err.message : undefined,
                idempotency_key: idempotencyKey,
            });
            ErrorTrackingService.captureException(err, {
                screen: 'AnchorRevealScreen',
                action: 'save_anchor_to_backend',
            });
            // Continue with local fallback — don't block the user
        }

        const createdAnchor: Anchor = {
            id: anchorId,
            userId: authUser?.id || 'user-local',
            intentionText,
            category,
            distilledLetters,
            baseSigilSvg,
            reinforcedSigilSvg,
            structureVariant,
            reinforcementMetadata,
            enhancementMetadata,
            enhancedImageUrl: enhancedImageUrl || undefined,
            planetaryTier: tier,
            classifierVersion: 2,
            classifierMeta: { confidenceScore, isCustomFallback },
            isCharged: false,
            activationCount: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        addAnchor(createdAnchor);
        setCurrentAnchor?.(anchorId);
        incrementAnchorCount();
        AnalyticsService.track(AnalyticsEvents.ANCHOR_CREATION_COMPLETED, {
            anchor_id: anchorId,
            source: isGuestFirstAnchor ? 'onboarding_first_anchor' : 'anchor_reveal',
            category,
            is_first_anchor: isGuestFirstAnchor,
            has_enhanced_image: Boolean(enhancedImageUrl),
            structure_variant: structureVariant || 'balanced',
            backend_synced: isBackendAnchorId(anchorId),
        });
        FrictionAnalytics.stepCompleted('anchor_creation', 'anchor_reveal', {
            is_first_anchor: isGuestFirstAnchor,
            category,
            has_enhanced_image: Boolean(enhancedImageUrl),
        });
        FrictionAnalytics.completeFlow('anchor_creation', {
            is_first_anchor: isGuestFirstAnchor,
            category,
            next_step: isGuestFirstAnchor ? 'save_progress' : isFirstAnchor ? 'prime_your_anchor' : 'creation_complete',
        });
        void handleAnchorSaved();

        // Clear heavy temporary data once the anchor record is created.
        setTempEnhancedImage(null);

        // First-anchor moment: offer a calm daily-reminder card before moving on.
        // We surface it once unless this device has already denied permission.
        // First creation now moves directly to the Save Progress / Prime
        // continuation. The optional reminder remains a returning-user affordance.
        const shouldShowReminder =
            !isFirstAnchor && await canOfferFirstAnchorReminder();

        if (shouldShowReminder) {
            pendingNavRef.current = { anchorId, isGuestFirstAnchor };
            setReminderCardVisible(true);
            return;
        }

        if (!isGuestFirstAnchor) {
            useFirstAnchorFlowStore.getState().clearDraft();
        }
        navigateAfterSave(anchorId, isGuestFirstAnchor, isFirstAnchor);
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
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
    },
    glowOverlay: {
        ...StyleSheet.absoluteFillObject,
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
