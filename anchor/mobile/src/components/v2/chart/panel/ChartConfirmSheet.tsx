import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { V2SheetModal, V2_SHEET_SKIRT } from '@/components/v2/primitives/V2SheetModal';
import { CHART_PANEL_COPY as COPY } from '../map/chartRhythm';
import { CHART_MAP_TOKENS as T } from '../map/chartMapTokens';
import { PanelButton } from './ChartPanelCards';
import type { PanelAccent } from './chartPanelColors';

type Props = {
  visible: boolean;
  /** Waypoint title for the question. */
  title: string;
  accent: PanelAccent;
  reducedMotion: boolean;
  busy?: boolean;
  onYes: () => void;
  onNotYet: () => void;
};

/**
 * "Have you reached it in the real world?" Progress only moves on the
 * person's word. Copy is the locked section 13 table; the confirmation sits on
 * the ink panel surface with the same 44pt+ controls as the panel.
 */
export function ChartConfirmSheet({ visible, title, accent, reducedMotion, busy, onYes, onNotYet }: Props) {
  return (
    <V2SheetModal
      visible={visible}
      onClose={onNotYet}
      reduceMotion={reducedMotion}
      scrimColor="rgba(5, 8, 11, 0.6)"
      testID="chart-reach-confirm"
    >
      <View style={styles.sheet} accessibilityViewIsModal>
        <Text accessibilityRole="header" style={styles.title}>{COPY.confirmTitle(title)}</Text>
        <Text style={styles.body}>{COPY.confirmBody}</Text>
        <PanelButton
          label={COPY.confirmYes}
          variant="primary"
          accent={accent}
          loading={busy}
          onPress={onYes}
          testID="chart-reach-yes"
          style={styles.primary}
        />
        <PanelButton label={COPY.confirmNo} accent={accent} onPress={onNotYet} testID="chart-reach-no" style={styles.primary} />
      </View>
    </V2SheetModal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: T.panel,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 1,
    borderTopColor: T.line,
    paddingHorizontal: 18,
    paddingTop: 22,
    paddingBottom: 22 + V2_SHEET_SKIRT,
    marginBottom: -V2_SHEET_SKIRT,
    gap: 12,
    flexShrink: 1,
  },
  title: { fontFamily: T.serif, fontSize: 26, lineHeight: 29, color: T.light },
  body: { fontFamily: T.sans, fontSize: 14, lineHeight: 20, color: T.muted },
  primary: { minHeight: 48, alignSelf: 'stretch' },
});
