import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { CircularAnchorRenderer, V2Button, V2EmptyState, V2Screen } from '@/components/v2';
import { anchorArtworkSvg, categoryLabel } from '@/components/v2/anchors/anchorPresentation';
import {
  V2_PRACTICE_DURATIONS,
  V2_PRACTICE_MODE_BY_ID,
  v2PracticeDurationLabel,
  type V2PracticeMode,
} from '@/constants/v2/practice';
import { useSettingsStore } from '@/stores/settingsStore';
import { colors, getCategoryColor, radii, spacing, typography } from '@/theme/v2';
import type { Anchor } from '@/types';
import type { HomeVisionState } from '@/adapters/v2/home';
import type { V2PracticeStartRequest, V2PremiumCapabilityRequest } from './practiceRoutes';

type Props = {
  anchor: Anchor;
  mode: V2PracticeMode;
  vision: HomeVisionState;
  source: 'practice_hub' | 'recommended_today';
  initialDuration?: number;
  entitled?: boolean;
  onBack: () => void;
  onCreateVision: (anchorId: string) => void;
  onOpenVision?: (anchorId: string) => void;
  onReleaseRequested: (anchorId: string, reason?: string) => void;
  onBeginPractice?: (request: V2PracticeStartRequest) => void;
  onPremiumRequired?: (request: V2PremiumCapabilityRequest) => void;
};

const MODE_SETUP_EXPLANATIONS: Record<V2PracticeMode, string> = {
  focus: "Return your attention to the intention you've chosen to reinforce.",
  deep_prime: 'Settle into a longer guided return to deepen your thread.',
  visualize: 'Rehearse the future held in your Vision.',
  release:
    'Release closes this intention when its work is complete. It preserves this Anchor and its history in your vault, but removes it from active daily reinforcement.',
};

export function V2PracticePrepareScreen({
  anchor,
  mode,
  vision,
  source,
  initialDuration,
  entitled = true,
  onBack,
  onCreateVision,
  onOpenVision,
  onReleaseRequested,
  onBeginPractice,
  onPremiumRequired,
}: Props) {
  const definition = V2_PRACTICE_MODE_BY_ID[mode];
  const durations = mode === 'release' ? [] : V2_PRACTICE_DURATIONS[mode];
  const defaultDuration = initialDuration ?? (durations[1] ?? durations[0]);
  const [duration, setDuration] = useState<number>(defaultDuration);

  const hapticIntensity = useSettingsStore((state) => state.hapticIntensity);
  const sessionAudioDefaults = useSettingsStore((state) => state.sessionAudioDefaults);
  const audioSettings = sessionAudioDefaults?.[mode === 'release' ? 'focus' : mode];
  const soundOn = audioSettings ? audioSettings.backgroundAudio !== 'off' || audioSettings.guidanceVoice !== 'none' : true;
  const hapticsOn = (hapticIntensity ?? 70) > 0;

  const isVisionEmpty = mode === 'visualize' && vision.state === 'none';

  const begin = () => {
    if (mode === 'release') {
      onReleaseRequested(anchor.id, 'practice_prepare');
      return;
    }

    if (isVisionEmpty || !duration) return;

    if (!entitled && (mode === 'deep_prime' || mode === 'visualize')) {
      onPremiumRequired?.({
        capability: mode,
        anchorId: anchor.id,
        source,
        durationSeconds: duration,
      });
      return;
    }

    onBeginPractice?.({
      anchorId: anchor.id,
      mode,
      durationSeconds: duration,
      source,
    });
  };

  const categoryColor = getCategoryColor(anchor.category);
  const visionTile = vision.state === 'ready' && vision.tiles && vision.tiles.length > 0 ? vision.tiles[0] : null;
  const visionImageUrl = visionTile?.imageUrl;

  return (
    <V2Screen scroll testID={`v2-practice-prepare-${mode}`}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back to Practice"
        onPress={onBack}
        style={styles.back}
      >
        <ArrowLeft size={20} color={colors.text.primary} />
        <Text style={styles.backText}>Practice</Text>
      </Pressable>

      <View style={styles.content}>
        {/* Visual focal point: Large Real Anchor Artwork */}
        <View style={styles.heroSection}>
          <Text style={[styles.eyebrow, { color: definition.accent }]}>
            {definition.title.toUpperCase()}
          </Text>

          <View style={styles.artworkContainer}>
            <CircularAnchorRenderer
              svg={anchorArtworkSvg(anchor)}
              category={anchor.category}
              size="hero"
              accessibilityLabel={`${categoryLabel(anchor.category)} Anchor artwork`}
            />
          </View>

          <Text style={styles.intentionText}>{anchor.intentionText}</Text>

          <View style={styles.categoryRow}>
            <View style={[styles.categoryDot, { backgroundColor: categoryColor }]} />
            <Text style={styles.categoryLabel}>{categoryLabel(anchor.category)}</Text>
          </View>

          <Text style={styles.explanationText}>
            {MODE_SETUP_EXPLANATIONS[mode]}
          </Text>
        </View>

        {/* Mode-specific setup body */}
        {isVisionEmpty ? (
          <V2EmptyState
            title="Create a Vision first"
            message="Add a Vision to use Visualize. Visualize rehearses a future you have chosen for this Anchor."
            action={
              <V2Button
                accessibilityLabel="Create a Vision for this Anchor"
                onPress={() => onCreateVision(anchor.id)}
              >
                Create a Vision
              </V2Button>
            }
          />
        ) : mode === 'release' ? (
          <View style={styles.releaseCard}>
            <Text style={styles.releaseTitle}>Close this intention with care.</Text>
            <Text style={styles.releaseBody}>
              Release preserves this Anchor and its complete history in your vault. It will no longer appear in daily reinforcement.
            </Text>
          </View>
        ) : (
          <View style={styles.controlsSection}>
            {/* Vision preview if Visualize */}
            {mode === 'visualize' && vision.state === 'ready' ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open this Anchor's Vision"
                onPress={() => onOpenVision?.(anchor.id)}
                style={styles.visionCard}
              >
                {visionImageUrl ? (
                  <Image
                    source={{ uri: visionImageUrl }}
                    style={styles.visionImage}
                    resizeMode="cover"
                  />
                ) : null}
                <Text numberOfLines={3} style={styles.visionPreviewText}>
                  {vision.previewText}
                </Text>
              </Pressable>
            ) : null}

            {/* Duration Selector */}
            <View style={styles.durationsContainer}>
              <Text style={styles.controlLabel}>HOW LONG?</Text>
              <View style={styles.durations}>
                {durations.map((option) => {
                  const isSelected = option === duration;
                  return (
                    <Pressable
                      key={option}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                      accessibilityLabel={`${v2PracticeDurationLabel(option)}${
                        isSelected ? ', selected' : ''
                      }`}
                      onPress={() => setDuration(option)}
                      style={[
                        styles.durationButton,
                        isSelected && {
                          borderColor: definition.accent,
                          backgroundColor: `${definition.accent}14`,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.durationButtonText,
                          isSelected && { color: definition.accent, fontWeight: '700' },
                        ]}
                      >
                        {v2PracticeDurationLabel(option)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Utility status indicators */}
            <View style={styles.utilityBlock}>
              <View style={styles.utilityRow}>
                <Text style={styles.utilityLabel}>Sound</Text>
                <Text style={styles.utilityValue}>{soundOn ? 'On' : 'Off'}</Text>
              </View>
              <View style={styles.utilityRow}>
                <Text style={styles.utilityLabel}>Haptics</Text>
                <Text style={styles.utilityValue}>{hapticsOn ? 'On' : 'Off'}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Primary Action Button */}
        {!isVisionEmpty ? (
          <View style={styles.bottomAction}>
            <V2Button
              size="large"
              variant={mode === 'release' ? 'secondary' : 'primary'}
              accessibilityLabel={
                mode === 'release'
                  ? 'Continue to Release'
                  : `Begin ${definition.title}`
              }
              onPress={begin}
            >
              {mode === 'release'
                ? 'Continue to Release'
                : `Begin ${definition.title}`}
            </V2Button>
          </View>
        ) : null}
      </View>
    </V2Screen>
  );
}

export const V2FocusPrepareScreen = (props: Omit<Props, 'mode'>) => (
  <V2PracticePrepareScreen {...props} mode="focus" />
);
export const V2DeepPrimePrepareScreen = (props: Omit<Props, 'mode'>) => (
  <V2PracticePrepareScreen {...props} mode="deep_prime" />
);
export const V2VisualizePrepareScreen = (props: Omit<Props, 'mode'>) => (
  <V2PracticePrepareScreen {...props} mode="visualize" />
);
export const V2ReleasePrepareScreen = (props: Omit<Props, 'mode'>) => (
  <V2PracticePrepareScreen {...props} mode="release" />
);

const styles = StyleSheet.create({
  back: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    minHeight: 44,
  },
  backText: {
    ...typography.labelLG,
    color: colors.text.primary,
  },
  content: {
    gap: spacing[6],
    paddingTop: spacing[2],
    paddingBottom: spacing[8],
  },
  heroSection: {
    alignItems: 'center',
    gap: spacing[2],
    paddingTop: spacing[2],
  },
  eyebrow: {
    ...typography.labelSM,
    letterSpacing: 1.2,
    fontWeight: '700',
    fontSize: 11,
  },
  artworkContainer: {
    marginVertical: spacing[3],
    alignItems: 'center',
    justifyContent: 'center',
  },
  intentionText: {
    ...typography.headingLG,
    color: colors.text.primary,
    textAlign: 'center',
    paddingHorizontal: spacing[4],
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 2,
  },
  categoryDot: {
    width: 6,
    height: 6,
    borderRadius: radii.round,
  },
  categoryLabel: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  explanationText: {
    ...typography.bodyMD,
    color: colors.text.secondary,
    textAlign: 'center',
    paddingHorizontal: spacing[4],
    paddingTop: spacing[1],
    lineHeight: 20,
  },
  controlsSection: {
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
  durationButtonText: {
    ...typography.labelMD,
    color: colors.text.primary,
  },
  utilityBlock: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    borderRadius: radii.md,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    gap: spacing[2],
  },
  utilityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  utilityLabel: {
    ...typography.bodySM,
    color: colors.text.secondary,
  },
  utilityValue: {
    ...typography.labelSM,
    color: colors.text.primary,
    fontWeight: '600',
  },
  visionCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    borderRadius: radii.md,
    overflow: 'hidden',
    gap: spacing[2],
  },
  visionImage: {
    width: '100%',
    height: 120,
  },
  visionPreviewText: {
    ...typography.bodyMD,
    color: colors.text.secondary,
    padding: spacing[3],
    lineHeight: 20,
  },
  releaseCard: {
    gap: spacing[2],
    padding: spacing[4],
    borderRadius: radii.md,
    backgroundColor: '#F28A2E14',
    borderWidth: 1,
    borderColor: '#F28A2E44',
  },
  releaseTitle: {
    ...typography.headingSM,
    color: colors.text.primary,
  },
  releaseBody: {
    ...typography.bodyMD,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  bottomAction: {
    paddingTop: spacing[2],
  },
});
