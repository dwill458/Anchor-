import { memo, useMemo } from 'react';
import { Pressable, StyleSheet, View, type LayoutRectangle } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import type { V2VisionTile } from '@/adapters/v2/vision';
import { toSceneRect, type BoardLayout, type Size } from './visionBoardLayouts';

import type { BoardRosterEntry } from './visionBoardReorder';
import type { BoardSlotRect, VisionBoardShared } from './useVisionBoardScene';
import { VisionBoardPhoto } from './VisionBoardPhoto';
import { VisionBoardIntentionCard, type VisionBoardCardArt } from './VisionBoardIntentionCard';
import type { VisionNote } from '@/adapters/v2/vision';
import { VisionBoardNoteElement } from './VisionBoardNoteElement';
import { VisionNoteRenderer } from '@/components/v2/vision/notes/VisionNoteRenderer';
import { visionNoteZIndex } from '@/components/v2/vision/notes/visionNotePlacement';

export type VisionBoardSceneProps = {
  /** Opt in on Vision and setup only; cinematic/session callers keep their approved surfaces. */
  materialMode?: 'legacy' | 'photographic';
  arrivingNoteId?: string;
  arrivingSceneId?: string | null;
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
  notes?: readonly VisionNote[];
  selectedNoteId?: string | null;
  onNoteSelect?: (id: string) => void;
  onNotePresentationChange?: (id: string, presentation: VisionNote['presentation']) => Promise<boolean>;
  onNoteDragActive?: (active: boolean) => void;
  interactive?: boolean;
  dragEnabled?: boolean;
  onPhotoPress?: (sceneId: string) => void;
  onCaptionEdit?: (sceneId: string) => void;
  /** Share/export readiness signal when an image asset has finished decoding. */
  onPhotoAssetReady?: (sceneId: string) => void;
  onPhotoAssetError?: (sceneId: string) => void;
  onCardPress?: () => void;
  onBackgroundPress?: () => void;
  onDragActive?: (active: boolean) => void;
  onSwap?: () => void;
  onOrderCommit?: (order: string[]) => void;
  onPhotoExited?: (sceneId: string) => void;
  onTeachingMotionChange?: (sceneId: string, moving: boolean) => void;
  onMovePhoto?: (sceneId: string, direction: -1 | 1) => void;
  /** Empty board: tasteful placeholders where the first photos will go. */
  onAddPress?: () => void;
  anchorTestID?: string;
  showAnchorMark?: boolean;
  /** Photos-only presentation leaves the editable board's card and notes unchanged. */
  showIntentionCard?: boolean;
  notesOpacity?: SharedValue<number>;
  intentionCardOpacity?: SharedValue<number>;
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
  scene, roster, entering, layout, shared, initialRectFor, intention, category, art, reduceMotion, arrivingSceneId, arrivingNoteId, notes = [], selectedNoteId = null, onNoteSelect, onNotePresentationChange, materialMode = 'legacy',
  interactive = false, dragEnabled = false, onPhotoPress, onCaptionEdit, onPhotoAssetReady, onPhotoAssetError, onCardPress, onBackgroundPress, onDragActive, onNoteDragActive, onSwap,
  onOrderCommit, onPhotoExited, onMovePhoto, onAddPress, anchorTestID, showAnchorMark = true, showIntentionCard = true, notesOpacity, intentionCardOpacity, markAppearance, detailEdges, edgeDarken, cinematic, onTeachingMotionChange,
}: VisionBoardSceneProps) {
  const activeCount = roster.filter(entry => !entry.exiting).length;
  const cardRect = useMemo(() => toSceneRect(layout.card, scene), [layout.card, scene]);
  const noteFadeStyle = useAnimatedStyle(() => ({ opacity: notesOpacity?.value ?? 1 }));
  const cardFadeStyle = useAnimatedStyle(() => ({ opacity: intentionCardOpacity?.value ?? 1 }));
  const renderedNotes = [...notes].filter(note => !note.isArchived).sort((a, b) => a.presentation.layerOrder - b.presentation.layerOrder).map(note =>
    onNoteSelect && onNotePresentationChange ? <VisionBoardNoteElement materialMode={materialMode} key={note.id} note={note} arriving={arrivingNoteId === note.id} sceneWidth={scene.width} sceneHeight={scene.height}
      cameraScale={shared.cameraScale} onDragActive={onNoteDragActive} reduceMotion={reduceMotion} selected={selectedNoteId === note.id} onSelect={onNoteSelect} onPresentationChange={onNotePresentationChange} /> :
      <VisionNoteRenderer materialMode={materialMode} key={note.id} styleId={note.presentation.styleId} fontId={note.presentation.fontId} text={note.content.text} width={scene.width} height={scene.height}
      presentation={{ ...note.presentation, layerOrder: visionNoteZIndex(note.presentation.layerOrder) }} scrollText />);
  return (
    <View style={{ width: scene.width, height: scene.height }}>
      {onBackgroundPress ? <Pressable style={styles.fill} onPress={onBackgroundPress} accessible={false} /> : null}
      {notesOpacity ? <Animated.View pointerEvents="none" style={[styles.fill, { zIndex: 20 }, noteFadeStyle]}>{renderedNotes}</Animated.View> : renderedNotes}
      {roster.filter(entry => entry.exiting || initialRectFor(entry.tile.sceneId) !== null).map(({ tile, exiting }) => {
        const index = layout.photos.length ? roster.filter(entry => !entry.exiting).findIndex(entry => entry.tile.sceneId === tile.sceneId) : -1;
        return (
          <VisionBoardPhoto
            materialMode={materialMode}
            frameVariant={index === 3 ? 'wide-bottom' : index === 2 ? 'torn-bottom' : index === 1 ? 'rough-edge' : 'classic'}
            key={tile.sceneId}
            testID={`vision-board-photo-${tile.sceneId}`}
            tapes={index >= 0 ? layout.decor.filter(tape => tape.photo === index) : []}
            sceneId={tile.sceneId}
            imageUrl={tile.imageUrl}
            caption={tile.caption ?? undefined}
            arriving={interactive && tile.sceneId === arrivingSceneId}
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
            onCaptionEdit={onCaptionEdit}
            onPhotoAssetReady={onPhotoAssetReady}
            onPhotoAssetError={onPhotoAssetError}
            onDragActive={onDragActive}
            onSwap={onSwap}
            onOrderCommit={onOrderCommit}
            onExited={onPhotoExited}
            onTeachingMotionChange={onTeachingMotionChange}
            onMove={onMovePhoto}
            canMoveEarlier={index > 0}
            canMoveLater={index >= 0 && index < activeCount - 1}
          />
        );
      })}
      {showIntentionCard ? <Animated.View pointerEvents={interactive ? 'box-none' : 'none'} style={[styles.fill, { zIndex: 40 }, cardFadeStyle]}><VisionBoardIntentionCard rect={cardRect} intention={intention} category={category} art={art}
        onTeachingMotionChange={onTeachingMotionChange}
        reduceMotion={reduceMotion} onPress={interactive ? onCardPress : undefined} anchorTestID={anchorTestID} markAppearance={cinematic?.bridgeOpacity ? 'paper' : markAppearance}
        hideMark={!showAnchorMark || (Boolean(cinematic) && !cinematic?.bridgeOpacity)} onMarkLayout={cinematic?.onMarkLayout}
        paperOpacity={cinematic?.bridgeOpacity ?? cinematic?.paperOpacity} pinOpacity={cinematic?.pinOpacity} /></Animated.View> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  fill: { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' },
});

