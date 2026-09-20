import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Check, X } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CircularAnchorRenderer } from '@/components/v2';
import { anchorArtworkSvg, categoryLabel } from '@/components/v2/anchors/anchorPresentation';
import { colors, getCategoryColor, radii, spacing, typography } from '@/theme/v2';
import type { Anchor } from '@/types';

type Props = {
  visible: boolean;
  anchors: Anchor[];
  selectedAnchorId?: string | null;
  onSelect: (anchorId: string) => void;
  onClose: () => void;
  testID?: string;
};

export function V2AnchorSwitcherSheet({
  visible,
  anchors,
  selectedAnchorId,
  onSelect,
  onClose,
  testID = 'v2-anchor-switcher-sheet',
}: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      testID={testID}
    >
      <Pressable
        style={styles.scrim}
        accessibilityRole="button"
        accessibilityLabel="Close anchor switcher"
        onPress={onClose}
      />

      <SafeAreaView edges={['bottom']} style={styles.sheet}>
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

        <ScrollView
          style={styles.scrollList}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {anchors.map((anchor, index) => {
            const isSelected =
              anchor.id === selectedAnchorId ||
              Boolean(anchor.localId && anchor.localId === selectedAnchorId);
            const categoryColor = getCategoryColor(anchor.category);
            const hasStrength =
              typeof anchor.threadStrength === 'number' && anchor.threadStrength > 0;
            const isLast = index === anchors.length - 1;

            return (
              <Pressable
                key={anchor.id}
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
                  !isLast && styles.anchorRowSeparator,
                  isSelected && styles.anchorRowSelected,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.artworkContainer}>
                  <CircularAnchorRenderer
                    svg={anchorArtworkSvg(anchor)}
                    imageUrl={anchor.enhancedImageUrl}
                    category={anchor.category}
                    size="thumbnail"
                    accessibilityLabel={`${categoryLabel(anchor.category)} Anchor artwork`}
                  />
                </View>

                <View style={styles.anchorDetails}>
                  <Text numberOfLines={1} style={styles.anchorIntention}>
                    {anchor.intentionText}
                  </Text>

                  <View style={styles.metaRow}>
                    <View style={styles.categoryBadge}>
                      <View style={[styles.dot, { backgroundColor: categoryColor }]} />
                      <Text style={styles.categoryText}>
                        {categoryLabel(anchor.category)}
                      </Text>
                    </View>

                    <Text style={styles.metaDot}>·</Text>

                    {hasStrength ? (
                      <Text style={styles.metaText}>
                        Thread Strength{' '}
                        <Text style={[styles.strengthValue, { color: categoryColor }]}>
                          {anchor.threadStrength}%
                        </Text>
                      </Text>
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
            );
          })}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(23, 23, 20, 0.38)',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: spacing[4],
    paddingTop: spacing[2],
    paddingBottom: spacing[5],
    maxHeight: '75%',
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
    marginBottom: spacing[3],
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[1],
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
    gap: spacing[3],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[2],
    borderRadius: radii.md,
    backgroundColor: 'transparent',
  },
  anchorRowSeparator: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.subtle,
  },
  anchorRowSelected: {
    backgroundColor: 'rgba(0, 0, 0, 0.035)',
  },
  pressed: {
    opacity: 0.72,
  },
  artworkContainer: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
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
    gap: spacing[1],
    flexWrap: 'wrap',
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
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
  metaDot: {
    ...typography.caption,
    color: colors.text.disabled,
    fontSize: 12,
  },
  metaText: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 12.5,
    flexShrink: 1,
  },
  strengthValue: {
    ...typography.labelSM,
    fontWeight: '600',
    fontSize: 12.5,
  },
  checkContainer: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
