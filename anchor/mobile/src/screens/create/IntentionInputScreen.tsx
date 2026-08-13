import React, { useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    TextInput,
    Pressable,
    StyleSheet,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    Modal,
    Alert,
    Keyboard,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, RadialGradient as SvgRadialGradient, Stop } from 'react-native-svg';
import Animated, {
    Easing,
    cancelAnimation,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming,
} from 'react-native-reanimated';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '@/types';
import { distillIntention } from '@/utils/sigil/distillation';
import { detectCategoryFromText } from '@/utils/categoryDetection';
import { colors, typography } from '@/theme';
import { BackChevronIcon, CloseIcon } from '@/components/icons';
import { useTeachingGate } from '@/utils/useTeachingGate';
import { useTeachingStore } from '@/stores/teachingStore';
import { useReduceMotionEnabled } from '@/hooks/useReduceMotionEnabled';
import { AnalyticsService } from '@/services/AnalyticsService';
import { TEACHINGS } from '@/constants/teaching';
import { useIntentionValidation } from '@/hooks/useIntentionValidation';
import { useEntitlements } from '@/hooks/useEntitlements';
import { getAnchorCreationLimitCopy } from '@/utils/entitlements';
import { useAuthStore } from '@/stores/authStore';
import { useAnchorStore } from '@/stores/anchorStore';
import { useFirstAnchorFlowStore } from '@/stores/firstAnchorFlowStore';

type NavigationProp = StackNavigationProp<RootStackParamList, 'CreateAnchor'>;

const gilt = colors.anchor15.gilt;
const giltBright = colors.anchor15.giltBright;
const ash = colors.anchor15.ash;
const bone = colors.anchor15.bone;
const boneSoft = 'rgba(244, 239, 230, 0.68)';
const boneFaint = 'rgba(244, 239, 230, 0.42)';
const goldLine = colors.anchor15.goldLine;
const hairlineGold = colors.anchor15.hairlineGold;
const maxChars = 100;

type PrincipleRow = {
    key: string;
    label: string;
    desc: string;
    attn?: boolean;
};

const SHEET_ITEMS = [
    { label: 'Short', title: 'One intention. One direction.' },
    {
        label: 'Present',
        title: "Write from the state you're choosing, not the state you're escaping.",
        example: {
            insteadOf: '"I don\'t want to procrastinate."',
            tryText: '"I begin important work immediately."',
        },
    },
    { label: 'Felt', title: 'Use words that feel personally meaningful.' },
];

function GoldGlow() {
    return (
        <View pointerEvents="none" style={styles.glowWrap}>
            <Svg width={340} height={340}>
                <Defs>
                    <SvgRadialGradient id="setIntentionGlow" cx="50%" cy="50%" r="50%">
                        <Stop offset="0%" stopColor={gilt} stopOpacity={0.09} />
                        <Stop offset="68%" stopColor={gilt} stopOpacity={0} />
                    </SvgRadialGradient>
                </Defs>
                <Circle cx={170} cy={170} r={170} fill="url(#setIntentionGlow)" />
            </Svg>
        </View>
    );
}

function PulsingBadge({ isNew, reduceMotion }: { isNew: boolean; reduceMotion: boolean }) {
    const pulse = useSharedValue(0);

    useEffect(() => {
        if (!isNew || reduceMotion) {
            cancelAnimation(pulse);
            pulse.value = 0;
            return;
        }
        pulse.value = withRepeat(
            withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
            -1,
            true
        );
        return () => cancelAnimation(pulse);
    }, [isNew, reduceMotion, pulse]);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: 0.7 + pulse.value * 0.3,
    }));

    return (
        <Animated.View
            style={[
                styles.principlesQ,
                isNew && styles.principlesQNew,
                isNew && animatedStyle,
            ]}
        >
            <Text style={[styles.principlesQText, isNew && styles.principlesQTextNew]}>?</Text>
        </Animated.View>
    );
}

export default function IntentionInputScreen() {
    const navigation = useNavigation<NavigationProp>();
    const insets = useSafeAreaInsets();
    const { recordShown } = useTeachingStore();

    const scrollViewRef = useRef<ScrollView>(null);
    const textInputRef = useRef<TextInput>(null);
    const [intention, setIntention] = useState('');
    const [isFocused, setIsFocused] = useState(false);
    const [delayedCanSubmit, setDelayedCanSubmit] = useState(false);
    const [sheetOpen, setSheetOpen] = useState(false);
    const intentionValidation = useIntentionValidation(intention);
    const entitlements = useEntitlements();
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
    const anchorCount = useAnchorStore((state) => state.anchors.length);
    const updateFirstAnchorDraft = useFirstAnchorFlowStore((state) => state.updateDraft);
    const initializedFromDraftRef = useRef(false);

    const reduceMotion = useReduceMotionEnabled();

    const principlesTeaching = useTeachingGate({
        screenId: 'intention_input',
        candidateIds: ['intention_input_principles_v1'],
    });

    useFocusEffect(
        React.useCallback(() => {
            if (!initializedFromDraftRef.current) {
                setIntention(useFirstAnchorFlowStore.getState().draft?.originalIntention ?? '');
                initializedFromDraftRef.current = true;
            }
            setDelayedCanSubmit(false);
            setIsFocused(false);
        }, [])
    );

    // 300ms delay before enabling CTA
    useEffect(() => {
        if (intentionValidation.canSubmit) {
            const timer = setTimeout(() => setDelayedCanSubmit(true), 300);
            return () => clearTimeout(timer);
        } else {
            setDelayedCanSubmit(false);
        }
    }, [intentionValidation.canSubmit]);

    const handleFocus = () => {
        setIsFocused(true);
        setTimeout(() => {
            scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 150);
    };

    const restoreLayoutAfterKeyboard = React.useCallback(() => {
        textInputRef.current?.blur();
        setIsFocused(false);
        requestAnimationFrame(() => {
            scrollViewRef.current?.scrollTo({ y: 0, animated: true });
        });
    }, []);

    useEffect(() => {
        const subscription = Keyboard.addListener('keyboardDidHide', restoreLayoutAfterKeyboard);
        return () => subscription.remove();
    }, [restoreLayoutAfterKeyboard]);

    const handleBlur = () => setIsFocused(false);

    const handleIntentionChange = (text: string) => {
        if (text.length <= maxChars) {
            setIntention(text);
        }
    };

    const openPrinciplesSheet = () => {
        setSheetOpen(true);
        if (principlesTeaching) {
            recordShown(principlesTeaching.teachingId, 'inline_whisper', principlesTeaching.maxShows ?? 1);
            AnalyticsService.track('teaching_shown', {
                teaching_id: principlesTeaching.teachingId,
                pattern: 'inline_whisper',
                screen: 'intention_input',
                trigger: principlesTeaching.trigger,
                guide_mode: true,
            });
        }
    };

    const handleContinue = () => {
        if (delayedCanSubmit) {
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
            navigation.navigate('LetterDistillation', {
                intentionText: intention,
                category,
                distilledLetters: distillation.finalLetters,
            });
        }
    };

    const guidanceText = intentionValidation.guidanceText;

    const principleRows: PrincipleRow[] = [
        { key: 'short', label: 'Short', desc: 'One clear direction.' },
        {
            key: 'present',
            label: 'Present',
            desc: guidanceText || "Write from the state you're choosing.",
            attn: Boolean(guidanceText),
        },
        { key: 'felt', label: 'Felt', desc: 'Use words that matter to you.' },
    ];

    return (
        <View style={styles.container}>
            <StatusBar style="light" />
            <LinearGradient
                colors={[colors.anchor15.creationTop, colors.anchor15.creationBottom, colors.anchor15.navy]}
                locations={[0, 0.44, 1]}
                style={StyleSheet.absoluteFill}
            />
            <GoldGlow />

            <SafeAreaView style={styles.safeArea}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
                    style={styles.keyboardView}
                >
                    <View style={styles.topBar}>
                        <Pressable
                            onPress={() => navigation.goBack()}
                            hitSlop={8}
                            style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnPressed]}
                            accessibilityRole="button"
                            accessibilityLabel="Back"
                        >
                            <BackChevronIcon size={16} color={boneSoft} />
                        </Pressable>
                        <Text style={styles.stepTag}>Step 1 of 2</Text>
                    </View>

                    <ScrollView
                        ref={scrollViewRef}
                        style={styles.scrollView}
                        contentContainerStyle={styles.scrollContent}
                        contentInsetAdjustmentBehavior="always"
                        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                    >
                        <View style={styles.textZone}>
                            <View style={styles.eyebrowRow}>
                                <View style={styles.eyebrowRule} />
                                <Text style={styles.eyebrow}>Set your intention</Text>
                            </View>
                            <Text style={styles.title}>
                                What are you <Text style={styles.titleEm}>anchoring</Text> right now?
                            </Text>
                            <Text style={styles.body}>Write one clear intention.</Text>
                        </View>

                        <View style={styles.inputBody}>
                            <Text style={styles.fieldLabel}>Your intention</Text>
                            <View
                                style={[styles.textareaWrap, isFocused && styles.textareaWrapFocused]}
                            >
                                <TextInput
                                    ref={textInputRef}
                                    style={styles.textarea}
                                    value={intention}
                                    onChangeText={handleIntentionChange}
                                    onFocus={handleFocus}
                                    onBlur={handleBlur}
                                    placeholder="I am fully present with my work."
                                    placeholderTextColor={boneFaint}
                                    multiline
                                    maxLength={maxChars}
                                    autoCapitalize="sentences"
                                    autoCorrect
                                    returnKeyType="none"
                                    blurOnSubmit={false}
                                    enablesReturnKeyAutomatically={false}
                                    selectionColor={gilt}
                                    accessibilityLabel="What are you anchoring right now?"
                                />
                            </View>

                            {intention.length === 0 && (
                                <View style={styles.exampleTeach}>
                                    <View style={styles.exampleLine}>
                                        <Text style={styles.exampleTag}>Instead of </Text>
                                        <Text style={styles.exampleQuote}>
                                            &ldquo;I want to stop getting distracted.&rdquo;
                                        </Text>
                                    </View>
                                    <View style={styles.exampleLine}>
                                        <Text style={styles.exampleTag}>&rarr; </Text>
                                        <Text style={styles.exampleGood}>
                                            &ldquo;I am fully present with my work.&rdquo;
                                        </Text>
                                    </View>
                                </View>
                            )}

                            <View style={styles.principles}>
                                <Pressable
                                    onPress={openPrinciplesSheet}
                                    style={styles.principlesToggle}
                                    hitSlop={{ top: 10, bottom: 10, left: 4, right: 4 }}
                                    accessibilityRole="button"
                                    accessibilityLabel="Short, present, felt — learn more"
                                >
                                    <Text style={styles.principlesToggleText}>Short &middot; Present &middot; Felt</Text>
                                    <PulsingBadge isNew={Boolean(principlesTeaching)} reduceMotion={reduceMotion} />
                                </Pressable>

                                {principleRows.map((row) => (
                                    <View key={row.key} style={styles.principleRow}>
                                        <View style={[styles.principleCheck, row.attn && styles.principleCheckAttn]}>
                                            <Text style={[styles.principleCheckText, row.attn && styles.principleCheckTextAttn]}>
                                                &#10003;
                                            </Text>
                                        </View>
                                        <View style={styles.principleBody}>
                                            <Text style={styles.principleLabel}>{row.label}</Text>
                                            <Text style={[styles.principleDesc, row.attn && styles.principleDescAttn]}>
                                                {row.desc}
                                            </Text>
                                        </View>
                                    </View>
                                ))}
                            </View>
                        </View>
                    </ScrollView>

                    <View style={[styles.bottomBar, { paddingBottom: 24 + insets.bottom }]}>
                        <Pressable
                            onPress={handleContinue}
                            disabled={!delayedCanSubmit}
                            style={({ pressed }) => [
                                styles.nextBtn,
                                !delayedCanSubmit && styles.nextBtnDisabled,
                                pressed && delayedCanSubmit && styles.nextBtnPressed,
                            ]}
                            accessibilityRole="button"
                            accessibilityLabel="Continue"
                            accessibilityState={{ disabled: !delayedCanSubmit }}
                        >
                            <Text style={styles.nextBtnText}>Continue &rarr;</Text>
                        </Pressable>
                    </View>
                </KeyboardAvoidingView>
            </SafeAreaView>

            <Modal
                transparent
                visible={sheetOpen}
                animationType="slide"
                onRequestClose={() => setSheetOpen(false)}
                accessibilityViewIsModal
            >
                <Pressable
                    style={styles.sheetBackdrop}
                    onPress={() => setSheetOpen(false)}
                    accessibilityLabel="Dismiss"
                >
                    <Pressable
                        style={{ width: '100%' }}
                        onPress={(event) => event.stopPropagation()}
                    >
                        <LinearGradient
                            colors={['#1A222B', '#10151B']}
                            style={[styles.sheet, { paddingBottom: 40 + insets.bottom }]}
                        >
                            <View style={styles.sheetHandle} />
                            <Pressable
                                onPress={() => setSheetOpen(false)}
                                hitSlop={8}
                                style={styles.sheetClose}
                                accessibilityRole="button"
                                accessibilityLabel="Close"
                            >
                                <CloseIcon size={12} color={boneFaint} />
                            </Pressable>
                            <Text style={styles.sheetTitle}>Short &middot; Present &middot; Felt</Text>

                            {SHEET_ITEMS.map((item, index) => (
                                <View
                                    key={item.label}
                                    style={[styles.sheetItem, index === 0 && styles.sheetItemFirst]}
                                >
                                    <Text style={styles.sheetItemLabel}>{item.label}</Text>
                                    <Text style={styles.sheetItemTitle}>{item.title}</Text>
                                    {item.example && (
                                        <View style={styles.sheetExample}>
                                            <View style={styles.sheetExampleRow}>
                                                <Text style={styles.sheetExTag}>Instead of</Text>
                                                <Text style={styles.sheetExText}>{item.example.insteadOf}</Text>
                                            </View>
                                            <View style={styles.sheetExampleRow}>
                                                <Text style={[styles.sheetExTag, styles.sheetExTagGood]}>Try</Text>
                                                <Text style={[styles.sheetExText, styles.sheetExTextGood]}>
                                                    {item.example.tryText}
                                                </Text>
                                            </View>
                                        </View>
                                    )}
                                </View>
                            ))}

                            <Pressable
                                onPress={() => setSheetOpen(false)}
                                style={({ pressed }) => [styles.sheetDismiss, pressed && styles.nextBtnPressed]}
                                accessibilityRole="button"
                                accessibilityLabel="Got it"
                            >
                                <Text style={styles.sheetDismissText}>Got it</Text>
                            </Pressable>
                        </LinearGradient>
                    </Pressable>
                </Pressable>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.anchor15.navy,
        overflow: 'hidden',
    },
    safeArea: {
        flex: 1,
    },
    glowWrap: {
        position: 'absolute',
        top: -100,
        right: -100,
        width: 340,
        height: 340,
    },
    keyboardView: {
        flex: 1,
        justifyContent: 'space-between',
    },
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 24,
        paddingTop: 14,
        paddingBottom: 12,
    },
    backBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: hairlineGold,
        alignItems: 'center',
        justifyContent: 'center',
    },
    backBtnPressed: {
        borderColor: goldLine,
    },
    stepTag: {
        fontFamily: typography.fontFamily.ritual,
        fontSize: 10,
        fontWeight: '500',
        letterSpacing: 2,
        color: ash,
        textTransform: 'uppercase',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        paddingBottom: 24,
    },
    textZone: {
        paddingHorizontal: 28,
        marginTop: 20,
    },
    eyebrowRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 14,
    },
    eyebrowRule: {
        width: 20,
        height: 1,
        backgroundColor: goldLine,
    },
    eyebrow: {
        fontFamily: typography.fontFamily.ritual,
        fontSize: 11,
        fontWeight: '500',
        letterSpacing: 2.2,
        color: ash,
        textTransform: 'uppercase',
    },
    title: {
        fontFamily: typography.fontFamily.voiceItalic,
        fontStyle: 'italic',
        fontWeight: '500',
        fontSize: 27,
        lineHeight: 34,
        color: bone,
        letterSpacing: 0.15,
        marginBottom: 14,
    },
    titleEm: {
        fontFamily: typography.fontFamily.voice,
        fontStyle: 'normal',
        color: giltBright,
    },
    body: {
        fontFamily: typography.fontFamily.instrument,
        fontSize: 16,
        color: boneSoft,
        lineHeight: 25.6,
    },
    inputBody: {
        paddingHorizontal: 28,
        marginTop: 24,
    },
    fieldLabel: {
        fontFamily: typography.fontFamily.ritual,
        fontSize: 10,
        fontWeight: '500',
        letterSpacing: 2.4,
        color: ash,
        textTransform: 'uppercase',
        marginBottom: 8,
    },
    textareaWrap: {
        borderWidth: 1,
        borderColor: 'rgba(217, 179, 108, 0.4)',
        backgroundColor: 'rgba(244, 239, 230, 0.055)',
        borderRadius: 14,
        minHeight: 132,
    },
    textareaWrapFocused: {
        borderColor: 'rgba(217, 179, 108, 0.65)',
        backgroundColor: 'rgba(244, 239, 230, 0.08)',
    },
    textarea: {
        fontFamily: typography.fontFamily.voiceItalic,
        fontStyle: 'italic',
        fontSize: 20,
        lineHeight: 28,
        color: bone,
        padding: 16,
        minHeight: 132,
        textAlignVertical: 'top',
    },
    exampleTeach: {
        marginTop: 16,
        gap: 4,
    },
    exampleLine: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    exampleTag: {
        fontFamily: typography.fontFamily.instrument,
        fontSize: 12.5,
        lineHeight: 18,
        color: ash,
    },
    exampleQuote: {
        fontFamily: typography.fontFamily.voiceItalic,
        fontStyle: 'italic',
        fontSize: 12.5,
        lineHeight: 18,
        color: boneFaint,
    },
    exampleGood: {
        fontFamily: typography.fontFamily.voiceItalic,
        fontStyle: 'italic',
        fontSize: 12.5,
        lineHeight: 18,
        color: giltBright,
    },
    principles: {
        marginTop: 18,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: hairlineGold,
    },
    principlesToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
        minHeight: 24,
    },
    principlesToggleText: {
        fontFamily: typography.fontFamily.ritual,
        fontSize: 9.5,
        fontWeight: '500',
        letterSpacing: 1.14,
        color: ash,
        textTransform: 'uppercase',
    },
    principlesQ: {
        width: 16,
        height: 16,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: goldLine,
        alignItems: 'center',
        justifyContent: 'center',
    },
    principlesQNew: {
        borderColor: gilt,
    },
    principlesQText: {
        fontFamily: typography.fontFamily.instrument,
        fontSize: 10,
        color: gilt,
    },
    principlesQTextNew: {
        color: giltBright,
    },
    principleRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        marginTop: 13,
    },
    principleCheck: {
        width: 15,
        height: 15,
        borderRadius: 7.5,
        borderWidth: 1,
        borderColor: goldLine,
        marginTop: 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    principleCheckAttn: {
        borderColor: giltBright,
        backgroundColor: 'rgba(217, 179, 108, 0.12)',
    },
    principleCheckText: {
        fontSize: 9,
        color: gilt,
    },
    principleCheckTextAttn: {
        color: giltBright,
    },
    principleBody: {
        flex: 1,
    },
    principleLabel: {
        fontFamily: typography.fontFamily.ritual,
        fontSize: 10,
        fontWeight: '500',
        letterSpacing: 1.8,
        color: gilt,
        textTransform: 'uppercase',
        marginBottom: 3,
    },
    principleDesc: {
        fontFamily: typography.fontFamily.voiceItalic,
        fontStyle: 'italic',
        fontSize: 13,
        lineHeight: 17.5,
        color: boneSoft,
    },
    principleDescAttn: {
        color: giltBright,
    },
    bottomBar: {
        paddingHorizontal: 28,
        paddingTop: 18,
        alignItems: 'center',
    },
    nextBtn: {
        width: '100%',
        height: 56,
        borderRadius: 999,
        backgroundColor: 'rgba(217, 179, 108, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(217, 179, 108, 0.34)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    nextBtnPressed: {
        backgroundColor: 'rgba(217, 179, 108, 0.16)',
        borderColor: 'rgba(217, 179, 108, 0.48)',
    },
    nextBtnDisabled: {
        opacity: 0.36,
    },
    nextBtnText: {
        fontFamily: typography.fontFamily.ritualSemiBold,
        fontWeight: '600',
        fontSize: 14,
        letterSpacing: 2.52,
        color: giltBright,
        textTransform: 'uppercase',
    },
    sheetBackdrop: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(6, 9, 13, 0.7)',
    },
    sheet: {
        borderTopLeftRadius: 26,
        borderTopRightRadius: 26,
        borderTopWidth: 1,
        borderColor: goldLine,
        paddingHorizontal: 26,
        paddingTop: 14,
    },
    sheetHandle: {
        width: 36,
        height: 4,
        borderRadius: 99,
        backgroundColor: 'rgba(244, 239, 230, 0.18)',
        alignSelf: 'center',
        marginBottom: 20,
    },
    sheetClose: {
        position: 'absolute',
        top: 14,
        right: 20,
        width: 28,
        height: 28,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: hairlineGold,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sheetTitle: {
        fontFamily: typography.fontFamily.ritual,
        fontSize: 11,
        letterSpacing: 2.42,
        textTransform: 'uppercase',
        color: ash,
        textAlign: 'center',
        marginBottom: 18,
    },
    sheetItem: {
        paddingVertical: 15,
        borderTopWidth: 1,
        borderTopColor: hairlineGold,
    },
    sheetItemFirst: {
        borderTopWidth: 0,
        paddingTop: 0,
    },
    sheetItemLabel: {
        fontFamily: typography.fontFamily.ritualSemiBold,
        fontSize: 11,
        fontWeight: '600',
        letterSpacing: 2.2,
        color: gilt,
        textTransform: 'uppercase',
        marginBottom: 7,
    },
    sheetItemTitle: {
        fontFamily: typography.fontFamily.voiceItalic,
        fontStyle: 'italic',
        fontSize: 16,
        lineHeight: 22.7,
        color: bone,
    },
    sheetExample: {
        marginTop: 12,
        gap: 8,
    },
    sheetExampleRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 10,
    },
    sheetExTag: {
        fontFamily: typography.fontFamily.instrument,
        fontSize: 10.5,
        fontWeight: '500',
        letterSpacing: 0.63,
        textTransform: 'uppercase',
        color: ash,
        width: 56,
    },
    sheetExTagGood: {
        color: gilt,
    },
    sheetExText: {
        fontFamily: typography.fontFamily.voiceItalic,
        fontStyle: 'italic',
        fontSize: 14,
        color: boneFaint,
        flex: 1,
    },
    sheetExTextGood: {
        color: giltBright,
    },
    sheetDismiss: {
        width: '100%',
        height: 48,
        borderRadius: 999,
        marginTop: 22,
        backgroundColor: 'rgba(217, 179, 108, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(217, 179, 108, 0.34)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    sheetDismissText: {
        fontFamily: typography.fontFamily.ritualSemiBold,
        fontWeight: '600',
        fontSize: 13,
        letterSpacing: 2.08,
        color: giltBright,
        textTransform: 'uppercase',
    },
});
