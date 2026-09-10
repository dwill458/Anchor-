import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { V2Button } from '@/components/v2';
import { colors, spacing, typography } from '@/theme/v2';
import type { HomeVisionState } from '@/adapters/v2/home';

type Props = {
  vision: HomeVisionState;
  onOpenVision?: () => void;
  onCreateVision?: () => void;
};

function VisionLandscape() {
  return <Svg width="100%" height={74} viewBox="0 0 260 90" style={styles.paint} accessible={false}>
    <Rect width="260" height="90" fill="#C6DDE5" />
    <Circle cx="210" cy="22" r="16" fill="#F7C775" opacity={0.9} />
    <Path d="M0 57C42 28 84 72 129 52S205 77 260 46V90H0Z" fill="#ABA9E6" />
    <Path d="M-6 63C45 38 84 78 142 62S212 75 268 52" stroke="#5979D8" strokeWidth="17" fill="none" />
    <Path d="M-4 79C48 61 88 94 147 79S215 91 267 71" stroke="#87C4DC" strokeWidth="16" fill="none" />
    <Path d="M7 77C47 68 83 84 108 78M148 83c35 7 69 8 101-5" stroke="#FBF9F4" strokeWidth="3" fill="none" />
  </Svg>;
}

/**
 * Supports both "Vision exists" and "Vision missing" honestly. No generated
 * imagery is fabricated; the current Vision domain persists text only.
 */
export function V2HomeVisionSection({ vision, onOpenVision, onCreateVision }: Props) {
  if (vision.state === 'none') {
    return (
      <View style={styles.section}>
        <View style={styles.mosaic}>
          <Pressable onPress={onCreateVision} style={styles.story}><VisionLandscape /><Text style={styles.kicker}>VISION</Text><Text style={styles.title}>The future, in full.</Text><Text style={styles.copy}>Give this Anchor a future you can see.</Text><V2Button variant="secondary" accessibilityLabel="Add a Vision" onPress={onCreateVision}>Create Vision</V2Button></Pressable>
          <View style={styles.details}><Text style={styles.pictureIcon}>▧</Text><Text style={styles.detailTitle}>What matters</Text><Text style={styles.detailCopy}>A fuller picture, in your own words.</Text></View>
          <View style={styles.details}><Text style={styles.pictureIcon}>▧</Text><Text style={styles.detailTitle}>Possibility</Text><Text style={styles.detailCopy}>Make room for what comes next.</Text></View>
        </View>
      </View>
    );
  }
  return (
    <View style={styles.section}>
      <Pressable onPress={onOpenVision} style={styles.preview}
        accessible
        accessibilityRole="text"
        accessibilityLabel={`Vision: ${vision.previewText}`}
      >
        <VisionLandscape /><Text style={styles.kicker}>VISION</Text>
        <Text style={styles.title}>The future, in full.</Text>
        <Text numberOfLines={4} style={styles.previewText}>
          {vision.previewText}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing[3] },
  kicker: { ...typography.labelSM, color: '#63748C' },
  mosaic: { height: 228, flexDirection: 'row', flexWrap: 'wrap', alignContent: 'space-between', justifyContent: 'space-between' },
  story: { width: '58%', height: 228, gap: spacing[2], padding: spacing[3], borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border.default, borderRadius: 12, backgroundColor: `${colors.surface}B8` },
  paint: { borderRadius: 8, marginBottom: spacing[1] },
  details: { width: '38%', height: 109, justifyContent: 'center', alignItems: 'center', gap: spacing[1], padding: spacing[2], borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border.default, borderRadius: 12, backgroundColor: `${colors.surface}86` },
  pictureIcon: { fontSize: 24, color: '#B6B6B0', lineHeight: 26 },
  title: { ...typography.headingLG, color: colors.text.primary },
  copy: { ...typography.bodySM, color: '#62738B' },
  detailTitle: { ...typography.labelMD, color: colors.text.primary, textAlign: 'center' },
  detailCopy: { ...typography.caption, color: '#62738B', textAlign: 'center' },
  preview: {
    gap: spacing[2], padding: spacing[3],
    borderRadius: 12,
    backgroundColor: `${colors.surface}B8`,
    borderWidth: 1,
    borderStyle: 'dashed', borderColor: colors.border.default,
  },
  previewText: { ...typography.bodyMD, color: colors.text.primary },
});
