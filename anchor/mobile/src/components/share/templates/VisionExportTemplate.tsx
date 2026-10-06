import React from 'react';
import { Image, View } from 'react-native';
import type { ShareTemplateProps } from '../shareTypes';
import {
  POSTER_INK,
  ShareAnchorDisc,
  ShareBrandMark,
  ShareCanvas,
  ShareIntention,
  ShareMetaLine,
  ShareScrim,
  intentionFontSize,
  shareHeight,
  useAssetGate,
} from './shared';

/** The user's own Vision, full bleed, with their Anchor set into it. */
export function VisionExportTemplate({ data, width, showMark, onAssetsReady }: ShareTemplateProps) {
  const h = shareHeight(width);
  const mark = useAssetGate(1 + (data.imageUrl ? 1 : 0), onAssetsReady);
  const diameter = width * 0.52;
  const discTop = h * 0.27;
  const textTop = discTop + diameter + h * 0.05;
  return (
    <ShareCanvas width={width} background={POSTER_INK}>
      {data.visionImageUrl ? (
        <Image
          source={{ uri: data.visionImageUrl }}
          resizeMode="cover"
          onLoad={mark}
          onError={mark}
          style={{ position: 'absolute', left: 0, top: 0, width, height: h }}
        />
      ) : null}
      {/* Light top, deeper toward the text: readable without flattening the Vision. */}
      <ShareScrim
        colors={['rgba(11,12,22,.28)', 'rgba(11,12,22,.12)', 'rgba(11,12,22,.5)', 'rgba(11,12,22,.84)']}
        locations={[0, 0.3, 0.7, 1]}
      />
      {/* A soft shadow disc seats the Anchor in the scene instead of leaving it pasted on top. */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: (width - diameter * 1.18) / 2,
          top: discTop - diameter * 0.09,
          width: diameter * 1.18,
          height: diameter * 1.18,
          borderRadius: diameter,
          backgroundColor: 'rgba(11,12,22,.34)',
        }}
      />
      <ShareAnchorDisc data={data} diameter={diameter} top={discTop} width={width} ring onImageLoad={mark} />
      <ShareIntention
        text={data.intention}
        width={width}
        top={textTop}
        shadow
        fontSize={intentionFontSize(data.intention, width, [[26, 74], [50, 60], [90, 50], [Infinity, 42]])}
      />
      <ShareMetaLine parts={[data.categoryLabel]} width={width} top={h * 0.835} />
      {showMark ? <ShareBrandMark width={width} /> : null}
    </ShareCanvas>
  );
}
