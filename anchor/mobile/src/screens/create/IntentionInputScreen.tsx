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
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '@/types';
import { distillIntention } from '@/utils/sigil/distillation';
import { detectCategoryFromText } from '@/utils/categoryDetection';
import { colors } from '@/theme/colors';
import { ArrowLeft } from 'lucide-react-native';
import { useTeachingGate } from '@/utils/useTeachingGate';
import { useTeachingStore } from '@/stores/teachingStore';
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

const PLACEHOLDER_POOL = [
    'Stay focused during training',
    'Respond calmly under pressure',
    'Be present with my family',
    'Trust my decisions',
    'Listen before reacting',
];

export default function IntentionInputScreen() {
    const navigation = useNavigation<NavigationProp>();
    const insets = useSafeAreaInsets();
    const { width, height } = useWindowDimensions();
    const { recordShown } = useTeachingStore();

    const scrollViewRef = useRef<ScrollView>(null);
    const textInputRef = useRef<TextInput>(null);
    const [intention, setIntention] = useState('');
    const [placeholder, setPlaceholder] = useState('');
    const [isFocused, setIsFocused] = useState(false);
    const [delayedCanSubmit, setDelayedCanSubmit] = useState(false);
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
    const initializedFromDraftRef = useRef(false);

    // Teaching: whisper state (Guide Mode)
    const [undertoneText, setUndertoneText] = useState<string | null>(null);
    const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const firstTimeShownRef = useRef(false);
    const hesitationShownRef = useRef(false);

    // Teaching gate — evaluated once per render cycle; gates enforce lifetime limits
    const firstTimeTeaching = useTeachingGate({
        screenId: 'intention_input',
        candidateIds: ['intention_input_first_time_v1'],
    });
    const hesitationTeaching = useTeachingGate({
        screenId: 'intention_input',
        candidateIds: ['intention_input_hesitation_v1'],
    });

    const showUndertone = (text: string, teachingId: string) => {
        const content = TEACHINGS[teachingId];
        setUndertoneText(text);
        recordShown(teachingId, 'inline_whisper', content?.maxShows ?? 1);
        AnalyticsService.track('teaching_shown', {
            teaching_id: teachingId,
            pattern: 'inline_whisper',
            screen: 'intention_input',
            trigger: content?.trigger ?? 'first_time',
            guide_mode: true,
        });
    };

    useEffect(() => {
        const randomIndex = Math.floor(Math.random() * PLACEHOLDER_POOL.length);
        setPlaceholder(`e.g. ${PLACEHOLDER_POOL[randomIndex]}`);
    }, []);

    useFocusEffect(
        React.useCallback(() => {
            if (!initializedFromDraftRef.current) {
                setIntention(useFirstAnchorFlowStore.getState().draft?.originalIntention ?? '');
                initializedFromDraftRef.current = true;
            }
            setDelayedCanSubmit(false);
            setLaunching(false);
            setIsFocused(false);
            setUndertoneText(null);

            if (idleTimerRef.current) clearTimeout(idleTimerRef.current);

            return () => {
                if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
            };
        }, [idleTimerRef])
    );

    // Cleanup idle timer on unmount
    useEffect(() => () => {
        if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    }, []);

    // DECISION D9: Continue (typed) needs two different consonants after distillation.
    const consonantCount = useMemo(() => distillIntention(intention).finalLetters.length, [intention]);
    const hasEnoughConsonants = consonantCount >= MIN_CONSONANTS;
    const canContinue = intentionValidation.canSubmit && hasEnoughConsonants;

    // 300ms delay before enabling CTA
    useEffect(() => {
        if (canContinue) {
            const timer = setTimeout(() => setDelayedCanSubmit(true), 300);
            return () => clearTimeout(timer);
        } else {
            setDelayedCanSubmit(false);
        }
    }, [canContinue]);

    const handleFocus = () => {
        setIsFocused(true);
        // First-time undertone: show after 1.2s of focus with no keystrokes
        if (firstTimeTeaching && !firstTimeShownRef.current) {
            idleTimerRef.current = setTimeout(() => {
                if (firstTimeTeaching && !firstTimeShownRef.current) {
                    firstTimeShownRef.current = true;
                    showUndertone(firstTimeTeaching.copy, firstTimeTeaching.teachingId);
                }
            }, 1200);
        }
        setTimeout(() => {
            scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 150);
    };

    const handleBlur = () => {
        setIsFocused(false);
        if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };

    const handleIntentionChange = (text: string) => {
        if (text.length <= MAX_CHARS) {
            setIntention(text);

            // Reset idle timer on every keystroke
            if (idleTimerRef.current) clearTimeout(idleTimerRef.current);

            // Schedule hesitation hint after 8s idle (only if user has typed something)
            if (isFocused && hesitationTeaching && !hesitationShownRef.current && text.length > 0) {
                idleTimerRef.current = setTimeout(() => {
                    if (hesitationTeaching && !hesitationShownRef.current) {
                        hesitationShownRef.current = true;
                        showUndertone(hesitationTeaching.copy, hesitationTeaching.teachingId);
                    }
                }, 8000);
            }
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
            source === 'typed' ? delayedCanSubmit : intention.trim().length >= 1;
        if (!canStart) return;
        playCreationSound('uiTap');

        const isGuestFirstAnchor = !isAuthenticated && anchorCount === 0;
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

            navigation.navigate('Paywall', {
                source: reason,
                preferredPlanId: 'annual',
            });
            return;
        }

        const distillation = distillIntention(intention);
        const category = detectCategoryFromText(intention);
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
        } as const;

        // DEFERRED: the old creation path, superseded by AnchorCreationFlow (still registered):
        // navigation.navigate('LetterDistillation', {
        //     intentionText: intention,
        //     category,
        //     distilledLetters: distillation.finalLetters,
        // });
        const go = (fieldFrame?: { x: number; y: number; width: number; height: number }) => {
            Keyboard.dismiss();
            setLaunching(true);
            navigation.navigate('AnchorCreationFlow', {
                ...baseParams,
                entry: fieldFrame ? 'glide' : 'fade',
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

    const showConsonantHint = intention.trim().length >= 3 && !hasEnoughConsonants;
    const hintText = intentionValidation.guidanceText || undertoneText;

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
                        {navigation.canGoBack() ? (
                            <TouchableOpacity
                                onPress={() => navigation.goBack()}
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
                                onBlur={handleBlur}
                                placeholder={placeholder}
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

                            {showConsonantHint ? (
                                <Text style={styles.consonantHint}>Use at least two different consonants.</Text>
                            ) : null}

                            {hintText ? (
                                <Text style={styles.guidance} accessibilityLiveRegion="polite">
                                    {hintText}
                                </Text>
                            ) : (
                                <StaticHints />
                            )}
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
                            disabled={!delayedCanSubmit}
                            style={styles.cta}
                            accessibilityRole="button"
                            accessibilityLabel="Continue"
                            accessibilityState={{ disabled: !delayedCanSubmit }}
                        >
                            <ContinueButtonFace enabled={delayedCanSubmit || launching} />
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
