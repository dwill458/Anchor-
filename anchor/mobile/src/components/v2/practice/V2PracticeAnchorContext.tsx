import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CircularAnchorRenderer, V2Badge } from '@/components/v2';
import { getCategoryColor, spacing, typography, colors } from '@/theme/v2';
import type { Anchor } from '@/types';
import { anchorRenderProps, categoryLabel } from '@/components/v2/anchors/anchorPresentation';
import type { AnchorTransitionPlaceBinding } from '@/navigation/v2/ProgressiveFocusTransition';

/** `artworkPlace` registers the mark as an Anchor transition place (the Deep Focus session). */
export function V2PracticeAnchorContext({ anchor, artworkPlace }: { anchor: Anchor; artworkPlace?: AnchorTransitionPlaceBinding }) {
  const mark = <CircularAnchorRenderer {...anchorRenderProps(anchor)} size="thumbnail" accessibilityLabel={`${categoryLabel(anchor.category)} Anchor artwork`} />;
  return <View testID="v2-practice-anchor-context" style={styles.context}>{artworkPlace ? <View ref={artworkPlace.ref} collapsable={false} onLayout={artworkPlace.onLayout} style={{ opacity: artworkPlace.hidden ? 0 : 1 }}>{mark}</View> : mark}<View style={styles.copy}><Text numberOfLines={2} style={styles.intention}>{anchor.intentionText}</Text><View style={styles.category}><View style={[styles.dash, { backgroundColor: getCategoryColor(anchor.category) }]} /><V2Badge label={categoryLabel(anchor.category)} tone="category" value={anchor.category} /></View></View></View>;
}
const styles = StyleSheet.create({ context: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] }, copy: { flex: 1, gap: spacing[2] }, intention: { ...typography.headingMD, color: colors.text.primary }, category: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] }, dash: { width: 12, height: 2, borderRadius: 2 } });
