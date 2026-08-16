/**
 * AnchorStack — Anchor 1.5 "Your anchors" horizontal chip row.
 *
 * Plain circular chips (sigil/image only) with a two-line name/category
 * label underneath. The current anchor gets a gilt highlight ring; the row
 * ends with a gilt outlined "New anchor" chip. Matches `Sanctuary Home (Standalone).html`.
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
import Svg, { Path } from 'react-native-svg';
import { colors, typography } from '@/theme';
import { withAlpha } from '@/utils/color';
import type { Anchor } from '@/types';
import { formatCategory, isAnchorReleased } from '../utils/anchorStateHelpers';
import { MedallionCoin } from './MedallionCoin';
import { NewAnchorTile } from './NewAnchorTile';

const CHIP_SIZE = 60;
const CARD_WIDTH = 72;
const CARD_GAP = 18;

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
        <MedallionCoin
          size={CHIP_SIZE}
          imageUrl={imageUrl}
          sigilXml={sigilXml}
          showGlow={false}
          reduceMotionEnabled={true}
        />
      </View>
      <View style={styles.cardLabels}>
        <Text
          style={[
            styles.cardName,
            { color: isActive ? colors.anchor15.bone : 'rgba(244,239,230,0.8)' },
          ]}
          numberOfLines={1}
        >
          {shortName(anchor.intentionText)}
        </Text>
        <Text style={styles.cardCategory} numberOfLines={1}>
          {formatCategory(anchor.category)}
        </Text>
      </View>
    </TouchableOpacity>
  );
});

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

  const handlePress = React.useCallback(
    (id: string) => {
      onAnchorPress(id);
    },
    [onAnchorPress]
  );

  const renderItem = React.useCallback(
    ({ item }: { item: Anchor }) => (
      <StackCard anchor={item} isActive={item.id === primaryAnchorId} onPress={handlePress} />
    ),
    [handlePress, primaryAnchorId]
  );

  const keyExtractor = React.useCallback((item: Anchor) => item.id, []);

  const renderFooter = React.useCallback(
    () => (
      <>
        <StackCardSeparator />
        <NewAnchorTile onPress={onAddPress} />
      </>
    ),
    [onAddPress]
  );

  return (
    <View style={styles.container}>
      {/* Section header */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionLabel}>YOUR ANCHORS</Text>
        <TouchableOpacity onPress={onViewAll} activeOpacity={0.6}>
          <Text style={styles.sectionLink}>All Anchors →</Text>
        </TouchableOpacity>
      </View>

      {/* Zero anchor empty state vs Horizontal Scroll Rail */}
      {visibleAnchors.length === 0 ? (
        <TouchableOpacity
          onPress={onAddPress}
          activeOpacity={0.8}
          style={styles.emptyCreateButton}
          accessibilityRole="button"
          accessibilityLabel="Create New Anchor"
        >
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
            <Path
              d="M12 4v16M4 12h16"
              stroke="#D4AF37"
              strokeWidth={1.8}
              strokeLinecap="round"
            />
          </Svg>
          <Text style={styles.emptyCreateLabel}>CREATE NEW ANCHOR</Text>
        </TouchableOpacity>
      ) : (
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
      )}
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    gap: 14,
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
    letterSpacing: 0.24,
    color: colors.anchor15.gilt,
  },
  scrollContent: {
    paddingRight: 10,
    alignItems: 'flex-start',
    paddingBottom: 10,
  },
  itemSeparator: {
    width: CARD_GAP,
  },
  stackCard: {
    width: CARD_WIDTH,
    alignItems: 'center',
    gap: 8,
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
  cardLabels: {
    alignItems: 'center',
    gap: 1,
    width: '100%',
  },
  cardName: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  cardCategory: {
    fontFamily: 'Inter-Regular',
    fontSize: 10,
    letterSpacing: 0.6,
    color: withAlpha(colors.anchor15.ash, 0.7),
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  emptyCreateButton: {
    height: 56,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D4AF37',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'transparent',
    marginTop: 4,
  },
  emptyCreateLabel: {
    fontFamily: typography.fontFamily.ritualSemiBold || 'Cinzel-SemiBold',
    fontSize: 13,
    letterSpacing: 0.78, // 0.06em
    color: '#D4AF37',
    textTransform: 'uppercase',
  },
});

