import type { ScrollViewInstance, TextInputInstance } from 'react-native';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    Alert,
    Keyboard,
    Pressable,
    useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList, type AnchorCategory } from '@/types';
import { distillIntention } from '@/utils/sigil/distillation';
import { detectCategoryFromText } from '@/utils/categoryDetection';
import { colors } from '@/theme/colors';
import { focusAreaById, focusAreaForCategory } from '@/constants/v2/focusAreas';
import { ArrowLeft } from 'lucide-react-native';
import { AnalyticsService } from '@/services/AnalyticsService';
import { warmUpBackend } from '@/services/backendWarmup';
import { playCreationSound } from '@/services/CreationSounds';
import { TEACHINGS } from '@/constants/teaching';
import { useIntentionValidation } from '@/hooks/useIntentionValidation';
import { useEntitlements } from '@/hooks/useEntitlements';
import { getAnchorCreationLimitCopy } from '@/utils/entitlements';
import { useAuthStore } from '@/stores/authStore';
import { useAnchorStore } from '@/stores/anchorStore';
import { useFirstAnchorFlowStore } from '@/stores/firstAnchorFlowStore';
import { computeFlowLayout } from './flow/flowLayout';
import { intentFontSize } from './flow/geometry';
import { useIntentionHandoffStore } from './flow/intentionHandoff';
import {
    ContinueButtonFace,
    DrawLinkFace,
    INTENTION_FONTS,
    INTENTION_SIDE_PADDING,
    IntentionFieldLabel,
    IntentionHeader,
    IntentionRule,
    RulesLine,
    StaticHints,
} from './components/IntentionChrome';

type NavigationProp = StackNavigationProp<RootStackParamList, 'CreateAnchor'>;
type CreationSource = 'typed' | 'drawn';

// DECISION D3: the maximum stays 100 (the mockup's /140 is not used).
const MAX_CHARS = 100;
// DECISION D9: a typed intention needs at least two different consonants to make a line.
const MIN_CONSONANTS = 2;

const CONSONANT_MESSAGE = 'Use at least two different consonants.';
const SHORT_MESSAGE = 'Write a little more.';

const PLACEHOLDER_POOL = [
    'Stay focused during training',
    'Respond calmly under pressure',
    'Be present with my family',
    'Trust my decisions',
    'Listen before reacting',
];

export interface IntentionInputScreenProps {
    fromOnboarding?: boolean;
    chosenCategory?: AnchorCategory;
    onBack?: () => void;
}

/** Evolve opens this screen from a Release screen: the old intention is the starting text, and the marker rides on to creation. */
type EvolveRouteParams = { initialIntention?: string; evolve?: { fromAnchorId: string } } | undefined;

export default function IntentionInputScreen({ fromOnboarding = false, chosenCategory, onBack }: IntentionInputScreenProps = {}) {
    const navigation = useNavigation<NavigationProp>();
    const routeParams = (useRoute() as { params?: EvolveRouteParams } | undefined)?.params;
    const evolve = routeParams?.evolve;
    // Editable: the user can reword it before continuing. Never longer than the field allows.
    const initialIntention = evolve && typeof routeParams?.initialIntention === 'string'
        ? routeParams.initialIntention.slice(0, MAX_CHARS)
        : '';
    const insets = useSafeAreaInsets();
    const { width, height } = useWindowDimensions();

    const scrollViewRef = useRef<ScrollViewInstance>(null);
    const textInputRef = useRef<TextInputInstance>(null);
    const [intention, setIntention] = useState('');
    const [placeholder, setPlaceholder] = useState('');
    // The one onboarding answer frames the field: its own placeholder and tip, in place on the
    // first frame. "Something else" arrives with no category and takes the open copy.
    const area = useMemo(
        () => (fromOnboarding ? focusAreaForCategory(chosenCategory) ?? focusAreaById('something_else') : undefined),
        [chosenCategory, fromOnboarding],
    );
    // Constraint feedback waits for Continue: it is never shown while the words are being written.
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [rulesOpen, setRulesOpen] = useState(false);
    // Once Continue has been pressed the words belong to the flow's canvas, and the button must
    // not grey out while it fades behind them.
    const [launching, setLaunching] = useState(false);
    const glyphsOwnedByFlow = useIntentionHandoffStore((state) => state.glyphsOwnedByFlow);
    const intentionValidation = useIntentionValidation(intention);
    const entitlements = useEntitlements();
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
    const anchorCount = useAnchorStore((state) => state.anchors.length);
    const updateFirstAnchorDraft = useFirstAnchorFlowStore((state) => state.updateDraft);
    const launchedForwardRef = useRef(false);
    // Synchronous re-entry guard: two quick Continue taps must start one creation, not two.
    const startingRef = useRef(false);
    // Set while a gate (paywall) is open so coming back keeps what was typed.
    const returningFromGateRef = useRef(false);

    useEffect(() => {
        if (area) return;
        const randomIndex = Math.floor(Math.random() * PLACEHOLDER_POOL.length);
        setPlaceholder(`e.g. ${PLACEHOLDER_POOL[randomIndex]}`);
    }, [area]);

    useFocusEffect(
        React.useCallback(() => {
            const returningFromChild = launchedForwardRef.current;
            const returningFromGate = returningFromGateRef.current;
            launchedForwardRef.current = false;
            returningFromGateRef.current = false;
            startingRef.current = false;
            setLaunching(false);

            // Fresh entry or absence of an active in-flight draft always resets the intention text.
            if (!returningFromGate && (!returningFromChild || !useFirstAnchorFlowStore.getState().draft)) {
                setIntention(initialIntention);
                setSubmitError(null);
                useFirstAnchorFlowStore.getState().clearDraft();
            }
        }, [initialIntention])
    );

    // Reset draft and intention when leaving this screen
    useEffect(() => {
        const unsubscribe = navigation.addListener?.('beforeRemove', () => {
            if (!launchedForwardRef.current) {
                setIntention('');
                setSubmitError(null);
                useFirstAnchorFlowStore.getState().clearDraft();
            }
        });
        return () => {
            if (typeof unsubscribe === 'function') unsubscribe();
        };
    }, [navigation]);

    // DECISION D9: Continue (typed) needs two different consonants after distillation.
    const consonantCount = useMemo(() => distillIntention(intention).finalLetters.length, [intention]);
    const hasEnoughConsonants = consonantCount >= MIN_CONSONANTS;
    // Continue is available as soon as there is something to check; the check runs on the tap.
    const canContinue = intention.trim().length >= 1;

    const handleFocus = () => {
        setTimeout(() => {
            scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 150);
    };

    const handleIntentionChange = (text: string) => {
        if (text.length <= MAX_CHARS) {
            setIntention(text);
            setSubmitError(null);
        }
    };

    // The field's glyph metrics, scaled with the flow's own factor so the words keep their exact
    // size as they glide into the flow.
    const flowScale = useMemo(() => computeFlowLayout(width, height).scale, [width, height]);
    const designFontSize = intentFontSize(intention.length);
    const fieldFontSize = Math.round(designFontSize * flowScale * 100) / 100;
    const fieldLineHeight = Math.round(Math.round(designFontSize * 1.3) * flowScale * 100) / 100;

    const startCreation = (source: CreationSource) => {
        const canStart =
            intention.trim().length >= 1;
        if (!canStart || startingRef.current) return;

        if (source === 'typed') {
            const problem = !hasEnoughConsonants
                ? CONSONANT_MESSAGE
                : intentionValidation.detection.isGibberish
                  ? intentionValidation.guidanceText
                  : !intentionValidation.canSubmit
                    ? SHORT_MESSAGE
                    : null;
            if (problem) {
                setSubmitError(problem);
                return;
            }
        }
        playCreationSound('uiTap');

        const isGuestFirstAnchor = !isAuthenticated && anchorCount === 0;
        // Evolve creates a second Anchor, so it is a paid path: the same gate as any other new Anchor
        // applies here (a free user sees the paywall at Continue, before any artwork is generated).
        if (!isGuestFirstAnchor && !entitlements.canCreateAnchor) {
            const reason = entitlements.anchorCreationLimitReason;
            if (!reason) return;

            AnalyticsService.track(reason, {
                source: 'first_anchor_creation',
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

            returningFromGateRef.current = true;
            navigation.navigate('Paywall', {
                source: reason,
                preferredPlanId: 'annual',
            });
            return;
        }

        startingRef.current = true;
        const distillation = distillIntention(intention);
        const category = chosenCategory ?? detectCategoryFromText(intention);
        updateFirstAnchorDraft({
            originalIntention: intention,
            distilledLetters: distillation.finalLetters,
            generationStatus: 'idle',
        });

        // Free latency: wake the backend now rather than when the style is chosen.
        warmUpBackend();

        const baseParams = {
            intentionText: intention,
            category,
            distilledLetters: distillation.finalLetters,
            source,
            ...(fromOnboarding ? { fromOnboarding: true } : {}),
            ...(evolve ? { evolve } : {}),
        } as const;

        // DEFERRED: the old creation path, superseded by AnchorCreationFlow (still registered):
        // navigation.navigate('LetterDistillation', {
        //     intentionText: intention,
        //     category,
        //     distilledLetters: distillation.finalLetters,
        // });
        const go = (fieldFrame?: { x: number; y: number; width: number; height: number }) => {
            Keyboard.dismiss();
            launchedForwardRef.current = true;
            setLaunching(true);
            navigation.navigate('AnchorCreationFlow', {
                ...baseParams,
                entry: fieldFrame ? 'glide' : 'fade',
                ...(area ? { focusAreaId: area.id } : {}),
                ...(fieldFrame
                    ? {
                          fieldFrame: {
                              ...fieldFrame,
                              fontSize: fieldFontSize,
                              lineHeight: fieldLineHeight,
                          },
                      }
                    : {}),
            });
        };

        // Measure the field so the words can glide from exactly where they were typed. If the
        // measurement is unavailable or stalls, fall back to the centred fade — never block.
        let started = false;
        const begin = (fieldFrame?: { x: number; y: number; width: number; height: number }) => {
            if (started) return;
            started = true;
            clearTimeout(measureFallback);
            go(fieldFrame);
        };
        const measureFallback = setTimeout(() => begin(), 150);
        const input = textInputRef.current;
        if (input && typeof input.measureInWindow === 'function') {
            input.measureInWindow((x, y, w, h) => begin({ x, y, width: w, height: h }));
        } else {
            begin();
        }
    };

    return (
        <View style={styles.container}>
            <StatusBar style="dark" />

            <SafeAreaView style={styles.safeArea}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
                    style={styles.keyboardView}
                >
                    <ScrollView
                        ref={scrollViewRef}
                        style={styles.scrollView}
                        contentContainerStyle={styles.scrollContent}
                        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                    >
                        {onBack || navigation.canGoBack() ? (
                            <TouchableOpacity
                                onPress={() => {
                                    launchedForwardRef.current = false;
                                    setIntention('');
                                    setSubmitError(null);
                                    useFirstAnchorFlowStore.getState().clearDraft();
                                    if (onBack) onBack();
                                    else navigation.goBack();
                                }}
                                accessibilityRole="button"
                                accessibilityLabel="Go back"
                                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                                style={styles.backButton}
                            >
                                <ArrowLeft size={22} color={colors.creation.ink} strokeWidth={2} />
                            </TouchableOpacity>
                        ) : null}
                        <IntentionHeader />

                        <View style={styles.fieldBlock}>
                            <IntentionFieldLabel count={intention.length} max={MAX_CHARS} />
                            <TextInput
                                ref={textInputRef}
                                style={[
                                    styles.textInput,
                                    { fontSize: fieldFontSize, lineHeight: fieldLineHeight },
                                    glyphsOwnedByFlow && styles.textInputHidden,
                                ]}
                                value={intention}
                                onChangeText={handleIntentionChange}
                                onFocus={handleFocus}
                                placeholder={area ? area.placeholder : placeholder}
                                placeholderTextColor={colors.creation.placeholder}
                                multiline
                                scrollEnabled={false}
                                maxLength={MAX_CHARS}
                                autoCapitalize="sentences"
                                autoCorrect
                                returnKeyType="none"
                                blurOnSubmit={false}
                                enablesReturnKeyAutomatically={false}
                                selectionColor={colors.creation.ink}
                                underlineColorAndroid="transparent"
                                accessibilityLabel="Your intention"
                            />
                            <IntentionRule />

                            {submitError ? (
                                <Text style={styles.consonantHint} accessibilityLiveRegion="polite">{submitError}</Text>
                            ) : null}

                            <StaticHints tip={area?.tip} />
                        </View>
                    </ScrollView>

                    <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, 16) }]}>
                        <RulesLine
                            trailing={
                                <Pressable
                                    onPress={() => setRulesOpen((open) => !open)}
                                    accessibilityRole="button"
                                    accessibilityLabel="About the three rules"
                                    // DEFERRED: 10 pt hit slop gave the 17 pt glyph only a 37 pt target.
                                    hitSlop={14}
                                    style={styles.info}
                                >
                                    <Text style={styles.infoGlyph}>i</Text>
                                </Pressable>
                            }
                        />

                        {rulesOpen ? (
                            <View style={styles.rulesSheet}>
                                <Text style={styles.rulesSheetTitle}>Short. Present. Felt.</Text>
                                <Text style={styles.rulesSheetBody}>
                                    {TEACHINGS.intention_input_first_time_v1.copy}
                                </Text>
                                <Text style={styles.rulesSheetBody}>
                                    {TEACHINGS.intention_input_hesitation_v1.copy}
                                </Text>
                            </View>
                        ) : null}

                        <TouchableOpacity
                            onPress={() => startCreation('typed')}
                            activeOpacity={0.85}
                            disabled={!canContinue}
                            style={styles.cta}
                            accessibilityRole="button"
                            accessibilityLabel="Continue"
                            accessibilityState={{ disabled: !canContinue }}
                        >
                            <ContinueButtonFace enabled={canContinue || launching} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => startCreation('drawn')}
                            disabled={intention.trim().length < 1}
                            accessibilityRole="button"
                            accessibilityLabel="Or draw it yourself"
                            accessibilityState={{ disabled: intention.trim().length < 1 }}
                        >
                            <DrawLinkFace enabled={intention.trim().length >= 1} />
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.creation.cream,
    },
    safeArea: {
        flex: 1,
    },
    keyboardView: {
        flex: 1,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: INTENTION_SIDE_PADDING,
        paddingTop: 32,
        paddingBottom: 24,
    },
    backButton: {
        marginBottom: 16,
        alignSelf: 'flex-start',
    },
    fieldBlock: {
        marginTop: 28,
    },
    textInput: {
        fontFamily: INTENTION_FONTS.serif,
        color: colors.creation.ink,
        minHeight: 80,
        marginTop: 14,
        padding: 0,
        paddingHorizontal: 0,
        textAlignVertical: 'top',
        includeFontPadding: false,
    },
    // The flow's canvas is drawing these glyphs now; keep the field (and its caret) invisible.
    textInputHidden: { color: 'transparent' },
    consonantHint: {
        fontFamily: INTENTION_FONTS.sans,
        fontSize: 13,
        color: colors.creation.muted,
        marginTop: 12,
    },
    guidance: {
        fontFamily: INTENTION_FONTS.serifItalic,
        fontSize: 17,
        lineHeight: 24,
        color: colors.creation.muted,
        marginTop: 20,
    },
    bottom: {
        paddingHorizontal: INTENTION_SIDE_PADDING,
        paddingTop: 12,
        gap: 12,
    },
    cta: {
        marginTop: 2,
    },
    info: {
        width: 17,
        height: 17,
        borderRadius: 8.5,
        borderWidth: 1.2,
        borderColor: colors.creation.muted,
        alignItems: 'center',
        justifyContent: 'center',
    },
    infoGlyph: {
        fontFamily: INTENTION_FONTS.sansBold,
        fontSize: 10,
        color: colors.creation.muted,
        lineHeight: 12,
    },
    rulesSheet: {
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.creation.hairline,
        borderRadius: 14,
        padding: 14,
        gap: 6,
    },
    rulesSheetTitle: {
        fontFamily: INTENTION_FONTS.serif,
        fontSize: 18,
        color: colors.creation.ink,
    },
    rulesSheetBody: {
        fontFamily: INTENTION_FONTS.sans,
        fontSize: 14,
        lineHeight: 20,
        color: colors.creation.muted,
    },
});
