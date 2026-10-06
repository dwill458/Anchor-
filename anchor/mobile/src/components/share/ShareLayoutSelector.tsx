import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { detailsFonts, detailsPalette } from '@/components/v2/anchors/anchorDetailsTokens';
import { ShareTemplate } from './ShareTemplate';
import { SHARE_ASPECT, SHARE_LAYOUT_LABELS, type ShareExportData, type ShareLayoutId } from './shareTypes';

const THUMB_WIDTH = 56;
const THUMB_HEIGHT = Math.round(THUMB_WIDTH * SHARE_ASPECT);

type Props = {
  layouts: ShareLayoutId[];
  selected: ShareLayoutId;
  onSelect: (layout: ShareLayoutId) => void;
  data: ShareExportData;
  showMark: boolean;
};

/** Each option is a real miniature of its export, drawn by the same template. */
export function ShareLayoutSelector({ layouts, selected, onSelect, data, showMark }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      accessibilityRole="radiogroup"
      testID="share-layout-selector"
    >
      {layouts.map((layout) => {
        const active = layout === selected;
        return (
          <Pressable
            key={layout}
            testID={`share-layout-${layout}`}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`${SHARE_LAYOUT_LABELS[layout]} layout`}
            onPress={() => onSelect(layout)}
            style={styles.item}
          >
            <View style={[styles.thumb, active && styles.thumbActive]}>
              <View pointerEvents="none" style={styles.thumbInner}>
                <ShareTemplate layout={layout} data={data} width={THUMB_WIDTH} showMark={showMark} />
              </View>
            </View>
            <Text style={[styles.label, active && styles.labelActive]}>{SHARE_LAYOUT_LABELS[layout]}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: 20, gap: 12 },
  item: { alignItems: 'center', gap: 6 },
  thumb: {
    width: THUMB_WIDTH + 6,
    height: THUMB_HEIGHT + 6,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbActive: { borderColor: detailsPalette.gold },
  thumbInner: { width: THUMB_WIDTH, height: THUMB_HEIGHT, borderRadius: 6, overflow: 'hidden' },
  label: { fontFamily: detailsFonts.ui, fontSize: 12, color: detailsPalette.creamMuted },
  labelActive: { fontFamily: detailsFonts.uiStrong, color: detailsPalette.cream },
});
