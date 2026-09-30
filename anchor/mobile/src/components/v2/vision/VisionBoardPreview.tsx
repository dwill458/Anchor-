import React, { memo, useMemo, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { colors, typography } from '@/theme/v2';
import { BOARD_ATTACHMENT_ART, BOARD_DECOR_IMAGES, BOARD_FRAME_IMAGES, VISION_BOARD_IMAGES } from './board/visionBoardAssets';
import { BOARD_FRAME_ASPECT, BOARD_FRAME_WINDOW } from './board/visionBoardLayouts';

type Props = {
  tiles: readonly { id: string; imageUrl?: string | null }[];
  statement?: string;
  variant?: 'home' | 'details';
  accent?: string;
  onPress?: () => void;
  accessibilityLabel?: string;
  testID?: string;
  imageTestID?: string;
  statementTestID?: string;
};

/** Read-only window into the physical board. Shares the board's extracted
 * materials and frame apertures, without mounting its editing/drag machinery.
 * Three photographs per page keep the board legible on small phones. */
export const VisionBoardPreview = memo(function VisionBoardPreview({
  tiles, statement, variant = 'home', accent, onPress, accessibilityLabel = 'Open Vision',
  testID = 'vision-board-preview', imageTestID, statementTestID,
}: Props) {
  const { width: windowWidth } = useWindowDimensions();
  const [width, setWidth] = useState(Math.max(1, windowWidth - 48));
  const [page, setPage] = useState(0);
  const scroll = useRef<ScrollView>(null);
  const images = useMemo(() => tiles.filter(tile => tile.imageUrl?.trim()), [tiles]);
  const imagesPerPage = variant === 'home' ? 2 : 3;
  const pages = Math.max(1, Math.ceil(images.length / imagesPerPage));
  const height = width * (variant === 'details' ? 0.6 : 0.35);

  return (
    <View onLayout={event => setWidth(Math.max(1, event.nativeEvent.layout.width))}>
      <ScrollView ref={scroll} horizontal pagingEnabled showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={event => setPage(Math.round(event.nativeEvent.contentOffset.x / width))}
      style={[styles.viewport, variant === 'home' ? styles.homeViewport : null]}>
        {Array.from({ length: pages }, (_, boardPage) => {
          const photos = images.slice(boardPage * imagesPerPage, boardPage * imagesPerPage + imagesPerPage);
          return (
            <Pressable key={boardPage} testID={boardPage === 0 ? testID : `${testID}-page-${boardPage}`}
              accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} disabled={!onPress}
              style={({ pressed }) => [styles.board, variant === 'home' ? styles.homeBoard : null, { width, height: images.length ? height : undefined, minHeight: images.length ? height : 96 }, pressed && styles.pressed]}>
              <Image source={variant === 'home' ? BOARD_DECOR_IMAGES['scrap-light'] : VISION_BOARD_IMAGES.board} style={styles.fill} resizeMode="stretch" accessible={false} />
              {variant === 'details' ? <>
                <Image source={BOARD_DECOR_IMAGES['map-corner']} style={[styles.decor, { width: width * 0.38, height: height * 0.7, left: width * 0.04, top: height * 0.06 }]} resizeMode="contain" accessible={false} />
                <Image source={BOARD_DECOR_IMAGES['leaf-branch']} style={[styles.decor, { width: width * 0.19, height: height * 0.9, right: 0, bottom: 0 }]} resizeMode="contain" accessible={false} />
              </> : null}
              {photos.map((tile, index) => {
                const single = photos.length === 1;
                const photoWidth = width * (single ? (variant === 'home' ? 0.42 : 0.66) : variant === 'home' ? 0.4 : photos.length === 2 ? 0.51 : 0.44);
                const photoHeight = photoWidth / BOARD_FRAME_ASPECT.landscape;
                const aperture = BOARD_FRAME_WINDOW.landscape;
                const fastening = BOARD_ATTACHMENT_ART[variant === 'home' ? 'tape-top' : index % 2 ? 'pin' : 'tape-top'];
                return (
                  <View key={tile.id} pointerEvents="none" style={[styles.photo, {
                    width: photoWidth, height: photoHeight,
                    left: single ? width * (variant === 'home' ? 0.29 : 0.17) : width * (variant === 'home' ? 0.06 + index * 0.35 : photos.length === 2 ? 0.04 + index * 0.4 : 0.035 + index * 0.26),
                    top: height * (variant === 'home' ? (index === 1 ? 0.08 : 0.04) : (index === 1 ? 0.2 : 0.08)),
                    transform: [{ rotate: `${index % 2 ? (variant === 'home' ? 2 : 4) : (variant === 'home' ? -2 : -4)}deg` }],
                  }]}>
                    <Image testID={boardPage === 0 && index === 0 && imageTestID ? imageTestID : `${testID}-image-${boardPage * imagesPerPage + index}`}
                      source={{ uri: tile.imageUrl!.trim() }} resizeMode="cover" accessibilityIgnoresInvertColors
                      style={{ position: 'absolute', left: `${aperture.left * 100}%`, top: `${aperture.top * 100}%`, width: `${(aperture.right - aperture.left) * 100}%`, height: `${(aperture.bottom - aperture.top) * 100}%` }} />
                    <Image source={BOARD_FRAME_IMAGES.landscape} style={styles.fill} resizeMode="stretch" accessible={false} />
                    <Image source={fastening.source} accessible={false} resizeMode="contain" style={{
                      position: 'absolute', width: photoWidth * fastening.width, height: photoWidth * fastening.width / fastening.aspect,
                      left: photoWidth * (fastening.x - fastening.width / 2), top: -photoHeight * 0.035,
                    }} />
                  </View>
                );
              })}
              {statement ? (
                <View pointerEvents="none" style={[styles.paper, variant === 'home' ? styles.homePaper : null, images.length ? { position: 'absolute', bottom: height * 0.045, left: variant === 'home' ? width * 0.67 : width * 0.17, width: variant === 'home' ? width * 0.27 : width * 0.66 } : styles.textOnly]}>
                  {variant === 'details' ? <Image source={VISION_BOARD_IMAGES.intentionPaper} style={styles.fill} resizeMode="stretch" accessible={false} /> : null}
                  <Text testID={boardPage === 0 ? statementTestID : undefined} numberOfLines={variant === 'home' ? 2 : 3} style={[styles.statement, variant === 'home' ? styles.homeStatement : null]}>{statement}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
      {pages > 1 ? <View style={styles.dots}>
        {Array.from({ length: pages }, (_, index) => (
          <Pressable key={index} accessibilityRole="button" accessibilityLabel={`Vision board page ${index + 1} of ${pages}`}
            accessibilityState={{ selected: page === index }} hitSlop={8}
            onPress={() => { scroll.current?.scrollTo({ x: index * width, animated: false }); setPage(index); }}>
            <View style={[styles.dot, { backgroundColor: page === index ? accent ?? colors.text.secondary : colors.border.strong }]} />
          </Pressable>
        ))}
      </View> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  viewport: { borderRadius: 14, overflow: 'hidden' },
  homeViewport: { borderRadius: 0, overflow: 'visible' },
  board: { overflow: 'hidden', backgroundColor: colors.grouped },
  homeBoard: { backgroundColor: 'transparent' },
  fill: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  decor: { position: 'absolute' },
  photo: { position: 'absolute' },
  paper: { paddingHorizontal: 16, paddingVertical: 12 },
  homePaper: { paddingHorizontal: 7, paddingVertical: 4, borderRadius: 2, backgroundColor: '#EDE1CC' },
  textOnly: { margin: 16 },
  statement: { fontFamily: typography.displaySemiBold, fontSize: 16, lineHeight: 19, color: colors.text.primary, textAlign: 'center' },
  homeStatement: { fontFamily: 'Figtree-SemiBold', fontSize: 9, lineHeight: 12, color: '#19232B', textAlign: 'left' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: 10 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  pressed: { opacity: 0.88 },
});
