import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ArrowRight } from 'lucide-react-native';
import { encryptedPersistStorage } from '@/stores/encryptedPersistStorage';
import { trackChart, useAnchorChart } from '@/hooks/v2/chart/useAnchorChart';
import { CHART_COPY } from '@/constants/v2/chartCopy';
import { colors, radii, spacing, typography } from '@/theme/v2';

export type ChartHandoffSurface = 'visualize' | 'practice';

/** At most once per Anchor per surface in this window: SEE → MOVE, never a nag. */
export const CHART_HANDOFF_COOLDOWN_MS = 20 * 60 * 60 * 1000;

const shownAt = new Map<string, number>();
const key = (anchorId: string, surface: ChartHandoffSurface) => `anchor:v2:chart2:handoff:${surface}:${anchorId}`;

export async function shouldOfferChartHandoff(anchorId: string, surface: ChartHandoffSurface, now = Date.now()): Promise<boolean> {
  const memo = shownAt.get(key(anchorId, surface));
  if (memo !== undefined) return now - memo >= CHART_HANDOFF_COOLDOWN_MS;
  try {
    const stored = await encryptedPersistStorage.getItem(key(anchorId, surface));
    const at = stored ? Number(stored) : NaN;
    if (Number.isFinite(at)) {
      shownAt.set(key(anchorId, surface), at);
      return now - at >= CHART_HANDOFF_COOLDOWN_MS;
    }
  } catch {
    /* storage failures only mean we may offer it again */
  }
  return true;
}

export function markChartHandoffShown(anchorId: string, surface: ChartHandoffSurface, now = Date.now()): void {
  shownAt.set(key(anchorId, surface), now);
  Promise.resolve(encryptedPersistStorage.setItem(key(anchorId, surface), String(now))).catch(() => undefined);
}

export function resetChartHandoffMemory(): void {
  shownAt.clear();
}

/**
 * After a completed Visualize or Practice: the Anchor's actual One Move, and a
 * way to the Chart. Renders nothing without a live One Move, and appears at
 * most once a day per surface.
 */
export function ChartMoveHandoff({
  anchorId,
  surface,
  tone,
  visible = true,
  testID,
}: {
  anchorId: string | null | undefined;
  surface: ChartHandoffSurface;
  tone: 'ink' | 'cream';
  /** Hold until the completion moment has settled. */
  visible?: boolean;
  testID?: string;
}) {
  const navigation = useNavigation<any>();
  const chart = useAnchorChart(anchorId ?? null);
  const oneMove = chart.view?.oneMove ?? null;
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    if (!anchorId) return undefined;
    void shouldOfferChartHandoff(anchorId, surface).then((value) => {
      if (alive) setAllowed(value);
    });
    return () => {
      alive = false;
    };
  }, [anchorId, surface]);

  const show = Boolean(anchorId && visible && allowed && oneMove && !chart.view?.isFinished);

  useEffect(() => {
    if (show && anchorId) {
      markChartHandoffShown(anchorId, surface);
      trackChart('chart_handoff_shown', { surface });
    }
  }, [anchorId, show, surface]);

  if (!show || !oneMove || !anchorId) return null;
  const onInk = tone === 'ink';

  return (
    <View testID={testID ?? `chart-handoff-${surface}`} style={[styles.card, onInk ? styles.cardInk : styles.cardCream]}>
      {surface === 'visualize' ? (
        <Text style={[styles.lead, { color: onInk ? colors.ink.text.primary : colors.text.primary }]}>You’ve seen the destination.</Text>
      ) : null}
      <Text style={[styles.eyebrow, { color: onInk ? colors.ink.text.secondary : colors.text.secondary }]}>{CHART_COPY.labels.oneMove}</Text>
      <Text style={[styles.move, { color: onInk ? colors.ink.text.primary : colors.text.primary }]}>{oneMove.title}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${CHART_COPY.active.viewChart}. One Move: ${oneMove.title}`}
        onPress={() => {
          trackChart('chart_handoff_opened', { surface });
          navigation.navigate('V2Chart', { anchorId, source: surface });
        }}
        hitSlop={6}
        style={({ pressed }) => [styles.link, pressed && { opacity: 0.7 }]}
      >
        <Text style={[styles.linkText, { color: onInk ? colors.ink.text.primary : colors.text.primary }]}>{CHART_COPY.active.viewChart}</Text>
        <ArrowRight size={15} color={onInk ? colors.ink.text.primary : colors.text.primary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { alignSelf: 'stretch', maxWidth: 420, borderRadius: radii.lg, padding: spacing[4], gap: 4, borderWidth: StyleSheet.hairlineWidth },
  cardInk: { backgroundColor: 'rgba(24, 33, 42, 0.86)', borderColor: colors.ink.hairlineStrong },
  cardCream: { backgroundColor: colors.surface, borderColor: colors.border.default },
  lead: { ...typography.bodyMD, marginBottom: spacing[2] },
  eyebrow: { ...typography.labelSM, letterSpacing: 1.1 },
  move: { ...typography.headingSM },
  link: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing[2], minHeight: 32, alignSelf: 'flex-start' },
  linkText: { ...typography.labelMD },
});
