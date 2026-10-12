import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { CircularAnchorRenderer } from '@/components/v2';
import { AnimatedPressable, usePressScale } from '@/components/v2/motion';
import { colors, spacing, typography } from '@/theme/v2';
import type { Anchor } from '@/types';
import { anchorRenderProps, categoryLabel } from './anchorPresentation';
import { countPerfRender } from '@/utils/perfDiagnostics';

type Props = {
  anchor: Anchor;
  released: boolean;
  selected?: boolean;
  selectionMode?: boolean;
  bulkSelected?: boolean;
  artworkSize?: number;
  onPress?: () => void;
};

// Line height of typography.labelMD is 18dp. Reserving 2 lines (36dp) ensures
// 1-line and 2-line intentions align metadata across the row identically.
const INTENTION_BOX_HEIGHT = 36;

/** One circular gallery cell: artwork, concise intention, category + state cue. */
export function V2AnchorGalleryItem({
  anchor,
  released,
  selected = false,
  selectionMode = false,
  bulkSelected = false,
  artworkSize = 128,
  onPress,
}: Props) {
  countPerfRender('V2AnchorGalleryItem');
  const state = categoryLabel(anchor.category);
  const status = released ? 'Released' : selected ? 'Current' : 'Active';
  const press = usePressScale();
  return (
    <AnimatedPressable
      accessibilityRole={selectionMode ? 'checkbox' : 'button'}
      accessibilityState={selectionMode ? { checked: bulkSelected } : undefined}
      accessibilityLabel={`${anchor.intentionText}. ${state}, ${status}.${selectionMode ? ` ${bulkSelected ? 'Selected' : 'Not selected'} for deletion.` : ''}`}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      style={[styles.item, press.style]}
    >
      <View style={[styles.artworkContainer, { width: '100%', height: artworkSize }]}>
        <CircularAnchorRenderer
          {...anchorRenderProps(anchor)}
          size={artworkSize}
          state={released ? 'inactive' : 'active'}
          accessibilityLabel={`${state} Anchor`}
          performanceLabel={`anchor-gallery:${anchor.localId ?? anchor.id}`}
        />
        {selectionMode ? (
          <View style={[styles.selectionMark, bulkSelected && styles.selectionMarkSelected]}>
            {bulkSelected ? <Check size={16} color={colors.text.inverse} strokeWidth={2.5} /> : null}
          </View>
        ) : null}
      </View>
      <View style={styles.intentionContainer}>
        <Text numberOfLines={2} ellipsizeMode="tail" style={styles.title}>
          {anchor.intentionText}
        </Text>
      </View>
      <Text numberOfLines={1} style={styles.meta}>
        {state} · {status}
      </Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  item: { width: '100%', alignItems: 'center' },
  artworkContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[3],
  },
  selectionMark: {
    position: 'absolute',
    top: spacing[2],
    right: spacing[2],
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.border.strong,
    backgroundColor: colors.canvas,
  },
  selectionMarkSelected: {
    borderColor: colors.semantic.error,
    backgroundColor: colors.semantic.error,
  },
  intentionContainer: {
    width: '100%',
    minHeight: INTENTION_BOX_HEIGHT,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: spacing[1],
    marginBottom: spacing[1],
  },
  title: { ...typography.labelMD, color: colors.text.primary, textAlign: 'center', textTransform: 'none' },
  meta: { ...typography.caption, color: colors.text.secondary, textAlign: 'center' },
});
