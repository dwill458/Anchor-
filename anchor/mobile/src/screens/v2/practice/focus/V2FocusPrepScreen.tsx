import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Sliders } from 'lucide-react-native';
import { CircularAnchorRenderer, V2Button, V2Screen } from '@/components/v2';
import { anchorArtworkSvg, categoryLabel } from '@/components/v2/anchors/anchorPresentation';
import { practiceColors } from '@/theme/v2/practiceColors';
import { getCategoryColor, getCategoryFieldColor, colors, radii, spacing, typography } from '@/theme/v2';
import type { Anchor } from '@/types';
import type { GuidanceVoice } from '@/types/sessionAudio';
import { useSettingsStore } from '@/stores/settingsStore';
import { useSubscriptionStore } from '@/stores/subscriptionStore';
import { safeHaptics } from '@/utils/haptics';
import * as Haptics from 'expo-haptics';
import { V2FocusSettingsSheet } from './V2FocusSettingsSheet';

export interface V2FocusPrepConfig {
  durationSeconds: number;
  voice: GuidanceVoice;
  ambient: boolean;
}

export interface V2FocusPrepScreenProps {
  anchor: Anchor;
  source: 'practice_hub' | 'recommended_today';
  initialDuration?: number;
  initialVoice?: GuidanceVoice;
  initialAmbient?: boolean;
  onBack: () => void;
  onBeginFocus: (config: V2FocusPrepConfig) => void;
  onPremiumRequired?: (intent: {
    anchorId: string;
    durationSeconds: number;
    voice: GuidanceVoice;
    ambient: boolean;
    source: 'practice_hub' | 'recommended_today';
  }) => void;
}

const DURATION_OPTIONS = [10, 30, 60] as const;

export function V2FocusPrepScreen({
  anchor,
  source,
  initialDuration,
  initialVoice,
  initialAmbient,
  onBack,
  onBeginFocus,
  onPremiumRequired,
}: V2FocusPrepScreenProps) {
  const insets = useSafeAreaInsets();
  const sessionDefaults = useSettingsStore((state) => state.sessionAudioDefaults?.focus);
  const preferredDuration = useSettingsStore((state) => state.focusSessionDuration);
  const hapticIntensity = useSettingsStore((state) => state.hapticIntensity);
  const setHapticIntensity = useSettingsStore((state) => state.setHapticIntensity);

  const [duration, setDuration] = useState<number>(() => {
    if (initialDuration && DURATION_OPTIONS.includes(initialDuration as 10 | 30 | 60)) {
      return initialDuration;
    }
    if (preferredDuration && DURATION_OPTIONS.includes(preferredDuration as 10 | 30 | 60)) {
      return preferredDuration;
    }
    return 30;
  });

  const [voice, setVoice] = useState<GuidanceVoice>(
    () => initialVoice ?? sessionDefaults?.guidanceVoice ?? 'female'
  );
  const [ambient, setAmbient] = useState<boolean>(
    () => initialAmbient ?? (sessionDefaults?.backgroundAudio !== 'off')
  );
  const [sheetOpen, setSheetOpen] = useState(false);

  const soundOn = ambient || voice !== 'none';
  const hapticsOn = (hapticIntensity ?? 70) > 0;

  const categoryColor = getCategoryColor(anchor.category);

  const formatDurationOption = (seconds: number) =>
    seconds === 60 ? '1 min' : `${seconds} sec`;

  const voiceLabel =
    voice === 'female'
      ? 'Female Voice'
      : voice === 'male'
      ? 'Male Voice'
      : 'No Voice';
  const ambientLabel = ambient ? 'Ambient' : 'Silence';
  const audioSummary = `${voiceLabel} · ${ambientLabel}`;

  const handleSelectDuration = (val: number) => {
    void safeHaptics.selection();
    setDuration(val);
  };

  const toggleSound = () => {
    void safeHaptics.selection();
    if (soundOn) {
      setVoice('none');
      setAmbient(false);
    } else {
      setVoice('female');
      setAmbient(true);
    }
  };

  const toggleHaptics = () => {
    if (hapticsOn) {
      setHapticIntensity(0);
    } else {
      setHapticIntensity(70);
      void safeHaptics.impact(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleBegin = () => {
    const isPro = useSubscriptionStore.getState().getEffectiveTier() === 'pro';
    if (!isPro && onPremiumRequired) {
      onPremiumRequired({
        anchorId: anchor.id,
        durationSeconds: duration,
        voice,
        ambient,
        source,
      });
      return;
    }

    onBeginFocus({
      durationSeconds: duration,
      voice,
      ambient,
    });
  };

  return (
    <V2Screen testID="v2-practice-prepare-focus" style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to Practice"
          testID="focus-prep-back-button"
          onPress={onBack}
          hitSlop={12}
          style={styles.backButton}
        >
          <ArrowLeft size={20} color={colors.text.primary} />
          <Text style={styles.backText}>Practice</Text>
        </Pressable>
      </View>

      <View style={styles.scrollContent}>
        {/* Practice Title Eyebrow */}
        <Text style={styles.eyebrow}>FOCUS</Text>

        {/* Hero Section: Centered prominent Anchor with organic halo */}
        <View style={styles.heroSection}>
          <View style={styles.artworkContainer}>
            <View
              style={[
                styles.halo,
                { backgroundColor: getCategoryFieldColor(anchor.category) },
              ]}
            />
            <CircularAnchorRenderer
              svg={anchorArtworkSvg(anchor)} imageUrl={anchor.enhancedImageUrl}
              category={anchor.category}
              size={186}
              appearance="paper"
              accessibilityLabel={`${categoryLabel(anchor.category)} Anchor artwork`}
            />
          </View>

          {/* Intention info */}
          <View style={styles.intentionBlock}>
            <Text style={styles.intentionText}>{anchor.intentionText}</Text>
            <View style={styles.categoryRow}>
              <View style={[styles.categoryDot, { backgroundColor: categoryColor }]} />
              <Text style={styles.categoryLabel}>{categoryLabel(anchor.category)}</Text>
            </View>
          </View>

          <Text style={styles.explanationText}>
            Return your attention to the intention you’ve chosen to reinforce.
          </Text>
        </View>

        {/* Duration Selector */}
        <View style={styles.controlsSection}>
          <View style={styles.durationsContainer}>
            <Text style={styles.controlLabel}>HOW LONG?</Text>
            <View style={styles.durations}>
              {DURATION_OPTIONS.map((opt) => {
                const isSelected = duration === opt;
                const labelText = formatDurationOption(opt);
                return (
                  <Pressable
                    key={opt}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={`${labelText}${isSelected ? ', selected' : ''}`}
                    onPress={() => handleSelectDuration(opt)}
                    style={[
                      styles.durationButton,
                      isSelected && styles.durationButtonSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.durationButtonText,
                        isSelected && styles.durationButtonTextSelected,
                      ]}
                    >
                      {labelText}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Interactive Utility Controls (Sound & Haptics) */}
          <View style={styles.utilityBlock}>
            <Pressable
              accessibilityRole="switch"
              accessibilityState={{ checked: soundOn }}
              accessibilityLabel={`Sound: ${soundOn ? 'On' : 'Off'}. Tap to toggle.`}
              testID="focus-sound-toggle"
              onPress={toggleSound}
              style={styles.utilityRow}
            >
              <View style={styles.utilityInfo}>
                <Text style={styles.utilityLabel}>Sound</Text>
                {soundOn ? (
                  <Text style={styles.utilitySubtext}>{audioSummary}</Text>
                ) : null}
              </View>
              <View style={styles.utilityRight}>
                <Text style={[styles.utilityValue, soundOn && styles.utilityValueActive]}>
                  {soundOn ? 'ON' : 'OFF'}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Customize audio guidance"
                  testID="focus-audio-customize-button"
                  onPress={() => setSheetOpen(true)}
                  hitSlop={8}
                  style={styles.settingsIconBtn}
                >
                  <Sliders size={15} color={colors.text.secondary} />
                </Pressable>
              </View>
            </Pressable>

            <View style={styles.utilityDivider} />

            <Pressable
              accessibilityRole="switch"
              accessibilityState={{ checked: hapticsOn }}
              accessibilityLabel={`Haptics: ${hapticsOn ? 'On' : 'Off'}. Tap to toggle.`}
              testID="focus-haptics-toggle"
              onPress={toggleHaptics}
              style={styles.utilityRow}
            >
              <Text style={styles.utilityLabel}>Haptics</Text>
              <Text style={[styles.utilityValue, hapticsOn && styles.utilityValueActive]}>
                {hapticsOn ? 'ON' : 'OFF'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* Primary CTA */}
      <View
        style={[
          styles.footer,
          { paddingBottom: Math.max(24, insets.bottom + 12) },
        ]}
      >
        <V2Button
          size="large"
          onPress={handleBegin}
          accessibilityLabel="Begin Focus"
          testID="v2-begin-focus"
          style={styles.beginButton}
        >
          Begin Focus
        </V2Button>
      </View>

      {/* Focus Settings Sheet */}
      <V2FocusSettingsSheet
        visible={sheetOpen}
        voice={voice}
        ambient={ambient}
        onVoiceChange={setVoice}
        onAmbientChange={setAmbient}
        onClose={() => setSheetOpen(false)}
      />
    </V2Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[2],
    minHeight: 44,
    justifyContent: 'center',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    minHeight: 44,
    alignSelf: 'flex-start',
  },
  backText: {
    ...typography.labelLG,
    color: colors.text.primary,
  },
  scrollContent: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingTop: spacing[1],
  },
  eyebrow: {
    ...typography.labelSM,
    letterSpacing: 1.4,
    fontWeight: '700',
    fontSize: 11,
    color: practiceColors.focus,
    marginTop: spacing[1],
  },
  heroSection: {
    alignItems: 'center',
    marginTop: spacing[2],
    width: '100%',
  },
  artworkContainer: {
    position: 'relative',
    width: 194,
    height: 194,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing[3],
  },
  halo: {
    position: 'absolute',
    width: 218,
    height: 218,
    borderRadius: 109,
    opacity: 0.7,
  },
  intentionBlock: {
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    marginTop: spacing[1],
  },
  intentionText: {
    ...typography.headingLG,
    fontFamily: typography.displayBold,
    fontSize: 22,
    color: colors.text.primary,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing[1],
  },
  categoryDot: {
    width: 6,
    height: 6,
    borderRadius: radii.round,
  },
  categoryLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  explanationText: {
    ...typography.bodyMD,
    color: colors.text.secondary,
    textAlign: 'center',
    paddingHorizontal: spacing[4],
    marginTop: spacing[2],
    lineHeight: 20,
    fontSize: 14,
  },
  controlsSection: {
    width: '100%',
    marginTop: spacing[5],
    gap: spacing[4],
  },
  durationsContainer: {
    gap: spacing[2],
  },
  controlLabel: {
    ...typography.labelSM,
    color: colors.text.secondary,
    letterSpacing: 0.8,
    fontSize: 10,
    fontWeight: '700',
  },
  durations: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  durationButton: {
    flex: 1,
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  durationButtonSelected: {
    borderColor: practiceColors.focus,
    backgroundColor: 'rgba(139, 92, 246, 0.08)',
    borderWidth: 1.5,
  },
  durationButtonText: {
    ...typography.labelMD,
    color: colors.text.primary,
    fontSize: 14,
  },
  durationButtonTextSelected: {
    color: practiceColors.focus,
    fontWeight: '700',
  },
  utilityBlock: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    borderRadius: radii.md,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[1],
  },
  utilityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[3],
    minHeight: 48,
  },
  utilityInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  utilityLabel: {
    ...typography.bodyMD,
    color: colors.text.primary,
    fontSize: 14,
  },
  utilitySubtext: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 11,
    marginTop: 2,
  },
  utilityRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  utilityValue: {
    ...typography.labelSM,
    color: colors.text.secondary,
    fontWeight: '600',
    fontSize: 12,
    letterSpacing: 0.5,
  },
  utilityValueActive: {
    color: colors.text.primary,
    fontWeight: '700',
  },
  settingsIconBtn: {
    padding: 4,
  },
  utilityDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border.subtle,
  },
  footer: {
    paddingHorizontal: spacing[4],
  },
  beginButton: {
    backgroundColor: '#171717',
    borderRadius: radii.round,
  },
});
