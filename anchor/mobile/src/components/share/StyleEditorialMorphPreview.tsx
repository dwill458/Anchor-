import React, { memo, useMemo } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { environmentPalette, resolveEnvironmentGeometry } from './environmentLayout';
import { getShareEnvironment } from './shareEnvironments';
import type { ShareExportData } from './shareTypes';
import { detailsPalette } from '@/components/v2/anchors/anchorDetailsTokens';
import { POSTER_INK, ShareBrandMark, ShareCanvas, shareHeight } from './templates/shared';
import { AnchorWithHalo, EditorialIntention, EnvironmentGround, IntentionLines, MetaLine, ShareWashes, brandWash, textWash } from './templates/environmentParts';

type Props = {
  data: ShareExportData;
  width: number;
  showMark: boolean;
  /** 0 = Style, 1 = Editorial. */
  progress: SharedValue<number>;
};

/**
 * Preview-only. Style and Editorial share one environment image that never
 * reloads; moving between them slides and scales the same Anchor and crossfades
 * the typography. The exported PNG is rendered by the static templates instead.
 */
export const StyleEditorialMorphPreview = memo(function StyleEditorialMorphPreview({ data, width, showMark, progress }: Props) {
  const env = useMemo(() => getShareEnvironment(data.styleId), [data.styleId]);
  const palette = environmentPalette(env);
  const style = useMemo(() => resolveEnvironmentGeometry(env, 'style', data, width), [env, data, width]);
  const editorial = useMemo(() => resolveEnvironmentGeometry(env, 'editorial', data, width), [env, data, width]);

  const dx = editorial.anchorCx - style.anchorCx;
  const dy = editorial.anchorCy - style.anchorCy;
  const ratio = editorial.diameter / style.diameter;
  const height = shareHeight(width);

  // The Anchor is drawn once, at Style size, and moved/scaled around its own centre.
  const discStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: dx * progress.value },
      { translateY: dy * progress.value },
      { scale: 1 + (ratio - 1) * progress.value },
    ],
  }));
  const styleLayer = useAnimatedStyle(() => ({ opacity: 1 - progress.value }));
  const editorialLayer = useAnimatedStyle(() => ({ opacity: progress.value }));

  const brand = showMark ? [brandWash(width, palette)] : [];
  const fill = { position: 'absolute' as const, left: 0, top: 0, width, height };

  return (
    <ShareCanvas width={width} background={env.tone === 'dark' ? POSTER_INK : detailsPalette.cream}>
      <EnvironmentGround env={env} width={width} />
      <Animated.View pointerEvents="none" style={[fill, styleLayer]}>
        <ShareWashes width={width} washes={[textWash(style, palette), ...brand]} />
      </Animated.View>
      <Animated.View pointerEvents="none" style={[fill, editorialLayer]}>
        <ShareWashes width={width} washes={[textWash(editorial, palette), ...brand]} />
      </Animated.View>
      <Animated.View pointerEvents="none" style={[fill, discStyle]}>
        <AnchorWithHalo data={data} diameter={style.diameter} cx={style.anchorCx} cy={style.anchorCy} palette={palette} />
      </Animated.View>
      <Animated.View pointerEvents="none" style={[fill, styleLayer]}>
        <IntentionLines geo={style} palette={palette} />
        <MetaLine geo={style} palette={palette} width={width} />
      </Animated.View>
      <Animated.View pointerEvents="none" style={[fill, editorialLayer]}>
        <EditorialIntention geo={editorial} palette={palette} ink={env.ink} width={width} />
        <MetaLine geo={editorial} palette={palette} width={width} color={palette.ink + 'BF'} />
      </Animated.View>
      {showMark ? <ShareBrandMark width={width} ground={palette.brand.ground} glow={palette.brand.wash} /> : null}
      <View pointerEvents="none" style={fill} />
    </ShareCanvas>
  );
});
