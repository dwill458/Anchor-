import { memo, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { type AnimatedStyle } from 'react-native-reanimated';
import { ChevronRight } from 'lucide-react-native';
import { noteAssets } from '@/assets/vision/notes/noteAssets';
import { VisionPaperSurface } from './material/VisionPaperSurface';
import { VisionPhotoArtifact } from './material/VisionPhotoArtifact';
import { VISION_CAPTION_COLOR, VISION_CAPTION_FONTS, VISION_PHOTO, VISION_SHADOW } from './material/visionMaterialTokens';
import type { VisionEditorialTile } from './visionEditorialLayout';
import {
  VISION_PREVIEW_PRINT_ASPECT,
  VISION_PREVIEW_PRINT_LIMIT,
  visionItemCountLabel,
  visionPreviewCaption,
  visionPreviewItemCount,
  visionPreviewOverflow,
  visionPreviewPhotos,
  visionPreviewSeed,
  visionPrintSlots,
  visionStageHeight,
  type VisionPreviewCardVariant,
} from './visionPreviewCardModel';

export type { VisionPreviewCardVariant } from './visionPreviewCardModel';

const INK_MUTED = 'rgba(58, 46, 32, 0.62)';
const ROSE = '#CE6091';
const TORN_TINTS = ['#D5BC95', '#E4D6BB'] as const;
/** The card's warm cream sheet, a shade deeper than the page so the card reads as an object on it. */
const CARD_CREAM = '#F3E9D6';

export type VisionPreviewCardProps = {
  variant: VisionPreviewCardVariant;
  /** Vision tiles in canonical board order. Only tiles with an image URL become photographs. */
  tiles: readonly VisionEditorialTile[];
  /** Saved, displayable notes. Counted toward "items"; drawn by the full Vision board, not here. */
  noteCount?: number;
  featuredTileId?: string;
  /**
   * Header text. Defaults to "Your Vision" on Home and "Vision" elsewhere.
   * `null` hides the header row when the host already titles the section.
   */
  title?: string | null;
  /** The Vision's own statement, shown as a caption. */
  statement?: string | null;
  /** The Anchor intention the host already shows; a statement that repeats it is not captioned again. */
  intentionText?: string | null;
  /** Small dot before the caption (the Anchor's category colour). */
  accent?: string;
  onPress?: () => void;
  accessibilityLabel?: string;
  /** Accessible name of the item count on Home; it is part of the card's press target. */
  viewAllLabel?: string;
  testID?: string;
  /** testID of the featured (largest) photograph's image on Home and Details. */
  imageTestID?: string;
  statementTestID?: string;
  /** Animated style for the header row (Home's return arrival). */
  titleStyle?: StyleProp<ViewStyle> | AnimatedStyle<ViewStyle>;
};

/** Stable identity for a photograph: the tile id, falling back to its URL. */
const photoIdentity = (tile: VisionEditorialTile) => tile.id || tile.imageUrl || '';

/**
 * One compact Vision material card, shared by Home, Anchor Details and Progress.
 * It renders the real Vision: counts and photographs come from `tiles` and
 * `noteCount`, never from fixtures. Images are contained, never cropped, and a
 * failed or missing image falls back to neutral paper inside the print.
 */
export const VisionPreviewCard = memo(function VisionPreviewCard({
  variant, tiles, noteCount = 0, featuredTileId, title, statement, intentionText, accent = ROSE,
  onPress, accessibilityLabel, viewAllLabel, testID = 'vision-preview-card', imageTestID, statementTestID, titleStyle,
}: VisionPreviewCardProps) {
  const { width: windowWidth } = useWindowDimensions();
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(null);
  const width = measuredWidth ?? Math.max(1, windowWidth - 48);

  const photos = useMemo(() => visionPreviewPhotos(tiles, featuredTileId), [tiles, featuredTileId]);
  const photoCount = photos.length;
  const itemCount = visionPreviewItemCount(photoCount, noteCount);
  const countLabel = visionItemCountLabel(itemCount);
  const caption = visionPreviewCaption(statement, intentionText);
  const headerTitle = title === undefined ? (variant === 'home' ? 'Your Vision' : 'Vision') : title;
  const label = accessibilityLabel ?? 'View Vision';

  const card = (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Opens your full Vision board"
      disabled={!onPress}
      onPress={onPress}
      onLayout={event => {
        const next = Math.max(1, event.nativeEvent.layout.width);
        setMeasuredWidth(previous => (previous === next ? previous : next));
      }}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <VisionPaperSurface seed={visionPreviewSeed(`vision-card-${variant}`)} style={[StyleSheet.absoluteFill, { backgroundColor: CARD_CREAM }]} />
      {variant === 'progress' ? (
        <ProgressRow
          testID={testID}
          photos={photos}
          photoCount={photoCount}
          countLabel={countLabel}
        />
      ) : (
        <View style={styles.body}>
          {headerTitle !== null ? (
            <Animated.View style={[styles.header, titleStyle]}>
              <Text style={styles.title}>{headerTitle}</Text>
              <View accessible={false} accessibilityLabel={viewAllLabel} style={styles.countRow}>
                <Text style={styles.count}>{countLabel}</Text>
                <ChevronRight size={14} color={INK_MUTED} strokeWidth={2.2} />
              </View>
            </Animated.View>
          ) : null}
          <PrintStage
            testID={testID}
            photos={photos}
            photoCount={photoCount}
            width={width}
            imageTestID={imageTestID}
          />
          <View style={[styles.footer, caption ? styles.footerWithCaption : null]}>
            {/* The vision text sits beside the round control, never under it. */}
            {caption ? (
              <View style={styles.captionRow}>
                <View style={[styles.dot, { backgroundColor: accent }]} />
                <Text testID={statementTestID} numberOfLines={2} style={styles.caption}>{caption}</Text>
              </View>
            ) : null}
            {/* Without a caption the item count stands in for it on Details, and wherever the header is hidden. */}
            {!caption && (variant === 'details' || headerTitle === null) ? <Text style={styles.count}>{countLabel}</Text> : null}
            {!caption ? <View style={styles.footerSpacer} /> : null}
            {variant === 'details' ? (
              <View style={styles.linkRow}>
                <Text style={styles.link}>View Vision</Text>
                <ChevronRight size={14} color={VISION_CAPTION_COLOR} strokeWidth={2.2} />
              </View>
            ) : null}
            <View testID={`${testID}-chevron`} pointerEvents="none" accessible={false} style={styles.roundButton}>
              <ChevronRight size={20} color={VISION_CAPTION_COLOR} strokeWidth={2.2} />
            </View>
          </View>
        </View>
      )}
    </Pressable>
  );

  return (
    <View testID={`${testID}-container`} style={[styles.shadow, VISION_SHADOW.contact]}>
      {card}
    </View>
  );
});

/** The torn-paper backdrop and the taped prints. Nothing is drawn for an empty Vision. */
const PrintStage = memo(function PrintStage({ testID, photos, photoCount, width, imageTestID }: {
  testID: string; photos: ReturnType<typeof visionPreviewPhotos>; photoCount: number; width: number; imageTestID?: string;
}) {
  const prints = photos.slice(0, VISION_PREVIEW_PRINT_LIMIT);
  if (!prints.length) return null;
  const slots = visionPrintSlots(prints.length);
  const height = visionStageHeight(prints.length) * width;
  return (
    <View testID={`${testID}-stage`} style={{ height }}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {[
          { x: -0.05, y: 0.22, width: 0.62, height: 0.6, rotation: -3, tint: TORN_TINTS[0] },
          { x: 0.5, y: 0.14, width: 0.6, height: 0.62, rotation: 2, tint: TORN_TINTS[1] },
        ].map((piece, index) => (
          <View key={index} style={{ position: 'absolute', left: piece.x * width, top: piece.y * height,
            width: piece.width * width, height: piece.height * height, transform: [{ rotate: `${piece.rotation}deg` }] }}>
            <Image source={noteAssets.tornPaper} resizeMode="stretch"
              style={{ width: piece.width * width, height: piece.height * height, tintColor: piece.tint, opacity: 0.9 }} />
          </View>
        ))}
      </View>
      {prints.map((photo, index) => {
        const slot = slots[index];
        return (
          <View key={photo.tile.id} style={{ position: 'absolute', left: slot.x * width, top: slot.y * width,
            width: slot.width * width, zIndex: slot.zIndex }}>
            <VisionPhotoArtifact
              uri={photo.imageUrl}
              width={slot.width * width}
              aspectRatio={VISION_PREVIEW_PRINT_ASPECT}
              fit="cover"
              rotation={slot.rotation}
              tape
              tapeTone={index === 0 ? 'cream' : 'kraft'}
              seed={visionPreviewSeed(photoIdentity(photo.tile))}
              accessibilityLabel={`Vision photograph ${index + 1} of ${photoCount}`}
              testID={`${testID}-print-${photo.sourceIndex}`}
              imageTestID={index === 0 && imageTestID ? imageTestID : undefined}
            />
          </View>
        );
      })}
    </View>
  );
});

/** Progress: a horizontal row with up to three bordered thumbnails and an overflow tile. */
const ProgressRow = memo(function ProgressRow({ testID, photos, photoCount, countLabel }: {
  testID: string; photos: ReturnType<typeof visionPreviewPhotos>; photoCount: number; countLabel: string;
}) {
  const thumbs = photos.slice(0, VISION_PREVIEW_PRINT_LIMIT);
  const overflow = visionPreviewOverflow(photoCount, VISION_PREVIEW_PRINT_LIMIT);
  return (
    <View style={styles.progressRow}>
      <View style={styles.progressCopy}>
        <Text style={styles.title}>Vision</Text>
        <Text style={styles.count}>{countLabel}</Text>
      </View>
      {thumbs.length || overflow ? (
        <View style={styles.thumbRow} testID={`${testID}-thumbs`}>
          {thumbs.map((photo, index) => (
            <VisionThumb key={photo.tile.id} uri={photo.imageUrl} testID={`${testID}-thumb-${index}`} />
          ))}
          {overflow > 0 ? (
            <View testID={`${testID}-overflow`} accessible accessibilityLabel={`${overflow} more photographs`} style={[styles.thumb, styles.overflowTile]}>
              <Text style={styles.overflowText}>+{overflow}</Text>
            </View>
          ) : null}
        </View>
      ) : null}
      <ChevronRight size={16} color={VISION_CAPTION_COLOR} strokeWidth={2.2} />
    </View>
  );
});

/** A small bordered print. A missing or failed image shows neutral paper, never a broken frame. */
const VisionThumb = memo(function VisionThumb({ uri, testID }: { uri: string; testID: string }) {
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const failed = failedUri === uri;
  return (
    <View testID={testID} style={styles.thumb}>
      <VisionPaperSurface seed={visionPreviewSeed(uri)} style={StyleSheet.absoluteFill} />
      {!failed && uri ? (
        <Image testID={`${testID}-image`} source={{ uri }} resizeMode="cover" fadeDuration={0} accessible={false}
          onError={() => setFailedUri(uri)} style={StyleSheet.absoluteFill} />
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  shadow: { borderRadius: 16 },
  card: { borderRadius: 16, overflow: 'hidden', backgroundColor: CARD_CREAM, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(42, 30, 16, 0.12)' },
  pressed: { opacity: 0.92 },
  body: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 14 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  title: { fontFamily: VISION_CAPTION_FONTS.serif, fontSize: 17, lineHeight: 22, color: VISION_CAPTION_COLOR },
  countRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  count: { fontFamily: VISION_CAPTION_FONTS.sans, fontSize: 12, lineHeight: 16, color: INK_MUTED },
  // The footer draws above the prints, so the round control is never tucked behind a print that overhangs the stage.
  footer: { marginTop: -34, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, position: 'relative', zIndex: 10, elevation: 10 },
  footerWithCaption: { marginTop: 8 },
  footerSpacer: { flex: 1 },
  captionRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7, minWidth: 0 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  caption: { flex: 1, fontFamily: VISION_CAPTION_FONTS.serifItalic, fontSize: 14, lineHeight: 19, color: VISION_CAPTION_COLOR },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  link: { fontFamily: VISION_CAPTION_FONTS.sans, fontSize: 12, lineHeight: 16, color: VISION_CAPTION_COLOR },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  progressCopy: { flexShrink: 1, minWidth: 64 },
  thumbRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1, justifyContent: 'flex-end' },
  thumb: {
    width: 36, height: 36, borderRadius: 3, borderWidth: 1, borderColor: 'rgba(42, 30, 16, 0.2)',
    backgroundColor: VISION_PHOTO.mount, overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
    ...VISION_SHADOW.contact,
  },
  overflowTile: { backgroundColor: '#E6D7BD', borderColor: 'rgba(42, 30, 16, 0.12)' },
  overflowText: { fontFamily: VISION_CAPTION_FONTS.sans, fontSize: 12, color: VISION_CAPTION_COLOR },
  roundButton: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#FBF8F1', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#2A1E10', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.18, shadowRadius: 6, elevation: 6, zIndex: 11,
  },
});
