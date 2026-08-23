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
import { getFreshChartAnchorHandoff, useChartJourneyStore } from '@/stores/chartJourneyStore';
import {
    cancelChartAnchorCreationHandoff,
    completeChartAnchorCreation,
} from '@/services/ChartAnchorHandoffService';

type AnchorRevealRouteProp = RouteProp<RootStackParamList, 'AnchorReveal'>;
type AnchorRevealNavigationProp = StackNavigationProp<RootStackParamList, 'AnchorReveal'>;

const AUTO_CONTINUE_SECONDS = 5;

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
    const [secondsRemaining, setSecondsRemaining] = useState(AUTO_CONTINUE_SECONDS);
    const pendingNavRef = useRef<{
        anchorId: string;
        isGuestFirstAnchor: boolean;
        expectedAccountId: string | null;
    } | null>(null);
    // State updates do not take effect until React re-renders. Keep a synchronous
    // guard across the whole create-and-reminder flow so a second tap cannot start
    // another request while an async continuation is still pending.
    const creationInFlightRef = useRef(false);
    // Retain one create intent across same-screen network reconciliation. This
    // is especially important for the first signed-in Anchor, where a lost
    // response must never lead to a second server record on the next tap.
    const standaloneCreateIdempotencyKeyRef = useRef(
        `anchor-create-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    );

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

    const navigateStandardAfterSave = (
        anchorId: string,
        isGuestFirstAnchor: boolean,
        isFirstAnchor: boolean,
        expectedAccountId: string | null,
    ) => {
        if (expectedAccountId && useAuthStore.getState().user?.id !== expectedAccountId) return;
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
            navigation.replace('PrimeYourAnchor', { anchorId });
        }
    };

    const navigateAfterSave = async (
        anchorId: string,
        isGuestFirstAnchor: boolean,
        isFirstAnchor: boolean,
        expectedAccountId: string | null,
    ) => {
        if (expectedAccountId && useAuthStore.getState().user?.id !== expectedAccountId) return;
        const handoff = await completeChartAnchorCreation(anchorId);
        if (expectedAccountId && useAuthStore.getState().user?.id !== expectedAccountId) return;
        if (handoff.status === 'linked') {
            useFirstAnchorFlowStore.getState().clearDraft();
            navigation.replace('PrimeYourAnchor', {
                anchorId,
                chartContext: handoff.chartContext,
                chartOriginAccountId: expectedAccountId ?? undefined,
            });
            return;
        }
        if (handoff.status === 'unavailable') {
            const pendingChartHandoff = authUser?.id
                ? getFreshChartAnchorHandoff(authUser.id)
                : null;
            creationInFlightRef.current = false;
            setIsSaving(false);
            Alert.alert(
                'Anchor saved',
                'Your Anchor is safe, but Chart could not connect it yet. Retry the link before beginning Practice.',
                [
                    {
                        text: 'Continue in Sanctuary',
                        style: 'cancel',
                        onPress: () => {
                            if (expectedAccountId && useAuthStore.getState().user?.id !== expectedAccountId) return;
                            if (expectedAccountId && pendingChartHandoff) {
                                cancelChartAnchorCreationHandoff(
                                    expectedAccountId,
                                    pendingChartHandoff.courseId,
                                    pendingChartHandoff.waypointId,
                                    pendingChartHandoff.linkIdempotencyKey,
                                );
                            }
                            navigateStandardAfterSave(
                                anchorId,
                                isGuestFirstAnchor,
                                isFirstAnchor,
                                expectedAccountId,
                            );
                        },
                    },
                    {
                        text: 'Retry link',
                        onPress: () => void navigateAfterSave(
                            anchorId,
                            isGuestFirstAnchor,
                            isFirstAnchor,
                            expectedAccountId,
                        ),
                    },
                ],
            );
            return;
        }
        if (handoff.status === 'stale') {
            Alert.alert(
                'Course changed',
                'Your Anchor is safe in Sanctuary. The Waypoint changed before it could be linked, so nothing was attached automatically.',
            );
        }
        navigateStandardAfterSave(anchorId, isGuestFirstAnchor, isFirstAnchor, expectedAccountId);
    };

    const handleReminderDismiss = () => {
        setReminderCardVisible(false);
        const pending = pendingNavRef.current;
        pendingNavRef.current = null;
        if (pending) {
            void navigateAfterSave(
                pending.anchorId,
                pending.isGuestFirstAnchor,
                false,
                pending.expectedAccountId,
            );
        }
    };

    const handleContinue = async () => {
        if (isSaving || creationInFlightRef.current) return;
        const expectedAccountId = authUser?.id ?? null;
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

        const { tier, confidenceScore, isCustomFallback } = classifyToTierPreliminary(intentionText);
        const anchorCreateIntent = {
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
        };
        const chartHandoff = authUser?.id ? getFreshChartAnchorHandoff(authUser.id) : null;
        let claimedChartHandoff = chartHandoff;
        if (chartHandoff) {
            try {
                claimedChartHandoff = await useChartJourneyStore.getState().claimAnchorCreateIntent(
                    JSON.stringify(anchorCreateIntent),
                );
            } catch {
                creationInFlightRef.current = false;
                setIsSaving(false);
                Alert.alert('Unable to save Chart progress', 'Try again before creating this Waypoint Anchor.');
                return;
            }
        }
        if (authUser?.id && useAuthStore.getState().user?.id !== authUser.id) {
            creationInFlightRef.current = false;
            setIsSaving(false);
            return;
        }
        const idempotencyKey = claimedChartHandoff?.anchorCreateIdempotencyKey
            ?? standaloneCreateIdempotencyKeyRef.current;
        let anchorId = isGuestFirstAnchor
            ? `pending-first-anchor-${idempotencyKey}`
            : `anchor-${idempotencyKey}`;

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
                    ...anchorCreateIntent,
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
                    // ApiClient resolves credentials at request time. Never let
                    // account B authenticate account A's delayed retry.
                    if (expectedAccountId && useAuthStore.getState().user?.id !== expectedAccountId) {
                        creationInFlightRef.current = false;
                        setIsSaving(false);
                        return;
                    }
                    response = await post<ApiResponse<Anchor>>('/api/anchors', anchorPayload);
                }

                if (response?.success && response?.data?.id) {
                    anchorId = response.data.id;
                    logger.info('[AnchorReveal] Anchor saved to backend', { anchorId });
                } else {
                    if (claimedChartHandoff || isFirstAnchor) {
                        throw new Error('The Anchor server did not confirm the saved Anchor.');
                    }
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

            if (expectedAccountId && useAuthStore.getState().user?.id !== expectedAccountId) {
                creationInFlightRef.current = false;
                setIsSaving(false);
                return;
            }
            logger.warn('[AnchorReveal] Failed to save anchor to backend', err);
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
            if (claimedChartHandoff || isFirstAnchor) {
                // Chart linking and the first-journey milestone require the
                // canonical server ID. Keep the persisted create intent/key and
                // let the user retry; if the server committed but both responses
                // were lost, the identical POST reconciles to that same Anchor.
                creationInFlightRef.current = false;
                setIsSaving(false);
                Alert.alert(
                    'Anchor not yet confirmed',
                    'Your creation is still here. Check your connection and tap Continue again; Anchor will safely recover the same save.',
                );
                return;
            }
            // Returning standalone Anchors retain the existing offline-first
            // local projection and are promoted by the normal sync service.
        }

        // The network request may outlive the screen's authenticated account.
        // Never project account A's newly-created Anchor into account B's
        // in-memory Sanctuary or journey state after a sign-out/switch.
        if (authUser?.id && useAuthStore.getState().user?.id !== authUser.id) {
            creationInFlightRef.current = false;
            setIsSaving(false);
            return;
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
        if (
            isFirstAnchor &&
            !isGuestFirstAnchor &&
            authUser?.id &&
            useAuthStore.getState().user?.id === authUser.id
        ) {
            await useChartJourneyStore.getState().bindAccount(authUser.id);
            if (
                useAuthStore.getState().user?.id === authUser.id &&
                useChartJourneyStore.getState().accountId === authUser.id
            ) {
                await useChartJourneyStore.getState().markFirstAnchorCreated(anchorId);
            }
        }
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
            pendingNavRef.current = { anchorId, isGuestFirstAnchor, expectedAccountId };
            setReminderCardVisible(true);
            return;
        }

        if (!isGuestFirstAnchor) {
            useFirstAnchorFlowStore.getState().clearDraft();
        }
        await navigateAfterSave(anchorId, isGuestFirstAnchor, isFirstAnchor, expectedAccountId);
    };

    const handleContinueRef = useRef(handleContinue);
    handleContinueRef.current = handleContinue;

    useEffect(() => {
        if (isSaving || reminderCardVisible) return;

        const interval = setInterval(() => {
            setSecondsRemaining((prev) => {
                if (prev <= 1) {
                    clearInterval(interval);
                    void handleContinueRef.current();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [isSaving, reminderCardVisible]);

    return (
        <View style={styles.container}>
            <StatusBar style="light" />
            <LinearGradient
                colors={['#18202A', '#121820', colors.anchor15.navy]}
                locations={[0, 0.44, 1]}
                style={StyleSheet.absoluteFill}
            />
            <View pointerEvents="none" style={styles.goldGlow} />

            <SafeAreaView style={styles.safeArea}>
                {/* Custom Header with Back Button and Centered Title */}
                <View style={[styles.header, { paddingTop: Math.max(insets.top, spacing.sm) }]}>
                    <GlassIconButton
                        onPress={handleBack}
                        accessibilityLabel="Back"
                        size="md"
                        testID="back-button"
                        style={styles.backButton}
                    >
                        <Text style={styles.backIcon}>←</Text>
                    </GlassIconButton>
                    <Text style={styles.headerTitle}>YOUR ANCHOR</Text>
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
                            <View style={[styles.imageHalo, { borderRadius: (imageSize + 40) / 2 }]} />
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
                                            color={colors.anchor15.giltBright}
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

                            {/* Seal Recall Micro-Teaching Line */}
                            <View style={styles.sealLineContainer}>
                                <View style={styles.sealIndicatorBar} />
                                <Text style={styles.sealLineText}>Return to this symbol to train recall.</Text>
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
                        {/* Prompt Helper Text */}
                        <Text style={[styles.ctaHelperText, isCompactLayout && styles.ctaHelperTextCompact]}>
                            Take in the symbol, then choose how you want to prime it.
                        </Text>

                        <TouchableOpacity
                            onPress={handleContinue}
                            activeOpacity={isSaving ? 1 : 0.85}
                            disabled={isSaving}
                            style={styles.continueButton}
                            accessibilityRole="button"
                            accessibilityLabel="Begin Priming"
                            testID="begin-priming-button"
                        >
                            <LinearGradient
                                colors={[colors.anchor15.giltBright, colors.anchor15.gilt, '#AE813F']}
                                style={[styles.continueGradient, isCompactLayout && styles.continueGradientCompact]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                            >
                                {isSaving ? (
                                    <ActivityIndicator color={colors.anchor15.ink} size="small" />
                                ) : (
                                    <>
                                        <Text style={[styles.continueText, isCompactLayout && styles.continueTextCompact]}>
                                            BEGIN PRIMING {secondsRemaining > 0 ? `(${secondsRemaining}s)` : ''}
                                        </Text>
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
        backgroundColor: colors.anchor15.navy,
    },
    goldGlow: {
        position: 'absolute',
        top: -140,
        left: '50%',
        transform: [{ translateX: -210 }],
        width: 420,
        height: 420,
        borderRadius: 210,
        backgroundColor: 'rgba(217, 179, 108, 0.08)',
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
        paddingBottom: spacing.sm,
    },
    backButton: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: 'rgba(22, 29, 37, 0.65)',
        borderWidth: 1,
        borderColor: 'rgba(217, 179, 108, 0.22)',
    },
    headerTitle: {
        fontFamily: typography.fontFamily.ritualSemiBold,
        fontSize: 15,
        letterSpacing: 2.6,
        color: colors.anchor15.giltBright,
        flex: 1,
        textAlign: 'center',
        textTransform: 'uppercase',
    },
    backIcon: {
        fontSize: 19,
        color: colors.anchor15.giltBright,
        fontWeight: '300',
    },
    headerSpacer: {
        width: 42,
        height: 42,
    },
    content: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'flex-start',
        paddingTop: spacing.lg,
    },
    contentCompact: {
        paddingTop: spacing.md,
    },
    imageContainer: {
        marginBottom: 26,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        shadowColor: colors.anchor15.gilt,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.32,
        shadowRadius: 32,
        elevation: 16,
    },
    imageContainerCompact: {
        marginBottom: 18,
        shadowRadius: 22,
    },
    imageHalo: {
        position: 'absolute',
        width: '116%',
        height: '116%',
        backgroundColor: 'rgba(217, 179, 108, 0.08)',
    },
    imageCard: {
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(217, 179, 108, 0.35)',
        backgroundColor: colors.anchor15.steel,
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
        borderWidth: 1,
        borderColor: 'rgba(217, 179, 108, 0.15)',
    },
    textContainer: {
        width: '100%',
    },
    label: {
        fontFamily: typography.fontFamily.ritual,
        fontSize: 11,
        letterSpacing: 2.2,
        color: colors.anchor15.ash,
        marginBottom: spacing.md,
        textAlign: 'center',
        textTransform: 'uppercase',
    },
    labelCompact: {
        fontSize: 10,
        letterSpacing: 1.8,
        marginBottom: spacing.sm,
    },
    intentionCard: {
        borderRadius: 16,
        paddingVertical: 22,
        paddingHorizontal: 24,
        borderWidth: 1,
        borderColor: 'rgba(217, 179, 108, 0.18)',
        backgroundColor: 'rgba(22, 29, 37, 0.55)',
        position: 'relative',
        overflow: 'hidden',
    },
    intentionCardCompact: {
        paddingVertical: 16,
        paddingHorizontal: 18,
        borderRadius: 14,
    },
    intentionBorder: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: 3.5,
        backgroundColor: colors.anchor15.giltBright,
    },
    intentionText: {
        fontFamily: typography.fontFamily.voiceItalic,
        fontSize: 20,
        fontStyle: 'italic',
        color: colors.anchor15.bone,
        lineHeight: 28,
        textAlign: 'center',
    },
    intentionTextCompact: {
        fontSize: 17,
        lineHeight: 24,
    },
    guideHintContainer: {
        marginTop: spacing.md,
        paddingHorizontal: spacing.sm,
        alignItems: 'flex-start',
    },
    sealLineContainer: {
        marginTop: spacing.md + 2,
        paddingHorizontal: spacing.xs,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    sealIndicatorBar: {
        width: 2.5,
        height: 14,
        backgroundColor: colors.anchor15.gilt,
        borderRadius: 1,
    },
    sealLineText: {
        fontFamily: typography.fontFamily.voiceItalic,
        fontSize: 14,
        fontStyle: 'italic',
        color: 'rgba(244, 239, 230, 0.62)',
        lineHeight: 20,
    },
    footer: {
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.md,
        paddingBottom: 22,
    },
    footerCompact: {
        paddingHorizontal: spacing.md + 4,
        paddingTop: spacing.sm,
        paddingBottom: 16,
    },
    ctaHelperText: {
        fontFamily: typography.fontFamily.voiceItalic,
        fontSize: 13.5,
        fontStyle: 'italic',
        color: 'rgba(244, 239, 230, 0.62)',
        textAlign: 'center',
        marginBottom: spacing.md,
        lineHeight: 19,
    },
    ctaHelperTextCompact: {
        fontSize: 12.5,
        marginBottom: spacing.sm,
    },
    continueButton: {
        borderRadius: 999,
        overflow: 'hidden',
        shadowColor: colors.anchor15.gilt,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.32,
        shadowRadius: 20,
        elevation: 10,
    },
    continueGradient: {
        minHeight: 56,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
        gap: 8,
    },
    continueGradientCompact: {
        minHeight: 50,
        paddingHorizontal: 20,
    },
    continueText: {
        fontFamily: typography.fontFamily.ritualSemiBold,
        fontSize: 14,
        letterSpacing: 2,
        color: colors.anchor15.ink,
        textTransform: 'uppercase',
    },
    continueTextCompact: {
        fontSize: 13,
        letterSpacing: 1.6,
    },
    continueArrow: {
        fontSize: 18,
        color: colors.anchor15.ink,
        fontWeight: '600',
    },
    continueArrowCompact: {
        fontSize: 16,
    },
});
