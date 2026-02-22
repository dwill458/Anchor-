import React, { useEffect, useMemo, useState } from 'react';
import {
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
import { BlurView } from 'expo-blur';
import { SvgXml } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Anchor } from '@/types';
import { OptimizedImage } from '@/components/common';
import { colors, spacing, typography } from '@/theme';

interface AnchorSelectorSheetProps {
  visible: boolean;
  anchors: Anchor[];
  selectedAnchorId?: string;
  nextRituals?: Record<string, string>;
  onSelect: (anchor: Anchor) => void;
  onClose: () => void;
}

const ITEM_AVATAR = 40;

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

  useEffect(() => {
    if (!visible) {
      setQuery('');
    }
  }, [visible]);

  const filtered = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return anchors;
    return anchors.filter((anchor) => anchor.intentionText.toLowerCase().includes(trimmed));
  }, [anchors, query]);

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
        <View style={[styles.sheetWrap, { paddingBottom: Math.max(spacing.xl, insets.bottom + spacing.md) }]}>
          {Platform.OS === 'ios' ? (
            <BlurView intensity={42} tint="dark" style={StyleSheet.absoluteFillObject} />
          ) : (
            <View style={[StyleSheet.absoluteFillObject, styles.androidSheetFill]} />
          )}
          <View style={styles.drag} />
          <Text style={styles.title}>Choose your anchor</Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search anchors"
            placeholderTextColor="rgba(192, 192, 192, 0.6)"
            style={styles.searchInput}
          />
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            style={styles.list}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={<Text style={styles.emptyText}>No anchors found.</Text>}
            renderItem={({ item }) => {
              const sigil = item.reinforcedSigilSvg ?? item.baseSigilSvg;
              const selected = selectedAnchorId === item.id;
              return (
                <TouchableOpacity
                  onPress={() => onSelect(item)}
                  activeOpacity={0.8}
                  style={[styles.row, selected && styles.rowSelected]}
                  accessibilityRole="button"
                  accessibilityLabel={`Select ${item.intentionText}`}
                >
                  <View style={styles.avatar}>
                    {item.enhancedImageUrl ? (
                      <OptimizedImage uri={item.enhancedImageUrl} style={styles.avatarImage} resizeMode="cover" />
                    ) : sigil ? (
                      <SvgXml xml={sigil} width={ITEM_AVATAR} height={ITEM_AVATAR} />
                    ) : (
                      <Text style={styles.fallback}>◈</Text>
                    )}
                  </View>
                  <View style={styles.rowBody}>
                    <Text style={styles.anchorName} numberOfLines={1}>
                      {item.intentionText}
                    </Text>
                    <Text style={styles.anchorMeta}>
                      {item.category.replace(/_/g, ' ')}
                    </Text>
                  </View>
                  {nextRituals?.[item.id] ? (
                    <View style={styles.nextRitualBadge}>
                      <Text style={styles.nextRitualText}>{nextRituals[item.id]}</Text>
                    </View>
                  ) : item.isCharged ? (
                    <View style={styles.chargedBadge}>
                      <Text style={styles.chargedText}>Charged</Text>
                    </View>
                  ) : null}
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'stretch',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.48)',
  },
  sheetWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    alignSelf: 'stretch',
    maxHeight: '82%',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    overflow: 'hidden',
    borderTopWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.24)',
    backgroundColor: 'rgba(10, 14, 20, 0.94)',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  androidSheetFill: {
    backgroundColor: 'rgba(10, 14, 20, 0.96)',
  },
  drag: {
    width: 46,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  title: {
    marginTop: spacing.md,
    marginBottom: spacing.md,
    fontFamily: typography.fontFamily.serifSemiBold,
    fontSize: 22,
    color: colors.text.primary,
  },
  searchInput: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    fontFamily: typography.fontFamily.sans,
    fontSize: 14,
    color: colors.text.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  list: {
    marginTop: spacing.md,
  },
  listContent: {
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  row: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rowSelected: {
    borderColor: 'rgba(212,175,55,0.42)',
    backgroundColor: 'rgba(212,175,55,0.1)',
  },
  avatar: {
    width: ITEM_AVATAR,
    height: ITEM_AVATAR,
    borderRadius: ITEM_AVATAR / 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  avatarImage: {
    width: ITEM_AVATAR,
    height: ITEM_AVATAR,
    borderRadius: ITEM_AVATAR / 2,
  },
  fallback: {
    color: colors.gold,
    fontFamily: typography.fontFamily.serif,
    fontSize: 16,
  },
  rowBody: {
    flex: 1,
  },
  anchorName: {
    fontFamily: typography.fontFamily.sansBold,
    fontSize: 14,
    color: colors.text.primary,
  },
  anchorMeta: {
    marginTop: 1,
    fontFamily: typography.fontFamily.sans,
    fontSize: 11,
    color: colors.text.tertiary,
    textTransform: 'capitalize',
  },
  chargedBadge: {
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.34)',
    backgroundColor: 'rgba(212,175,55,0.1)',
  },
  chargedText: {
    fontFamily: typography.fontFamily.sansBold,
    color: colors.gold,
    fontSize: 10,
  },
  nextRitualBadge: {
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  nextRitualText: {
    fontFamily: typography.fontFamily.sans,
    color: colors.text.secondary,
    fontSize: 10,
  },
  emptyText: {
    fontFamily: typography.fontFamily.sans,
    color: colors.text.secondary,
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },
});
