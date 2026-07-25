/**
 * AnchorStack — Horizontal scroll row of anchors.
 * Shows enhanced images when available, intention text as the label.
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
import type { Anchor } from '@/types';
import { hasIgnited, isAnchorReleased } from '../utils/anchorStateHelpers';
import { AnchorArtworkThumbnail } from './AnchorArtworkThumbnail';

const CARD_WIDTH = 80;
const CARD_GAP = 10;

// ─── StackCard ────────────────────────────────────────────────────────────────

interface StackCardProps {
  anchor: Anchor;
  onPress: (id: string) => void;
}

const StackCard = React.memo<StackCardProps>(({ anchor, onPress }) => {
  const imageUrl = anchor.enhancedImageUrl;
  const sigilXml = anchor.reinforcedSigilSvg ?? anchor.baseSigilSvg;
  // Truncate intention to ~18 chars so it fits the narrow card
  const label = anchor.intentionText.length > 18
    ? anchor.intentionText.slice(0, 16).trimEnd() + '…'
    : anchor.intentionText;

  return (
    <TouchableOpacity
      style={styles.stackCard}
      onPress={() => onPress(anchor.id)}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={anchor.intentionText}
    >
      <View style={styles.sigilThumb}>
        <AnchorArtworkThumbnail
          imageUrl={imageUrl}
          sigilXml={sigilXml}
          imageStyle={styles.thumbImage}
          fallbackStyle={styles.sigilFallback}
          fallbackSize={36}
        />
      </View>
      <Text style={styles.cardLabel} numberOfLines={2}>{label}</Text>
      <View style={[styles.statusDot, hasIgnited(anchor) ? styles.dotCharged : styles.dotUncharged]} />
    </TouchableOpacity>
  );
});

const StackCardSeparator = () => <View style={styles.itemSeparator} />;

// ─── AnchorStack ─────────────────────────────────────────────────────────────

export interface AnchorStackProps {
  anchors: Anchor[];
  onAnchorPress: (id: string) => void;
  onAddPress: () => void;
  onViewAll: () => void;
}

export const AnchorStack: React.FC<AnchorStackProps> = ({
  anchors,
  onAnchorPress,
  onAddPress: _onAddPress,
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
    ({ item }: { item: Anchor }) => <StackCard anchor={item} onPress={handlePress} />,
    [handlePress],
  );

  const keyExtractor = React.useCallback((item: Anchor) => item.id, []);

  const getItemLayout = React.useCallback(
    (_: ArrayLike<Anchor> | null | undefined, index: number) => ({
      length: CARD_WIDTH + CARD_GAP,
      offset: (CARD_WIDTH + CARD_GAP) * index,
      index,
    }),
    [],
  );

  return (
    <View style={styles.container}>
      {/* Section header */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionLabel}>YOUR ANCHORS</Text>
        <TouchableOpacity onPress={onViewAll} activeOpacity={0.6}>
          <Text style={styles.sectionLink}>View all →</Text>
        </TouchableOpacity>
      </View>

      {/* Scroll row */}
      <FlatList
        horizontal
        data={visibleAnchors}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ItemSeparatorComponent={StackCardSeparator}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        getItemLayout={getItemLayout}
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
    gap: 6,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionLabel: {
    fontFamily: 'Cinzel-Regular',
    fontSize: 9,
    letterSpacing: 2.2,
    color: 'rgba(212,175,55,0.38)',
    textTransform: 'uppercase',
  },
  sectionLink: {
    fontFamily: 'CormorantGaramond-Italic',
    fontSize: 12,
    color: 'rgba(192,192,192,0.4)',
  },
  scrollContent: {
    paddingRight: 2,
  },
  itemSeparator: {
    width: CARD_GAP,
  },
  stackCard: {
    width: CARD_WIDTH,
    backgroundColor: 'rgba(255,255,255,0.025)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.08)',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: 'center',
    gap: 4,
  },
  sigilThumb: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.2)',
    backgroundColor: '#0d1117',
  },
  thumbImage: {
    width: 48,
    height: 48,
  },
  sigilFallback: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardLabel: {
    fontFamily: 'CormorantGaramond-Italic',
    fontSize: 10,
    color: 'rgba(192,192,192,0.65)',
    textAlign: 'center',
    lineHeight: 13,
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  dotCharged: {
    backgroundColor: colors.gold,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 4,
  },
  dotUncharged: {
    backgroundColor: 'rgba(192,192,192,0.2)',
  },
  addCard: {
    width: 68,
    backgroundColor: 'rgba(212,175,55,0.03)',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(212,175,55,0.12)',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 12,
  },
  addPlus: {
    fontSize: 17,
    color: 'rgba(212,175,55,0.35)',
    lineHeight: 20,
  },
  addLabel: {
    fontFamily: 'Cinzel-Regular',
    fontSize: 7,
    letterSpacing: 1.4,
    color: 'rgba(212,175,55,0.28)',
    textTransform: 'uppercase',
  },
});
