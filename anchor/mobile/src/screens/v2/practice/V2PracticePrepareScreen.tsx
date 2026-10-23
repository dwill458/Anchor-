import React, { useMemo, useState } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { CircularAnchorRenderer, V2Button, V2EmptyState } from '@/components/v2';
import { V2PracticeSetupLayout } from '@/components/v2/practice/V2PracticeSetupLayout';
import { resolvePracticeSetupMetrics } from '@/components/v2/practice/practiceSetupLayout';
import { useSessionAudioSetup, useV2Responsive } from '@/hooks/v2';
import { V2PracticeAudioSheet } from '@/components/v2/practice/V2PracticeAudioSheet';
import { V2PracticeSettingsCard } from '@/components/v2/practice/V2PracticeSettingsCard';
import { stopVoicePreview } from '@/services/VoicePreviewService';
import { anchorRenderProps, categoryLabel } from '@/components/v2/anchors/anchorPresentation';
import {
  V2_PRACTICE_DURATIONS,
  V2_PRACTICE_MODE_BY_ID,
  v2PracticeDurationLabel,
  type V2PracticeMode,
} from '@/constants/v2/practice';
import { colors, getCategoryColor, radii, spacing, typography } from '@/theme/v2';
import type { Anchor } from '@/types';
import type { HomeVisionState } from '@/adapters/v2/home';
import type { V2PracticeStartRequest, V2PremiumCapabilityRequest } from './practiceRoutes';
import { V2VisualizePrepareScreen as V2VisionVisualizePrepare } from './visualize/V2VisualizePrepareScreen';
import { useAnchorTransitionPlace } from '@/navigation/v2/ProgressiveFocusTransition';
import { useRemoteAudioReady } from '@/hooks/useRemoteAudioReady';
import { resolveSessionAudioPlan } from '@/services/SessionAudioManifest';

type Props = {
  visionEntry?: import('@/adapters/v2/vision').VisionVisualizeEntry;
  anchor: Anchor;
  mode: V2PracticeMode;
  vision: HomeVisionState;
  source: 'practice_hub' | 'recommended_today';
  initialDuration?: number;
  entitled?: boolean;
  onBack: () => void;
  onCreateVision: (anchorId: string) => void;
  onOpenVision?: (anchorId: string) => void;
  /** The shared Anchor transition carries Begin into the session; setup skips its own hand-off veil. */
  anchorHandoff?: boolean;
  onReleaseRequested: (anchorId: string, reason?: string) => void;
  onBeginPractice?: (request: V2PracticeStartRequest) => void;
  onPremiumRequired?: (request: V2PremiumCapabilityRequest) => void;
};

const MODE_SETUP_EXPLANATIONS: Record<V2PracticeMode, string> = {
  focus: "Return your attention to the intention you've chosen to reinforce.",
  deep_prime: 'A longer, guided session to go deeper with your intention.',
  visualize: 'Rehearse the future held in your Vision.',
  release:
    'Release closes this intention when its work is complete. It preserves this Anchor and its history in your vault, but removes it from active daily reinforcement.',
};

export function V2PracticePrepareScreen({
  anchor,
  mode,
  vision,
  visionEntry,
  source,
  initialDuration,
  entitled = true,
  onBack,
  onCreateVision,
  onOpenVision,
  onReleaseRequested,
  onBeginPractice,
  onPremiumRequired,
  anchorHandoff,
}: Props) {
  const viewport = useV2Responsive();
  const metrics = resolvePracticeSetupMetrics(viewport, 'hero');
  const definition = V2_PRACTICE_MODE_BY_ID[mode];
  const durations = mode === 'release' ? [] : V2_PRACTICE_DURATIONS[mode];
  const defaultDuration = initialDuration ?? (durations[1] ?? durations[0]);
  const [duration, setDuration] = useState<number>(defaultDuration);

  const audio = useSessionAudioSetup(mode === 'release' ? 'focus' : mode);
  const [audioSheetOpen, setAudioSheetOpen] = useState(false);

  const isVisionEmpty = mode === 'visualize' && vision.state === 'none';

  // Deep Focus's longer mixes are downloaded rather than bundled. Start fetching the selected one
  // here so the session plays it from disk; if it is not ready in time the session streams it.
  const deepFocusAudio = useMemo(() => {
    if (mode !== 'deep_prime' || !duration) return [];
    const plan = resolveSessionAudioPlan({
      sessionType: 'deep_prime',
      durationSeconds: duration,
      configuration: {
        guidanceVoice: audio.voice,
        backgroundAudio: audio.ambient ? 'ambient' : 'off',
        source: 'default',
      },
    });
    return [...plan.voiceCues.map((cue) => cue.track.asset), plan.ambientTrack?.asset];
  }, [audio.ambient, audio.voice, duration, mode]);
  useRemoteAudioReady(deepFocusAudio);

  const begin = () => {
    if (mode === 'release') {
      onReleaseRequested(anchor.id, 'practice_prepare');
      return;
    }

    if (isVisionEmpty || !duration) return;
    // A preview started from Settings must not run into the session.
    stopVoicePreview();

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
      voice: audio.voice,
      ambient: audio.ambient,
      haptics: audio.hapticsOn,
    });
  };

  // Visualize with a Vision: the Vision's photography leads the setup.
  if (mode === 'visualize' && vision.state === 'ready') {
    return (
      <V2VisionVisualizePrepare
        anchor={anchor}
        statement={vision.previewText}
        visionId={vision.visionId}
        tiles={vision.tiles ?? []}
        notes={vision.notes}
        boardLayout={vision.boardLayout ?? 'CLASSIC'}
        entry={visionEntry}
        initialDuration={initialDuration}
        onBack={onBack}
        onOpenVision={onOpenVision}
        anchorHandoff={anchorHandoff}
        entitled={entitled}
        onBegin={(config) => {
          if (!entitled) {
            onPremiumRequired?.({ capability: 'visualize', anchorId: anchor.id, source, durationSeconds: config.durationSeconds });
            return;
          }
          onBeginPractice?.({
            anchorId: anchor.id,
            mode: 'visualize',
            durationSeconds: config.durationSeconds,
            source,
            voice: config.voice,
            ambient: config.ambient,
            haptics: config.haptics,
            preparedVisualize: config.prepared,
          });
        }}
      />
    );
  }

  const categoryColor = getCategoryColor(anchor.category);
  const visionTile = vision.state === 'ready' && vision.tiles && vision.tiles.length > 0 ? vision.tiles[0] : null;
  const visionImageUrl = visionTile?.imageUrl;

  return (
    <V2PracticeSetupLayout
      testID={`v2-practice-prepare-${mode}`}
      onBack={onBack}
      sidePadding={metrics.sidePadding}
      footerPaddingBottom={metrics.footerPaddingBottom}
      footer={!isVisionEmpty ? (
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
      ) : null}
    >
      <View style={[styles.content, { gap: metrics.bodyGap }]}>
        {/* Visual focal point: Large Real Anchor Artwork */}
        <View style={styles.heroSection}>
          <Text style={[styles.eyebrow, { color: definition.accent }]}>
            {definition.title.toUpperCase()}
          </Text>

          <View style={[styles.artworkContainer, { marginVertical: metrics.artworkGap }]}>
            <SetupAnchor anchor={anchor} size={metrics.artworkSize} />
          </View>

          <Text style={styles.intentionText} numberOfLines={3}>{anchor.intentionText}</Text>

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
            <V2PracticeSettingsCard
              soundOn={audio.soundOn}
              summary={audio.summary}
              hapticsOn={audio.hapticsOn}
              onToggleSound={audio.toggleSound}
              onToggleHaptics={audio.toggleHaptics}
              onOpenSettings={() => setAudioSheetOpen(true)}
              testIDPrefix={mode === 'deep_prime' ? 'deep-focus' : mode}
            />
            <V2PracticeAudioSheet
              visible={audioSheetOpen}
              sessionType={mode}
              durationSeconds={duration}
              value={audio.config}
              accent={definition.accent}
              actionColor={mode === 'deep_prime' ? '#8A5B12' : undefined}
              testIDPrefix={mode === 'deep_prime' ? 'deep-focus' : mode}
              onApply={audio.apply}
              onClose={() => setAudioSheetOpen(false)}
            />
          </View>
        )}

      </View>
    </V2PracticeSetupLayout>
  );
}

export const V2FocusPrepareScreen = (props: Omit<Props, 'mode'>) => (
  <V2PracticePrepareScreen {...props} mode="focus" />
);
export const V2DeepPrimePrepareScreen = (props: Omit<Props, 'mode'>) => (
  <V2PracticePrepareScreen {...props} mode="deep_prime" />
);
/**
 * The setup's hero Anchor, registered as the transition's `practiceSetup`
 * place. Its own component so the Vision-led Visualize branch above, which
 * registers its identity mark instead, never registers a second one.
 */
function SetupAnchor({ anchor, size }: { anchor: Anchor; size: number }) {
  // A pushed Android screen settles beneath the status bar a beat after its first layout.
  const place = useAnchorTransitionPlace('practiceSetup', anchor.id, 'paper', { measureDelayMs: Platform.OS === 'android' ? 120 : 0 });
  return (
    <View ref={place.ref} collapsable={false} onLayout={place.onLayout} style={{ width: size, height: size, opacity: place.hidden ? 0 : 1 }}>
      <CircularAnchorRenderer
        {...anchorRenderProps(anchor)}
        size={size}
        appearance="paper"
        accessibilityLabel={`${categoryLabel(anchor.category)} Anchor artwork`}
      />
    </View>
  );
}

export const V2VisualizePrepareScreen = (props: Omit<Props, 'mode'>) => (
  <V2PracticePrepareScreen {...props} mode="visualize" />
);
export const V2ReleasePrepareScreen = (props: Omit<Props, 'mode'>) => (
  <V2PracticePrepareScreen {...props} mode="release" />
);

const styles = StyleSheet.create({
  content: {
    paddingTop: spacing[2],
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
});
