import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useV2ReduceMotion } from '@/hooks/v2';
import { ArrowRight, Eye } from 'lucide-react-native';
import { V2Button } from '@/components/v2';
import { anchorRenderProps } from '@/components/v2/anchors/anchorPresentation';
import { VisionHeaderRow, VisionIdentity, VisionInkBand } from '@/components/v2/vision/VisionChrome';
import { VisionPhoto } from '@/components/v2/vision/VisionPhoto';
import { v2PracticeDurationLabel } from '@/constants/v2/practice';
import { useSettingsStore } from '@/stores/settingsStore';
import { colors, radii, spacing, typography } from '@/theme/v2';
import { practiceColors } from '@/theme/v2/practiceColors';
import { DEFAULT_SESSION_AUDIO_DEFAULTS, type BackgroundAudioMode, type GuidanceVoice } from '@/types/sessionAudio';
import type { Anchor } from '@/types';
import type { V2VisionTile } from '@/adapters/v2/vision';
import { preloadVisionImages, V2_VISUALIZE_DURATIONS, V2_VISUALIZE_TIMING } from './visualizeVisionPlan';

export type V2VisualizeBeginConfig = {
  durationSeconds: number;
  voice: GuidanceVoice;
  ambient: boolean;
  haptics: boolean;
};

type Props = {
  anchor: Anchor;
  statement: string;
  tiles: V2VisionTile[];
  initialDuration?: number;
  onBack: () => void;
  onOpenVision?: (anchorId: string) => void;
  onBegin: (config: V2VisualizeBeginConfig) => void;
};

const ACCENT = practiceColors.visualize;

/**
 * Visualize setup. The person is here to see their Vision, so the Vision's
 * photography is the hero and the Anchor is a small line of provenance.
 * Sound and haptics apply to this session only; saved defaults are untouched.
 */
export function V2VisualizePrepareScreen({ anchor, statement, tiles, initialDuration, onBack, onOpenVision, onBegin }: Props) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const defaults = useSettingsStore(state => state.sessionAudioDefaults?.visualize);
  const hapticIntensity = useSettingsStore(state => state.hapticIntensity);
  const savedVoice: GuidanceVoice = defaults?.guidanceVoice ?? DEFAULT_SESSION_AUDIO_DEFAULTS.visualize.guidanceVoice;
  const savedAmbient: BackgroundAudioMode = defaults?.backgroundAudio ?? DEFAULT_SESSION_AUDIO_DEFAULTS.visualize.backgroundAudio;
  const [duration, setDuration] = useState<number>(
    initialDuration && (V2_VISUALIZE_DURATIONS as readonly number[]).includes(initialDuration) ? initialDuration : 180,
  );
  const [soundOn, setSoundOn] = useState(savedVoice !== 'none' || savedAmbient !== 'off');
  const [hapticsOn, setHapticsOn] = useState((hapticIntensity ?? 70) > 0);
  const art = useMemo(() => anchorRenderProps(anchor), [anchor]);
  const cover = tiles.find(tile => Boolean(tile.imageUrl))?.imageUrl ?? null;
  const photoHeight = Math.round(Math.min((width - spacing[5] * 2) * 0.72, height * 0.36));

  // Decode every Vision image now, so the session never shows one loading.
  const imageUrls = useMemo(() => tiles.map(tile => tile.imageUrl).filter((uri): uri is string => Boolean(uri)), [tiles]);
  useEffect(() => { preloadVisionImages(imageUrls); }, [imageUrls]);

  // Setup hands over to the session through darkness, never a hard cut.
  const reduceMotion = useV2ReduceMotion();
  const veil = useSharedValue(0);
  const veilStyle = useAnimatedStyle(() => ({ opacity: veil.value }));
  const beganRef = useRef(false);

  const begin = () => {
    if (beganRef.current) return;
    beganRef.current = true;
    // Turning sound on when the saved defaults are fully silent uses the
    // product defaults rather than starting a silent "sound on" session.
    const voice: GuidanceVoice = soundOn ? (savedVoice !== 'none' || savedAmbient !== 'off' ? savedVoice : DEFAULT_SESSION_AUDIO_DEFAULTS.visualize.guidanceVoice) : 'none';
    const ambient = soundOn ? (savedVoice !== 'none' || savedAmbient !== 'off' ? savedAmbient !== 'off' : true) : false;
    const config = { durationSeconds: duration, voice, ambient, haptics: hapticsOn };
    if (reduceMotion) { onBegin(config); return; }
    veil.value = withTiming(1, { duration: V2_VISUALIZE_TIMING.handoffMs, easing: Easing.in(Easing.quad) });
    setTimeout(() => onBegin(config), V2_VISUALIZE_TIMING.handoffMs);
  };

  return (
    <View testID="v2-practice-prepare-visualize" style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <VisionInkBand>
          <View style={styles.band}>
            <VisionHeaderRow title="Visualize" onBack={onBack} backLabel="Back to Practice" />
            <VisionIdentity intention={anchor.intentionText} category={anchor.category} art={art} />
            <Text accessibilityRole="header" style={styles.title}>Rehearse{'\n'}the future.</Text>
            <Text style={styles.subtitle}>Step into the moments you’ve created and let them feel real.</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Open this Anchor’s Vision" disabled={!onOpenVision}
              onPress={() => onOpenVision?.(anchor.id)} style={({ pressed }) => [pressed && styles.pressed]}>
              <VisionPhoto testID="v2-visualize-prepare-vision" source={cover} scrim="bottom" style={[styles.photo, { height: photoHeight }]}>
                <View style={styles.caption}>
                  <Text style={styles.captionKicker}>YOUR VISION</Text>
                  <Text numberOfLines={3} style={styles.statement}>{statement}</Text>
                </View>
              </VisionPhoto>
            </Pressable>
          </View>
        </VisionInkBand>

        <View style={styles.controls}>
          <Text style={styles.label}>HOW LONG?</Text>
          <View style={styles.durations}>
            {V2_VISUALIZE_DURATIONS.map(option => {
              const selected = option === duration;
              return (
                <Pressable key={option} accessibilityRole="button" accessibilityState={{ selected }}
                  accessibilityLabel={`${v2PracticeDurationLabel(option)}${selected ? ', selected' : ''}`}
                  onPress={() => setDuration(option)}
                  style={[styles.duration, selected && { borderColor: ACCENT, backgroundColor: `${ACCENT}14` }]}>
                  <Text style={[styles.durationText, selected && styles.durationTextSelected]}>{v2PracticeDurationLabel(option)}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.toggles}>
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Sound</Text>
              <Switch accessibilityLabel="Sound" value={soundOn} onValueChange={setSoundOn}
                trackColor={{ true: ACCENT, false: colors.border.default }} thumbColor={colors.paper} ios_backgroundColor={colors.border.default} />
            </View>
            <View style={styles.divider} />
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Haptics</Text>
              <Switch accessibilityLabel="Haptics" value={hapticsOn} onValueChange={setHapticsOn}
                trackColor={{ true: ACCENT, false: colors.border.default }} thumbColor={colors.paper} ios_backgroundColor={colors.border.default} />
            </View>
          </View>
        </View>
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing[3] }]}>
        <V2Button size="large" accessibilityLabel="Begin Visualize" onPress={begin}
          iconLeft={<Eye size={18} color={ACCENT} />} iconRight={<ArrowRight size={17} color={colors.paper} />}>
          Begin Visualize
        </V2Button>
      </View>
      <Animated.View pointerEvents="none" style={[styles.veil, veilStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  scroll: { paddingBottom: spacing[5] },
  band: { paddingHorizontal: spacing[5], gap: spacing[3], paddingBottom: spacing[2] },
  // Same display scale as the Vision entrance ("See your future."), so setup reads as one family.
  title: { ...typography.displayMedium, color: colors.ink.text.primary, marginTop: spacing[4] },
  subtitle: { ...typography.bodyLG, color: colors.ink.text.secondary, maxWidth: 320 },
  photo: { borderRadius: radii.lg, marginTop: spacing[3], justifyContent: 'flex-end' },
  caption: { padding: spacing[4], gap: spacing[1] },
  captionKicker: { ...typography.labelSM, fontSize: 10, letterSpacing: 2, color: colors.ink.text.secondary },
  statement: { ...typography.headingSM, color: colors.ink.text.primary },
  pressed: { opacity: 0.85 },
  controls: { paddingHorizontal: spacing[5], paddingTop: spacing[4], gap: spacing[2] },
  label: { ...typography.labelSM, fontSize: 10, letterSpacing: 0.8, color: colors.text.secondary },
  durations: { flexDirection: 'row', gap: spacing[2], marginBottom: spacing[2] },
  duration: { flex: 1, minHeight: 52, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border.subtle, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  durationText: { ...typography.labelMD, color: colors.text.primary },
  durationTextSelected: { fontFamily: typography.utilityBold.fontFamily, color: ACCENT },
  veil: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.ink.deep, opacity: 0 },
  toggles: { borderRadius: radii.md, borderWidth: 1, borderColor: colors.border.subtle, backgroundColor: colors.surface, paddingHorizontal: spacing[4] },
  toggleRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggleLabel: { ...typography.bodyMD, color: colors.text.primary },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border.subtle },
  footer: { paddingHorizontal: spacing[5], paddingTop: spacing[3], backgroundColor: colors.canvas },
});
