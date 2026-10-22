import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, getCategoryColor, radii, spacing, typography } from '@/theme/v2';
import { V2SheetGrabZone, V2SheetModal, V2_SHEET_SKIRT } from '@/components/v2/primitives/V2SheetModal';
import { useV2ReduceMotion } from '@/hooks/v2';
import { CircularAnchorRenderer } from '@/components/v2';
import { anchorRenderProps, categoryLabel } from '@/components/v2/anchors/anchorPresentation';
import type { V2ProgressAnchorOption } from '@/adapters/v2/progress/types';
import { progressTokens } from './progressTokens';

export interface V2ProgressAnchorSheetProps {
  visible: boolean;
  anchors: V2ProgressAnchorOption[];
  selectedAnchorId: string;
  onSelect: (anchorId: string) => void;
  onClose: () => void;
  testID?: string;
}

const ARTWORK_SIZE = 48;
const ARTWORK_RING = 2;

/**
 * Picks which Anchor's progress to read. Lists the non-archived Anchors only.
 * Choosing one changes this screen, not the app's current Anchor.
 */
export const V2ProgressAnchorSheet: React.FC<V2ProgressAnchorSheetProps> = ({
  visible,
  anchors,
  selectedAnchorId,
  onSelect,
  onClose,
  testID = 'v2-progress-anchor-sheet',
}) => {
  const insets = useSafeAreaInsets();
  const reduceMotion = useV2ReduceMotion();

  return (
    <V2SheetModal
      visible={visible}
      onClose={onClose}
      reduceMotion={reduceMotion}
      scrimAccessibilityLabel="Close Anchor list"
      testID={testID}
    >
      <View style={[styles.sheet, { paddingBottom: spacing[6] + V2_SHEET_SKIRT + insets.bottom }]}>
        <V2SheetGrabZone>
          <View style={styles.handle} />
        </V2SheetGrabZone>
        <Text style={styles.sheetTitle}>Switch Anchor</Text>
        <ScrollView showsVerticalScrollIndicator={false}>
          {anchors.map((anchor) => {
            const selected = anchor.id === selectedAnchorId;
            return (
              <Pressable
                key={anchor.id}
                testID={`${testID}-item-${anchor.id}`}
                onPress={() => {
                  onSelect(anchor.id);
                  onClose();
                }}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`${anchor.intention}, ${categoryLabel(anchor.category)}${selected ? ', selected' : ''}`}
                style={({ pressed }) => [styles.row, selected && styles.rowSelected, pressed && styles.pressed]}
              >
                <View style={[styles.artworkRing, { borderColor: getCategoryColor(anchor.category) }]}>
                  <CircularAnchorRenderer
                    {...anchorRenderProps(anchor.anchor)}
                    size={ARTWORK_SIZE - ARTWORK_RING * 2}
                    appearance="tinted"
                    accessibilityLabel={`${categoryLabel(anchor.category)} Anchor artwork`}
                  />
                </View>
                <View style={styles.text}>
                  <Text style={styles.intention} numberOfLines={2}>
                    {anchor.intention}
                  </Text>
                  <View style={styles.categoryRow}>
                    <View style={[styles.categoryDot, { backgroundColor: getCategoryColor(anchor.category) }]} />
                    <Text style={styles.category} numberOfLines={1}>
                      {categoryLabel(anchor.category)}
                    </Text>
                  </View>
                </View>
                {selected ? <Check size={18} color={colors.text.primary} strokeWidth={2.4} /> : null}
              </Pressable>
            );
          })}
          {/* DEFERRED: "All anchors" row. A combined, all-Anchor progress view is not built in this pass. */}
        </ScrollView>
      </View>
    </V2SheetModal>
  );
};

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: colors.cream,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: spacing[4],
    paddingTop: spacing[3],
    marginBottom: -V2_SHEET_SKIRT,
    flexShrink: 1,
  },
  handle: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border.default,
    marginBottom: 10,
  },
  sheetTitle: {
    ...typography.labelMD,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 64,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radii.md,
  },
  rowSelected: { backgroundColor: progressTokens.chip },
  pressed: { opacity: 0.72 },
  artworkRing: {
    width: ARTWORK_SIZE,
    height: ARTWORK_SIZE,
    borderRadius: ARTWORK_SIZE / 2,
    borderWidth: ARTWORK_RING,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  text: { flex: 1 },
  intention: { ...typography.labelLG, color: progressTokens.text },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  categoryDot: { width: 7, height: 7, borderRadius: 4 },
  category: { ...typography.bodySM, color: progressTokens.muted, flexShrink: 1 },
});
