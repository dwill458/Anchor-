// @ts-nocheck
import React, { forwardRef } from 'react';
import { Image, Text, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { typography } from '@/theme';

export const EXPORT_DIMENSIONS = {
  square:    { standard: { w: 1080, h: 1080 }, high: { w: 3240, h: 3240 } },
  wallpaper: { standard: { w: 1170, h: 2532 }, high: { w: 3510, h: 7596 } },
  print:     { standard: { w: 2400, h: 2400 }, high: { w: 7200, h: 7200 } },
};

type Props = {
  format: 'square' | 'wallpaper' | 'print';
  resolution: 'standard' | 'high';
  transparentBG: boolean;
  sigilSvg?: string;
  sigilUri?: string;
  intention?: string;
};

export const ExportPreviewRenderer = forwardRef<View, Props>(
  ({ format, resolution, transparentBG, sigilSvg, sigilUri, intention }, ref) => {
    const { w, h } = EXPORT_DIMENSIONS[format][resolution];
    const sigilSize = Math.round(Math.min(w, h) * 0.65);
    const intentionFontSize = Math.round(Math.min(w, h) * 0.028);
    const intentionPadding = Math.round(h * 0.06);

    return (
      <View
        ref={ref}
        collapsable={false}
        style={{
          position: 'absolute',
          left: -9999,
          top: -9999,
          width: w,
          height: h,
          backgroundColor: transparentBG ? 'transparent' : '#0F1419',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {sigilUri ? (
          <Image
            source={{ uri: sigilUri }}
            style={{ width: sigilSize, height: sigilSize, borderRadius: sigilSize / 2 }}
            resizeMode="cover"
          />
        ) : sigilSvg ? (
          <SvgXml xml={sigilSvg} width={sigilSize} height={sigilSize} />
        ) : null}

        {!!intention && (
          <Text
            style={{
              position: 'absolute',
              bottom: intentionPadding,
              left: Math.round(w * 0.1),
              right: Math.round(w * 0.1),
              fontFamily: typography.fonts.bodySerifItalic,
              fontSize: intentionFontSize,
              color: 'rgba(245,245,220,0.75)',
              textAlign: 'center',
              letterSpacing: intentionFontSize * 0.04,
            }}
          >
            {intention}
          </Text>
        )}
      </View>
    );
  }
);

ExportPreviewRenderer.displayName = 'ExportPreviewRenderer';
