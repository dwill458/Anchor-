import React, { memo, useEffect, useMemo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { Plus } from 'lucide-react-native';
import { typography } from '@/theme/v2';
import type { V2VisionTile } from '@/adapters/v2/vision';
import { BOARD_DECOR_IMAGES, VISION_BOARD_IMAGES } from './visionBoardAssets';
import {
  decorAspect, emptyBoardPlaceholderSlots, toSceneRect,
  type BoardDecorAsset, type BoardDecorItem, type BoardLayout, type Size,
} from './visionBoardLayouts';
import { boardRecomposeEasing, boardTiming, VISION_BOARD_MOTION as MOTION } from './visionBoardMotion';
import type { BoardRosterEntry } from './visionBoardReorder';
import type { BoardSlotRect, VisionBoardShared } from './useVisionBoardScene';
import { VisionBoardPhoto } from './VisionBoardPhoto';
import { VisionBoardIntentionCard, type VisionBoardCardArt } from './VisionBoardIntentionCard';

const DECOR_ASSETS = Object.keys(BOARD_DECOR_IMAGES) as BoardDecorAsset[];

/** One piece of ephemera. It moves with the composition and fades when a preset leaves it out. */
const DecorPiece = memo(function DecorPiece({ asset, item, scene, reduceMotion }: {
  asset: BoardDecorAsset; item: BoardDecorItem | null; scene: Size; reduceMotion: boolean;
}) {
  const target = item ? toSceneRect({ ...item, aspectRatio: decorAspect(item) }, scene) : null;
  const x = useSharedValue(target?.x ?? 0);
  const y = useSharedValue(target?.y ?? 0);
  const width = useSharedValue(target?.width ?? 0);
  const height = useSharedValue(target?.height ?? 0);
  const rotation = useSharedValue(target?.rotation ?? 0);
  const opacity = useSharedValue(item?.opacity ?? 0);
  useEffect(() => {
    const config = reduceMotion
      ? { duration: MOTION.reduced.recomposeMs }
      : { duration: MOTION.recompose.moveMs, easing: boardRecomposeEasing };
    if (target) {
      x.value = boardTiming(target.x, config);
      y.value = boardTiming(target.y, config);
      width.value = boardTiming(target.width, config);
      height.value = boardTiming(target.height, config);
      rotation.value = boardTiming(target.rotation, config);
    }
    opacity.value = boardTiming(item?.opacity ?? 0, config);
    // `target` is derived from item + scene.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item, scene.width, scene.height, reduceMotion]);
  const style = useAnimatedStyle(() => ({
    left: x.value, top: y.value, width: width.value, height: height.value, opacity: opacity.value,
    transform: [{ rotate: `${rotation.value}deg` }],
  }));
  return (
    <Animated.Image source={BOARD_DECOR_IMAGES[asset]} resizeMode="stretch" accessible={false}
      style={[styles.decor, { zIndex: item?.zIndex ?? 1 }, style]} />
  );
});

export type VisionBoardSceneProps = {
  scene: Size;
  roster: BoardRosterEntry<V2VisionTile>[];
  entering: ReadonlySet<string>;
  layout: BoardLayout;
  shared: VisionBoardShared;
  initialRectFor: (sceneId: string) => BoardSlotRect | null;
  intention: string;
  category?: string | null;
  art?: VisionBoardCardArt | null;
  reduceMotion: boolean;
  interactive?: boolean;
  dragEnabled?: boolean;
  onPhotoPress?: (sceneId: string) => void;
  onCardPress?: () => void;
  onBackgroundPress?: () => void;
  onDragActive?: (active: boolean) => void;
  onSwap?: () => void;
  onOrderCommit?: (order: string[]) => void;
  onPhotoExited?: (sceneId: string) => void;
  onMovePhoto?: (sceneId: string, direction: -1 | 1) => void;
  /** Empty board: tasteful placeholders where the first photos will go. */
  onAddPress?: () => void;
  anchorTestID?: string;
};

/**
 * The whole physical board as one coordinate space: linen and frame,
 * ephemera, photographs, and the Anchor card. It knows nothing about the
 * camera; whoever renders it moves the view it sits in.
 */
export const VisionBoardScene = memo(function VisionBoardScene({
  scene, roster, entering, layout, shared, initialRectFor, intention, category, art, reduceMotion,
  interactive = false, dragEnabled = false, onPhotoPress, onCardPress, onBackgroundPress, onDragActive, onSwap,
  onOrderCommit, onPhotoExited, onMovePhoto, onAddPress, anchorTestID,
}: VisionBoardSceneProps) {
  const cardRect = useMemo(() => toSceneRect(layout.card, scene), [layout.card, scene]);
  const decorByAsset = useMemo(() => new Map(layout.decor.map(item => [item.asset, item])), [layout.decor]);
  const activeCount = roster.filter(entry => !entry.exiting).length;
  const placeholders = useMemo(
    () => (activeCount === 0 && onAddPress ? emptyBoardPlaceholderSlots().map(slot => toSceneRect(slot, scene)) : []),
    [activeCount, onAddPress, scene],
  );

  return (
    <View style={{ width: scene.width, height: scene.height }}>
      <Image source={VISION_BOARD_IMAGES.board} resizeMode="stretch" accessible={false} style={styles.fill} />
      {onBackgroundPress ? (
        <Pressable style={styles.fill} onPress={onBackgroundPress} accessible={false} importantForAccessibility="no" />
      ) : null}
      {DECOR_ASSETS.map(asset => (
        <DecorPiece key={asset} asset={asset} item={decorByAsset.get(asset) ?? null} scene={scene} reduceMotion={reduceMotion} />
      ))}
      {placeholders.map((rect, index) => (
        <Pressable key={`placeholder-${index}`} onPress={onAddPress} accessibilityRole="button"
          accessibilityLabel={index === 0 ? 'Add an image to your Vision' : undefined}
          accessible={index === 0} importantForAccessibility={index === 0 ? 'yes' : 'no-hide-descendants'}
          style={[styles.placeholder, {
            left: rect.x, top: rect.y, width: rect.width, height: rect.height,
            transform: [{ rotate: `${rect.rotation}deg` }],
            borderRadius: scene.width * 0.012,
          }]}>
          <Plus size={scene.width * 0.05} color="rgba(58,48,36,0.55)" />
          {index === 0 ? <Text style={[styles.placeholderText, { fontSize: scene.width * 0.028 }]}>Add image</Text> : null}
        </Pressable>
      ))}
      {roster.map(({ tile, exiting }) => {
        const index = layout.photos.length ? roster.filter(entry => !entry.exiting).findIndex(entry => entry.tile.sceneId === tile.sceneId) : -1;
        return (
          <VisionBoardPhoto
            key={tile.sceneId}
            testID={`vision-board-photo-${tile.sceneId}`}
            sceneId={tile.sceneId}
            imageUrl={tile.imageUrl}
            accessibilityLabel={`Vision image ${index + 1} of ${activeCount}`}
            initialRect={initialRectFor(tile.sceneId)}
            entering={entering.has(tile.sceneId)}
            exiting={exiting}
            shared={shared}
            reduceMotion={reduceMotion}
            interactive={interactive}
            dragEnabled={dragEnabled}
            onPress={onPhotoPress}
            onDragActive={onDragActive}
            onSwap={onSwap}
            onOrderCommit={onOrderCommit}
            onExited={onPhotoExited}
            onMove={onMovePhoto}
            canMoveEarlier={index > 0}
            canMoveLater={index >= 0 && index < activeCount - 1}
          />
        );
      })}
      <VisionBoardIntentionCard rect={cardRect} intention={intention} category={category} art={art}
        reduceMotion={reduceMotion} onPress={interactive ? onCardPress : undefined} anchorTestID={anchorTestID} />
    </View>
  );
});

const styles = StyleSheet.create({
  fill: { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' },
  decor: { position: 'absolute' },
  placeholder: {
    position: 'absolute', alignItems: 'center', justifyContent: 'center', gap: 4,
    borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(58,48,36,0.35)', backgroundColor: 'rgba(255,250,240,0.28)',
    zIndex: 10,
  },
  placeholderText: { ...typography.labelMD, color: 'rgba(58,48,36,0.7)' },
});

