import { memo, useMemo } from 'react';
import { Pressable, StyleSheet, View, type LayoutRectangle } from 'react-native';
import { type SharedValue } from 'react-native-reanimated';

import type { V2VisionTile } from '@/adapters/v2/vision';
import { toSceneRect, type BoardLayout, type Size } from './visionBoardLayouts';

import type { BoardRosterEntry } from './visionBoardReorder';
import type { BoardSlotRect, VisionBoardShared } from './useVisionBoardScene';
import { VisionBoardPhoto } from './VisionBoardPhoto';
import { VisionBoardIntentionCard, type VisionBoardCardArt } from './VisionBoardIntentionCard';

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
  markAppearance?: 'bare' | 'paper';
  detailEdges?: boolean;
  edgeDarken?: SharedValue<number>;
  cinematic?: {
    photoId: string;
    photoOpacity: SharedValue<number>;
    paperOpacity?: SharedValue<number>;
    pinOpacity?: SharedValue<number>;
    /** The set-up's paper medallion, kept visible at the start so the hand-off to the session's ink mark is a dissolve, not a swap. */
    bridgeOpacity?: SharedValue<number>;
    onMarkLayout: (rect: LayoutRectangle) => void;
  };
};

/**
 * The whole physical board as one coordinate space: linen and frame,
 * ephemera, photographs, and the Anchor card. It knows nothing about the
 * camera; whoever renders it moves the view it sits in.
 */
export const VisionBoardScene = memo(function VisionBoardScene({
  scene, roster, entering, layout, shared, initialRectFor, intention, category, art, reduceMotion,
  interactive = false, dragEnabled = false, onPhotoPress, onCardPress, onBackgroundPress, onDragActive, onSwap,
  onOrderCommit, onPhotoExited, onMovePhoto, onAddPress, anchorTestID, markAppearance, detailEdges, edgeDarken, cinematic,
}: VisionBoardSceneProps) {
  const activeCount = roster.filter(entry => !entry.exiting).length;
  const cardRect = useMemo(() => toSceneRect(layout.card, scene), [layout.card, scene]);
  return (
    <View style={{ width: scene.width, height: scene.height }}>
      {onBackgroundPress ? <Pressable style={styles.fill} onPress={onBackgroundPress} accessible={false} /> : null}
      {roster.filter(entry => entry.exiting || shared.order.value.includes(entry.tile.sceneId)).map(({ tile, exiting }) => {
        const index = layout.photos.length ? roster.filter(entry => !entry.exiting).findIndex(entry => entry.tile.sceneId === tile.sceneId) : -1;
        return (
          <VisionBoardPhoto
            key={tile.sceneId}
            testID={`vision-board-photo-${tile.sceneId}`}
            sceneId={tile.sceneId}
            imageUrl={tile.imageUrl}
            uploaded={tile.sourceType === 'USER_UPLOAD' || tile.sourceType === 'USER_CAMERA'}
            displayAspect={layout.photos[Math.max(0, index)]?.aspectRatio ?? 1.12}
            hero={index === 0}
            detailEdges={detailEdges}
            cinematicOpacity={cinematic?.photoId === tile.sceneId ? cinematic.photoOpacity : undefined}
            accessibilityLabel={`Vision image ${index + 1} of ${activeCount}`}
            initialRect={initialRectFor(tile.sceneId)}
            entering={entering.has(tile.sceneId)}
            exiting={exiting}
            shared={shared}
            reduceMotion={reduceMotion}
            edgeDarken={edgeDarken}
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
        reduceMotion={reduceMotion} onPress={interactive ? onCardPress : undefined} anchorTestID={anchorTestID} markAppearance={cinematic?.bridgeOpacity ? 'paper' : markAppearance}
        hideMark={Boolean(cinematic) && !cinematic?.bridgeOpacity} onMarkLayout={cinematic?.onMarkLayout}
        paperOpacity={cinematic?.bridgeOpacity ?? cinematic?.paperOpacity} pinOpacity={cinematic?.pinOpacity} />
    </View>
  );
});

const styles = StyleSheet.create({
  fill: { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' },
});
