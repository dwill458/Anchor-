import { memo, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useV2ReduceMotion } from '@/hooks/v2';
import { colors, typography } from '@/theme/v2';
import { editorialImageFit, editorialImageIdentity, getEditorialPhotoSlots, selectEditorialImages, type VisionEditorialTile } from './visionEditorialLayout';

// Small geometry cache avoids reframing prints when returning to the preview.
const imageAspects = new Map<string, number>();

/** Read-only composition slot. The Notes owner supplies its real styled renderer. */
export type VisionEditorialNoteElement = {
  id: string;
  render: (size: { width: number; height: number }) => ReactNode;
};

export type VisionEditorialPreviewProps = {
  tiles: readonly VisionEditorialTile[];
  variant?: 'home' | 'details';
  featuredTileId?: string;
  statement?: string;
  accent?: string;
  onPress?: () => void;
  accessibilityLabel?: string;
  testID?: string;
  imageTestID?: string;
  statementTestID?: string;
  noteElements?: readonly VisionEditorialNoteElement[];
  reduceMotion?: boolean;
};

const EditorialPrint = memo(function EditorialPrint({ uri, width, height, rotation, index, reduceMotion, testID }: {
  uri: string; width: number; height: number; rotation: number; index: number; reduceMotion: boolean; testID: string;
}) {
  const [loaded, setLoaded] = useState<{ uri: string; aspect: number } | null>(null);
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const [shownUri, setShownUri] = useState(uri);
  const identity = editorialImageIdentity(uri);
  const sameImage = editorialImageIdentity(shownUri) === identity;
  // Reuse the decoded source during signed-URL refreshes, as the full board does.
  // A failed old signing URL immediately falls through to the refreshed one.
  const displayUri = sameImage && failedUri !== shownUri ? shownUri : uri;
  const failed = failedUri === displayUri;
  useEffect(() => { if (!sameImage) setShownUri(uri); }, [uri, sameImage]);
  const aspect = loaded?.uri === displayUri ? loaded.aspect : imageAspects.get(identity) ?? 0;
  const printWidth = aspect > 0 ? Math.min(width, (height - 8) * aspect + 8) : width;
  const printHeight = aspect > 0 ? Math.min(height, (width - 8) / aspect + 8) : height;
  const fit = editorialImageFit(aspect, (printWidth - 8) / (printHeight - 8));
  const entrance = useMemo(() => reduceMotion ? undefined : FadeInDown.duration(260).delay(index * 65)
    .springify().damping(22).stiffness(210).mass(0.65), [reduceMotion, index]);
  return <Animated.View entering={entrance} style={{ width, height, justifyContent: 'center', alignItems: index === 0 ? 'flex-start' : 'center' }}>
    <View testID={`${testID}-print`} style={[styles.print, { width: printWidth, height: printHeight, transform: [{ rotate: `${rotation}deg` }] }]}>
    <View style={styles.aperture}>
      <View testID={`${testID}-placeholder`} style={styles.placeholder}>
        <Text style={styles.placeholderText}>{failed ? 'Image unavailable' : '·'}</Text>
      </View>
      {!failed ? <Image testID={testID} source={{ uri: displayUri }} resizeMode={fit}
        resizeMethod="resize" fadeDuration={0} accessible={false} accessibilityIgnoresInvertColors
        onLoad={event => {
          const { width: sourceWidth, height: sourceHeight } = event.nativeEvent.source;
          if (sourceWidth > 0 && sourceHeight > 0) {
            const next = sourceWidth / sourceHeight;
            if (imageAspects.size >= 128 && !imageAspects.has(identity)) imageAspects.delete(imageAspects.keys().next().value!);
            imageAspects.set(identity, next);
            setLoaded({ uri: displayUri, aspect: next });
          }
        }} onError={() => setFailedUri(displayUri)} style={styles.image} /> : null}
    </View>
    </View>
  </Animated.View>;
});

/** Miniature editorial composition; it never mounts the full board or its gestures. */
export const VisionEditorialPreview = memo(function VisionEditorialPreview({
  tiles, variant = 'home', featuredTileId, statement, accent, onPress,
  accessibilityLabel = 'View Vision', testID = 'vision-editorial-preview', imageTestID, statementTestID,
  noteElements = [], reduceMotion: motionOverride,
}: VisionEditorialPreviewProps) {
  const systemReduceMotion = useV2ReduceMotion();
  const reduceMotion = motionOverride ?? systemReduceMotion;
  const { width: windowWidth } = useWindowDimensions();
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(null);
  const width = measuredWidth ?? Math.max(1, windowWidth - 48);
  const photos = useMemo(() => selectEditorialImages(tiles, variant, featuredTileId), [tiles, variant, featuredTileId]);
  const slots = useMemo(() => getEditorialPhotoSlots(variant, photos.length), [variant, photos.length]);
  const stageHeight = width * (variant === 'home' ? 0.58 : 0.76);
  const notes = noteElements.slice(0, variant === 'home' ? 1 : 2);
  const noteWidth = (width - 32 - Math.max(0, notes.length - 1) * 12) / Math.max(1, notes.length);
  const noteHeight = variant === 'home' ? 100 : 112;
  const entrance = useMemo(() => reduceMotion ? undefined : FadeIn.duration(200), [reduceMotion]);
  const pressScale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: reduceMotion ? 1 : pressScale.value }] }));
  const imageCount = tiles.filter(tile => Boolean(tile.imageUrl?.trim())).length;
  return <View testID={`${testID}-container`}>
    <Animated.View style={pressStyle}>
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={accessibilityLabel}
      accessibilityHint="Opens your full Vision board" disabled={!onPress} onPress={onPress}
      onPressIn={() => { if (!reduceMotion) pressScale.value = withTiming(0.985, { duration: 100 }); }}
      onPressOut={() => { pressScale.value = reduceMotion ? 1 : withSpring(1, { damping: 22, stiffness: 240 }); }}
      onLayout={event => {
        const next = Math.max(1, event.nativeEvent.layout.width);
        setMeasuredWidth(previous => previous === next ? previous : next);
      }} style={({ pressed }) => [styles.paper, pressed && styles.pressed]}>
      {photos.length > 0 || notes.length === 0 ? <Animated.View entering={entrance} pointerEvents="none" accessible={false}
        style={[styles.stage, { height: stageHeight }]}>
        {photos.map((photo, index) => {
          const slot = slots[index];
          return <View key={photo.tile.id} style={{ position: 'absolute', left: slot.x * width, top: slot.y * stageHeight,
            width: slot.width * width, height: slot.height * stageHeight, zIndex: slot.zIndex }}>
            <EditorialPrint uri={photo.imageUrl} width={slot.width * width} height={slot.height * stageHeight}
              rotation={slot.rotation} index={index} reduceMotion={reduceMotion}
              testID={index === 0 && imageTestID ? imageTestID : `${testID}-image-${photo.sourceIndex}`} />
          </View>;
        })}
        {!photos.length ? <View style={styles.empty}><Text style={styles.emptyText}>Your Vision has no images yet</Text></View> : null}
      </Animated.View> : null}
      {notes.length ? <View pointerEvents="none" style={styles.notes}>{notes.map(note =>
        <View key={note.id} style={{ width: noteWidth, height: noteHeight, overflow: 'hidden' }}>{note.render({ width: noteWidth, height: noteHeight })}</View>,
      )}</View> : null}
      <View pointerEvents="none" style={styles.footer}>
        <Text style={styles.count}>{imageCount} {imageCount === 1 ? 'image' : 'images'}</Text>
        <Text style={styles.link}>View Vision <Text style={styles.arrow}> →</Text></Text>
      </View>
    </Pressable>
    </Animated.View>
    {statement ? <View pointerEvents="none" style={styles.caption}>
      {accent ? <View style={[styles.dot, { backgroundColor: accent }]} /> : null}
      <Text testID={statementTestID} numberOfLines={2} style={[styles.statement, { color: variant === 'home' ? colors.paper : colors.text.primary }]}>{statement}</Text>
    </View> : null}
  </View>;
});

const styles = StyleSheet.create({
  paper: { backgroundColor: colors.canvas, borderRadius: 12, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border.subtle },
  pressed: { opacity: 0.92 },
  stage: { overflow: 'hidden' },
  print: { padding: 4, backgroundColor: colors.paper, shadowColor: colors.ink.deep, shadowOpacity: 0.16, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  aperture: { flex: 1, overflow: 'hidden', backgroundColor: colors.grouped },
  image: { ...StyleSheet.absoluteFillObject },
  placeholder: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  placeholderText: { ...typography.caption, color: colors.text.secondary, textAlign: 'center', paddingHorizontal: 4 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
  emptyText: { ...typography.bodySM, color: colors.text.secondary },
  footer: { minHeight: 36, paddingHorizontal: 14, paddingVertical: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  count: { ...typography.caption, color: colors.text.secondary },
  link: { ...typography.caption, color: colors.text.primary },
  arrow: { fontSize: 18 },
  notes: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  caption: { minHeight: 32, paddingTop: 8, flexDirection: 'row', alignItems: 'center', gap: 7 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  statement: { ...typography.bodySM, flex: 1 },
});
