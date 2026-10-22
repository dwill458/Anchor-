import React from 'react';
import type { ShareTemplateProps } from '../shareTypes';
import { environmentPalette, resolveEnvironmentGeometry, type EnvironmentKind } from '../environmentLayout';
import { getShareEnvironment } from '../shareEnvironments';
import { POSTER_INK, ShareBrandMark, ShareCanvas, useAssetGate } from './shared';
import { AnchorWithHalo, EditorialIntention, EnvironmentGround, IntentionLines, MetaLine, ShareWashes, brandWash, textWash } from './environmentParts';
import { detailsPalette } from '@/components/v2/anchors/anchorDetailsTokens';

/**
 * Style and Editorial are the same poster system: one curated environment per
 * creation style, the user's actual circular Anchor, the intention, and an
 * optional brand mark. Only the composition differs (`kind`).
 */
export function EnvironmentPoster({ kind, data, width, showMark, onAssetsReady }: ShareTemplateProps & { kind: EnvironmentKind }) {
  const env = getShareEnvironment(data.styleId);
  const palette = environmentPalette(env);
  const geo = resolveEnvironmentGeometry(env, kind, data, width);
  const mark = useAssetGate((env.source ? 1 : 0) + (data.imageUrl ? 1 : 0), onAssetsReady);
  const washes = [textWash(geo, palette), ...(showMark ? [brandWash(width, palette)] : [])];
  return (
    <ShareCanvas width={width} background={env.tone === 'dark' ? POSTER_INK : detailsPalette.cream}>
      <EnvironmentGround env={env} width={width} onLoad={mark} />
      <ShareWashes width={width} washes={washes} />
      <AnchorWithHalo data={data} diameter={geo.diameter} cx={geo.anchorCx} cy={geo.anchorCy} palette={palette} onImageLoad={mark} />
      {kind === 'editorial' ? (
        <>
          <EditorialIntention geo={geo} palette={palette} ink={env.ink} width={width} />
          <MetaLine geo={geo} palette={palette} width={width} color={palette.ink + 'BF'} />
        </>
      ) : (
        <>
          <IntentionLines geo={geo} palette={palette} />
          <MetaLine geo={geo} palette={palette} width={width} />
        </>
      )}
      {showMark ? <ShareBrandMark width={width} ground={palette.brand.ground} glow={palette.brand.wash} /> : null}
    </ShareCanvas>
  );
}
