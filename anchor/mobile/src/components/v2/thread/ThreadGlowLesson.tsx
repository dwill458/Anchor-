import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useGuidanceHost } from '@/hooks/v2/guidance/useGuidanceHost';
import type { PracticeSceneKind, PracticeScenePhase } from '@/hooks/v2/practice/usePracticeCompletionScene';
import { colors, spacing, typography } from '@/theme/v2';
import { ThreadStrengthExplainerSheet } from './ThreadStrengthExplainerSheet';

type Result = { sessionId: string | null; saved: boolean; before?: number | null; after?: number | null; kind: PracticeSceneKind; phase: PracticeScenePhase };
/** The blueprint authorizes first/repeat only. No inferred result or celebratory level claim. */
export function threadGlowVariant(result: Result): 'A' | 'B' | null {
  if (!result.sessionId || !result.saved || result.phase !== 'settled'
    || typeof result.before !== 'number' || typeof result.after !== 'number'
    || !Number.isFinite(result.before) || !Number.isFinite(result.after)
    || result.before < 0 || result.after > 100 || result.after <= result.before) return null;
  return result.kind === 'first' ? 'A' : result.kind === 'repeat' ? 'B' : null;
}

export function ThreadGlowLesson({ account, anchorId, sessionId, variant, strength, active, viewport }: {
  account: string; anchorId: string; sessionId: string; variant: 'A' | 'B'; strength: number; active: boolean; viewport: { height: number; offset: number; resultY: number };
}) {
  const [explainer, setExplainer] = useState(false);
  const host = useGuidanceHost({ screenId: 'practice-completion', accountId: account, variant,
    contextKey: `${anchorId}:${sessionId}`, eligible: ['thread.glow'], isFocused: active, blocked: !active || explainer });
  const [layout, setLayout] = useState<{ y: number; height: number } | null>(null);
  const insideViewport = layout !== null && viewport.height > 0
    && layout.y + viewport.resultY >= viewport.offset
    && layout.y + viewport.resultY + layout.height <= viewport.offset + viewport.height;
  useEffect(() => {
    if (insideViewport) host.markShown();
    else host.markHidden();
  }, [insideViewport, host.markShown, host.markHidden]);
  return <>
    {host.presentation ? <View testID="thread-glow-lesson" style={styles.lesson} onLayout={event => setLayout(event.nativeEvent.layout)}>
      <Text style={styles.copy} accessibilityLiveRegion="polite">{variant === 'A'
        ? "As your Thread Strength grows, so does your Anchor's glow."
        : "Your Thread Strength grew — and your Anchor's glow with it."}</Text>
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" onPress={() => setExplainer(true)} style={styles.action}>
          <Text style={styles.link}>What's Thread Strength?</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Dismiss Thread Strength tip" onPress={() => host.dismiss('close')} style={styles.action}>
          <Text style={styles.link}>Dismiss</Text>
        </Pressable>
      </View>
    </View> : layout ? <View testID="thread-glow-placeholder" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      style={{ height: layout.height, marginTop: spacing[2] }} /> : null}
    <ThreadStrengthExplainerSheet visible={explainer && active} onClose={() => setExplainer(false)} strength={strength} />
  </>;
}
const styles = StyleSheet.create({
  lesson: { alignSelf: 'stretch', gap: spacing[1], marginTop: spacing[2] },
  copy: { ...typography.bodySM, color: colors.text.secondary, textAlign: 'center' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: spacing[4] },
  action: { minHeight: 44, minWidth: 44, justifyContent: 'center', paddingHorizontal: spacing[1] },
  link: { ...typography.bodySM, color: colors.text.secondary, textDecorationLine: 'underline' },
});
