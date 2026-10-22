import { memo, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutRectangle } from 'react-native';
import Animated, { FadeIn, FadeOut, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { Plus } from 'lucide-react-native';

import type { V2VisionTile } from '@/adapters/v2/vision';
import { toSceneRect, type BoardLayout, type Size } from './visionBoardLayouts';

import type { BoardRosterEntry } from './visionBoardReorder';
import type { BoardSlotRect, VisionBoardShared } from './useVisionBoardScene';
import { VisionBoardPhoto } from './VisionBoardPhoto';
import { VisionBoardIntentionCard, type VisionBoardCardArt } from './VisionBoardIntentionCard';
import type { VisionNote } from '@/adapters/v2/vision';
import type { VisionFocal } from '../visionPhotoFocus';
import { VISION_SLOT_COUNT, slotLabel } from './visionBoardSlots';
import { VisionBoardNoteElement } from './VisionBoardNoteElement';
import { VisionNoteRenderer } from '@/components/v2/vision/notes/VisionNoteRenderer';
import { visionNoteZIndex } from '@/components/v2/vision/notes/visionNotePlacement';

/** Positions the board is asking the person to choose from, and what a tap on one does. Vision board only. */
export type VisionSlotOverlay = {
  slots: ReadonlyArray<{ slot: number; kind: 'empty' | 'occupied' }>;
  /** `subtle` while arranging; `strong` while a position is being chosen for an add or a move. */
  emphasis: 'subtle' | 'strong';
  onPress: (slot: number) => void;
};

type SlotRect = { x: number; y: number; width: number; height: number; rotation: number };

/** An empty position: a faint dashed outline and a plus where a photograph could go. */
function EmptySlotMarker({ rect, slot, emphasis, onPress }: { rect: SlotRect; slot: number; emphasis: 'subtle' | 'strong'; onPress: (slot: number) => void }) {
  const strong = emphasis === 'strong';
  return (
    <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(140)}
      style={{ position: 'absolute', left: rect.x, top: rect.y, width: rect.width, height: rect.height, transform: [{ rotate: `${rect.rotation}deg` }], zIndex: 6 }}>
      <Pressable testID={`vision-board-slot-${slot}`} accessibilityRole="button" accessibilityLabel={`Add a photo to ${slotLabel(slot)}`}
        onPress={() => onPress(slot)} style={[styles.slot, strong ? styles.slotStrong : styles.slotSubtle]}>
        <View style={[styles.slotPlus, strong && styles.slotPlusStrong]}>
          <Plus size={Math.max(18, Math.min(rect.width, rect.height) * 0.16)} color={strong ? '#6B5330' : '#8D7C63'} strokeWidth={1.6} />
        </View>
        {strong ? <Text allowFontScaling={false} style={[styles.slotNumber, { fontSize: Math.max(14, rect.width * 0.07) }]}>{slot + 1}</Text> : null}
      </Pressable>
    </Animated.View>
  );
}

/** A tap target over an occupied position while the person is choosing where a photograph moves. */
function OccupiedSlotTarget({ rect, slot, onPress }: { rect: SlotRect; slot: number; onPress: (slot: number) => void }) {
  return (
    <Pressable testID={`vision-board-slot-${slot}`} accessibilityRole="button" accessibilityLabel={`Swap with the photo in ${slotLabel(slot)}`} onPress={() => onPress(slot)}
      style={{ position: 'absolute', left: rect.x, top: rect.y, width: rect.width, height: rect.height, transform: [{ rotate: `${rect.rotation}deg` }], zIndex: 36,
        borderWidth: 2, borderColor: 'rgba(176,138,74,0.7)', borderStyle: 'dashed', borderRadius: 3 }} />
  );
}

export type VisionBoardSceneProps = {
  /**
   * Vision board only: the photographs by slot (`''` for an empty one), so each print keeps its own position.
   * Absent, photographs fill the layout's slots in roster order, as Visualize and the share image expect.
   */
  slotOrder?: readonly string[];
  /** On-screen size of the scene at rest (scene px to points). Switches on the board's caption sizing. */
  displayScale?: number;
  focals?: Readonly<Record<string, VisionFocal>>;
  repositioningId?: string | null;
  onFocalCommit?: (sceneId: string, focal: VisionFocal) => void;
  slotOverlay?: VisionSlotOverlay;
  onMoveRequest?: (sceneId: string) => void;
  /**
   * The size notes are positioned against. A note's saved position is a fraction of the board, so on the Vision board it
   * keeps using the count-based height it was placed on: arranging or opening the board to every position never moves it.
   */
  noteScene?: Size;
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
  scene, roster, entering, layout, shared, initialRectFor, intention, slotOrder, displayScale, focals, repositioningId = null, onFocalCommit, slotOverlay, onMoveRequest, noteScene, category, art, reduceMotion, arrivingSceneId, arrivingNoteId, notes = [], selectedNoteId = null, onNoteSelect, onNotePresentationChange, materialMode = 'legacy',
  interactive = false, dragEnabled = false, onPhotoPress, onCaptionEdit, onPhotoAssetReady, onPhotoAssetError, onCardPress, onBackgroundPress, onDragActive, onNoteDragActive, onSwap,
  onOrderCommit, onPhotoExited, onMovePhoto, onAddPress, anchorTestID, showAnchorMark = true, showIntentionCard = true, notesOpacity, intentionCardOpacity, markAppearance, detailEdges, edgeDarken, cinematic, onTeachingMotionChange,
}: VisionBoardSceneProps) {
  const activeCount = roster.filter(entry => !entry.exiting).length;
  const cardRect = useMemo(() => toSceneRect(layout.card, scene), [layout.card, scene]);
  const noteSize = noteScene ?? scene;
  const noteFadeStyle = useAnimatedStyle(() => ({ opacity: notesOpacity?.value ?? 1 }));
  const cardFadeStyle = useAnimatedStyle(() => ({ opacity: intentionCardOpacity?.value ?? 1 }));
  const renderedNotes = [...notes].filter(note => !note.isArchived).sort((a, b) => a.presentation.layerOrder - b.presentation.layerOrder).map(note =>
    onNoteSelect && onNotePresentationChange ? <VisionBoardNoteElement materialMode={materialMode} key={note.id} note={note} arriving={arrivingNoteId === note.id} sceneWidth={noteSize.width} sceneHeight={noteSize.height}
      cameraScale={shared.cameraScale} onDragActive={onNoteDragActive} reduceMotion={reduceMotion} selected={selectedNoteId === note.id} onSelect={onNoteSelect} onPresentationChange={onNotePresentationChange} /> :
      <VisionNoteRenderer materialMode={materialMode} key={note.id} styleId={note.presentation.styleId} fontId={note.presentation.fontId} text={note.content.text} width={noteSize.width} height={noteSize.height}
      presentation={{ ...note.presentation, layerOrder: visionNoteZIndex(note.presentation.layerOrder) }} scrollText />);
  return (
    <View style={{ width: scene.width, height: scene.height }}>
      {onBackgroundPress ? <Pressable style={styles.fill} onPress={onBackgroundPress} accessible={false} /> : null}
      {notesOpacity ? <Animated.View pointerEvents="none" style={[styles.fill, { zIndex: 20 }, noteFadeStyle]}>{renderedNotes}</Animated.View> : renderedNotes}
      {roster.filter(entry => entry.exiting || initialRectFor(entry.tile.sceneId) !== null).map(({ tile, exiting }) => {
        const index = slotOrder ? slotOrder.indexOf(tile.sceneId) : layout.photos.length ? roster.filter(entry => !entry.exiting).findIndex(entry => entry.tile.sceneId === tile.sceneId) : -1;
        return (
          <VisionBoardPhoto
            materialMode={materialMode}
            treatment={slotOrder && index >= 0 ? layout.photos[index]?.treatment : undefined}
            frameVariant={index === 3 ? 'wide-bottom' : index === 7 ? 'torn-bottom' : slotOrder ? 'classic' : index === 2 ? 'torn-bottom' : index === 1 ? 'rough-edge' : 'classic'}
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
            accessibilityLabel={slotOrder ? `Vision image in ${slotLabel(index)}` : `Vision image ${index + 1} of ${activeCount}`}
            displayScale={displayScale}
            focal={focals?.[tile.sceneId] ?? null}
            repositioning={repositioningId === tile.sceneId}
            onFocalCommit={onFocalCommit}
            onMoveRequest={slotOrder ? onMoveRequest : undefined}
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
            canMoveEarlier={!slotOrder && index > 0}
            canMoveLater={!slotOrder && index >= 0 && index < activeCount - 1}
          />
        );
      })}
      {slotOverlay ? slotOverlay.slots.filter(item => item.slot < VISION_SLOT_COUNT && layout.photos[item.slot]).map(item => {
        const rect = toSceneRect(layout.photos[item.slot], scene);
        return item.kind === 'empty'
          ? <EmptySlotMarker key={`slot-${item.slot}`} rect={rect} slot={item.slot} emphasis={slotOverlay.emphasis} onPress={slotOverlay.onPress} />
          : <OccupiedSlotTarget key={`slot-${item.slot}`} rect={rect} slot={item.slot} onPress={slotOverlay.onPress} />;
      }) : null}
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
  slot: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 3, borderStyle: 'dashed', borderWidth: 1.5 },
  slotSubtle: { borderColor: 'rgba(120,100,70,0.26)', backgroundColor: 'rgba(251,249,244,0.22)' },
  slotStrong: { borderColor: 'rgba(176,138,74,0.85)', backgroundColor: 'rgba(251,246,232,0.62)', borderWidth: 2 },
  slotPlus: { opacity: 0.8 },
  slotPlusStrong: { opacity: 1 },
  slotNumber: { position: 'absolute', bottom: 8, fontFamily: 'Inter-SemiBold', color: '#6B5330' },
});

