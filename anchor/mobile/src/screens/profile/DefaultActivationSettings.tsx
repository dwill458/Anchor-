/**
 * Default Activation Settings
 * Redesigned to match Zen Architect premium aesthetic
 */

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Eye,
  Volume2,
  Check,
  Info
} from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { CustomDurationSheet, ZenBackground } from '@/components/common';
import { useSettingsStore, ActivationType, type ActivationMode } from '@/stores/settingsStore';
import { colors, spacing } from '@/theme';

const IS_ANDROID = Platform.OS === 'android';
const FOCUS_MIN_SECONDS = 10;
const FOCUS_MAX_SECONDS = 60;
const FOCUS_PRESETS = [10, 30, 60] as const;

const clampFocusSeconds = (value: number): number =>
  Math.min(FOCUS_MAX_SECONDS, Math.max(FOCUS_MIN_SECONDS, Math.round(value)));

type OptionCardProps = {
  type: ActivationType;
  label: string;
  description: string;
  icons: React.ReactNode[];
  isSelected: boolean;
  onSelect: (type: ActivationType) => void;
};

const OptionCard: React.FC<OptionCardProps> = ({
  type,
  label,
  description,
  icons,
  isSelected,
  onSelect,
}) => {
  const CardWrapper = IS_ANDROID ? View : BlurView;
  const cardProps = IS_ANDROID ? {} : { intensity: 15, tint: 'dark' as const };

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => onSelect(type)}
      style={[
        styles.cardContainer,
        isSelected && styles.cardSelected
      ]}
    >
      <CardWrapper {...cardProps} style={styles.cardContent}>
        <View style={[styles.iconContainer, type === 'full' && styles.iconContainerWide]}>
          {icons.map((icon, index) => (
            <View key={index}>
              {icon}
            </View>
          ))}
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

export const DefaultActivationSettings: React.FC = () => {
  const { defaultActivation, setDefaultActivation, setDefaultActivationMode } = useSettingsStore();
  const [customSheetVisible, setCustomSheetVisible] = useState(false);

  const handleSelectMode = (mode: ActivationMode) => {
    setDefaultActivationMode(mode);
  };

  const MODES: Array<{ mode: ActivationMode; label: string; description: string }> = [
    { mode: 'silent', label: 'Silent', description: 'No audio, pure focus' },
    { mode: 'mantra', label: 'Mantra', description: 'Repeat your mantra aloud or mentally' },
    { mode: 'ambient', label: 'Ambient', description: 'Background audio support' },
  ];

  const handleSelectType = (type: ActivationType) => {
    setDefaultActivation({
      ...defaultActivation,
      type,
    });
  };

  const focusSeconds = useMemo(() => {
    if (defaultActivation.unit === 'seconds') {
      return clampFocusSeconds(defaultActivation.value);
    }
    return 30;
  }, [defaultActivation.unit, defaultActivation.value]);

  const isCustomDuration = !(FOCUS_PRESETS as readonly number[]).includes(focusSeconds);

  const handleSelectPreset = (seconds: number) => {
    setDefaultActivation({
      ...defaultActivation,
      unit: 'seconds',
      value: seconds,
    });
  };

  const handleCustomConfirm = (seconds: number) => {
    setDefaultActivation({
      ...defaultActivation,
      unit: 'seconds',
      value: clampFocusSeconds(seconds),
    });
    setCustomSheetVisible(false);
  };

  const OPTIONS: Array<{
    type: ActivationType;
    label: string;
    description: string;
    icons: React.ReactNode[]
  }> = [
      {
        type: 'visual',
        label: 'Visual Focus',
        description: 'Gaze at your anchor symbol',
        icons: [<Eye color={colors.gold} size={24} />],
      },
      {
        type: 'mantra',
        label: 'Mantra',
        description: 'Recite your mantra',
        icons: [<Volume2 color={colors.gold} size={24} />],
      },
      {
        type: 'full',
        label: 'Full Activation',
        description: 'Combined visual and mantra practice',
        icons: [
          <Eye color={colors.gold} size={22} />,
          <Volume2 color={colors.gold} size={22} />
        ],
      },
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
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Activation Type</Text>
            <Text style={styles.sectionDescription}>
              Choose how you prefer to activate your anchors during daily practice
            </Text>

            <View style={styles.optionsList}>
              {OPTIONS.map((option) => (
                <OptionCard
                  key={option.type}
                  {...option}
                  isSelected={defaultActivation.type === option.type}
                  onSelect={handleSelectType}
                />
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Focus Duration</Text>
            <Text style={styles.sectionDescription}>
              Enter Focus runs for 10-60 seconds. Choose a preset or set a custom duration.
            </Text>

            <View style={styles.durationChipRow}>
              {FOCUS_PRESETS.map((seconds) => {
                const selected = focusSeconds === seconds;
                return (
                  <TouchableOpacity
                    key={seconds}
                    activeOpacity={0.8}
                    onPress={() => handleSelectPreset(seconds)}
                    style={[styles.durationChip, selected && styles.durationChipSelected]}
                    accessibilityRole="button"
                    accessibilityLabel={`Set focus duration to ${seconds} seconds`}
                    accessibilityState={{ selected }}
                  >
                    <Text style={[styles.durationChipText, selected && styles.durationChipTextSelected]}>
                      {seconds}s
                    </Text>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setCustomSheetVisible(true)}
                style={[styles.durationChip, isCustomDuration && styles.durationChipSelected]}
                accessibilityRole="button"
                accessibilityLabel={`Custom duration. Current ${focusSeconds} seconds`}
                accessibilityState={{ selected: isCustomDuration }}
              >
                <Text style={[styles.durationChipText, isCustomDuration && styles.durationChipTextSelected]}>
                  {isCustomDuration ? `Custom ${focusSeconds}s` : 'Custom'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Default Mode</Text>
            <Text style={styles.sectionDescription}>
              How you want to show up for each activation session.
            </Text>
            <View style={styles.durationChipRow}>
              {MODES.map(({ mode, label }) => {
                const selected = (defaultActivation.mode ?? 'silent') === mode;
                return (
                  <TouchableOpacity
                    key={mode}
                    activeOpacity={0.8}
                    onPress={() => handleSelectMode(mode)}
                    style={[styles.durationChip, selected && styles.durationChipSelected]}
                    accessibilityRole="button"
                    accessibilityLabel={`Set mode to ${label}`}
                    accessibilityState={{ selected }}
                  >
                    <Text style={[styles.durationChipText, selected && styles.durationChipTextSelected]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.infoSection}>
            <InfoBoxWrapper {...infoProps} style={styles.infoBox}>
              <View style={styles.infoTitleRow}>
                <Info color={colors.gold} size={18} style={{ marginRight: spacing.sm }} />
                <Text style={styles.infoTitle}>About Activation</Text>
              </View>
              <Text style={styles.infoText}>
                Activation is your daily practice of reconnecting with your anchor's intention. This setting determines your preferred activation method.
              </Text>
            </InfoBoxWrapper>
          </View>
        </ScrollView>

        <CustomDurationSheet
          visible={customSheetVisible}
          mode="focus"
          initialValue={focusSeconds}
          onCancel={() => setCustomSheetVisible(false)}
          onConfirm={handleCustomConfirm}
        />
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
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: spacing.lg,
    width: 32,
    justifyContent: 'center',
  },
  iconContainerWide: {
    width: 54,
    gap: 6,
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
  durationChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  durationChip: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  durationChipSelected: {
    borderColor: colors.gold,
    backgroundColor: 'rgba(212, 175, 55, 0.16)',
  },
  durationChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.silver,
  },
  durationChipTextSelected: {
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
