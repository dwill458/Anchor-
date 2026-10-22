import React, { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  type TextLayoutEvent,
  View,
} from 'react-native';
import { Check, X } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CircularAnchorRenderer } from '@/components/v2';
import { anchorRenderProps, categoryLabel } from '@/components/v2/anchors/anchorPresentation';
import { HandDrawnThreadLine } from '@/components/v2/thread/HandDrawnThreadLine';
import { V2SheetGrabZone, V2SheetModal, V2_SHEET_SKIRT } from '@/components/v2/primitives/V2SheetModal';
import { useV2ReduceMotion } from '@/hooks/v2';
import { categories, colors, getCategoryColor, radii, spacing, typography } from '@/theme/v2';
import type { Anchor } from '@/types';

type Props = {
  visible: boolean;
  anchors: Anchor[];
  selectedAnchorId?: string | null;
  /** Epoch ms of each Anchor's most recent practice, keyed by Anchor id or localId. */
  lastPracticedAtByAnchorId?: Record<string, number>;
  onSelect: (anchorId: string) => void;
  onClose: () => void;
  testID?: string;
};

const ARTWORK_SIZE = 48;
const ARTWORK_RING = 2;
const ROW_SIDE_PADDING = 18;
const ARTWORK_GAP = 14;
const THREAD_LINE_WIDTH = 70;
const CATEGORY_DOT_SIZE = 6;
const CATEGORY_DOT_GAP = 6;
const SCRIM = 'rgba(23, 23, 20, 0.38)';

/**
 * The active Anchor is pinned first; the rest run most recently practiced
 * first. Anchors with no recorded practice keep their incoming order (the sort
 * is stable), after the ones that have been practiced.
 */
export function orderAnchorsForSwitcher(
  anchors: Anchor[],
  selectedAnchorId?: string | null,
  lastPracticedAtByAnchorId?: Record<string, number>
): Anchor[] {
  const isActive = (a: Anchor) =>
    Boolean(selectedAnchorId && (a.id === selectedAnchorId || a.localId === selectedAnchorId));
  const lastPracticed = (a: Anchor) =>
    lastPracticedAtByAnchorId?.[a.id] ?? (a.localId ? lastPracticedAtByAnchorId?.[a.localId] : undefined) ?? 0;
  const active = anchors.filter(isActive);
  const rest = anchors
    .map((anchor, index) => ({ anchor, index }))
    .filter(({ anchor }) => !isActive(anchor))
    .sort((l, r) => lastPracticed(r.anchor) - lastPracticed(l.anchor) || l.index - r.index)
    .map(({ anchor }) => anchor);
  return [...active, ...rest];
}

export function V2AnchorSwitcherSheet({
  visible,
  anchors,
  selectedAnchorId,
  lastPracticedAtByAnchorId,
  onSelect,
  onClose,
  testID = 'v2-anchor-switcher-sheet',
}: Props) {
  const orderedAnchors = useMemo(
    () => orderAnchorsForSwitcher(anchors, selectedAnchorId, lastPracticedAtByAnchorId),
    [anchors, selectedAnchorId, lastPracticedAtByAnchorId]
  );

  const reduceMotion = useV2ReduceMotion();
  const [maxCategoryLabelWidth, setMaxCategoryLabelWidth] = useState(0);
  const categoryLabels = useMemo(
    () => Array.from(new Set([
      ...Object.keys(categories).map((category) => categoryLabel(category)),
      ...orderedAnchors.map((anchor) => categoryLabel(anchor.category)),
    ])),
    [orderedAnchors]
  );
  const handleCategoryLabelLayout = useCallback((event: TextLayoutEvent) => {
    const measuredWidth = Math.ceil(
      Math.max(...event.nativeEvent.lines.map((line) => line.width), 0)
    );
    setMaxCategoryLabelWidth((current) => Math.max(current, measuredWidth));
  }, []);
  const categoryColumnWidth = maxCategoryLabelWidth + CATEGORY_DOT_SIZE + CATEGORY_DOT_GAP;

  return (
    <V2SheetModal
      visible={visible}
      onClose={onClose}
      reduceMotion={reduceMotion}
      scrimColor={SCRIM}
      scrimAccessibilityLabel="Close anchor switcher"
      testID={testID}
    >
      <SafeAreaView edges={['bottom']} style={styles.sheet}>
        <V2SheetGrabZone>
        <View style={styles.handle} />

        <View style={styles.headerRow}>
          <View style={styles.headerTextCol}>
            <Text style={styles.title}>Switch Anchor</Text>
            <Text style={styles.subtitle}>
              Select the Anchor to focus your practices on
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={onClose}
            hitSlop={8}
            style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
          >
            <X size={18} color={colors.text.secondary} />
          </Pressable>
        </View>
        </V2SheetGrabZone>

        <ScrollView
          style={styles.scrollList}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {orderedAnchors.map((anchor, index) => {
            const isSelected =
              anchor.id === selectedAnchorId ||
              Boolean(anchor.localId && anchor.localId === selectedAnchorId);
            const categoryColor = getCategoryColor(anchor.category);
            const hasStrength =
              typeof anchor.threadStrength === 'number' && anchor.threadStrength > 0;
            const isLast = index === orderedAnchors.length - 1;

            return (
              <React.Fragment key={anchor.id}>
                <Pressable
                  testID={`v2-anchor-switcher-item-${anchor.id}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={`${anchor.intentionText}, category ${categoryLabel(
                    anchor.category
                  )}${isSelected ? ', currently selected' : ''}`}
                  onPress={() => {
                    onSelect(anchor.id);
                    onClose();
                  }}
                  style={({ pressed }) => [
                    styles.anchorRow,
                    isSelected && { backgroundColor: `${categoryColor}14` },
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={[styles.artworkRing, { borderColor: categoryColor }]}>
                    <CircularAnchorRenderer
                      {...anchorRenderProps(anchor)}
                      size={ARTWORK_SIZE - ARTWORK_RING * 2}
                      appearance="tinted"
                      accessibilityLabel={`${categoryLabel(anchor.category)} Anchor artwork`}
                    />
                  </View>

                  <View style={styles.anchorDetails}>
                    <Text numberOfLines={1} ellipsizeMode="tail" style={styles.anchorIntention}>
                      {anchor.intentionText}
                    </Text>
                    {/* DEFERRED: "Ready to release" note under the title. The per-Anchor Chart arc-complete flag is not readily accessible from the Anchor list this sheet receives. */}

                    <View style={styles.metaRow}>
                      <View style={[styles.categoryColumn, categoryColumnWidth > 0 && { width: categoryColumnWidth }]}>
                        <View style={styles.categoryLabelRow}>
                          <View style={[styles.dot, { backgroundColor: categoryColor }]} />
                          <Text numberOfLines={1} style={styles.categoryText}>
                            {categoryLabel(anchor.category)}
                          </Text>
                        </View>
                      </View>

                      {hasStrength ? (
                        <HandDrawnThreadLine
                          compact
                          width={THREAD_LINE_WIDTH}
                          percent={anchor.threadStrength as number}
                          color={categoryColor}
                          testID={`v2-anchor-switcher-thread-${anchor.id}`}
                          style={styles.threadLine}
                        />
                      ) : (
                        <Text numberOfLines={1} style={styles.metaText}>
                          Baseline not established
                        </Text>
                      )}
                    </View>
                  </View>

                  <View style={styles.checkContainer}>
                    {isSelected ? (
                      <Check size={18} color={colors.text.primary} strokeWidth={2.4} />
                    ) : null}
                  </View>
                </Pressable>
                {!isLast ? <View style={styles.divider} /> : null}
              </React.Fragment>
            );
          })}
        </ScrollView>
        <View
          pointerEvents="none"
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={styles.categoryMeasurement}
        >
          {categoryLabels.map((label) => (
            <Text
              key={label}
              numberOfLines={1}
              onTextLayout={handleCategoryLabelLayout}
              style={styles.categoryText}
            >
              {label}
            </Text>
          ))}
        </View>
      </SafeAreaView>
    </V2SheetModal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
    // The surface continues below the screen edge so the entrance spring's
    // overshoot never opens a gap; V2SheetModal caps the height at 80%.
    paddingBottom: spacing[7] + V2_SHEET_SKIRT,
    marginBottom: -V2_SHEET_SKIRT,
    flexShrink: 1,
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  handle: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 99,
    backgroundColor: colors.border.default,
    marginBottom: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingBottom: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  headerTextCol: {
    gap: 2,
    flex: 1,
  },
  title: {
    ...typography.headingSM,
    color: colors.text.primary,
  },
  subtitle: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  closeButton: {
    padding: spacing[1],
    borderRadius: radii.round,
  },
  scrollList: {
    marginTop: spacing[2],
  },
  scrollContent: {
    paddingBottom: spacing[3],
  },
  anchorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ARTWORK_GAP,
    minHeight: 56,
    paddingVertical: spacing[3],
    paddingHorizontal: ROW_SIDE_PADDING,
    borderRadius: radii.sm,
    backgroundColor: 'transparent',
  },
  // Inset to the text column so the rule does not run under the avatar.
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: ROW_SIDE_PADDING + ARTWORK_SIZE + ARTWORK_GAP,
    backgroundColor: colors.border.subtle,
  },
  pressed: {
    opacity: 0.72,
  },
  artworkRing: {
    width: ARTWORK_SIZE,
    height: ARTWORK_SIZE,
    borderRadius: ARTWORK_SIZE / 2,
    borderWidth: ARTWORK_RING,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  anchorDetails: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  anchorIntention: {
    ...typography.labelLG,
    color: colors.text.primary,
    fontWeight: '600',
    fontSize: 15,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  categoryColumn: {
    flexShrink: 0,
  },
  categoryLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: CATEGORY_DOT_GAP,
  },
  threadLine: {
    marginLeft: spacing[2],
    flexShrink: 0,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: radii.round,
  },
  categoryText: {
    ...typography.caption,
    color: colors.text.secondary,
    fontWeight: '500',
    fontSize: 12.5,
  },
  categoryMeasurement: {
    position: 'absolute',
    left: 0,
    top: 0,
    opacity: 0,
  },
  metaText: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 12.5,
    flexShrink: 1,
  },
  checkContainer: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
