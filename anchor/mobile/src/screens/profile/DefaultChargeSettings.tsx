/**
 * Default Charge Settings
 * Redesigned to match Zen Architect premium aesthetic
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import {
  Zap,
  Clock,
  Check,
  Info
} from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { ZenBackground } from '@/components/common';
import { useSettingsStore, ChargeMode, ChargeDurationPreset } from '@/stores/settingsStore';
import { colors, spacing } from '@/theme';

const IS_ANDROID = Platform.OS === 'android';

type ModeCardProps = {
  mode: ChargeMode;
  label: string;
  description: string;
  icon: React.ReactNode;
  isSelected: boolean;
  onSelect: (mode: ChargeMode) => void;
};

const ModeCard: React.FC<ModeCardProps> = ({
  mode,
  label,
  description,
  icon,
  isSelected,
  onSelect,
}) => {
  const CardWrapper = IS_ANDROID ? View : BlurView;
  const cardProps = IS_ANDROID ? {} : { intensity: 15, tint: 'dark' as const };

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => onSelect(mode)}
      style={[
        styles.cardContainer,
        isSelected && styles.cardSelected
      ]}
    >
      <CardWrapper {...cardProps} style={styles.cardContent}>
        <View style={styles.iconContainer}>
          {icon}
        </View>

        <View style={styles.textContainer}>
          <Text style={[styles.cardLabel, isSelected && styles.goldText]}>
            {label}
          </Text>
          <Text style={styles.cardDescription}>
            {description}
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

export const DefaultChargeSettings: React.FC = () => {
  const navigation = useNavigation();
  const { defaultCharge, setDefaultCharge } = useSettingsStore();

  const handleSelectMode = (mode: ChargeMode) => {
    setDefaultCharge({
      ...defaultCharge,
      mode,
    });
  };

  const handleSelectPreset = (preset: ChargeDurationPreset) => {
    setDefaultCharge({
      ...defaultCharge,
      preset,
    });
  };

  const PRESETS: Array<{ label: string, value: ChargeDurationPreset }> = [
    { label: '30s', value: '30s' },
    { label: '2 min', value: '2m' },
    { label: '5 min', value: '5m' },
    { label: '10 min', value: '10m' },
  ];

  const InfoBoxWrapper = IS_ANDROID ? View : BlurView;
  const infoProps = IS_ANDROID ? {} : { intensity: 5, tint: 'dark' as const };

  return (
    <View style={styles.container}>
      <ZenBackground />
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Mode Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Charging Mode</Text>
            <Text style={styles.sectionDescription}>
              Choose your preferred approach for daily anchor charging
            </Text>

            <View style={styles.optionsList}>
              <ModeCard
                mode="focus"
                label="Focus Charge"
                description="Brief, regular energy alignment"
                icon={<Zap color={colors.gold} size={24} />}
                isSelected={defaultCharge.mode === 'focus'}
                onSelect={handleSelectMode}
              />
              <ModeCard
                mode="ritual"
                label="Ritual Charge"
                description="Enhanced, meditative ceremony"
                icon={<Clock color={colors.gold} size={24} />}
                isSelected={defaultCharge.mode === 'ritual'}
                onSelect={handleSelectMode}
              />
            </View>
          </View>

          {/* Duration Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Default Duration</Text>
            <Text style={styles.sectionDescription}>
              Sessions will automatically start with this duration
            </Text>

            <View style={styles.presetGrid}>
              {PRESETS.map((preset) => (
                <TouchableOpacity
                  key={preset.value}
                  activeOpacity={0.7}
                  onPress={() => handleSelectPreset(preset.value)}
                  style={[
                    styles.presetButton,
                    defaultCharge.preset === preset.value && styles.presetButtonSelected
                  ]}
                >
                  <Text style={[
                    styles.presetText,
                    defaultCharge.preset === preset.value && styles.presetTextSelected
                  ]}>
                    {preset.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Info Box */}
          <View style={styles.infoSection}>
            <InfoBoxWrapper {...infoProps} style={styles.infoBox}>
              <View style={styles.infoTitleRow}>
                <Info color={colors.gold} size={18} style={{ marginRight: spacing.sm }} />
                <Text style={styles.infoTitle}>About Charging</Text>
              </View>
              <Text style={styles.infoText}>
                Charging your anchor daily strengthens the neurological bond between the symbol and your intention.
              </Text>
            </InfoBoxWrapper>
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
  section: {
    marginBottom: spacing.xxl,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.gold,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: spacing.xs,
  },
  sectionDescription: {
    fontSize: 14,
    color: colors.silver,
    opacity: 0.8,
    marginBottom: spacing.xl,
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
    paddingVertical: spacing.xl,
  },
  iconContainer: {
    marginRight: spacing.lg,
  },
  textContainer: {
    flex: 1,
  },
  cardLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.bone,
    marginBottom: 2,
  },
  goldText: {
    color: colors.gold,
  },
  cardDescription: {
    fontSize: 13,
    color: colors.silver,
    opacity: 0.7,
  },
  checkContainer: {
    marginLeft: spacing.sm,
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  presetButton: {
    flex: 1,
    minWidth: '45%',
    paddingVertical: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
    alignItems: 'center',
    backgroundColor: 'rgba(26, 26, 29, 0.4)',
  },
  presetButtonSelected: {
    borderColor: colors.gold,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
  },
  presetText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.silver,
  },
  presetTextSelected: {
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
