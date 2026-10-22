import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet } from 'react-native';
import {
  AlphaType,
  BlendMode,
  Canvas,
  ClipOp,
  ColorType,
  FilterMode,
  MipmapMode,
  Picture,
  Skia,
  TileMode,
  type SkPicture,
  type SkShader,
} from '@shopify/react-native-skia';
import { useSharedValue } from 'react-native-reanimated';

import { colors } from '@/theme/colors';
import type { FlowLayout } from './flowLayout';
import { rng } from './motion';
import { INK_VISIBLE_BELOW, tornEdge } from './scenes/InkBoundary';
import { drawFrameContent, type FlowFrame } from './scenes/drawFrame';
import { CREAM_PALETTE, INK_PALETTE, type SceneContext } from './scenes/sceneTypes';
import { FlowFontCache, SkiaPainter } from './skiaPainter';

export interface FlowFrameSource {
  frame: FlowFrame;
  /** Y of the ink band's top edge in design px. At or beyond the screen it is not drawn. */
  boundary: number;
  /** When equal to the previous frame's key (and not undefined) nothing is re-recorded. */
  key?: string;
}

interface FlowCanvasProps {
  fonts: FlowFontCache;
  context: SceneContext;
  layout: FlowLayout;
  /** Called every animation frame; read from refs, do not allocate. */
  getFrame: () => FlowFrameSource;
  /** Fired once, right after the first picture has been handed to the canvas. */
  onFirstFrame?: () => void;
}

const GRAIN_SIZE = 128;

/** Paper grain: the same seeded noise tile as the prototype, soft-lit over everything. */
function createGrainShader(): SkShader | null {
  try {
    const random = rng(5);
    const bytes = new Uint8Array(GRAIN_SIZE * GRAIN_SIZE * 4);
    for (let i = 0; i < GRAIN_SIZE * GRAIN_SIZE; i += 1) {
      const v = 116 + Math.floor(random() * 44);
      bytes[i * 4] = v;
      bytes[i * 4 + 1] = v;
      bytes[i * 4 + 2] = v;
      bytes[i * 4 + 3] = 255;
    }
    const image = Skia.Image.MakeImage(
      { width: GRAIN_SIZE, height: GRAIN_SIZE, alphaType: AlphaType.Opaque, colorType: ColorType.RGBA_8888 },
      Skia.Data.fromBytes(bytes),
      GRAIN_SIZE * 4
    );
    return image
      ? image.makeShaderOptions(TileMode.Repeat, TileMode.Repeat, FilterMode.Linear, MipmapMode.None)
      : null;
  } catch {
    // Grain is texture, never content: a failure here must not break creation.
    return null;
  }
}

function emptyPicture(width: number, height: number): SkPicture {
  const recorder = Skia.PictureRecorder();
  recorder.beginRecording(Skia.XYWHRect(0, 0, width, height));
  return recorder.finishRecordingAsPicture();
}

/**
 * The cream/ink transformation canvas. Each animation frame the scene is recorded into an
 * SkPicture on the JS thread (a few hundred draw calls) and handed to a single <Picture>.
 * The content is painted twice — cream palette, then ink palette clipped to the torn boundary —
 * so one description of the scene yields the whole two-tone effect.
 *
 * DEFERRED: UI-thread recording (polish brief F3). Recording here is JS-thread work, but it only
 * happens while the scene changes: Style settles to a short-circuited 'style-rest' key and
 * Choose/seal/Home are 'choose-rest', so the canvas costs the JS thread nothing during the seal.
 * Moving the painter onto the UI thread would mean workletizing the whole scene graph and the font
 * cache; revisit if the FPS probe shows the Form beat dropping frames.
 */
export function FlowCanvas({ fonts, context, layout, getFrame, onFirstFrame }: FlowCanvasProps) {
  const picture = useSharedValue<SkPicture>(emptyPicture(layout.width, layout.height));
  const grain = useMemo(createGrainShader, []);
  const lastKeyRef = useRef<string | undefined>(undefined);
  const getFrameRef = useRef(getFrame);
  getFrameRef.current = getFrame;
  const onFirstFrameRef = useRef(onFirstFrame);
  onFirstFrameRef.current = onFirstFrame;
  const firstFrameFiredRef = useRef(false);

  useEffect(() => {
    let raf = 0;
    let alive = true;
    lastKeyRef.current = undefined;

    const grainPaint = Skia.Paint();
    if (grain) {
      grainPaint.setShader(grain);
      grainPaint.setBlendMode(BlendMode.SoftLight);
      grainPaint.setAlphaf(0.5);
    }
    const cream = Skia.Color(colors.creation.cream);
    const ink = Skia.Color(colors.creation.ink);
    const inkPaint = Skia.Paint();
    inkPaint.setColor(ink);
    inkPaint.setAntiAlias(true);
    const shadowPaint = Skia.Paint();
    shadowPaint.setColor(ink);
    shadowPaint.setAlphaf(0.14);
    shadowPaint.setAntiAlias(true);
    const creamPaint = Skia.Paint();
    creamPaint.setColor(cream);

    const { scale, offsetX, offsetY, width, height } = layout;
    // Visible design-space extent, so the paper and band reach every edge of the device.
    const left = -offsetX / scale - 20;
    const right = (width - offsetX) / scale + 20;
    const top = -offsetY / scale - 20;
    const bottom = (height - offsetY) / scale + 60;
    const bounds = Skia.XYWHRect(0, 0, width, height);

    const record = () => {
      if (!alive) return;
      raf = requestAnimationFrame(record);

      const source = getFrameRef.current();
      if (source.key !== undefined && source.key === lastKeyRef.current) return;
      lastKeyRef.current = source.key;

      const recorder = Skia.PictureRecorder();
      const canvas = recorder.beginRecording(bounds);
      canvas.drawPaint(creamPaint);
      canvas.translate(offsetX, offsetY);
      canvas.scale(scale, scale);

      const painter = new SkiaPainter(canvas, fonts);
      drawFrameContent(painter, CREAM_PALETTE, context, source.frame);

      if (source.boundary < INK_VISIBLE_BELOW) {
        const edgeBuilder = Skia.PathBuilder.Make();
        edgeBuilder.moveTo(left, bottom);
        for (let x = left; x <= right; x += 2) edgeBuilder.lineTo(x, source.boundary + tornEdge(x));
        edgeBuilder.lineTo(right, bottom);
        edgeBuilder.close();
        const edge = edgeBuilder.detach();

        // A faint ink copy of the edge, shifted up, reads as paper thickness.
        canvas.save();
        canvas.translate(0, -3.5);
        canvas.drawPath(edge, shadowPaint);
        canvas.restore();

        canvas.save();
        canvas.clipPath(edge, ClipOp.Intersect, true);
        canvas.drawRect(Skia.XYWHRect(left, top, right - left, bottom - top), inkPaint);
        drawFrameContent(painter, INK_PALETTE, context, source.frame);
        canvas.restore();
      }

      if (grain) {
        canvas.drawRect(Skia.XYWHRect(left, top, right - left, bottom - top), grainPaint);
      }

      picture.value = recorder.finishRecordingAsPicture();

      if (!firstFrameFiredRef.current) {
        firstFrameFiredRef.current = true;
        onFirstFrameRef.current?.();
      }
    };

    raf = requestAnimationFrame(record);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, [fonts, context, layout, grain, picture]);

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none" accessible={false}>
      <Picture picture={picture} />
    </Canvas>
  );
}
