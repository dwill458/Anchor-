// @ts-nocheck
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { colors, spacing, typography } from '@/theme';
import { ExportPreviewRenderer, EXPORT_DIMENSIONS } from '@/components/ExportPreviewRenderer';
import { ExportSuccessModal } from '@/components/ExportSuccessModal';
import { useDownloadAnchor } from '@/hooks/useDownloadAnchor';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const ENTER_MS = 300;
const EXIT_MS = 220;

const FORMAT_PILLS = [
  { key: 'square',    label: 'SQUARE',    sub: '1:1'     },
  { key: 'wallpaper', label: 'WALLPAPER', sub: '9:16'    },
  { key: 'print',     label: 'PRINT',     sub: '300 DPI' },
];

const SIZE_LABELS = {
  square:    { standard: '~350 KB', high: '~2.8 MB' },
  wallpaper: { standard: '~600 KB', high: '~4.8 MB' },
  print:     { standard: '~1.2 MB', high: '~9.6 MB' },
};

type Props = {
  isVisible: boolean;
  onClose: () => void;
  sigilSvg?: string;
  sigilUri?: string;
  onExportComplete?: (uri: string) => void;
};

export function ExportAnchorSheet({ isVisible, onClose, sigilSvg, sigilUri, onExportComplete }: Props) {
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(isVisible);
  const [format, setFormat] = useState<'square' | 'wallpaper' | 'print'>('square');
  const [resolution, setResolution] = useState<'standard' | 'high'>('high');
  const [transparentBG, setTransparentBG] = useState(true);
  const [showSuccess, setShowSuccess] = useState(false);

  const rendererRef = useRef(null);
  const { downloadAnchor, isLoading } = useDownloadAnchor();
  const openProgress = useSharedValue(0);

  useEffect(() => {
    if (isVisible) {
      setMounted(true);
      openProgress.value = withTiming(1, { duration: ENTER_MS, easing: Easing.out(Easing.cubic) });
    } else {
      openProgress.value = withTiming(
        0,
        { duration: EXIT_MS, easing: Easing.out(Easing.cubic) },
        (done) => { if (done) runOnJS(setMounted)(false); }
      );
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
    const result = await downloadAnchor(rendererRef, format, resolution, transparentBG);
    if (result) {
      onExportComplete?.(result.uri);
      void safeHaptics.notification(Haptics.NotificationFeedbackType.Success);
      onClose();
      setShowSuccess(true);
    }
  }, [downloadAnchor, format, onClose, onExportComplete, resolution, transparentBG]);

  const selectFormat = useCallback((f) => {
    setFormat(f);
    void safeHaptics.selection();
  }, []);

  const selectResolution = useCallback((r) => {
    setResolution(r);
    void safeHaptics.selection();
  }, []);

  const toggleTransparent = useCallback(() => {
    setTransparentBG((v) => !v);
    void safeHaptics.selection();
  }, []);

  const sizeLabel = SIZE_LABELS[format][resolution];

  if (!mounted) return null;

  return (
    <>
      <Modal
        visible={mounted}
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
          >
            {Platform.OS === 'ios' ? (
              <BlurView intensity={28} tint="dark" style={StyleSheet.absoluteFill} />
            ) : (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(8,10,14,0.88)' }]} />
            )}
          </AnimatedPressable>

          <Animated.View
            style={[styles.sheet, sheetStyle, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}
            accessibilityViewIsModal
          >
            {/* Sheet background */}
            {Platform.OS === 'ios' ? (
              <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
            ) : (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(12,17,24,0.96)' }]} />
            )}
            <LinearGradient
              colors={['rgba(212,175,55,0.14)', 'rgba(212,175,55,0.04)', 'rgba(212,175,55,0.01)']}
              start={{ x: 0.2, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />

            {/* Handle */}
            <View style={styles.handle} />

            {/* Header */}
            <Text style={styles.title}>EXPORT ANCHOR</Text>
            <Text style={styles.subtitle}>Save your primed symbol</Text>

            {/* Format pills */}
            <Text style={styles.sectionLabel}>FORMAT</Text>
            <View style={styles.pillRow}>
              {FORMAT_PILLS.map(({ key, label, sub }) => (
                <TouchableOpacity
                  key={key}
                  style={[styles.pill, format === key && styles.pillActive]}
                  onPress={() => selectFormat(key)}
                  activeOpacity={0.8}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: format === key }}
                >
                  <Text style={[styles.pillLabel, format === key && styles.pillLabelActive]}>
                    {label}
                  </Text>
                  <Text style={styles.pillSub}>{sub}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Resolution */}
            <Text style={styles.sectionLabel}>RESOLUTION</Text>
            <View style={styles.resRow}>
              {(['standard', 'high'] as const).map((res) => {
                const dim = EXPORT_DIMENSIONS[format][res];
                return (
                  <TouchableOpacity
                    key={res}
                    style={[styles.resBtn, resolution === res && styles.resBtnActive]}
                    onPress={() => selectResolution(res)}
                    activeOpacity={0.8}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: resolution === res }}
                  >
                    <Text style={[styles.resLabel, resolution === res && styles.resLabelActive]}>
                      {res === 'standard' ? 'STANDARD' : 'HIGH-RES'}
                    </Text>
                    <Text style={styles.resDim}>
                      {dim.w} × {dim.h}
                    </Text>
                    {res === 'high' && (
                      <View style={styles.resBadge}>
                        <Text style={styles.resBadgeText}>3×</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Divider */}
            <View style={styles.divider} />

            {/* Transparent background toggle */}
            <View style={styles.toggleRow}>
              <View style={{ flex: 1, marginRight: spacing.md }}>
                <Text style={styles.toggleLabel}>TRANSPARENT BACKGROUND</Text>
                <Text style={styles.toggleSub}>PNG alpha channel preserved</Text>
              </View>
              <TouchableOpacity
                style={[styles.toggle, transparentBG && styles.toggleOn]}
                onPress={toggleTransparent}
                activeOpacity={0.8}
                accessibilityRole="switch"
                accessibilityState={{ checked: transparentBG }}
              >
                <View style={[styles.toggleThumb, transparentBG && styles.toggleThumbOn]} />
              </TouchableOpacity>
            </View>

            {/* CTA */}
            <TouchableOpacity
              style={[styles.ctaWrapper, isLoading && styles.ctaDisabled]}
              onPress={handleExport}
              disabled={isLoading}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Save to Camera Roll"
            >
              <LinearGradient
                colors={['#b8920a', '#d4a820', '#c49a15']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.cta}
              >
                <Text style={styles.ctaText}>
                  {isLoading ? 'SAVING...' : 'SAVE TO CAMERA ROLL'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            <Text style={styles.ctaNote}>PNG · {sizeLabel} · Saved to Photos</Text>
          </Animated.View>

          {/* Off-screen renderer — must be in same tree as the modal for captureRef */}
          <ExportPreviewRenderer
            ref={rendererRef}
            format={format}
            resolution={resolution}
            transparentBG={transparentBG}
            sigilSvg={sigilSvg}
            sigilUri={sigilUri}
          />
        </View>
      </Modal>

      {/* Success confirmation modal */}
      <ExportSuccessModal
        visible={showSuccess}
        format={format}
        resolution={resolution}
        onDismiss={() => setShowSuccess(false)}
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
    backgroundColor: 'rgba(8,10,14,0.6)',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: colors.ritual.border,
    overflow: 'hidden',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  handle: {
    width: 36,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(212,175,55,0.3)',
    alignSelf: 'center',
    marginBottom: spacing.md + spacing.xs,
  },
  title: {
    fontFamily: typography.fonts.heading,
    fontSize: 13,
    letterSpacing: 2.5,
    color: colors.gold,
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: typography.fonts.bodySerifItalic,
    fontSize: 12,
    color: colors.text.tertiary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  sectionLabel: {
    fontFamily: typography.fonts.heading,
    fontSize: 8,
    letterSpacing: 2,
    color: 'rgba(212,175,55,0.5)',
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  pillRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  pill: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.xs,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.18)',
    backgroundColor: 'rgba(255,255,255,0.02)',
    alignItems: 'center',
    gap: 3,
  },
  pillActive: {
    borderColor: 'rgba(212,175,55,0.7)',
    backgroundColor: 'rgba(212,175,55,0.08)',
  },
  pillLabel: {
    fontFamily: typography.fonts.heading,
    fontSize: 8.5,
    letterSpacing: 1,
    color: colors.text.primary,
  },
  pillLabelActive: {
    color: colors.gold,
  },
  pillSub: {
    fontFamily: typography.fonts.bodySerifItalic,
    fontSize: 9,
    color: 'rgba(192,192,192,0.45)',
  },
  resRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  resBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.18)',
    backgroundColor: 'rgba(255,255,255,0.02)',
    alignItems: 'center',
    gap: 2,
  },
  resBtnActive: {
    borderColor: colors.gold,
    backgroundColor: 'rgba(212,175,55,0.08)',
  },
  resLabel: {
    fontFamily: typography.fonts.heading,
    fontSize: 9,
    letterSpacing: 1.2,
    color: colors.text.primary,
  },
  resLabelActive: {
    color: colors.gold,
  },
  resDim: {
    fontFamily: typography.fonts.bodySerifItalic,
    fontSize: 8.5,
    color: 'rgba(192,192,192,0.4)',
  },
  resBadge: {
    backgroundColor: 'rgba(212,175,55,0.15)',
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 1,
    marginTop: 2,
  },
  resBadgeText: {
    fontFamily: typography.fonts.heading,
    fontSize: 7,
    letterSpacing: 0.5,
    color: colors.gold,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(212,175,55,0.14)',
    marginBottom: spacing.md,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  toggleLabel: {
    fontFamily: typography.fonts.heading,
    fontSize: 9,
    letterSpacing: 1.2,
    color: colors.text.primary,
    marginBottom: 2,
  },
  toggleSub: {
    fontFamily: typography.fonts.bodySerifItalic,
    fontSize: 9,
    color: 'rgba(192,192,192,0.4)',
  },
  toggle: {
    width: 42,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.3)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleOn: {
    backgroundColor: 'rgba(212,175,55,0.2)',
    borderColor: colors.gold,
  },
  toggleThumb: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(192,192,192,0.4)',
  },
  toggleThumbOn: {
    backgroundColor: colors.gold,
    alignSelf: 'flex-end',
  },
  ctaWrapper: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  ctaDisabled: {
    opacity: 0.6,
  },
  cta: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    fontFamily: typography.fonts.headingBold,
    fontSize: 12,
    letterSpacing: 2,
    color: colors.navy,
  },
  ctaNote: {
    fontFamily: typography.fonts.bodySerifItalic,
    fontSize: 9,
    color: 'rgba(192,192,192,0.3)',
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
});
