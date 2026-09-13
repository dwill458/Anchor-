import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { CircularAnchorRenderer } from '@/components/v2';
import { colors, getCategoryPalette, typography } from '@/theme/v2';
import { v2Haptics } from '@/hooks/v2';
import { anchorArtworkSvg, categoryLabel } from '@/components/v2/anchors/anchorPresentation';
import type { V2HomeAnchorSummary } from '@/adapters/v2/home';

type Props = {
  anchors: V2HomeAnchorSummary[];
  onSelect: (anchorId: string) => void;
  onOpenAllAnchors?: () => void;
};

function ChevronRight({ color = '#647188' }: { color?: string }) {
  return (
    <Svg width={12} height={12} viewBox="0 0 12 12" fill="none" accessibilityElementsHidden>
      <Path
        d="M4.5 2.5L8 6L4.5 9.5"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/**
 * Open-canvas circular rail matching the approved handmade reference.
 * Inactive Anchors stay visually subordinate. Tap updates selected Anchor in place.
 */
export function V2AnchorQuickSwitch({ anchors, onSelect, onOpenAllAnchors }: Props) {
  if (anchors.length === 0) return null;

  return (
    <View style={styles.container}>
      {/* Section Header */}
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>Your Anchors</Text>
        {onOpenAllAnchors ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View all Anchors"
            onPress={onOpenAllAnchors}
            style={({ pressed }) => [styles.seeAllLink, pressed && styles.pressed]}
          >
            <Text style={styles.seeAllText}>See all</Text>
            <ChevronRight color="#647188" />
          </Pressable>
        ) : null}
      </View>

      {/* Quick-switch horizontal rail */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rail}
        accessibilityRole="tablist"
        accessibilityLabel="Switch selected Anchor"
      >
        {anchors.map(({ anchor, isSelected, thread }) => {
          const id = anchor.localId ?? anchor.id;
          const palette = getCategoryPalette(anchor.category);

          return (
            <Pressable
              key={id}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`Select ${anchor.intentionText}, Thread Strength ${thread.value === null ? 'not yet measured' : thread.value}`}
              onPress={() => {
                if (isSelected) return;
                v2Haptics.selection();
                onSelect(id);
              }}
              style={({ pressed }) => [
                styles.item,
                { opacity: isSelected ? 1 : 0.72 },
                pressed && styles.pressed,
              ]}
            >
              {/* 64x64 Circle Artwork with Category Wash Outer Ring */}
              <View style={styles.artFrame}>
                <View
                  style={[styles.artWash, { backgroundColor: palette.wash }]}
                  accessibilityElementsHidden
                />
                <View style={styles.artInner}>
                  <CircularAnchorRenderer
                    svg={anchorArtworkSvg(anchor)}
                    category={anchor.category}
                    size="thumbnail"
                    state={isSelected ? 'active' : 'inactive'}
                    accessibilityLabel={`${categoryLabel(anchor.category)} Anchor`}
                  />
                </View>
              </View>

              {/* 2-line intention text */}
              <Text numberOfLines={2} style={styles.intentionText}>
                {anchor.intentionText}
              </Text>

              {/* Active colored pill indicator */}
              <View
                style={[
                  styles.activeIndicator,
                  { backgroundColor: isSelected ? palette.base : 'transparent' },
                ]}
                accessibilityElementsHidden
              />
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 20,
  },
  headerRow: {
    paddingHorizontal: 22,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerTitle: {
    fontFamily: typography.displayBold,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.2,
    color: colors.text.primary,
  },
  seeAllLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  seeAllText: {
    fontFamily: typography.utilitySemibold.fontFamily,
    fontSize: 13.5,
    fontWeight: '600',
    color: '#647188',
  },
  rail: {
    flexDirection: 'row',
    gap: 16,
    paddingHorizontal: 22,
    paddingBottom: 28,
  },
  item: {
    width: 84,
    alignItems: 'center',
    gap: 8,
  },
  artFrame: {
    width: 64,
    height: 64,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  artWash: {
    position: 'absolute',
    inset: 0,
    borderRadius: 32,
  },
  artInner: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#FBF9F4',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  intentionText: {
    fontFamily: typography.utilitySemibold.fontFamily,
    fontSize: 11.5,
    fontWeight: '600',
    lineHeight: 15,
    color: colors.text.primary,
    textAlign: 'center',
    width: 84,
    minHeight: 30,
  },
  activeIndicator: {
    width: 14,
    height: 3,
    borderRadius: 1.5,
  },
  pressed: {
    opacity: 0.75,
  },
});
