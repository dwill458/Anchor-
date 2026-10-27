import type { ViewInstance } from 'react-native';
import React, { useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { CircularAnchorRenderer, V2Button } from '@/components/v2';
import { V2PracticeSetupLayout } from '@/components/v2/practice/V2PracticeSetupLayout';
import { resolvePracticeSetupMetrics, SETUP_CONTROL_MIN_HEIGHT } from '@/components/v2/practice/practiceSetupLayout';
import { useV2Responsive } from '@/hooks/v2';
import { anchorRenderProps, categoryLabel } from '@/components/v2/anchors/anchorPresentation';
import { practiceColors } from '@/theme/v2/practiceColors';
import { getCategoryColor, getCategoryFieldColor, colors, radii, spacing, typography } from '@/theme/v2';
import type { Anchor } from '@/types';
import type { GuidanceVoice } from '@/types/sessionAudio';
import { useSettingsStore } from '@/stores/settingsStore';
import { useAuraStrength } from '@/stores/devThreadStrengthStore';
import { useV2ReduceMotion } from '@/hooks/v2';
import { safeHaptics } from '@/utils/haptics';
import { V2PracticeAudioSheet } from '@/components/v2/practice/V2PracticeAudioSheet';
import { V2PracticeSettingsCard } from '@/components/v2/practice/V2PracticeSettingsCard';
import { useSessionAudioSetup } from '@/hooks/v2/useSessionAudioSetup';
import { stopVoicePreview } from '@/services/VoicePreviewService';
import { useAnchorTransitionPlace } from '@/navigation/v2/ProgressiveFocusTransition';

export interface V2FocusPrepConfig {
  durationSeconds: number;
  voice: GuidanceVoice;
  ambient: boolean;
  haptics: boolean;
  anchorCenterY?: number;
  anchorSize?: number;
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
/** A pushed Android screen settles beneath the status bar a beat after its first layout. */
const SETUP_PLACE_MEASURE_DELAY_MS = Platform.OS === 'android' ? 120 : 0;

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
  const viewport = useV2Responsive();
  const metrics = resolvePracticeSetupMetrics(viewport, 'focus');
  const preferredDuration = useSettingsStore((state) => state.focusSessionDuration);
  const glow = useAuraStrength(anchor.threadStrength ?? null);
  const reduceMotion = useV2ReduceMotion();

  const [duration, setDuration] = useState<number>(() => {
    if (initialDuration && DURATION_OPTIONS.includes(initialDuration as 10 | 30 | 60)) {
      return initialDuration;
    }
    if (preferredDuration && DURATION_OPTIONS.includes(preferredDuration as 10 | 30 | 60)) {
      return preferredDuration;
    }
    return 30;
  });

  const audio = useSessionAudioSetup('focus', { initialVoice, initialAmbient });
  const { voice, ambient, hapticsOn } = audio;
  const [sheetOpen, setSheetOpen] = useState(false);
  const artworkRef = useRef<ViewInstance>(null);
  const anchorCenterYRef = useRef<number | undefined>(undefined);
  // Where the Anchor lands from Details or the Practice hub, and leaves from for the session.
  const place = useAnchorTransitionPlace('practiceSetup', anchor.id, 'paper', { measureDelayMs: SETUP_PLACE_MEASURE_DELAY_MS });

  const categoryColor = getCategoryColor(anchor.category);

  const formatDurationOption = (seconds: number) =>
    seconds === 60 ? '1 min' : `${seconds} sec`;

  const handleSelectDuration = (val: number) => {
    void safeHaptics.selection();
    setDuration(val);
  };

  const handleBegin = () => {
    // A preview started from Settings must not run into the session.
    stopVoicePreview();
    if (hapticsOn) void safeHaptics.selection();

    onBeginFocus({
      durationSeconds: duration,
      voice,
      ambient,
      haptics: hapticsOn,
      anchorCenterY: anchorCenterYRef.current,
      anchorSize: metrics.artworkSize,
    });
  };

  return (
    <V2PracticeSetupLayout
      testID="v2-practice-prepare-focus"
      backTestID="focus-prep-back-button"
      onBack={onBack}
      centered
      sidePadding={metrics.sidePadding}
      footerPaddingBottom={metrics.footerPaddingBottom}
      footer={
        <V2Button
          size="large"
          onPress={handleBegin}
          accessibilityLabel="Begin Focus"
          testID="v2-begin-focus"
          style={styles.beginButton}
        >
          Begin Focus
        </V2Button>
      }
      overlay={
        <V2PracticeAudioSheet
          visible={sheetOpen}
          sessionType="focus"
          durationSeconds={duration}
          value={audio.config}
          accent={practiceColors.focus}
          actionColor="#5C3A82"
          testIDPrefix="focus"
          onApply={audio.apply}
          onClose={() => setSheetOpen(false)}
        />
      }
    >
      <>
        {/* Practice Title Eyebrow */}
        <Text style={[styles.eyebrow, { marginTop: metrics.heroTop / 2 }]}>FOCUS</Text>

        {/* Hero Section: Centered prominent Anchor with organic halo */}
        <View style={[styles.heroSection, { marginTop: metrics.heroTop }]}>
          <View
            ref={artworkRef}
            onLayout={() => artworkRef.current?.measureInWindow((_x, y, _width, height) => {
              anchorCenterYRef.current = y + height / 2;
            })}
            style={[styles.artworkContainer, { width: metrics.artworkFrameSize, height: metrics.artworkFrameSize, marginVertical: metrics.artworkGap }]}
          >
            <View
              style={[
                styles.halo,
                { width: metrics.haloSize, height: metrics.haloSize, borderRadius: metrics.haloSize / 2, backgroundColor: getCategoryFieldColor(anchor.category) },
              ]}
            />
            <View ref={place.ref} collapsable={false} onLayout={place.onLayout} style={{ width: metrics.artworkSize, height: metrics.artworkSize, opacity: place.hidden ? 0 : 1 }}>
              <CircularAnchorRenderer
                {...anchorRenderProps(anchor)}
                size={metrics.artworkSize}
                appearance="paper"
                aura={{ anchorId: `${anchor.id}${glow.keySuffix}`, threadStrength: glow.strength, variant: 'details', active: true, reducedMotion: reduceMotion }}
                accessibilityLabel={`${categoryLabel(anchor.category)} Anchor artwork`}
              />
            </View>
          </View>

          {/* Intention info */}
          <View style={styles.intentionBlock}>
            <Text style={styles.intentionText} numberOfLines={3}>{anchor.intentionText}</Text>
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
        <View style={[styles.controlsSection, { marginTop: metrics.sectionGap, gap: metrics.controlGap }]}>
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

          <V2PracticeSettingsCard
            soundOn={audio.soundOn}
            summary={audio.summary}
            hapticsOn={hapticsOn}
            onToggleSound={audio.toggleSound}
            onToggleHaptics={audio.toggleHaptics}
            onOpenSettings={() => setSheetOpen(true)}
            testIDPrefix="focus"
          />
        </View>
      </>
    </V2PracticeSetupLayout>
  );
}

const styles = StyleSheet.create({
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
    width: '100%',
  },
  artworkContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
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
    minHeight: SETUP_CONTROL_MIN_HEIGHT + 4,
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
  beginButton: {
    backgroundColor: colors.ink.base,
    borderRadius: radii.round,
  },
});
