import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Rect } from 'react-native-svg';

import { AnchorMark } from '@/components/v2/anchor/AnchorMark';
import { categoryLabel } from '@/components/v2/anchors/anchorPresentation';
import { DISTILLATION_COPY, REVEAL_COPY } from '@/constants/v2/creation';
import { colors, spacing, typography } from '@/theme/v2';
import type { SigilFormation } from '@/utils/sigil/traditional-generator';
import { V2Button } from '@/components/v2';
import { CreationSheet, sheetText } from './CreationSheet';
import { kameaGeometry } from './FormationLayer';

const DIAGRAM = 132;

/**
 * "See how it was formed": the method, told with the user's own words, letters and grid.
 * Optional and never shown unasked — the formation itself is the primary explanation.
 */
export function FormationSheet({
  visible,
  onClose,
  onReplay,
  intention,
  letters,
  category,
  formation,
  svg,
}: {
  visible: boolean;
  onClose: () => void;
  /** Plays the whole formation again on the stage, exactly as it first happened. */
  onReplay?: () => void;
  intention: string;
  letters: string[];
  category?: string | null;
  formation: SigilFormation | null;
  svg?: string;
}) {
  return (
    <CreationSheet visible={visible} title={REVEAL_COPY.howItFormed} onClose={onClose} testID="formation-sheet">
      <Text style={sheetText.body}>{DISTILLATION_COPY.sheetIntro}</Text>
      <View style={styles.mechanism}>
        {DISTILLATION_COPY.mechanism.map((step, index) => (
          <View key={step} style={styles.mechanismRow}>
            <Text style={styles.mechanismIndex}>{index + 1}</Text>
            <Text style={styles.mechanismStep}>{step}</Text>
          </View>
        ))}
      </View>
      {intention && letters.length ? (
        <View style={styles.worked}>
          <Text style={sheetText.label}>Your intention</Text>
          <Text style={styles.workedIntention}>{intention}</Text>
          <Text style={sheetText.label}>Your letters</Text>
          <Text style={styles.workedLetters}>{letters.join('  ')}</Text>
        </View>
      ) : null}
      {formation && svg ? (
        <View style={styles.grid}>
          <View style={styles.gridCopy}>
            <Text style={sheetText.label}>The grid</Text>
            <Text style={sheetText.quiet}>
              {`${categoryLabel(category)} intentions are drawn on a ${formation.gridSize} × ${formation.gridSize} grid. `}
              {REVEAL_COPY.gridIntro}
            </Text>
          </View>
          <View style={styles.diagram} accessible accessibilityLabel={`Your ${formation.vertices.length} points joined on a ${formation.gridSize} by ${formation.gridSize} grid`}>
            <Svg width={DIAGRAM} height={DIAGRAM} viewBox="0 0 100 100" style={StyleSheet.absoluteFill}>
              <Rect {...squareOf(formation)} stroke={colors.ink.base} strokeOpacity={0.24} strokeWidth={0.6} fill="none" />
              {formation.gridCells.map((cell) => (
                <Circle key={cell.value} cx={cell.x} cy={cell.y} r={1.1} fill={colors.ink.base} fillOpacity={0.28} />
              ))}
            </Svg>
            <AnchorMark svg={svg} category={category} expression="monoline" size={DIAGRAM} />
          </View>
        </View>
      ) : null}
      {onReplay && formation ? (
        <V2Button variant="secondary" onPress={onReplay} testID="formation-replay">{REVEAL_COPY.replay}</V2Button>
      ) : null}
    </CreationSheet>
  );
}

function squareOf(formation: SigilFormation) {
  const { left, top, side } = kameaGeometry(formation);
  return { x: left, y: top, width: side, height: side };
}

const styles = StyleSheet.create({
  mechanism: { gap: spacing[2] },
  mechanismRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing[3] },
  mechanismIndex: { ...typography.labelSM, color: colors.text.tertiary, width: 14 },
  mechanismStep: { ...typography.bodyMD, color: colors.text.primary, flex: 1 },
  worked: { gap: spacing[1], paddingTop: spacing[3], borderTopWidth: 1, borderTopColor: colors.border.subtle },
  workedIntention: { ...typography.bodyMD, color: colors.text.primary, fontStyle: 'italic', marginBottom: spacing[2] },
  workedLetters: { ...typography.headingSM, color: colors.text.primary, letterSpacing: 2 },
  grid: { gap: spacing[3], paddingTop: spacing[3], borderTopWidth: 1, borderTopColor: colors.border.subtle },
  gridCopy: { gap: spacing[1] },
  diagram: { width: DIAGRAM, height: DIAGRAM, alignSelf: 'center' },
});
