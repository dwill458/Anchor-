import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    SafeAreaView,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    Animated,
    Dimensions,
    Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList, AnchorCategory } from '@/types';
import { distillIntention } from '@/utils/sigil/distillation';
import { colors } from '@/theme';
import { ScreenHeader, ZenBackground } from '@/components/common';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface CategoryData {
    id: AnchorCategory;
    label: string;
    emoji: string;
    color: string;
}

const CATEGORIES: CategoryData[] = [
    { id: 'career', label: 'Career', emoji: '💼', color: colors.gold },
    { id: 'health', label: 'Health', emoji: '⚕️', color: colors.success },
    { id: 'wealth', label: 'Wealth', emoji: '💰', color: colors.bronze },
    { id: 'relationships', label: 'Love', emoji: '💕', color: colors.deepPurple },
    { id: 'personal_growth', label: 'Growth', emoji: '🌱', color: colors.silver },
];

const EXAMPLE_INTENTIONS = [
    'I am confident and capable',
    'My business thrives with abundance',
    'I attract meaningful relationships',
    'I excel in my career',
    'I embrace healthy habits daily',
];

const WEAK_WORDS = ['want', 'needs', 'need', 'wish', 'hope', 'try', 'maybe', 'perhaps', 'might', 'should', 'would', 'could'];
const FUTURE_TENSE = ['will', 'shall', 'going to', 'gonna'];
const PAST_TENSE = ['was', 'were', 'did', 'had', 'been'];

type NavigationProp = StackNavigationProp<RootStackParamList, 'CreateAnchor'>;

export default function IntentionInputScreen() {
    const navigation = useNavigation<NavigationProp>();

    const [intention, setIntention] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<AnchorCategory>('personal_growth');
    const [showTips, setShowTips] = useState(false);
    const [charCount, setCharCount] = useState(0);
    const [warningMessage, setWarningMessage] = useState<string | null>(null);
    const [showWarningModal, setShowWarningModal] = useState(false);

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;
    const inputRef = useRef<TextInput>(null);

    const maxChars = 100;
    const minChars = 3;
    const isValid = charCount >= minChars && charCount <= maxChars;

    useEffect(() => {
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
        ]).start();
    }, []);

    const handleIntentionChange = (text: string) => {
        if (text.length <= maxChars) {
            setIntention(text);
            setCharCount(text.length);
        }
    };

    const handleExamplePress = (example: string) => {
        setIntention(example);
        setCharCount(example.length);
    };

    const handleContinue = () => {
        if (isValid) {
            const issues = validateIntention(intention);
            if (issues.length > 0) {
                setWarningMessage(issues[0]);
                setShowWarningModal(true);
                return;
            }
            proceedToAnchor();
        }
    };

    const validateIntention = (text: string) => {
        const lowerText = text.toLowerCase();
        const words = lowerText.split(/[^a-zA-Z]+/).filter(Boolean);
        let issues = [];

        if (WEAK_WORDS.some(word => words.includes(word))) {
            issues.push("Avoid 'weak' words like want, need, or wish. State your intention as a present fact.");
        }

        if (FUTURE_TENSE.some(phrase => lowerText.includes(phrase))) {
            issues.push("State your intention in the present tense (I am) rather than the future (I will).");
        }

        if (PAST_TENSE.some(word => words.includes(word))) {
            issues.push("State your intention in the active present. Avoid references to the past.");
        }

        // Simple check for past tense verbs ending in 'ed'
        if (words.some(word => word.length > 3 && word.endsWith('ed') && !['need', 'seed', 'feed', 'bleed', 'speed'].includes(word))) {
            if (!issues.some(i => i.includes("present tense"))) {
                issues.push("Ensure your intention is in the active present tense.");
            }
        }

        return issues;
    };

    const proceedToAnchor = () => {
        const distillation = distillIntention(intention);
        setShowWarningModal(false);
        navigation.navigate('EnhancementChoice', {
            intentionText: intention,
            category: selectedCategory,
            distilledLetters: distillation.finalLetters,
        });
    };

    return (
        <View style={styles.container}>
            <StatusBar style="light" />

            <ZenBackground />

            <SafeAreaView style={styles.safeArea}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.keyboardView}
                >
                    <ScreenHeader title="Create Anchor" />

                    <ScrollView
                        style={styles.scrollView}
                        contentContainerStyle={styles.scrollContent}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
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
                            <Text style={styles.title}>What is your intention?</Text>
                            <Text style={styles.subtitle}>
                                Enter a clear, focused intention. This could be a goal,
                                affirmation, or desire.
                            </Text>
                        </Animated.View>

                        {/* Category Selection */}
                        <Animated.View
                            style={[
                                styles.section,
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
                            <Text style={styles.sectionLabel}>CATEGORY</Text>
                            <View style={styles.categoriesContainer}>
                                {CATEGORIES.map((category) => (
                                    <TouchableOpacity
                                        key={category.id}
                                        onPress={() => setSelectedCategory(category.id)}
                                        activeOpacity={0.7}
                                    >
                                        <BlurView
                                            intensity={
                                                selectedCategory === category.id ? 20 : 10
                                            }
                                            tint="dark"
                                            style={[
                                                styles.categoryChip,
                                                selectedCategory === category.id &&
                                                styles.categoryChipSelected,
                                            ]}
                                        >
                                            <Text style={styles.categoryEmoji}>
                                                {category.emoji}
                                            </Text>
                                            <Text
                                                style={[
                                                    styles.categoryLabel,
                                                    selectedCategory === category.id &&
                                                    styles.categoryLabelSelected,
                                                ]}
                                            >
                                                {category.label}
                                            </Text>
                                        </BlurView>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </Animated.View>

                        {/* Intention Input */}
                        <Animated.View
                            style={[
                                styles.section,
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
                            <BlurView intensity={12} tint="dark" style={styles.inputCard}>
                                <TextInput
                                    ref={inputRef}
                                    style={styles.textInput}
                                    value={intention}
                                    onChangeText={handleIntentionChange}
                                    placeholder="e.g., I am confident and capable"
                                    placeholderTextColor={`${colors.silver}60`}
                                    multiline
                                    maxLength={maxChars}
                                    autoCapitalize="sentences"
                                    autoCorrect={true}
                                />

                                {/* Character Counter */}
                                <View style={styles.inputFooter}>
                                    <View style={styles.validationDot}>
                                        {charCount > 0 && (
                                            <View
                                                style={[
                                                    styles.dot,
                                                    {
                                                        backgroundColor: isValid
                                                            ? colors.success
                                                            : colors.warning,
                                                    },
                                                ]}
                                            />
                                        )}
                                    </View>
                                    <Text
                                        style={[
                                            styles.charCounter,
                                            charCount > maxChars * 0.9 && styles.charCounterWarning,
                                        ]}
                                    >
                                        {charCount} / {maxChars}
                                    </Text>
                                </View>
                            </BlurView>
                        </Animated.View>

                        {/* Intent Formatting Tips */}
                        <Animated.View
                            style={[
                                styles.section,
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
                            <TouchableOpacity
                                onPress={() => setShowTips(!showTips)}
                                activeOpacity={0.7}
                                style={styles.tipsToggle}
                            >
                                <Text style={styles.tipsIcon}>💡</Text>
                                <Text style={styles.tipsText}>Intent Formatting Tips</Text>
                                <Text style={styles.tipsArrow}>{showTips ? '▼' : '▶'}</Text>
                            </TouchableOpacity>

                            {showTips && (
                                <BlurView intensity={10} tint="dark" style={styles.tipsCard}>
                                    <View style={styles.tipItem}>
                                        <Text style={styles.tipBullet}>✓</Text>
                                        <Text style={styles.tipText}>
                                            Use present tense: "I am" instead of "I will"
                                        </Text>
                                    </View>
                                    <View style={styles.tipItem}>
                                        <Text style={styles.tipBullet}>✓</Text>
                                        <Text style={styles.tipText}>
                                            Be specific and clear about what you want
                                        </Text>
                                    </View>
                                    <View style={styles.tipItem}>
                                        <Text style={styles.tipBullet}>✓</Text>
                                        <Text style={styles.tipText}>
                                            Focus on the positive outcome you desire
                                        </Text>
                                    </View>
                                </BlurView>
                            )}
                        </Animated.View>

                        {/* Example Intentions */}
                        <Animated.View
                            style={[
                                styles.section,
                                {
                                    opacity: fadeAnim,
                                    transform: [
                                        {
                                            translateY: slideAnim.interpolate({
                                                inputRange: [0, 30],
                                                outputRange: [0, 70],
                                            }),
                                        },
                                    ],
                                },
                            ]}
                        >
                            <Text style={styles.sectionLabel}>EXAMPLE INTENTIONS</Text>
                            {EXAMPLE_INTENTIONS.map((example, index) => (
                                <TouchableOpacity
                                    key={index}
                                    onPress={() => handleExamplePress(example)}
                                    activeOpacity={0.7}
                                    style={styles.exampleItem}
                                >
                                    <Text style={styles.exampleQuote}>"</Text>
                                    <Text style={styles.exampleText}>{example}</Text>
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
                            disabled={!isValid}
                            style={styles.continueButton}
                        >
                            <LinearGradient
                                colors={
                                    isValid
                                        ? [colors.gold, '#B8941F']
                                        : ['rgba(192,192,192,0.3)', 'rgba(158,158,158,0.3)']
                                }
                                style={styles.continueGradient}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                            >
                                <Text
                                    style={[
                                        styles.continueText,
                                        !isValid && styles.continueTextDisabled,
                                    ]}
                                >
                                    Continue to Anchor
                                </Text>
                                <Text
                                    style={[
                                        styles.continueArrow,
                                        !isValid && styles.continueTextDisabled,
                                    ]}
                                >
                                    →
                                </Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </Animated.View>
                </KeyboardAvoidingView>
            </SafeAreaView>

            {/* Warning Modal */}
            <Modal
                transparent
                visible={showWarningModal}
                animationType="fade"
                onRequestClose={() => setShowWarningModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <BlurView intensity={30} tint="dark" style={styles.modalBlur}>
                        <View style={styles.modalContent}>
                            <View style={styles.warningHeader}>
                                <Text style={styles.warningIcon}>⚠️</Text>
                                <Text style={styles.warningTitle}>Refine Your Intent</Text>
                            </View>

                            <Text style={styles.warningBody}>
                                {warningMessage}
                            </Text>

                            <Text style={styles.warningHint}>
                                Anchors are most powerful when stated as a current reality.
                            </Text>

                            <View style={styles.modalButtons}>
                                <TouchableOpacity
                                    style={styles.modalSecondaryButton}
                                    onPress={() => setShowWarningModal(false)}
                                >
                                    <Text style={styles.modalSecondaryButtonText}>Edit Mindfully</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.modalPrimaryButton}
                                    onPress={proceedToAnchor}
                                >
                                    <LinearGradient
                                        colors={[colors.gold, '#B8941F']}
                                        style={styles.modalPrimaryGradient}
                                    >
                                        <Text style={styles.modalPrimaryButtonText}>Forging Anyway</Text>
                                    </LinearGradient>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </BlurView>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.navy,
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
        paddingHorizontal: 24,
        paddingBottom: 120,
    },
    titleSection: {
        paddingTop: 8,
        paddingBottom: 32,
    },
    title: {
        fontSize: 28,
        // fontFamily: 'Cinzel-Regular',
        fontWeight: '600',
        color: colors.gold,
        marginBottom: 12,
        letterSpacing: 0.5,
    },
    subtitle: {
        fontSize: 15,
        color: colors.silver,
        lineHeight: 22,
    },
    section: {
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
    categoriesContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    categoryChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(192, 192, 192, 0.2)',
        backgroundColor: 'rgba(26, 26, 29, 0.3)',
    },
    categoryChipSelected: {
        borderColor: colors.gold,
        backgroundColor: 'rgba(212, 175, 55, 0.15)',
    },
    categoryEmoji: {
        fontSize: 18,
        marginRight: 8,
    },
    categoryLabel: {
        fontSize: 15,
        fontWeight: '600',
        color: colors.silver,
    },
    categoryLabelSelected: {
        color: colors.gold,
        fontWeight: '700',
    },
    inputCard: {
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.2)',
        backgroundColor: 'rgba(26, 26, 29, 0.4)',
        minHeight: 140,
    },
    textInput: {
        fontSize: 17,
        color: colors.bone,
        lineHeight: 26,
        minHeight: 80,
        textAlignVertical: 'top',
    },
    inputFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: 'rgba(192, 192, 192, 0.1)',
    },
    validationDot: {
        width: 24,
        height: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    charCounter: {
        fontSize: 13,
        color: colors.silver,
        opacity: 0.6,
    },
    charCounterWarning: {
        color: colors.warning,
        opacity: 1,
    },
    tipsToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
    },
    tipsIcon: {
        fontSize: 20,
        marginRight: 8,
    },
    tipsText: {
        fontSize: 15,
        fontWeight: '600',
        color: colors.gold,
        flex: 1,
    },
    tipsArrow: {
        fontSize: 14,
        color: colors.gold,
    },
    tipsCard: {
        borderRadius: 16,
        padding: 20,
        marginTop: 12,
        borderWidth: 1,
        borderColor: 'rgba(192, 192, 192, 0.15)',
        backgroundColor: 'rgba(26, 26, 29, 0.3)',
    },
    tipItem: {
        flexDirection: 'row',
        marginBottom: 12,
    },
    tipBullet: {
        fontSize: 14,
        color: colors.success,
        marginRight: 12,
        marginTop: 2,
    },
    tipText: {
        fontSize: 14,
        color: colors.silver,
        lineHeight: 20,
        flex: 1,
    },
    exampleItem: {
        flexDirection: 'row',
        paddingVertical: 16,
        paddingHorizontal: 20,
        marginBottom: 8,
        borderRadius: 12,
        backgroundColor: 'rgba(26, 26, 29, 0.4)',
        borderWidth: 1,
        borderColor: 'rgba(192, 192, 192, 0.1)',
    },
    exampleQuote: {
        fontSize: 24,
        color: colors.gold,
        marginRight: 12,
        marginTop: -4,
        opacity: 0.5,
    },
    exampleText: {
        fontSize: 15,
        fontStyle: 'italic',
        color: colors.bone,
        lineHeight: 22,
        flex: 1,
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
    continueTextDisabled: {
        color: colors.silver,
        opacity: 0.5,
    },
    continueArrow: {
        fontSize: 20,
        color: colors.charcoal,
        fontWeight: '300',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'center',
        padding: 24,
    },
    modalBlur: {
        borderRadius: 24,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.3)',
    },
    modalContent: {
        padding: 24,
        backgroundColor: 'rgba(26, 26, 29, 0.8)',
    },
    warningHeader: {
        alignItems: 'center',
        marginBottom: 16,
    },
    warningIcon: {
        fontSize: 32,
        marginBottom: 8,
    },
    warningTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: colors.gold,
        letterSpacing: 0.5,
    },
    warningBody: {
        fontSize: 16,
        color: colors.bone,
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 12,
    },
    warningHint: {
        fontSize: 13,
        color: colors.silver,
        textAlign: 'center',
        fontStyle: 'italic',
        marginBottom: 24,
        opacity: 0.8,
    },
    modalButtons: {
        flexDirection: 'row',
        gap: 12,
    },
    modalSecondaryButton: {
        flex: 1,
        height: 50,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(192, 192, 192, 0.3)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalSecondaryButtonText: {
        color: colors.silver,
        fontSize: 14,
        fontWeight: '600',
    },
    modalPrimaryButton: {
        flex: 1,
        height: 50,
        borderRadius: 12,
        overflow: 'hidden',
    },
    modalPrimaryGradient: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalPrimaryButtonText: {
        color: colors.charcoal,
        fontSize: 14,
        fontWeight: '700',
    },
});
