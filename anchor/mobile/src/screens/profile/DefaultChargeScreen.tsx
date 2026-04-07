/**
 * Anchor App - Default Charge Screen
 * Premium Zen Architect Design
 */

import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Alert,
    Platform,
    Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Check, Clock, Zap, BookOpen, Info } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import {
    useSettingsStore,
    ChargeMode,
    ChargeDurationPreset,
} from '@/stores/settingsStore';
import { colors, spacing } from '@/theme';
import { ZenBackground } from '@/components/common';

const IS_ANDROID = Platform.OS === 'android';

export const DefaultChargeScreen: React.FC = () => {
    const navigation = useNavigation();
    const { defaultCharge, setDefaultCharge } = useSettingsStore();

    const [mode, setMode] = useState<ChargeMode>(defaultCharge.mode);
    const [preset, setPreset] = useState<ChargeDurationPreset>(defaultCharge.preset);
    const [customMinutes, setCustomMinutes] = useState<string>(
        defaultCharge.customMinutes?.toString() || '12'
    );

    const handleSave = () => {
        const minutes = parseInt(customMinutes, 10);

        if (preset === 'custom') {
            if (isNaN(minutes) || minutes < 1 || minutes > 60) {
                Alert.alert('Invalid Duration', 'Please enter a duration between 1 and 60 minutes.');
                return;
            }
        }

        setDefaultCharge({
            mode,
            preset,
            customMinutes: preset === 'custom' ? minutes : undefined,
        });
        navigation.goBack();
    };

    const CardWrapper = IS_ANDROID ? View : BlurView;
    const cardProps = IS_ANDROID ? {} : { intensity: 10, tint: 'dark' as const };

    const ModeCard = ({
        targetMode,
        title,
        icon: Icon,
        description,
    }: {
        targetMode: ChargeMode;
        title: string;
        icon: any;
        description: string;
    }) => {
        const isSelected = mode === targetMode;
        return (
            <TouchableOpacity
                onPress={() => setMode(targetMode)}
                activeOpacity={0.8}
                style={styles.modeCardWrapper}
            >
                <CardWrapper
                    {...cardProps}
                    style={[
                        styles.modeCard,
                        isSelected && styles.modeCardSelected,
                    ]}
                >
                    <View style={styles.modeIconContainer}>
                        <Icon
                            size={24}
                            color={isSelected ? colors.gold : colors.silver}
                        />
                    </View>
                    <View style={styles.modeTextContainer}>
                        <Text
                            style={[
                                styles.modeTitle,
                                isSelected && styles.modeTitleSelected,
                            ]}
                        >
                            {title}
                        </Text>
                        <Text style={styles.modeDescription}>{description}</Text>
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

    const DurationOption = ({
        targetPreset,
        label,
    }: {
        targetPreset: ChargeDurationPreset;
        label: string;
    }) => {
        const isSelected = preset === targetPreset;
        return (
            <TouchableOpacity
                style={[
                    styles.durationOption,
                    isSelected && styles.durationOptionSelected,
                ]}
                onPress={() => setPreset(targetPreset)}
            >
                <View style={[styles.radioButton, isSelected && styles.radioButtonSelected]}>
                    {isSelected && <View style={styles.radioButtonInner} />}
                </View>
                <Text
                    style={[
                        styles.durationLabel,
                        isSelected && styles.durationLabelSelected,
                    ]}
                >
                    {label}
                </Text>
            </TouchableOpacity>
        );
    };

    const focusPresets: { preset: ChargeDurationPreset; label: string }[] = [
        { preset: '30s', label: '30 Seconds' },
        { preset: '2m', label: '2 Minutes' },
        { preset: '5m', label: '5 Minutes' },
    ];

    const ritualPresets: { preset: ChargeDurationPreset; label: string }[] = [
        { preset: '5m', label: '5 Minutes' },
        { preset: '10m', label: '10 Minutes' },
        { preset: 'custom', label: 'Custom' },
    ];

    const currentPresets = mode === 'focus' ? focusPresets : ritualPresets;

    // Reset preset if switching modes and current preset is not available
    React.useEffect(() => {
        const isAvailable = currentPresets.some((p) => p.preset === preset);
        if (!isAvailable) {
            setPreset(currentPresets[0].preset);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mode]);

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
                        <Text style={styles.title}>Deep Charge Defaults</Text>
                        <Text style={styles.subtitle}>
                            Choose your preferred approach for deep charging.
                        </Text>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>DEEP CHARGE STYLE</Text>
                        <ModeCard
                            targetMode="focus"
                            title="Quick Charge"
                            icon={Zap}
                            description="Brief, regular reinforcement"
                        />
                        <ModeCard
                            targetMode="ritual"
                            title="Ritual Charge"
                            icon={BookOpen}
                            description="Meditative, ceremonial session"
                        />
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Default Duration</Text>
                        <Text style={styles.sectionHelper}>Deep Charge sessions start with this duration.</Text>
                        <CardWrapper {...cardProps} style={styles.optionsContainer}>
                            {preset === '30s' && <DurationOption targetPreset="30s" label="30s (Legacy)" />}
                            <DurationOption targetPreset="1m" label="1 min" />
                            <DurationOption targetPreset="5m" label="5 min" />
                            <DurationOption targetPreset="10m" label="10 min" />
                            <DurationOption targetPreset="custom" label="Custom" />
                        </CardWrapper>

                        {preset === 'custom' && (
                            <CardWrapper {...cardProps} style={styles.customInputContainer}>
                                <Text style={styles.customLabel}>Minutes:</Text>
                                <TextInput
                                    style={styles.customInput}
                                    value={customMinutes}
                                    onChangeText={(text) => setCustomMinutes(text.replace(/[^0-9]/g, ''))}
                                    keyboardType="numeric"
                                    maxLength={2}
                                    placeholder="1-60"
                                    placeholderTextColor={colors.silver}
                                />
                            </CardWrapper>
                        )}
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Audio Settings</Text>
                        <CardWrapper {...cardProps} style={styles.optionsContainer}>
                            <View style={styles.toggleRow}>
                                <View style={styles.toggleTextContainer}>
                                    <Text style={styles.toggleLabel}>Mantra audio by default</Text>
                                    <Text style={styles.toggleHelperText}>Automatically play your mantra guidance.</Text>
                                </View>
                                <Switch
                                    value={useSettingsStore.getState().mantraAudioByDefault}
                                    onValueChange={(val) => useSettingsStore.getState().setMantraAudioByDefault(val)}
                                    trackColor={{ false: 'rgba(255, 255, 255, 0.1)', true: colors.gold }}
                                    thumbColor={useSettingsStore.getState().mantraAudioByDefault ? colors.navy : colors.silver}
                                />
                            </View>
                        </CardWrapper>
                    </View>

                    <View style={preset === 'custom' ? styles.infoSectionHidden : styles.infoSection}>
                        <CardWrapper {...cardProps} style={styles.infoBox}>
                            <View style={styles.infoTitleRow}>
                                <Info color={colors.gold} size={18} style={{ marginRight: spacing.sm }} />
                                <Text style={styles.infoTitle}>About Deep Charge</Text>
                            </View>
                            <Text style={styles.infoText}>
                                Deep Charge strengthens the bond between symbol and intention over time. This sets your default style and duration for Reinforce.
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
    modeCardWrapper: {
        marginBottom: spacing.md,
    },
    modeCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.lg,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.15)',
        backgroundColor: IS_ANDROID ? 'rgba(26, 26, 29, 0.9)' : 'rgba(26, 26, 29, 0.3)',
    },
    modeCardSelected: {
        borderColor: colors.gold,
        backgroundColor: 'rgba(212, 175, 55, 0.08)',
    },
    modeIconContainer: {
        marginRight: spacing.lg,
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modeTextContainer: {
        flex: 1,
    },
    modeTitle: {
        fontSize: 17,
        fontWeight: '600',
        color: colors.bone,
        marginBottom: 4,
    },
    modeTitleSelected: {
        color: colors.gold,
    },
    modeDescription: {
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
    optionsContainer: {
        backgroundColor: IS_ANDROID ? 'rgba(26, 26, 29, 0.9)' : 'rgba(26, 26, 29, 0.3)',
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.15)',
    },
    durationOption: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    },
    durationOptionSelected: {
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
    durationLabel: {
        fontSize: 16,
        color: colors.silver,
    },
    durationLabelSelected: {
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
    toggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: spacing.lg,
    },
    toggleTextContainer: {
        flex: 1,
        marginRight: spacing.md,
    },
    toggleLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.bone,
        marginBottom: 4,
    },
    toggleHelperText: {
        fontSize: 13,
        color: colors.silver,
        lineHeight: 18,
        opacity: 0.7,
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
});
