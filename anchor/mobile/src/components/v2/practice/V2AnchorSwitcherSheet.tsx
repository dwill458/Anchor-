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
          {anchors.map((anchor) => {
            const isSelected =
              anchor.id === selectedAnchorId ||
              Boolean(anchor.localId && anchor.localId === selectedAnchorId);
            const categoryColor = getCategoryColor(anchor.category);
            const hasStrength =
              typeof anchor.threadStrength === 'number' && anchor.threadStrength > 0;

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
                  isSelected && styles.anchorRowSelected,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.artworkContainer}>
                  <CircularAnchorRenderer
                    svg={anchorArtworkSvg(anchor)}
                    category={anchor.category}
                    size="thumbnail"
                    accessibilityLabel={`${categoryLabel(anchor.category)} Anchor sigil`}
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
                        Baseline not yet established
                      </Text>
                    )}
                  </View>
                </View>

                {isSelected ? (
                  <View style={styles.checkPill}>
                    <Check size={14} color="#FFFFFF" strokeWidth={2.6} />
                  </View>
                ) : (
                  <View style={styles.unselectedIndicator} />
                )}
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
    gap: spacing[2],
    paddingBottom: spacing[3],
  },
  anchorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[3],
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  anchorRowSelected: {
    backgroundColor: colors.grouped,
    borderColor: colors.text.primary,
  },
  pressed: {
    opacity: 0.75,
  },
  artworkContainer: {
    width: 44,
    height: 44,
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
  },
  metaDot: {
    ...typography.caption,
    color: colors.text.disabled,
  },
  metaText: {
    ...typography.caption,
    color: colors.text.secondary,
    flexShrink: 1,
  },
  strengthValue: {
    ...typography.labelSM,
    fontWeight: '700',
  },
  checkPill: {
    width: 22,
    height: 22,
    borderRadius: radii.round,
    backgroundColor: colors.text.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unselectedIndicator: {
    width: 22,
    height: 22,
    borderRadius: radii.round,
    borderWidth: 1.5,
    borderColor: colors.border.default,
  },
});
