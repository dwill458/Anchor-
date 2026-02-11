/**
 * Anchor App - Default Activation Screen
 * Premium Zen Architect Design
 */

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Alert,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Check, Eye, MessageCircle, Wind, Info } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import {
    useSettingsStore,
    ActivationType,
} from '@/stores/settingsStore';
import { colors, spacing } from '@/theme';
import { ZenBackground } from '@/components/common';

const IS_ANDROID = Platform.OS === 'android';

type PresetOption = {
    value: number;
    label: string;
};

export const DefaultActivationScreen: React.FC = () => {
    const navigation = useNavigation();
    const { defaultActivation, setDefaultActivation } = useSettingsStore();

    const [type, setType] = useState<ActivationType>(defaultActivation.type);
    const [selectedValue, setSelectedValue] = useState<number>(defaultActivation.value);
    const [customInput, setCustomInput] = useState<string>(
        defaultActivation.value.toString()
    );
    const [isCustom, setIsCustom] = useState(false);

    // Unified presets for Enter Focus
    const focusPresets: PresetOption[] = [
        { value: 10, label: '10s' },
        { value: 30, label: '30s' },
        { value: 60, label: '60s' },
    ];

    // Reset to first preset when switching types if current value not supported
    useEffect(() => {
        const isValueInPresets = focusPresets.some((p) => p.value === selectedValue);
        if (!isValueInPresets && !isCustom) {
            setSelectedValue(focusPresets[1].value); // Default to 30s
        }
    }, [type]);

    const handleValueSelect = (value: number) => {
        setSelectedValue(value);
        setIsCustom(false);
    };

    const handleCustomSelect = () => {
        setIsCustom(true);
        setCustomInput(selectedValue.toString());
    };

    const getValidationRange = (): { min: number; max: number; unit: string } => {
        switch (type) {
            case 'visual':
                return { min: 5, max: 300, unit: 'seconds' };
            case 'mantra':
                return { min: 1, max: 33, unit: 'reps' };
            case 'breath_visual':
                return { min: 1, max: 10, unit: 'minutes' };
            default:
                return { min: 1, max: 100, unit: '' };
        }
    };

    const getUnit = (): 'seconds' | 'reps' | 'minutes' | 'breaths' => {
        if (type === 'visual') return 'seconds';
        if (type === 'mantra') return 'reps';
        return isCustom || selectedValue <= 3 ? 'breaths' : 'minutes';
    };

    const handleSave = () => {
        let finalValue = selectedValue;

        if (isCustom) {
            const parsedValue = parseInt(customInput, 10);
            const { min, max, unit } = getValidationRange();

            if (isNaN(parsedValue) || parsedValue < min || parsedValue > max) {
                Alert.alert(
                    'Invalid Input',
                    `Please enter a value between ${min} and ${max} ${unit}.`
                );
                return;
            }
            finalValue = parsedValue;
        }

        setDefaultActivation({
            type,
            value: finalValue,
            unit: getUnit(),
        });
        navigation.goBack();
    };

    const CardWrapper = IS_ANDROID ? View : BlurView;
    const cardProps = IS_ANDROID ? {} : { intensity: 10, tint: 'dark' as const };

    const MethodCard = ({
        targetType,
        title,
        icon: Icon,
        description,
    }: {
        targetType: ActivationType;
        title: string;
        icon: any;
        description: string;
    }) => {
        const isSelected = type === targetType;
        return (
            <TouchableOpacity
                onPress={() => setType(targetType)}
                activeOpacity={0.8}
                style={styles.methodCardWrapper}
            >
                <CardWrapper
                    {...cardProps}
                    style={[
                        styles.methodCard,
                        isSelected && styles.methodCardSelected,
                    ]}
                >
                    <View style={styles.methodIconContainer}>
                        <Icon
                            size={24}
                            color={isSelected ? colors.gold : colors.silver}
                        />
                    </View>
                    <View style={styles.methodTextContainer}>
                        <Text
                            style={[
                                styles.methodTitle,
                                isSelected && styles.methodTitleSelected,
                            ]}
                        >
                            {title}
                        </Text>
                        <Text style={styles.methodDescription}>{description}</Text>
                    </View>
                    {isSelected && (
                        <View style={styles.checkCircle}>
                            <Check size={14} color={colors.navy} />
                        </View>
                    )}
                </CardWrapper>
            </TouchableOpacity>
        );
    };

    const ValueOption = ({
        value,
        label,
    }: {
        value: number;
        label: string;
    }) => {
        const isSelected = !isCustom && selectedValue === value;
        return (
            <TouchableOpacity
                style={[
                    styles.valueOption,
                    isSelected && styles.valueOptionSelected,
                ]}
                onPress={() => handleValueSelect(value)}
            >
                <View style={[styles.radioButton, isSelected && styles.radioButtonSelected]}>
                    {isSelected && <View style={styles.radioButtonInner} />}
                </View>
                <Text
                    style={[
                        styles.valueLabel,
                        isSelected && styles.valueLabelSelected,
                    ]}
                >
                    {label}
                </Text>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            <ZenBackground />
            <SafeAreaView style={styles.safeArea} edges={['top']}>
                <ScrollView
                    style={styles.scrollView}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.scrollContent}
                >
                    <View style={styles.header}>
                        <Text style={styles.title}>Enter Focus Mode</Text>
                        <Text style={styles.subtitle}>
                            Choose how you enter focus during daily practice.
                        </Text>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>ENTER FOCUS MODE</Text>
                        <MethodCard
                            targetType="visual"
                            title="Visual Focus"
                            icon={Eye}
                            description="Gaze at your anchor symbol"
                        />
                        <MethodCard
                            targetType="mantra"
                            title="Mantra Focus"
                            icon={MessageCircle}
                            description="Recite your mantra"
                        />
                        <MethodCard
                            targetType="full"
                            title="Full Focus"
                            icon={Wind}
                            description="Symbol + mantra together"
                        />
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>DEFAULT DURATION</Text>
                        <Text style={styles.sectionHelper}>Enter Focus sessions start with this duration.</Text>
                        <CardWrapper {...cardProps} style={styles.optionsContainer}>
                            <ValueOption value={10} label="10s" />
                            <ValueOption value={30} label="30s" />
                            <ValueOption value={60} label="60s" />
                            <TouchableOpacity
                                style={[
                                    styles.valueOption,
                                    isCustom && styles.valueOptionSelected,
                                ]}
                                onPress={handleCustomSelect}
                            >
                                <View style={[styles.radioButton, isCustom && styles.radioButtonSelected]}>
                                    {isCustom && <View style={styles.radioButtonInner} />}
                                </View>
                                <Text
                                    style={[
                                        styles.valueLabel,
                                        isCustom && styles.valueLabelSelected,
                                    ]}
                                >
                                    Custom
                                </Text>
                            </TouchableOpacity>
                        </CardWrapper>

                        {isCustom && (
                            <CardWrapper {...cardProps} style={styles.customInputContainer}>
                                <Text style={styles.customLabel}>
                                    {type === 'visual' && 'Seconds:'}
                                    {type === 'mantra' && 'Reps:'}
                                    {type === 'breath_visual' && 'Minutes:'}
                                </Text>
                                <TextInput
                                    style={styles.customInput}
                                    value={customInput}
                                    onChangeText={(text) =>
                                        setCustomInput(text.replace(/[^0-9]/g, ''))
                                    }
                                    keyboardType="numeric"
                                    maxLength={3}
                                    placeholder={
                                        type === 'visual'
                                            ? '5-300'
                                            : type === 'mantra'
                                                ? '1-33'
                                                : '1-10'
                                    }
                                    placeholderTextColor={colors.silver}
                                />
                            </CardWrapper>
                        )}
                    </View>

                    <View style={isCustom ? styles.infoSectionHidden : styles.infoSection}>
                        <CardWrapper {...cardProps} style={styles.infoBox}>
                            <View style={styles.infoTitleRow}>
                                <Info color={colors.gold} size={18} style={{ marginRight: spacing.sm }} />
                                <Text style={styles.infoTitle}>About Enter Focus</Text>
                            </View>
                            <Text style={styles.infoText}>
                                Enter Focus is a quick ritual (10–60s) to reconnect and lock in. This sets your default mode and duration.
                            </Text>
                        </CardWrapper>
                    </View>
                </ScrollView>

                <View style={styles.footer}>
                    <TouchableOpacity style={styles.saveButtonWrapper} onPress={handleSave} activeOpacity={0.8}>
                        <LinearGradient
                            colors={[colors.gold, colors.bronze]}
                            style={styles.saveButton}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                        >
                            <Text style={styles.saveButtonText}>Save Default</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
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
        paddingBottom: spacing.xxl,
    },
    header: {
        padding: spacing.lg,
        paddingTop: spacing.xl,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: colors.gold,
        marginBottom: spacing.xs,
        letterSpacing: 0.5,
    },
    subtitle: {
        fontSize: 14,
        color: colors.silver,
        lineHeight: 20,
        opacity: 0.8,
    },
    section: {
        paddingHorizontal: spacing.lg,
        marginBottom: spacing.xl,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: '700',
        color: colors.silver,
        textTransform: 'uppercase',
        letterSpacing: 1.2,
        marginBottom: spacing.xs,
        opacity: 0.6,
    },
    sectionHelper: {
        fontSize: 13,
        color: colors.silver,
        lineHeight: 18,
        opacity: 0.7,
        marginBottom: spacing.md,
    },
    methodCardWrapper: {
        marginBottom: spacing.md,
    },
    methodCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.lg,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.15)',
        backgroundColor: IS_ANDROID ? 'rgba(26, 26, 29, 0.9)' : 'rgba(26, 26, 29, 0.3)',
    },
    methodCardSelected: {
        borderColor: colors.gold,
        backgroundColor: 'rgba(212, 175, 55, 0.08)',
    },
    methodIconContainer: {
        marginRight: spacing.lg,
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    methodTextContainer: {
        flex: 1,
    },
    methodTitle: {
        fontSize: 17,
        fontWeight: '600',
        color: colors.bone,
        marginBottom: 4,
    },
    methodTitleSelected: {
        color: colors.gold,
    },
    methodDescription: {
        fontSize: 13,
        color: colors.silver,
        lineHeight: 18,
        opacity: 0.7,
    },
    checkCircle: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: colors.gold,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: spacing.md,
    },
    infoSection: {
        paddingHorizontal: spacing.lg,
        marginTop: spacing.md,
    },
    infoSectionHidden: {
        display: 'none',
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
        fontSize: 13,
        color: colors.silver,
        lineHeight: 18,
        opacity: 0.9,
    },
    optionsContainer: {
        backgroundColor: IS_ANDROID ? 'rgba(26, 26, 29, 0.9)' : 'rgba(26, 26, 29, 0.3)',
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.15)',
    },
    valueOption: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    },
    valueOptionSelected: {
        backgroundColor: 'rgba(212, 175, 55, 0.05)',
    },
    radioButton: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 2,
        borderColor: 'rgba(255, 255, 255, 0.2)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.md,
    },
    radioButtonSelected: {
        borderColor: colors.gold,
    },
    radioButtonInner: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: colors.gold,
    },
    valueLabel: {
        fontSize: 16,
        color: colors.silver,
    },
    valueLabelSelected: {
        color: colors.gold,
        fontWeight: '600',
    },
    customInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: spacing.md,
        padding: spacing.lg,
        borderRadius: 16,
        backgroundColor: IS_ANDROID ? 'rgba(26, 26, 29, 0.9)' : 'rgba(26, 26, 29, 0.3)',
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.15)',
    },
    customLabel: {
        fontSize: 16,
        color: colors.bone,
        marginRight: spacing.md,
    },
    customInput: {
        flex: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        color: colors.gold,
        padding: spacing.md,
        borderRadius: 8,
        fontSize: 18,
        fontWeight: '600',
        textAlign: 'center',
    },
    helperFooter: {
        paddingHorizontal: spacing.xl,
        fontSize: 12,
        color: colors.silver,
        textAlign: 'center',
        marginTop: spacing.xl,
        opacity: 0.5,
    },
    footer: {
        padding: spacing.lg,
        paddingBottom: Platform.OS === 'ios' ? spacing.xl : spacing.lg,
        backgroundColor: 'transparent',
    },
    saveButtonWrapper: {
        borderRadius: 12,
        overflow: 'hidden',
    },
    saveButton: {
        paddingVertical: spacing.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    saveButtonText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.navy,
    },
});
