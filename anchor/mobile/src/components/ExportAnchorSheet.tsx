// @ts-nocheck
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SvgXml } from 'react-native-svg';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { safeHaptics } from '@/utils/haptics';
import {
  ExportPreviewRenderer,
  EXPORT_DIMENSIONS,
  exportTextColor,
  resolveExportLayout,
} from '@/components/ExportPreviewRenderer';
import { ExportSuccessModal } from '@/components/ExportSuccessModal';
import { useDownloadAnchor } from '@/hooks/useDownloadAnchor';
import { detailsFonts, detailsPalette } from '@/components/v2/anchors/anchorDetailsTokens';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const ENTER_MS = 300;
const EXIT_MS = 220;
const PREVIEW_HEIGHT = 108;
const CHECKER_TILE = 8;

const FORMAT_OPTIONS = [
  { key: 'square', label: 'Square', sub: '1:1' },
  { key: 'wallpaper', label: 'Wallpaper', sub: '9:16' },
  { key: 'print', label: 'Print', sub: '300 DPI' },
];

const BACKGROUND_OPTIONS = [
  { key: 'card', label: 'Card' },
  { key: 'clear', label: 'Clear' },
];

const INTENTION_OPTIONS = [
  { key: true, label: 'Text' },
  { key: false, label: 'None' },
];

type Props = {
  isVisible: boolean;
  onClose: () => void;
  sigilSvg?: string;
  sigilUri?: string;
  intention?: string;
  onExportComplete?: (uri: string) => void;
  /** Called with a one-line summary after a save; the host shows it (e.g. as a toast). Without it the sheet shows its own confirmation. */
  onSaved?: (summary: string) => void;
};

/** A selectable option: cream fill + ink text when selected, a faint cream wash otherwise. */
function Segment({ selected, onPress, label, sub, height = 44, style, testID }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={sub ? `${label}, ${sub}` : label}
      testID={testID}
      style={({ pressed }) => [
        styles.segment,
        { height, backgroundColor: selected ? detailsPalette.cream : detailsPalette.creamFaint },
        pressed && styles.pressed,
        style,
      ]}
    >
      <Text style={[styles.segmentLabel, { color: selected ? detailsPalette.ink : detailsPalette.cream }]}>
        {label}
      </Text>
      {sub ? (
        <Text style={[styles.segmentSub, { color: selected ? 'rgba(20,22,43,.66)' : detailsPalette.creamMuted }]}>
          {sub}
        </Text>
      ) : null}
    </Pressable>
  );
}

function Checkerboard({ width, height }) {
  const cols = Math.ceil(width / CHECKER_TILE);
  const rows = Math.ceil(height / CHECKER_TILE);
  const tiles = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      tiles.push(
        <View
          key={`${r}-${c}`}
          style={{
            position: 'absolute',
            left: c * CHECKER_TILE,
            top: r * CHECKER_TILE,
            width: CHECKER_TILE,
            height: CHECKER_TILE,
            backgroundColor: (r + c) % 2 === 0 ? detailsPalette.checkerDark : detailsPalette.checkerDarker,
          }}
        />,
      );
    }
  }
  return <View pointerEvents="none" style={StyleSheet.absoluteFill}>{tiles}</View>;
}

/** A live thumbnail built from the same layout the PNG uses. Clear shows a dark checkerboard. */
function ExportPreview({ format, resolution, background, showIntention, sigilSvg, sigilUri, intention }) {
  const { w, h } = EXPORT_DIMENSIONS[format][resolution];
  const pw = Math.round((PREVIEW_HEIGHT * w) / h);
  const layout = resolveExportLayout(pw, PREVIEW_HEIGHT, showIntention && !!intention);
  const size = layout.anchor;
  return (
    <View
      testID="export-preview"
      accessibilityLabel={`${format} preview, ${background === 'card' ? 'card' : 'transparent'} background, ${showIntention ? 'with intention' : 'anchor only'}`}
      style={[styles.preview, { width: pw, height: PREVIEW_HEIGHT }]}
    >
      {background === 'card' ? (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: detailsPalette.cream }]} />
      ) : (
        <Checkerboard width={pw} height={PREVIEW_HEIGHT} />
      )}
      <View
        style={{
          position: 'absolute',
          left: (pw - size) / 2,
          top: layout.anchorTop,
          width: size,
          height: size,
          borderRadius: size / 2,
          overflow: 'hidden',
          // Finished artwork is a full disc; a bare SVG mark stands on the canvas itself.
          backgroundColor: sigilUri ? '#0b0b10' : 'transparent',
        }}
      >
        {sigilUri ? (
          <Image source={{ uri: sigilUri }} style={{ width: size, height: size }} resizeMode="cover" />
        ) : sigilSvg ? (
          <SvgXml xml={sigilSvg} width={size} height={size} />
        ) : null}
      </View>
      {showIntention && !!intention ? (
        <Text
          numberOfLines={3}
          style={{
            position: 'absolute',
            left: layout.textLeft,
            top: layout.textTop,
            width: layout.textWidth,
            textAlign: 'center',
            fontFamily: detailsFonts.serif,
            fontSize: layout.fontSize,
            lineHeight: layout.fontSize * 1.2,
            color: exportTextColor(background),
          }}
        >
          {intention}
        </Text>
      ) : null}
    </View>
  );
}

export function ExportAnchorSheet({ isVisible, onClose, sigilSvg, sigilUri, intention, onExportComplete, onSaved }: Props) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  
  const [format, setFormat] = useState<'square' | 'wallpaper' | 'print'>('wallpaper');
  const [resolution, setResolution] = useState<'standard' | 'high'>('standard');
  const [background, setBackground] = useState<'card' | 'clear'>('card');
  const [showIntention, setShowIntention] = useState(true);
  const [showSuccess, setShowSuccess] = useState(false);

  const rendererRef = useRef(null);
  const { downloadAnchor, isLoading } = useDownloadAnchor();
  const openProgress = useSharedValue(0);

  useEffect(() => {
    if (isVisible) {
      openProgress.value = withTiming(1, { duration: ENTER_MS, easing: Easing.out(Easing.cubic) });
    } else {
      openProgress.value = withTiming(0, { duration: EXIT_MS, easing: Easing.out(Easing.cubic) });
    }
  }, [isVisible]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(openProgress.value, [0, 1], [0, 1], Extrapolation.CLAMP),
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    opacity: interpolate(openProgress.value, [0, 1], [0, 1], Extrapolation.CLAMP),
    transform: [
      { translateY: interpolate(openProgress.value, [0, 1], [48, 0], Extrapolation.CLAMP) },
    ],
  }));

  const handleExport = useCallback(async () => {
    void safeHaptics.impact(Haptics.ImpactFeedbackStyle.Medium);
    const result = await downloadAnchor(rendererRef, format, resolution, background, showIntention && !!intention);
    if (result) {
      onExportComplete?.(result.uri);
      void safeHaptics.notification(Haptics.NotificationFeedbackType.Success);
      if (onSaved) {
        onSaved(
          `Saved to Camera Roll · ${format}, ${resolution === 'high' ? 'high-res' : 'standard'}, ${background === 'card' ? 'card' : 'transparent'}${showIntention && intention ? ', with intention' : ', anchor only'}`,
        );
        onClose();
      } else {
        setShowSuccess(true);
      }
    }
  }, [background, downloadAnchor, format, intention, onClose, onExportComplete, onSaved, resolution, showIntention]);

  const pick = useCallback((setter, value) => {
    setter(value);
    void safeHaptics.selection();
  }, []);

  const dims = EXPORT_DIMENSIONS[format];
  const multiplier = Math.round(dims.high.w / dims.standard.w);
  const footDims = `${dims[resolution].w} × ${dims[resolution].h}`;

  return (
    <>
      <Modal
        visible={isVisible}
        transparent
        animationType="none"
        onRequestClose={onClose}
        statusBarTranslucent
      >
        <View style={styles.root} pointerEvents="box-none">
          <AnimatedPressable
            style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close export sheet"
          />

          <Animated.View
            style={[styles.sheet, sheetStyle, { maxHeight: windowHeight - insets.top - 24 }]}
            accessibilityViewIsModal
          >
            <View style={styles.handle} />
            <ScrollView
              showsVerticalScrollIndicator={false}
              bounces={false}
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: Math.max(insets.bottom, 20) }}
            >
              <Text accessibilityRole="header" style={styles.title}>Export anchor</Text>

              <View style={styles.previewWrap}>
                <ExportPreview
                  format={format}
                  resolution={resolution}
                  background={background}
                  showIntention={showIntention}
                  sigilSvg={sigilSvg}
                  sigilUri={sigilUri}
                  intention={intention}
                />
              </View>

              <Text style={styles.label}>FORMAT</Text>
              <View style={[styles.row, { gap: 7 }]}>
                {FORMAT_OPTIONS.map(({ key, label, sub }) => (
                  <Segment
                    key={key}
                    height={48}
                    selected={format === key}
                    label={label}
                    sub={sub}
                    onPress={() => pick(setFormat, key)}
                    style={styles.flex}
                  />
                ))}
              </View>

              <Text style={[styles.label, styles.labelGap]}>RESOLUTION</Text>
              <View style={[styles.row, { gap: 8 }]}>
                <Segment
                  height={48}
                  selected={resolution === 'standard'}
                  label="Standard"
                  sub={`${dims.standard.w} × ${dims.standard.h}`}
                  onPress={() => pick(setResolution, 'standard')}
                  style={styles.flex}
                />
                <Segment
                  height={48}
                  selected={resolution === 'high'}
                  label={`High-res · ${multiplier}×`}
                  sub={`${dims.high.w} × ${dims.high.h}`}
                  onPress={() => pick(setResolution, 'high')}
                  style={styles.flex}
                />
              </View>

              <View style={[styles.row, styles.optionGroups]}>
                <View style={styles.flex}>
                  <Text style={styles.label}>BACKGROUND</Text>
                  <View style={[styles.row, { gap: 6 }]}>
                    {BACKGROUND_OPTIONS.map(({ key, label }) => (
                      <Segment
                        key={key}
                        selected={background === key}
                        label={label}
                        onPress={() => pick(setBackground, key)}
                        style={styles.flex}
                      />
                    ))}
                  </View>
                </View>
                <View style={styles.flex}>
                  <Text style={styles.label}>INTENTION</Text>
                  <View style={[styles.row, { gap: 6 }]}>
                    {INTENTION_OPTIONS.map(({ key, label }) => (
                      <Segment
                        key={label}
                        selected={showIntention === key}
                        label={label}
                        onPress={() => pick(setShowIntention, key)}
                        style={styles.flex}
                      />
                    ))}
                  </View>
                </View>
              </View>

              <Pressable
                onPress={handleExport}
                disabled={isLoading}
                accessibilityRole="button"
                accessibilityLabel="Save to Camera Roll"
                style={({ pressed }) => [styles.cta, isLoading && styles.ctaDisabled, pressed && styles.pressed]}
              >
                <Text style={styles.ctaText}>{isLoading ? 'Saving…' : 'Save to Camera Roll'}</Text>
              </Pressable>
              <Text style={styles.footnote}>PNG · {footDims} · Saved to Photos</Text>
            </ScrollView>
          </Animated.View>

          {/* Off-screen renderer — must be in same tree as the modal for captureRef */}
          <ExportPreviewRenderer
            ref={rendererRef}
            format={format}
            resolution={resolution}
            background={background}
            showIntention={showIntention}
            sigilSvg={sigilSvg}
            sigilUri={sigilUri}
            intention={intention}
          />
        </View>
      </Modal>

      {/* Fallback confirmation for hosts that do not take over feedback via onSaved */}
      <ExportSuccessModal
        visible={showSuccess}
        format={format}
        resolution={resolution}
        onDismiss={() => {
          setShowSuccess(false);
          onClose();
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    backgroundColor: 'rgba(20,22,43,0.4)',
  },
  sheet: {
    backgroundColor: detailsPalette.ink,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(244,237,224,.34)',
    alignSelf: 'center',
    marginTop: 9,
    marginBottom: 12,
  },
  title: {
    fontFamily: detailsFonts.serif,
    fontSize: 19,
    color: detailsPalette.cream,
    marginTop: 4,
  },
  previewWrap: {
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 20,
  },
  preview: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: 'rgba(244,237,224,.2)',
  },
  label: {
    fontFamily: detailsFonts.uiStrong,
    fontSize: 11,
    letterSpacing: 1.1,
    color: detailsPalette.creamMuted,
    marginBottom: 8,
  },
  labelGap: { marginTop: 16 },
  row: { flexDirection: 'row' },
  flex: { flex: 1 },
  optionGroups: { gap: 20, marginTop: 16 },
  segment: {
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  segmentLabel: {
    fontFamily: detailsFonts.uiStrong,
    fontSize: 14,
    lineHeight: 17,
  },
  segmentSub: {
    fontFamily: detailsFonts.ui,
    fontSize: 11,
    lineHeight: 14,
  },
  cta: {
    marginTop: 24,
    height: 48,
    borderRadius: 24,
    backgroundColor: detailsPalette.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaDisabled: { opacity: 0.6 },
  ctaText: {
    fontFamily: detailsFonts.uiStrong,
    fontSize: 16,
    color: detailsPalette.ink,
  },
  footnote: {
    marginTop: 10,
    textAlign: 'center',
    fontFamily: detailsFonts.ui,
    fontSize: 12,
    color: detailsPalette.creamMuted,
  },
  pressed: { opacity: 0.82 },
});
