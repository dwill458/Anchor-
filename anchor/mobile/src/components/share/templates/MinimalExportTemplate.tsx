import React from 'react';
import type { ShareTemplateProps } from '../shareTypes';
import {
  POSTER_INK,
  ShareAnchorDisc,
  ShareBrandMark,
  ShareCanvas,
  ShareIntention,
  intentionFontSize,
  shareHeight,
  useAssetGate,
} from './shared';

/** A poster: dark field, the Anchor, the intention, a breadcrumb. Nothing else. */
export function MinimalExportTemplate({ data, width, showMark, onAssetsReady }: ShareTemplateProps) {
  const h = shareHeight(width);
  const mark = useAssetGate(data.imageUrl ? 1 : 0, onAssetsReady);
  const diameter = width * 0.72;
  const discTop = h * 0.2;
  return (
    <ShareCanvas width={width} background={POSTER_INK}>
      <ShareAnchorDisc data={data} diameter={diameter} top={discTop} width={width} onImageLoad={mark} />
      <ShareIntention
        text={data.intention}
        width={width}
        top={discTop + diameter + h * 0.055}
        fontSize={intentionFontSize(data.intention, width, [[26, 78], [50, 64], [90, 52], [Infinity, 44]])}
      />
      {showMark ? <ShareBrandMark width={width} logoTone="light" /> : null}
    </ShareCanvas>
  );
}
