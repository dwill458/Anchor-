import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, ChevronRight, Search, X } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { SvgXml } from 'react-native-svg';
import type { Anchor } from '@/types';
import { OptimizedImage } from '@/components/common';
import { colors, spacing, typography } from '@/theme';
import { safeHaptics } from '@/utils/haptics';
import { useReduceMotionEnabled } from '@/hooks/useReduceMotionEnabled';

interface AnchorSelectorSheetProps {
  visible: boolean;
  anchors: Anchor[];
  selectedAnchorId?: string;
  nextRituals?: Record<string, string>;
  onSelect: (anchor: Anchor) => void;
  onClose: () => void;
}

const FEATURED_AVATAR_SIZE = 64;
const ROW_AVATAR_SIZE = 54;

function formatRecency(anchor: Anchor): string | null {
  const ts = Math.max(
    anchor.lastActivatedAt ? new Date(anchor.lastActivatedAt).getTime() : 0,
    anchor.chargedAt ? new Date(anchor.chargedAt).getTime() : 0
  );
  if (!ts || Number.isNaN(ts)) {
    if (anchor.isCharged) return 'Primed';
    return null;
  }
  const now = Date.now();
  const diffMs = Math.max(0, now - ts);
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHours < 1) return 'Practiced just now';
  if (diffHours < 24) return 'Practiced today';
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Practiced yesterday';
  if (diffDays < 7) return `Practiced ${diffDays}d ago`;
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `Practiced ${weeks}w ago`;
  }
  return null;
}

interface AnchorArtworkProps {
  anchor: Anchor;
  size: number;
  isSelecting?: boolean;
}

const AnchorArtwork: React.FC<AnchorArtworkProps> = React.memo(
  ({ anchor, size, isSelecting }) => {
    const reduceMotion = useReduceMotionEnabled();
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const sigil = anchor.reinforcedSigilSvg ?? anchor.baseSigilSvg;

    useEffect(() => {
      if (isSelecting && !reduceMotion) {
        Animated.sequence([
          Animated.timing(scaleAnim, {
            toValue: 1.05,
            duration: 120,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 140,
            useNativeDriver: true,
          }),
        ]).start();
      }
    }, [isSelecting, reduceMotion, scaleAnim]);

    return (
      <Animated.View
        style={[
          styles.artworkContainer,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: isSelecting
              ? colors.gold
              : 'rgba(217, 179, 108, 0.22)',
            transform: [{ scale: scaleAnim }],
          },
          isSelecting && styles.artworkContainerActive,
        ]}
      >
        {anchor.enhancedImageUrl ? (
          <OptimizedImage
            uri={anchor.enhancedImageUrl}
            style={{ width: size, height: size, borderRadius: size / 2 }}
            resizeMode="cover"
          />
        ) : sigil ? (
          <SvgXml xml={sigil} width={size * 0.62} height={size * 0.62} />
        ) : (
          <Text style={styles.artworkFallback}>◈</Text>
        )}
      </Animated.View>
    );
  }
);

interface AnchorRowProps {
  item: Anchor;
  selected: boolean;
  isSelecting: boolean;
  nextRitual?: string;
  onPress: (item: Anchor) => void;
}

const AnchorRow: React.FC<AnchorRowProps> = React.memo(
  ({ item, selected, isSelecting, nextRitual, onPress }) => {
    const recency = formatRecency(item);
    const category = item.category ? item.category.replace(/_/g, ' ') : 'Anchor';

    return (
      <TouchableOpacity
        onPress={() => onPress(item)}
        activeOpacity={0.76}
        style={[
          styles.row,
          selected && styles.rowSelected,
          isSelecting && styles.rowSelecting,
        ]}
        accessibilityRole="button"
        accessibilityLabel={`Select ${item.intentionText}`}
        accessibilityState={{ selected }}
      >
        <AnchorArtwork
          anchor={item}
          size={ROW_AVATAR_SIZE}
          isSelecting={isSelecting}
        />

        <View style={styles.rowBody}>
          <Text style={styles.rowIntention} numberOfLines={2}>
            {item.intentionText}
          </Text>
          <View style={styles.rowMetaLine}>
            <Text style={styles.rowCategory}>{category}</Text>
            {recency && (
              <>
                <Text style={styles.rowMetaDot}>·</Text>
                <Text style={styles.rowRecency}>{recency}</Text>
              </>
            )}
            {nextRitual && (
              <>
                <Text style={styles.rowMetaDot}>·</Text>
                <Text style={styles.rowTertiary}>{nextRitual}</Text>
              </>
            )}
          </View>
        </View>

        <View style={styles.rowRight}>
          {selected || isSelecting ? (
            <View style={styles.checkWrap}>
              <Check size={16} color={colors.gold} strokeWidth={2.4} />
            </View>
          ) : (
            <ChevronRight size={16} color="rgba(244, 239, 230, 0.28)" />
          )}
        </View>
      </TouchableOpacity>
    );
  }
);

export const AnchorSelectorSheet: React.FC<AnchorSelectorSheetProps> = ({
  visible,
  anchors,
  selectedAnchorId,
  nextRituals,
  onSelect,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const selectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!visible) {
      setQuery('');
      setSelectingId(null);
      if (selectTimerRef.current) {
        clearTimeout(selectTimerRef.current);
        selectTimerRef.current = null;
      }
    }
  }, [visible]);

  const currentAnchor = useMemo(() => {
    if (!selectedAnchorId) return anchors[0] ?? null;
    return anchors.find((a) => a.id === selectedAnchorId) ?? anchors[0] ?? null;
  }, [anchors, selectedAnchorId]);

  const filteredAnchors = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) {
      // Exclude current anchor from recent list if there's no search query
      if (currentAnchor) {
        return anchors.filter((a) => a.id !== currentAnchor.id);
      }
      return anchors;
    }
    return anchors.filter(
      (anchor) =>
        anchor.intentionText?.toLowerCase().includes(trimmed) ||
        anchor.category?.toLowerCase().includes(trimmed)
    );
  }, [anchors, currentAnchor, query]);

  const handleSelectAnchor = useCallback(
    (anchor: Anchor) => {
      safeHaptics.selection();
      setSelectingId(anchor.id);

      if (selectTimerRef.current) {
        clearTimeout(selectTimerRef.current);
      }

      selectTimerRef.current = setTimeout(() => {
        onSelect(anchor);
      }, 220);
    },
    [onSelect]
  );

  const renderItem = useCallback(
    ({ item }: { item: Anchor }) => (
      <AnchorRow
        item={item}
        selected={selectedAnchorId === item.id}
        isSelecting={selectingId === item.id}
        nextRitual={nextRituals?.[item.id]}
        onPress={handleSelectAnchor}
      />
    ),
    [handleSelectAnchor, nextRituals, selectedAnchorId, selectingId]
  );

  const isSearching = query.trim().length > 0;
  const currentRecency = currentAnchor ? formatRecency(currentAnchor) : null;
  const currentCategory = currentAnchor?.category
    ? currentAnchor.category.replace(/_/g, ' ')
    : 'Anchor';

  return (
    <Modal
      animationType={Platform.OS === 'android' ? 'none' : 'fade'}
      visible={visible}
      transparent
      statusBarTranslucent
      hardwareAccelerated
      presentationStyle={Platform.OS === 'ios' ? 'overFullScreen' : undefined}
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View
          style={[
            styles.sheetWrap,
            {
              paddingBottom: Math.max(spacing.lg, insets.bottom + spacing.sm),
            },
          ]}
          accessibilityViewIsModal={true}
        >
          {Platform.OS === 'ios' ? (
            <BlurView intensity={48} tint="dark" style={StyleSheet.absoluteFillObject} />
          ) : (
            <View style={[StyleSheet.absoluteFillObject, styles.androidSheetFill]} />
          )}

          <View style={styles.drag} />

          <View style={styles.header}>
            <Text style={styles.title}>CHOOSE YOUR ANCHOR</Text>
            <Text style={styles.subtitle}>Which intention are you returning to?</Text>
          </View>

          {/* FEATURED CURRENT ANCHOR (only if not actively searching) */}
          {!isSearching && currentAnchor && (
            <View style={styles.featuredSection}>
              <Text style={styles.sectionEyebrow}>CURRENT ANCHOR</Text>
              <TouchableOpacity
                activeOpacity={0.82}
                onPress={() => handleSelectAnchor(currentAnchor)}
                style={[
                  styles.featuredCard,
                  selectingId === currentAnchor.id && styles.featuredCardSelecting,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Select ${currentAnchor.intentionText}`}
                accessibilityState={{ selected: true }}
              >
                <AnchorArtwork
                  anchor={currentAnchor}
                  size={FEATURED_AVATAR_SIZE}
                  isSelecting={selectingId === currentAnchor.id}
                />

                <View style={styles.featuredBody}>
                  <Text style={styles.featuredIntention} numberOfLines={2}>
                    {currentAnchor.intentionText}
                  </Text>
                  <View style={styles.featuredMetaRow}>
                    <Text style={styles.featuredCategory}>{currentCategory}</Text>
                    {currentRecency && (
                      <>
                        <Text style={styles.rowMetaDot}>·</Text>
                        <Text style={styles.featuredRecency}>{currentRecency}</Text>
                      </>
                    )}
                  </View>
                </View>

                <View style={styles.featuredCheckWrap}>
                  <Check size={18} color={colors.gold} strokeWidth={2.4} />
                </View>
              </TouchableOpacity>
            </View>
          )}

          {/* SEARCH FIELD */}
          <View style={styles.searchContainer}>
            <Search
              size={16}
              color="rgba(244, 239, 230, 0.4)"
              style={styles.searchIcon}
            />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search your anchors"
              placeholderTextColor="rgba(244, 239, 230, 0.38)"
              style={styles.searchInput}
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
            {query.length > 0 && Platform.OS === 'android' && (
              <TouchableOpacity
                onPress={() => setQuery('')}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={styles.clearButton}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
              >
                <X size={15} color="rgba(244, 239, 230, 0.5)" />
              </TouchableOpacity>
            )}
          </View>

          {/* ANCHORS LIST */}
          <View style={styles.listSection}>
            <Text style={styles.sectionEyebrow}>
              {isSearching ? 'ALL MATCHES' : 'RECENT ANCHORS'}
            </Text>

            <FlatList
              data={filteredAnchors}
              keyExtractor={(item) => item.id}
              style={styles.list}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                <Text style={styles.emptyText}>
                  {isSearching ? 'No matching anchors.' : 'No other anchors yet.'}
                </Text>
              }
              renderItem={renderItem}
              removeClippedSubviews={Platform.OS === 'android'}
              maxToRenderPerBatch={8}
              windowSize={7}
              initialNumToRender={10}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(6, 9, 13, 0.68)',
  },
  sheetWrap: {
    maxHeight: '86%',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    overflow: 'hidden',
    borderTopWidth: 1,
    borderColor: 'rgba(217, 179, 108, 0.24)',
    backgroundColor: 'rgba(14, 19, 26, 0.96)',
    paddingHorizontal: spacing.lg,
    paddingTop: 12,
  },
  androidSheetFill: {
    backgroundColor: 'rgba(12, 17, 24, 0.98)',
  },
  drag: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 14,
    backgroundColor: 'rgba(244, 239, 230, 0.22)',
  },
  header: {
    marginBottom: 14,
  },
  title: {
    fontFamily: typography.fontFamily.serifSemiBold,
    fontSize: 18,
    letterSpacing: 1.3,
    color: colors.bone,
    textTransform: 'uppercase',
  },
  subtitle: {
    marginTop: 3,
    fontFamily: typography.fontFamily.sans,
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(244, 239, 230, 0.58)',
  },
  featuredSection: {
    marginBottom: 14,
  },
  sectionEyebrow: {
    fontFamily: typography.fontFamily.sansBold,
    fontSize: 9,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: 'rgba(217, 179, 108, 0.72)',
    marginBottom: 6,
  },
  featuredCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(217, 179, 108, 0.32)',
    backgroundColor: 'rgba(20, 27, 36, 0.88)',
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  featuredCardSelecting: {
    borderColor: colors.gold,
    backgroundColor: 'rgba(217, 179, 108, 0.12)',
  },
  featuredBody: {
    flex: 1,
    minWidth: 0,
  },
  featuredIntention: {
    fontFamily: typography.fontFamily.bodySerif,
    fontSize: 16,
    lineHeight: 21,
    color: colors.bone,
  },
  featuredMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  featuredCategory: {
    fontFamily: typography.fontFamily.sans,
    fontSize: 10,
    letterSpacing: 0.8,
    color: 'rgba(244, 239, 230, 0.48)',
    textTransform: 'uppercase',
  },
  featuredRecency: {
    fontFamily: typography.fontFamily.sans,
    fontSize: 10,
    color: 'rgba(244, 239, 230, 0.42)',
  },
  featuredCheckWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(217, 179, 108, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(244, 239, 230, 0.08)',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontFamily: typography.fontFamily.sans,
    fontSize: 13.5,
    color: colors.bone,
    paddingVertical: 0,
  },
  clearButton: {
    padding: 4,
  },
  listSection: {
    flex: 1,
    minHeight: 160,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: spacing.md,
    gap: 8,
  },
  row: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(244, 239, 230, 0.06)',
    backgroundColor: 'rgba(244, 239, 230, 0.025)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowSelected: {
    borderColor: 'rgba(217, 179, 108, 0.35)',
    backgroundColor: 'rgba(217, 179, 108, 0.07)',
  },
  rowSelecting: {
    borderColor: colors.gold,
    backgroundColor: 'rgba(217, 179, 108, 0.12)',
  },
  artworkContainer: {
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10, 14, 20, 0.94)',
    flexShrink: 0,
  },
  artworkContainerActive: {
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 6,
    elevation: 3,
  },
  artworkFallback: {
    color: colors.gold,
    fontFamily: typography.fontFamily.serif,
    fontSize: 18,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  rowIntention: {
    fontFamily: typography.fontFamily.serifSemiBold,
    fontSize: 14,
    lineHeight: 18,
    color: colors.bone,
  },
  rowMetaLine: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
    flexWrap: 'wrap',
  },
  rowCategory: {
    fontFamily: typography.fontFamily.sans,
    fontSize: 10,
    letterSpacing: 0.7,
    color: 'rgba(244, 239, 230, 0.44)',
    textTransform: 'uppercase',
  },
  rowMetaDot: {
    marginHorizontal: 4,
    fontSize: 10,
    color: 'rgba(244, 239, 230, 0.28)',
  },
  rowRecency: {
    fontFamily: typography.fontFamily.sans,
    fontSize: 10,
    color: 'rgba(244, 239, 230, 0.38)',
  },
  rowTertiary: {
    fontFamily: typography.fontFamily.sans,
    fontSize: 10,
    color: 'rgba(217, 179, 108, 0.65)',
  },
  rowRight: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    width: 22,
  },
  checkWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(217, 179, 108, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontFamily: typography.fontFamily.sans,
    fontSize: 12.5,
    color: 'rgba(244, 239, 230, 0.38)',
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
});
