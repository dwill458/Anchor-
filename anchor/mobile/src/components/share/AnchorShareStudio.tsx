import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Download, Share2, X } from 'lucide-react-native';
import { detailsFonts, detailsPalette, withAlpha } from '@/components/v2/anchors/anchorDetailsTokens';
import { useV2ReduceMotion, v2Haptics } from '@/hooks/v2';
import { useSubscription } from '@/hooks/useSubscription';
import { AnalyticsEvents, AnalyticsService } from '@/services/AnalyticsService';
import { saveShareExport, sharePngViaSystemSheet } from '@/services/anchorExportService';
import { logger } from '@/utils/logger';
import { AnchorSharePreview } from './AnchorSharePreview';
import { ShareLayoutSelector } from './ShareLayoutSelector';
import { useShareExportRenderer } from './useShareExportRenderer';
import { SHARE_ASPECT, availableShareLayouts, type ShareExportData, type ShareLayoutId } from './shareTypes';

type Props = {
  visible: boolean;
  onClose: () => void;
  data: ShareExportData;
};

const PILL_MS = 2200;
const HEADER_HEIGHT = 76;
const CONTROLS_HEIGHT = 292;

/**
 * Full-screen "choose, then share". The preview is the real template at screen
 * size; the 1080 x 1920 PNG is rendered separately, and only when Save or Share
 * is pressed.
 */
export function AnchorShareStudio({ visible, onClose, data }: Props) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const reduceMotion = useV2ReduceMotion();
  const { isPro } = useSubscription();
  const { renderPng, prepare, release, exportNode } = useShareExportRenderer(data);

  const layouts = useMemo(() => availableShareLayouts(data), [data]);
  const [index, setIndex] = useState(0);
  const [markPreference, setMarkPreference] = useState(true);
  const [busy, setBusy] = useState<'save' | 'share' | null>(null);
  const [pill, setPill] = useState<string | null>(null);
  const pillTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const layout: ShareLayoutId = layouts[Math.min(index, layouts.length - 1)];
  // Free keeps the mark on and locked; Pro defaults to on and may turn it off.
  const showMark = isPro ? markPreference : true;

  // Pre-render the selected layout at full size while the person looks at it, so Save/Share only has to capture.
  useEffect(() => {
    if (!visible) {
      release();
      return undefined;
    }
    const timer = setTimeout(() => prepare(layout, showMark), 350);
    return () => clearTimeout(timer);
  }, [visible, layout, showMark, prepare, release]);

  // Entrance: a quiet settle, not a slide.
  const enter = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (!visible) {
      enter.value = reduceMotion ? 1 : 0;
      return;
    }
    setIndex(0);
    setMarkPreference(true);
    setPill(null);
    AnalyticsService.track(AnalyticsEvents.SHARE_STUDIO_OPENED, {
      category: data.category,
      has_vision: layouts.includes('vision'),
    });
    // Warm the images so switching layouts never shows an empty frame.
    for (const uri of [data.imageUrl, data.visionImageUrl]) {
      if (uri) void Image.prefetch(uri).catch(() => undefined);
    }
    enter.value = reduceMotion ? 1 : withTiming(1, { duration: 320 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);
  const enterStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ scale: 0.97 + 0.03 * enter.value }],
  }));

  useEffect(
    () => () => {
      if (pillTimer.current) clearTimeout(pillTimer.current);
    },
    [],
  );

  const showPill = useCallback((message: string) => {
    setPill(message);
    if (pillTimer.current) clearTimeout(pillTimer.current);
    pillTimer.current = setTimeout(() => setPill(null), PILL_MS);
  }, []);

  const previewWidth = useMemo(() => {
    const room = height - insets.top - insets.bottom - HEADER_HEIGHT - CONTROLS_HEIGHT;
    return Math.max(180, Math.min(width - 88, room / SHARE_ASPECT));
  }, [height, insets.bottom, insets.top, width]);

  const selectIndex = useCallback(
    (next: number) => {
      if (next === index || next < 0 || next >= layouts.length) return;
      setIndex(next);
      void v2Haptics.selection();
      AnalyticsService.track(AnalyticsEvents.SHARE_LAYOUT_SELECTED, { layout: layouts[next] });
    },
    [index, layouts],
  );

  const run = async (kind: 'save' | 'share') => {
    if (busy) return;
    setBusy(kind);
    try {
      const uri = await renderPng(layout, showMark, { keepWarm: true });
      if (kind === 'save') {
        const result = await saveShareExport(uri, layout);
        if (result === 'permission-denied') {
          void v2Haptics.warning();
          showPill('Allow photo access to save');
          return;
        }
        void v2Haptics.confirmation();
        showPill('Saved to Photos');
        AnalyticsService.track(AnalyticsEvents.ANCHOR_EXPORT_SAVED, { layout, source: 'share_studio' });
      } else {
        await sharePngViaSystemSheet(uri);
        AnalyticsService.track(AnalyticsEvents.ANCHOR_EXPORT_SHARED, { layout });
      }
    } catch (error) {
      logger.warn('[ShareStudio] export failed', error);
      void v2Haptics.warning();
      showPill(kind === 'save' ? 'Could not save the image' : 'Could not open sharing');
    } finally {
      setBusy(null);
    }
  };

  const pressScale = useSharedValue(1);
  const shareButtonStyle = useAnimatedStyle(() => ({ transform: [{ scale: pressScale.value }] }));

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.root, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 12) }]} testID="share-studio">
        <Animated.View style={[styles.fill, enterStyle]}>
          <View style={styles.header}>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
              testID="share-studio-close"
              hitSlop={12}
              style={styles.close}
            >
              <X size={22} color={detailsPalette.cream} strokeWidth={1.8} />
            </Pressable>
            <Text style={styles.title}>Share Your Anchor</Text>
            <Text style={styles.sub}>Choose a style to share or save.</Text>
          </View>

          <View style={styles.pagerWrap}>
            <View style={styles.page}>
              <AnchorSharePreview
                layout={layout}
                data={data}
                width={previewWidth}
                showMark={showMark}
                reduceMotion={reduceMotion}
                onSwipe={(direction) => selectIndex(index + direction)}
              />
            </View>
            <View style={styles.dots} pointerEvents="none">
              {layouts.map((id, i) => (
                <View key={id} style={[styles.dot, i === index && styles.dotActive]} />
              ))}
            </View>
          </View>

          <View style={styles.controls}>
            <ShareLayoutSelector
              layouts={layouts}
              selected={layout}
              onSelect={(next) => selectIndex(layouts.indexOf(next))}
              data={data}
              showMark={showMark}
            />

            <View style={styles.markRow}>
              <View style={styles.markCopy}>
                <Text style={styles.markLabel}>Show Anchor mark</Text>
                <Text style={styles.markHelp}>
                  {isPro ? 'Recommended for sharing' : 'Included with every free export'}
                </Text>
              </View>
              <Switch
                testID="share-studio-mark-toggle"
                value={showMark}
                disabled={!isPro}
                onValueChange={setMarkPreference}
                accessibilityLabel="Show Anchor mark"
                trackColor={{ false: withAlpha(detailsPalette.cream, 0.2), true: detailsPalette.gold }}
                thumbColor={detailsPalette.cream}
              />
            </View>

            <View style={styles.actions}>
              <Pressable
                testID="share-studio-save"
                accessibilityRole="button"
                accessibilityLabel="Save to Photos"
                disabled={busy !== null}
                onPress={() => void run('save')}
                style={({ pressed }) => [styles.secondary, pressed && styles.pressed, busy !== null && styles.disabled]}
              >
                <Download size={20} color={detailsPalette.cream} strokeWidth={1.8} />
                <Text style={styles.secondaryText}>{busy === 'save' ? 'Saving…' : 'Save'}</Text>
              </Pressable>
              <Animated.View style={[styles.primaryWrap, shareButtonStyle]}>
                <Pressable
                  testID="share-studio-share"
                  accessibilityRole="button"
                  accessibilityLabel="Share"
                  disabled={busy !== null}
                  onPressIn={() => {
                    pressScale.value = reduceMotion ? 1 : withTiming(0.97, { duration: 90 });
                  }}
                  onPressOut={() => {
                    pressScale.value = reduceMotion ? 1 : withTiming(1, { duration: 140 });
                  }}
                  onPress={() => void run('share')}
                  style={[styles.primary, busy !== null && styles.disabled]}
                >
                  <Share2 size={20} color={detailsPalette.ink} strokeWidth={1.8} />
                  <Text style={styles.primaryText}>{busy === 'share' ? 'Preparing…' : 'Share'}</Text>
                </Pressable>
              </Animated.View>
            </View>
          </View>
        </Animated.View>

        {pill ? (
          <View pointerEvents="none" style={[styles.pillWrap, { top: insets.top + 14 }]} accessibilityLiveRegion="polite">
            <View style={styles.pill}>
              <Text style={styles.pillText}>{pill}</Text>
            </View>
          </View>
        ) : null}

        {exportNode}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: detailsPalette.ink },
  fill: { flex: 1 },
  header: { height: HEADER_HEIGHT, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 56 },
  close: { position: 'absolute', left: 20, top: 14, width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: detailsFonts.display, fontSize: 17, color: detailsPalette.cream },
  sub: { marginTop: 4, fontFamily: detailsFonts.ui, fontSize: 13, color: detailsPalette.creamMuted, textAlign: 'center' },
  pagerWrap: { flex: 1 },
  page: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  dots: { position: 'absolute', bottom: 4, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: withAlpha(detailsPalette.cream, 0.25) },
  dotActive: { backgroundColor: detailsPalette.cream },
  controls: { height: CONTROLS_HEIGHT, justifyContent: 'flex-end', gap: 14, paddingBottom: 4 },
  markRow: {
    marginHorizontal: 20,
    paddingHorizontal: 16,
    height: 60,
    borderRadius: 16,
    backgroundColor: detailsPalette.creamFaint,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  markCopy: { flex: 1, gap: 2 },
  markLabel: { fontFamily: detailsFonts.uiStrong, fontSize: 15, color: detailsPalette.cream },
  markHelp: { fontFamily: detailsFonts.ui, fontSize: 12, color: detailsPalette.creamMuted },
  actions: { marginHorizontal: 20, flexDirection: 'row', gap: 12 },
  secondary: {
    flex: 1,
    height: 54,
    borderRadius: 27,
    borderWidth: 1,
    borderColor: detailsPalette.creamHairline,
    backgroundColor: detailsPalette.creamFaint,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryText: { fontFamily: detailsFonts.uiStrong, fontSize: 16, color: detailsPalette.cream },
  primaryWrap: { flex: 1.35 },
  primary: {
    height: 54,
    borderRadius: 27,
    backgroundColor: detailsPalette.cream,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryText: { fontFamily: detailsFonts.uiStrong, fontSize: 16, color: detailsPalette.ink },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.6 },
  pillWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  pill: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: detailsPalette.cream },
  pillText: { fontFamily: detailsFonts.uiStrong, fontSize: 14, color: detailsPalette.ink },
});
