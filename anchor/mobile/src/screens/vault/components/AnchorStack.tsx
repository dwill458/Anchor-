/**
 * AnchorStack — Anchor 1.5 "Your anchors" horizontal chip row.
 *
 * Plain circular chips (sigil/image only) with a two-line name/category
 * label underneath. The current anchor gets a gilt highlight ring; the row
 * ends with a gilt outlined "New anchor" chip. See `09 Sanctuary Home.html`.
 */

import React from 'react';
import {
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors } from '@/theme';
import { withAlpha } from '@/utils/color';
import type { Anchor } from '@/types';
import { formatCategory, isAnchorReleased } from '../utils/anchorStateHelpers';
import { AnchorArtworkThumbnail } from './AnchorArtworkThumbnail';

const CHIP_SIZE = 60;
const CARD_WIDTH = 76;
const CARD_GAP = 14;

function shortName(intentionText: string): string {
  return intentionText.length > 14
    ? intentionText.slice(0, 12).trimEnd() + '…'
    : intentionText;
}

// ─── StackCard ────────────────────────────────────────────────────────────────

interface StackCardProps {
  anchor: Anchor;
  isActive: boolean;
  onPress: (id: string) => void;
}

const StackCard = React.memo<StackCardProps>(({ anchor, isActive, onPress }) => {
  const imageUrl = anchor.enhancedImageUrl;
  const sigilXml = anchor.reinforcedSigilSvg ?? anchor.baseSigilSvg;

  return (
    <TouchableOpacity
      style={styles.stackCard}
      onPress={() => onPress(anchor.id)}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${anchor.intentionText}, ${formatCategory(anchor.category)}`}
    >
      <View style={[styles.chip, isActive ? styles.chipActive : styles.chipInactive]}>
        <AnchorArtworkThumbnail
          imageUrl={imageUrl}
          sigilXml={sigilXml}
          imageStyle={styles.thumbImage}
          fallbackStyle={styles.sigilFallback}
          fallbackSize={30}
        />
      </View>
      <Text style={styles.cardName} numberOfLines={1}>{shortName(anchor.intentionText)}</Text>
      <Text style={styles.cardCategory} numberOfLines={1}>{formatCategory(anchor.category)}</Text>
    </TouchableOpacity>
  );
});

// ─── AddCard ──────────────────────────────────────────────────────────────────

const AddCard: React.FC<{ onPress: () => void }> = ({ onPress }) => (
  <TouchableOpacity
    style={styles.stackCard}
    onPress={onPress}
    activeOpacity={0.7}
    accessibilityRole="button"
    accessibilityLabel="Create new anchor"
  >
    <View style={[styles.chip, styles.addChip]}>
      <Text style={styles.addPlus}>+</Text>
    </View>
    <Text style={styles.addLabel} numberOfLines={1}>New anchor</Text>
  </TouchableOpacity>
);

const StackCardSeparator = () => <View style={styles.itemSeparator} />;

// ─── AnchorStack ─────────────────────────────────────────────────────────────

export interface AnchorStackProps {
  anchors: Anchor[];
  primaryAnchorId?: string | null;
  onAnchorPress: (id: string) => void;
  onAddPress: () => void;
  onViewAll: () => void;
}

export const AnchorStack: React.FC<AnchorStackProps> = ({
  anchors,
  primaryAnchorId,
  onAnchorPress,
  onAddPress,
  onViewAll,
}) => {
  const visibleAnchors = React.useMemo(
    () => anchors.filter((anchor) => !isAnchorReleased(anchor)),
    [anchors]
  );

  const handlePress = React.useCallback((id: string) => {
    onAnchorPress(id);
  }, [onAnchorPress]);

  const renderItem = React.useCallback(
    ({ item }: { item: Anchor }) => (
      <StackCard anchor={item} isActive={item.id === primaryAnchorId} onPress={handlePress} />
    ),
    [handlePress, primaryAnchorId],
  );

  const keyExtractor = React.useCallback((item: Anchor) => item.id, []);

  const renderFooter = React.useCallback(
    () => (
      <>
        <StackCardSeparator />
        <AddCard onPress={onAddPress} />
      </>
    ),
    [onAddPress],
  );

  return (
    <View style={styles.container}>
      {/* Section header */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionLabel}>Your anchors</Text>
        <TouchableOpacity onPress={onViewAll} activeOpacity={0.6}>
          <Text style={styles.sectionLink}>All Anchors →</Text>
        </TouchableOpacity>
      </View>

      {/* Scroll row */}
      <FlatList
        horizontal
        data={visibleAnchors}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ItemSeparatorComponent={StackCardSeparator}
        ListFooterComponent={renderFooter}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={5}
        removeClippedSubviews={Platform.OS === 'android'}
      />
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionLabel: {
    fontFamily: 'Cinzel-Regular',
    fontSize: 11,
    letterSpacing: 2.2,
    textTransform: 'uppercase',
    color: colors.anchor15.ash,
  },
  sectionLink: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: colors.anchor15.gilt,
  },
  scrollContent: {
    paddingRight: 2,
    alignItems: 'flex-start',
  },
  itemSeparator: {
    width: CARD_GAP,
  },
  stackCard: {
    width: CARD_WIDTH,
    alignItems: 'center',
    gap: 6,
  },
  chip: {
    width: CHIP_SIZE,
    height: CHIP_SIZE,
    borderRadius: CHIP_SIZE / 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0b1015',
  },
  chipActive: {
    borderWidth: 1.5,
    borderColor: colors.anchor15.gilt,
    shadowColor: colors.anchor15.gilt,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  chipInactive: {
    borderWidth: 1,
    borderColor: withAlpha(colors.anchor15.ash, 0.16),
  },
  thumbImage: {
    width: CHIP_SIZE,
    height: CHIP_SIZE,
  },
  sigilFallback: {
    width: CHIP_SIZE,
    height: CHIP_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardName: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    color: colors.anchor15.bone,
    textAlign: 'center',
  },
  cardCategory: {
    fontFamily: 'Inter-Regular',
    fontSize: 10,
    color: withAlpha(colors.anchor15.ash, 0.7),
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  addChip: {
    backgroundColor: withAlpha(colors.anchor15.gilt, 0.05),
    borderWidth: 1,
    borderColor: withAlpha(colors.anchor15.gilt, 0.62),
    shadowColor: colors.anchor15.gilt,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 3,
  },
  addPlus: {
    fontFamily: 'Inter-Regular',
    fontSize: 28,
    lineHeight: 30,
    color: colors.anchor15.giltBright,
    fontWeight: '300',
  },
  addLabel: {
    fontFamily: 'EBGaramond-Regular',
    fontSize: 14,
    color: withAlpha(colors.anchor15.bone, 0.78),
    textAlign: 'center',
  },
});
