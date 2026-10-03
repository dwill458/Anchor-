import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowLeft, MoreHorizontal } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CHART_COPY } from '@/constants/v2/chartCopy';
import { CHART_MAP_TOKENS as T } from '../map/chartMapTokens';
import { categoryLabelOnPaper, type PanelAccent } from './chartPanelColors';

type Props = {
  /** Category label, e.g. DESIRE. */
  categoryLabel: string;
  /** Category key, for the AA-contrast label colour on paper. */
  category?: string | null;
  accent: PanelAccent;
  visionImageUrl: string | null;
  hasVision: boolean;
  onBack?: () => void;
  inline?: boolean;
  tone?: 'paper' | 'ink';
  onMenu?: () => void;
  onOpenVision: () => void;
};

const CONTROL = 44;

/**
 * Overlay on the map (prototype .topbar, .cat, .vcard): back, serif "Chart",
 * menu, the category label and the polaroid Vision card. The map underneath
 * stays tappable outside these controls.
 */
export function ChartMapHeader({ categoryLabel, category, accent, visionImageUrl, hasVision, onBack, onMenu, onOpenVision, inline = false, tone = 'paper' }: Props) {
  const insets = useSafeAreaInsets();
  const ink = tone === 'ink' ? T.light : T.ink;
  return (
    <View style={[styles.root, inline && styles.inline, { paddingTop: insets.top }]} pointerEvents="box-none">
      <View style={styles.bar} pointerEvents="box-none">
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={onBack} disabled={!onBack} accessibilityState={{ disabled: !onBack }} style={[styles.ib, tone === 'ink' && styles.inkControl, !onBack && { opacity: 0 }]} testID="chart-back">
          <ArrowLeft size={22} color={ink} />
        </Pressable>
        <Text accessibilityRole="header" style={[styles.title, { color: ink }]}>{CHART_COPY.title}</Text>
        {onMenu ? <Pressable accessibilityRole="button" accessibilityLabel="Chart options" onPress={onMenu} style={styles.ib} testID="chart-menu-button">
          <MoreHorizontal size={22} color={ink} />
        </Pressable> : <View style={{ width: CONTROL, height: CONTROL }} /> }
      </View>
      <View style={styles.cat} pointerEvents="none">
        <View style={[styles.dot, { backgroundColor: accent.fill }]} />
        <Text style={[styles.catText, { color: tone === 'ink' ? accent.text : categoryLabelOnPaper(category) }]} testID="chart-category-label">{categoryLabel}</Text>
      </View>
      {hasVision ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open Vision"
          onPress={onOpenVision}
          style={styles.vcardHit}
          testID="chart-vision-card"
        >
          <View style={styles.vcard}>
            {visionImageUrl ? (
              <Image source={{ uri: visionImageUrl }} style={styles.vimg} accessibilityIgnoresInvertColors />
            ) : (
              <View style={[styles.vimg, { backgroundColor: accent.fill, opacity: 0.35 }]} />
            )}
            <Text style={styles.vlabel}>VISION</Text>
          </View>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', left: 0, right: 0, top: 0, zIndex: 3 },
  inline: { position: 'relative', paddingBottom: 8 },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10, paddingVertical: 8 },
  ib: { width: CONTROL, height: CONTROL, borderRadius: CONTROL / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(244,241,233,.72)' },
  inkControl: { backgroundColor: 'rgba(239,234,223,.08)' },
  title: { fontFamily: T.serif, fontSize: 26, color: T.ink, letterSpacing: 0.3 },
  cat: { flexDirection: 'row', alignItems: 'center', gap: 7, marginLeft: 16, marginTop: 2 },
  dot: { width: 7, height: 7, borderRadius: 3.5 },
  catText: { fontFamily: T.sansStrong, fontSize: 11, letterSpacing: 2 },
  // The polaroid is 66pt wide; the touch target is padded out to 44pt+ without changing its look.
  vcardHit: { alignSelf: 'flex-start', marginLeft: 8, marginTop: 8, padding: 6 },
  vcard: {
    width: 66,
    paddingHorizontal: 4,
    paddingTop: 4,
    paddingBottom: 13,
    backgroundColor: '#FBF9F4',
    transform: [{ rotate: '-3deg' }],
    shadowColor: T.ink,
    shadowOpacity: 0.28,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  vimg: { width: '100%', height: 46 },
  vlabel: { position: 'absolute', left: 0, right: 0, bottom: 2, textAlign: 'center', fontFamily: T.sansStrong, fontSize: 7, letterSpacing: 1.4, color: T.ink },
});
