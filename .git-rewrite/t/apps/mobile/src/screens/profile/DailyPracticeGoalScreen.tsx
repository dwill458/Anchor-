import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Platform,
    TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import {
    Check,
    Info,
    Plus,
    Minus,
    Target
} from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { ZenBackground } from '@/components/common';
import { useSettingsStore } from '@/stores/settingsStore';
import { colors, spacing } from '@/theme';

const IS_ANDROID = Platform.OS === 'android';

type GoalOptionProps = {
    value: number;
    label: string;
    isSelected: boolean;
    onSelect: (value: number) => void;
};

const GoalOption: React.FC<GoalOptionProps> = ({
    value,
    label,
    isSelected,
    onSelect,
}) => {
    const CardWrapper = IS_ANDROID ? View : BlurView;
    const cardProps = IS_ANDROID ? {} : { intensity: 15, tint: 'dark' as const };

    return (
        <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => onSelect(value)}
            style={[
                styles.cardContainer,
                isSelected && styles.cardSelected
            ]}
        >
            <CardWrapper {...cardProps} style={styles.cardContent}>
                <View style={styles.textContainer}>
                    <Text style={[styles.cardLabel, isSelected && styles.goldText]}>
                        {label}
                    </Text>
                </View>

                {isSelected && (
                    <View style={styles.checkContainer}>
                        <Check color={colors.gold} size={20} />
                    </View>
                )}
            </CardWrapper>
        </TouchableOpacity>
    );
};

export const DailyPracticeGoalScreen: React.FC = () => {
    const navigation = useNavigation();
    const { dailyPracticeGoal, setDailyPracticeGoal } = useSettingsStore();
    const [isCustomMode, setIsCustomMode] = useState(![1, 3, 5, 7].includes(dailyPracticeGoal));

    const OPTIONS = [
        { value: 1, label: '1 activation per day' },
        { value: 3, label: '3 activations per day' },
        { value: 5, label: '5 activations per day' },
        { value: 7, label: '7 activations per day' },
    ];

    const handleSelectGoal = (val: number) => {
        setIsCustomMode(false);
        setDailyPracticeGoal(val);
    };

    const handleAdjustCustom = (delta: number) => {
        setIsCustomMode(true);
        setDailyPracticeGoal(dailyPracticeGoal + delta);
    };

    const CardWrapper = IS_ANDROID ? View : BlurView;
    const cardProps = IS_ANDROID ? {} : { intensity: 15, tint: 'dark' as const };

    return (
        <View style={styles.container}>
            <ZenBackground />
            <SafeAreaView style={styles.safeArea} edges={['bottom']}>
                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.header}>
                        <Text style={styles.title}>Daily Practice Goal</Text>
                        <Text style={styles.subtitle}>
                            Set a gentle target for consistency.
                        </Text>
                    </View>

                    <View style={styles.section}>
                        <View style={styles.optionsList}>
                            {OPTIONS.map((option) => (
                                <GoalOption
                                    key={option.value}
                                    value={option.value}
                                    label={option.label}
                                    isSelected={!isCustomMode && dailyPracticeGoal === option.value}
                                    onSelect={handleSelectGoal}
                                />
                            ))}

                            {/* Custom Stepper */}
                            <TouchableOpacity
                                activeOpacity={0.8}
                                onPress={() => setIsCustomMode(true)}
                                style={[
                                    styles.cardContainer,
                                    isCustomMode && styles.cardSelected
                                ]}
                            >
                                <CardWrapper {...cardProps} style={styles.cardContent}>
                                    <View style={styles.customRow}>
                                        <View style={styles.textContainer}>
                                            <Text style={[styles.cardLabel, isCustomMode && styles.goldText]}>
                                                Custom
                                            </Text>
                                            <Text style={styles.helperLabel}>1–20 activations</Text>
                                        </View>

                                        <View style={styles.stepperContainer}>
                                            <TouchableOpacity
                                                onPress={() => handleAdjustCustom(-1)}
                                                disabled={dailyPracticeGoal <= 1}
                                                style={[styles.stepButton, dailyPracticeGoal <= 1 && styles.buttonDisabled]}
                                            >
                                                <Minus color={dailyPracticeGoal <= 1 ? colors.text.disabled : colors.gold} size={20} />
                                            </TouchableOpacity>

                                            <View style={styles.valueDisplay}>
                                                <Text style={styles.valueText}>{dailyPracticeGoal}</Text>
                                            </View>

                                            <TouchableOpacity
                                                onPress={() => handleAdjustCustom(1)}
                                                disabled={dailyPracticeGoal >= 20}
                                                style={[styles.stepButton, dailyPracticeGoal >= 20 && styles.buttonDisabled]}
                                            >
                                                <Plus color={dailyPracticeGoal >= 20 ? colors.text.disabled : colors.gold} size={20} />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                </CardWrapper>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={styles.infoSection}>
                        <CardWrapper {...cardProps} style={styles.infoBox}>
                            <View style={styles.infoTitleRow}>
                                <Info color={colors.gold} size={18} style={{ marginRight: spacing.sm }} />
                                <Text style={styles.infoTitle}>Gentle Targets</Text>
                            </View>
                            <Text style={styles.infoText}>
                                This is a target, not a rule. It is used to help you maintain consistency and visualize your progress without pressure.
                            </Text>
                        </CardWrapper>
                    </View>
                </ScrollView>
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
        padding: spacing.lg,
        paddingTop: spacing.xl,
    },
    header: {
        marginBottom: spacing.xl,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: colors.gold,
        marginBottom: spacing.xs,
    },
    subtitle: {
        fontSize: 16,
        color: colors.silver,
        opacity: 0.8,
    },
    section: {
        marginBottom: spacing.xxl,
    },
    optionsList: {
        gap: spacing.md,
    },
    cardContainer: {
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.1)',
        backgroundColor: IS_ANDROID ? 'rgba(26, 26, 29, 0.4)' : 'transparent',
    },
    cardSelected: {
        borderColor: colors.gold,
        backgroundColor: IS_ANDROID ? 'rgba(212, 175, 55, 0.05)' : 'transparent',
    },
    cardContent: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.lg,
        minHeight: 80,
    },
    textContainer: {
        flex: 1,
    },
    cardLabel: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.bone,
    },
    helperLabel: {
        fontSize: 12,
        color: colors.silver,
        opacity: 0.6,
        marginTop: 2,
    },
    goldText: {
        color: colors.gold,
    },
    checkContainer: {
        marginLeft: spacing.sm,
    },
    customRow: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    stepperContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.2)',
        borderRadius: 12,
        padding: 4,
    },
    stepButton: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 10,
    },
    buttonDisabled: {
        opacity: 0.3,
    },
    valueDisplay: {
        minWidth: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    valueText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.gold,
    },
    infoSection: {
        marginTop: spacing.xl,
    },
    infoBox: {
        borderRadius: 16,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.15)',
        backgroundColor: IS_ANDROID ? 'rgba(26, 26, 29, 0.3)' : 'transparent',
    },
    infoTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    infoTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.gold,
    },
    infoText: {
        fontSize: 14,
        color: colors.silver,
        lineHeight: 20,
        opacity: 0.9,
    },
});
