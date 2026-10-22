import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Check, X } from 'lucide-react-native';
import { colors, radii, spacing } from '@/theme/v2';
import { formatElapsed } from '@/hooks/v2/chart/askChartDictation';
import type { useAskDictation } from '@/hooks/v2/chart/useAskDictation';
import { chartTypography as typography } from '../chartTypography';
import { AskWaveform } from './AskWaveform';
import type { AskAccent } from './askChartTheme';

type Props = {
  dictation: Pick<ReturnType<typeof useAskDictation>, 'state' | 'elapsedMs' | 'levels' | 'volumeSupported' | 'finish' | 'cancel'>;
  accent: AskAccent;
  reducedMotion: boolean;
};

const STATUS: Record<'starting' | 'listening' | 'finishing', string> = { starting: 'Starting…', listening: 'Listening…', finishing: 'Finishing…' };

/**
 * Replaces the composer while recording. Cancel throws the recording away; the check keeps the words and returns
 * them to the composer to edit. Neither sends anything.
 */
export const AskVoiceRecorder = memo(function AskVoiceRecorder({ dictation, accent, reducedMotion }: Props) {
  const { state } = dictation;
  if (state === 'idle') return null;
  const busy = state !== 'listening';
  return (
    <Animated.View entering={reducedMotion ? undefined : FadeIn.duration(180)} style={styles.panel} testID="ask-recorder">
      <Text style={styles.status} accessibilityLiveRegion="polite">{STATUS[state]}</Text>
      <AskWaveform levels={dictation.levels} color={accent.fill} reducedMotion={reducedMotion} levelsSupported={dictation.volumeSupported} />
      <View style={styles.row}>
        <Pressable accessibilityRole="button" accessibilityLabel="Cancel recording" onPress={dictation.cancel} style={[styles.round, styles.cancel, { borderColor: accent.border }]} testID="ask-record-cancel">
          <X size={22} color={colors.text.primary} />
        </Pressable>
        <Text style={styles.time} accessibilityLabel={`Recording time ${formatElapsed(dictation.elapsedMs)}`} testID="ask-record-time">{formatElapsed(dictation.elapsedMs)}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Finish recording"
          accessibilityState={{ disabled: busy }}
          disabled={busy}
          onPress={dictation.finish}
          style={[styles.round, { backgroundColor: accent.fill, opacity: busy ? 0.5 : 1 }]}
          testID="ask-record-finish"
        >
          <Check size={24} color={accent.onFill} strokeWidth={2.6} />
        </Pressable>
      </View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  panel: { marginHorizontal: spacing[4], paddingTop: spacing[4], paddingBottom: spacing[3], paddingHorizontal: spacing[4], gap: spacing[3], alignItems: 'stretch', borderRadius: radii.xl, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border.subtle },
  status: { ...typography.headingSM, color: colors.text.primary, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  round: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  cancel: { borderWidth: 1, backgroundColor: colors.canvas },
  time: { ...typography.labelLG, color: colors.text.secondary, fontVariant: ['tabular-nums'] },
});
