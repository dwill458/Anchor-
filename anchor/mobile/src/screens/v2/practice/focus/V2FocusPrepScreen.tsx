import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, ChevronRight } from 'lucide-react-native';
import { CircularAnchorRenderer, V2Button, V2Screen } from '@/components/v2';
import { anchorArtworkSvg } from '@/components/v2/anchors/anchorPresentation';
import { practiceColors } from '@/theme/v2/practiceColors';
import { getCategoryColor, getCategoryFieldColor, colors, spacing, typography } from '@/theme/v2';
import type { Anchor } from '@/types';
import type { GuidanceVoice } from '@/types/sessionAudio';
import { useSettingsStore } from '@/stores/settingsStore';
import { useSubscriptionStore } from '@/stores/subscriptionStore';
import { safeHaptics } from '@/utils/haptics';
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

  const formatDurationOption = (seconds: number) =>
    seconds === 60 ? '1 MIN' : `${seconds} SEC`;

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
          accessibilityLabel="Back"
          onPress={onBack}
          hitSlop={12}
          style={styles.backButton}
        >
          <ArrowLeft size={22} color={colors.text.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>Focus</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.scrollContent}>
        {/* Anchor Artwork Medallion with restrained halo */}
        <View style={styles.artworkContainer}>
          <View
            style={[
              styles.halo,
              { backgroundColor: getCategoryFieldColor(anchor.category) },
            ]}
          />
          <CircularAnchorRenderer
            svg={anchorArtworkSvg(anchor)}
            category={anchor.category}
            size={212}
            accessibilityLabel={`${anchor.category} Anchor artwork`}
          />
        </View>

        {/* Intention info */}
        <View style={styles.intentionBlock}>
          <Text style={styles.eyebrow}>YOUR ANCHOR</Text>
          <Text style={styles.intentionText}>
            “<Text>{anchor.intentionText}</Text>”
          </Text>
        </View>

        <Text style={styles.supportingCopy}>
          Return to your Anchor for a few seconds.
        </Text>

        {/* Duration Selector */}
        <View style={styles.durationSelector}>
          {DURATION_OPTIONS.map((opt, i) => {
            const isSelected = duration === opt;
            return (
              <Pressable
                key={opt}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={`${formatDurationOption(opt)}${isSelected ? ', selected' : ''}`}
                onPress={() => handleSelectDuration(opt)}
                style={[
                  styles.durationOption,
                  i < DURATION_OPTIONS.length - 1 && styles.durationDivider,
                ]}
              >
                <View
                  style={[
                    styles.durationIndicator,
                    isSelected && styles.durationIndicatorActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.durationText,
                      isSelected && styles.durationTextActive,
                    ]}
                  >
                    {formatDurationOption(opt)}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* Audio / Guidance Summary Row */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Session guidance: ${audioSummary}. Tap to customize.`}
          onPress={() => setSheetOpen(true)}
          style={styles.summaryRow}
        >
          <Text style={styles.summaryLabel}>{audioSummary}</Text>
          <ChevronRight size={16} color={colors.text.secondary} />
        </Pressable>
      </View>

      {/* Bottom CTA */}
      <View
        style={[
          styles.footer,
          { paddingBottom: Math.max(22, insets.bottom + 8) },
        ]}
      >
        <V2Button
          size="large"
          onPress={handleBegin}
          accessibilityLabel="Begin Focus"
          testID="v2-begin-focus"
          style={{ backgroundColor: '#5C3A82' }}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 6,
    minHeight: 48,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...typography.headingMD,
    fontFamily: typography.displayBold,
    fontSize: 22,
    color: colors.text.primary,
  },
  headerSpacer: {
    width: 44,
  },
  scrollContent: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 8,
  },
  artworkContainer: {
    position: 'relative',
    width: 212,
    height: 212,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  halo: {
    position: 'absolute',
    width: 236,
    height: 236,
    borderRadius: 118,
    opacity: 0.6,
  },
  intentionBlock: {
    marginTop: 24,
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  eyebrow: {
    ...typography.labelSM,
    color: colors.text.secondary,
    letterSpacing: 0.8,
  },
  intentionText: {
    ...typography.headingMD,
    fontFamily: typography.displayBold,
    fontSize: 23,
    lineHeight: 30,
    color: colors.text.primary,
    textAlign: 'center',
    marginTop: 8,
    letterSpacing: -0.3,
  },
  supportingCopy: {
    ...typography.bodyMD,
    fontSize: 14.5,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: 14,
    paddingHorizontal: 40,
  },
  durationSelector: {
    flexDirection: 'row',
    width: '100%',
    marginTop: 28,
    paddingHorizontal: 22,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border.default,
  },
  durationOption: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
  },
  durationDivider: {
    borderRightWidth: 1,
    borderRightColor: colors.border.default,
  },
  durationIndicator: {
    paddingBottom: 6,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  durationIndicatorActive: {
    borderBottomColor: practiceColors.focus,
  },
  durationText: {
    ...typography.labelMD,
    fontSize: 13,
    fontFamily: typography.bodyBold,
    letterSpacing: 0.5,
    color: colors.text.disabled,
  },
  durationTextActive: {
    color: '#5C3A82',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 22,
    paddingVertical: 14,
    minHeight: 46,
  },
  summaryLabel: {
    ...typography.bodyMD,
    fontSize: 13.5,
    fontFamily: typography.bodySemiBold,
    color: colors.text.secondary,
  },
  footer: {
    paddingHorizontal: 22,
  },
});
