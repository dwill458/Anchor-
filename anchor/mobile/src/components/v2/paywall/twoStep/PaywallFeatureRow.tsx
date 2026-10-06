import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { paywallType } from './paywallType';

type Props = {
  W: number;
  title: string;
  body: string;
  /** Decorative preview; hidden from assistive tech, the row speaks for itself. */
  renderTile: (frame: { width: number; height: number }) => React.ReactNode;
  testID?: string;
};

export const PAYWALL_TILE = { width: 0.43, minHeight: 0.195 } as const;

/** One step-1 benefit: a live preview tile on the left, serif title and body on the right. */
export function PaywallFeatureRow({ W, title, body, renderTile, testID }: Props) {
  const tile = { width: PAYWALL_TILE.width * W, height: PAYWALL_TILE.minHeight * W };
  return (
    <View
      accessible
      accessibilityLabel={`${title}. ${body}`}
      style={[styles.row, { gap: W * 0.05 }]}
      testID={testID}
    >
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={tile}>
        {renderTile(tile)}
      </View>
      <View style={styles.copy}>
        <Text style={paywallType.rowTitle(W)}>{title}</Text>
        <Text style={[paywallType.rowBody(W), { marginTop: W * 0.008 }]}>{body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  copy: { flex: 1, minWidth: 0 },
});
