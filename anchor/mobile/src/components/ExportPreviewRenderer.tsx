// @ts-nocheck
import React, { forwardRef } from 'react';
import { Image, Text, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { detailsFonts, detailsPalette } from '@/components/v2/anchors/anchorDetailsTokens';

export const EXPORT_DIMENSIONS = {
  square:    { standard: { w: 1080, h: 1080 }, high: { w: 3240, h: 3240 } },
  wallpaper: { standard: { w: 1170, h: 2532 }, high: { w: 3510, h: 7596 } },
  print:     { standard: { w: 2400, h: 2400 }, high: { w: 7200, h: 7200 } },
};

export type ExportBackground = 'card' | 'clear';

/**
 * One layout for the export and its on-screen preview, in fractions of the
 * canvas, so what the sheet previews is what the PNG contains.
 * - Intention shown: the anchor sits high with the text beneath it.
 * - Intention hidden: the anchor is centred vertically, alone.
 */
export function resolveExportLayout(w: number, h: number, showIntention: boolean) {
  const anchor = Math.round(w * 0.62 * 10) / 10;
  const anchorTop = showIntention ? h * 0.18 : (h - anchor) / 2;
  return {
    anchor,
    anchorTop,
    textLeft: w * 0.08,
    textTop: anchorTop + anchor + h * 0.05,
    textWidth: w * 0.84,
    // Floor keeps the thumbnail legible; capture sizes are far above it.
    fontSize: Math.max(5.5, w * 0.085),
  };
}

export function exportTextColor(background: ExportBackground) {
  return background === 'card' ? detailsPalette.ink : detailsPalette.cream;
}

type Props = {
  format: 'square' | 'wallpaper' | 'print';
  resolution: 'standard' | 'high';
  /** Card is cream with ink text. Clear is a real alpha channel with light text. */
  background: ExportBackground;
  showIntention: boolean;
  sigilSvg?: string;
  sigilUri?: string;
  intention?: string;
};

export const ExportPreviewRenderer = forwardRef<View, Props>(
  ({ format, resolution, background, showIntention, sigilSvg, sigilUri, intention }, ref) => {
    const { w, h } = EXPORT_DIMENSIONS[format][resolution];
    const layout = resolveExportLayout(w, h, showIntention && !!intention);
    const sigilSize = Math.round(layout.anchor);
    const textBottomRoom = Math.max(0, h - layout.textTop - h * 0.04);

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
          backgroundColor: background === 'card' ? detailsPalette.cream : 'transparent',
        }}
      >
        <View
          style={{
            position: 'absolute',
            left: Math.round((w - sigilSize) / 2),
            top: Math.round(layout.anchorTop),
            width: sigilSize,
            height: sigilSize,
            borderRadius: sigilSize / 2,
            overflow: 'hidden',
          }}
        >
          {sigilUri ? (
            <Image
              source={{ uri: sigilUri }}
              style={{ width: sigilSize, height: sigilSize }}
              resizeMode="cover"
            />
          ) : sigilSvg ? (
            <SvgXml xml={sigilSvg} width={sigilSize} height={sigilSize} />
          ) : null}
        </View>

        {showIntention && !!intention && (
          <View
            style={{
              position: 'absolute',
              left: Math.round(layout.textLeft),
              top: Math.round(layout.textTop),
              width: Math.round(layout.textWidth),
              maxHeight: textBottomRoom,
            }}
          >
            <Text
              adjustsFontSizeToFit
              minimumFontScale={0.5}
              numberOfLines={4}
              style={{
                fontFamily: detailsFonts.serif,
                fontSize: Math.round(layout.fontSize),
                lineHeight: Math.round(layout.fontSize * 1.2),
                color: exportTextColor(background),
                textAlign: 'center',
              }}
            >
              {intention}
            </Text>
          </View>
        )}
      </View>
    );
  }
);

ExportPreviewRenderer.displayName = 'ExportPreviewRenderer';
