import React, { useEffect } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { colors } from '@/theme/colors';
import type { RefineStyleOption } from '../../constants/refineStyles';
import { getAllStyles } from '../creationStyles';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../creationFlowConfig';
import type { Pt } from '../geometry';
import { StyleChip } from './StyleChip';

const SHEET_TOP = 236;
const TILE = { width: 104, height: 130 };
const COLUMNS = 3;

interface AllStylesSheetProps {
  open: boolean;
  selectedId: string;
  strokes: Pt[][];
  onPick: (style: RefineStyleOption) => void;
  onClose: () => void;
  reduceMotion?: boolean;
}

/**
 * Every shipped style (all 20, including the ones kept out of the three-chip rotation), in a
 * cream bottom sheet. Tapping a style selects it and closes the sheet; tapping outside closes it.
 */
export function AllStylesSheet({ open, selectedId, strokes, onPick, onClose, reduceMotion = false }: AllStylesSheetProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = reduceMotion
      ? open ? 1 : 0
      : withTiming(open ? 1 : 0, { duration: 260, easing: Easing.out(Easing.cubic) });
  }, [open, progress, reduceMotion]);

  const scrim = useAnimatedStyle(() => ({ opacity: progress.value }));
  const sheet = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.value) * (DESIGN_HEIGHT - SHEET_TOP + 20) }],
  }));

  const styles_ = getAllStyles();

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={open ? 'auto' : 'none'} accessibilityViewIsModal={open}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, scrim]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close all styles"
        />
      </Animated.View>

      <Animated.View style={[styles.sheet, sheet]}>
        <View style={styles.titleRow}>
          <Text style={styles.title} accessibilityRole="header">All styles</Text>
          <Pressable
            onPress={onClose}
            hitSlop={14}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Text style={styles.close}>×</Text>
          </Pressable>
        </View>

        <FlatList
          data={styles_}
          keyExtractor={(item) => item.id}
          numColumns={COLUMNS}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.row}
          renderItem={({ item }) => (
            <View style={styles.tile}>
              <StyleChip
                style={item}
                selected={item.id === selectedId}
                onPress={onPick}
                strokes={strokes}
                width={TILE.width - 6}
                height={TILE.height - 6}
              />
              <Text style={styles.name} numberOfLines={2}>{item.displayName}</Text>
            </View>
          )}
          ListFooterComponent={<Text style={styles.footer}>Tap a style to choose it.</Text>}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { backgroundColor: colors.creation.scrim },
  sheet: {
    position: 'absolute',
    left: 0,
    width: DESIGN_WIDTH,
    top: SHEET_TOP,
    height: DESIGN_HEIGHT - SHEET_TOP + 40,
    backgroundColor: colors.creation.cream,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 22,
    overflow: 'hidden',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    marginBottom: 14,
  },
  title: { fontFamily: 'EBGaramond-Regular', fontSize: 22, color: colors.creation.ink },
  close: { fontFamily: 'Figtree-Regular', fontSize: 28, lineHeight: 28, color: colors.creation.ink, opacity: 0.7 },
  grid: { paddingBottom: 80, paddingHorizontal: 27 },
  row: { gap: 12, marginBottom: 14 },
  tile: { width: TILE.width, minHeight: TILE.height + 36, alignItems: 'center' },
  name: {
    fontFamily: 'Figtree-Regular',
    fontSize: 12.5,
    lineHeight: 15,
    color: colors.creation.ink,
    opacity: 0.85,
    marginTop: 6,
    textAlign: 'center',
    width: TILE.width,
  },
  footer: {
    fontFamily: 'Figtree-Regular',
    fontSize: 12,
    color: colors.creation.ink,
    opacity: 0.5,
    textAlign: 'center',
    marginTop: 8,
  },
});
