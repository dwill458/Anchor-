import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronDown } from 'lucide-react-native';

import { OptimizedImage, SigilSvg } from '@/components/common';
import { colors, typography } from '@/theme';
import type { Anchor } from '@/types';
import { useReduceMotionEnabled } from '@/hooks/useReduceMotionEnabled';

function anchorDisplayName(anchor?: Anchor) {
  return (anchor as { identityAnchor?: string })?.identityAnchor || anchor?.intentionText?.trim() || 'Select an anchor';
}

// This card renders category as raw enum text (no shared label map exists
// yet). Only override the two renamed categories; everything else keeps its
// existing raw-text behavior.
const CATEGORY_LABEL_OVERRIDES: Partial<Record<string, string>> = {
  desire: 'ambition',
  abundance: 'wealth',
};

function anchorMetadata(anchor?: Anchor) {
  const category = anchor?.category?.trim();
  if (!category) return 'Personal Anchor';
  return CATEGORY_LABEL_OVERRIDES[category] ?? category;
}

export const PracticeOverviewCard: React.FC<{
  anchor?: Anchor;
  onOpenAnchor: () => void;
}> = ({ anchor, onOpenAnchor }) => {
  const reduceMotion = useReduceMotionEnabled();
  const sigil = anchor?.reinforcedSigilSvg ?? anchor?.baseSigilSvg ?? '';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Current anchor, ${anchorDisplayName(anchor)}. Double tap to choose another anchor.`}
      accessibilityHint="Double tap to choose another anchor for practice."
      onPress={onOpenAnchor}
      style={({ pressed }) => [styles.card, pressed && !reduceMotion && styles.pressed]}
    >
      <View style={styles.sigil}>
        {anchor?.enhancedImageUrl ? (
          <OptimizedImage uri={anchor.enhancedImageUrl} style={styles.image} resizeMode="cover" />
        ) : sigil ? (
          <SigilSvg xml={sigil} width={30} height={30} />
        ) : (
          <Text style={styles.fallback}>◈</Text>
        )}
      </View>
      <View style={styles.anchorCopy}>
        <Text style={styles.eyebrow}>CURRENT ANCHOR</Text>
        <Text style={styles.anchorName} numberOfLines={1}>
          {anchorDisplayName(anchor)}
        </Text>
        <View style={styles.metadataRow}>
          <Text style={styles.anchorMetadata} numberOfLines={1}>
            {anchorMetadata(anchor)}
          </Text>
          <ChevronDown size={11} color="rgba(139,131,155,0.85)" />
        </View>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    minHeight: 64,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  pressed: {
    opacity: 0.78,
  },
  sigil: {
    width: 44,
    height: 44,
    borderRadius: 22,
    flexShrink: 0,
    overflow: 'hidden',
    backgroundColor: '#121820',
    borderWidth: 1,
    borderColor: 'rgba(139,131,155,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: 44,
    height: 44,
  },
  fallback: {
    color: colors.gold,
    fontSize: 20,
  },
  anchorCopy: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    fontFamily: typography.fontFamily.serifSemiBold,
    fontSize: 11,
    letterSpacing: 2.2,
    color: '#8B839B',
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  anchorName: {
    fontFamily: typography.fontFamily.serifSemiBold,
    fontSize: 19,
    letterSpacing: 1.2,
    color: '#F4EFE6',
    textTransform: 'uppercase',
  },
  metadataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 3,
  },
  anchorMetadata: {
    fontFamily: typography.fontFamily.sans,
    fontSize: 12,
    letterSpacing: 0.3,
    color: 'rgba(139,131,155,0.85)',
  },
});

