// @ts-nocheck
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
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
import { X } from 'lucide-react-native';
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
  intention?: string;
  onExportComplete?: (uri: string) => void;
};

export function ExportAnchorSheet({ isVisible, onClose, sigilSvg, sigilUri, intention, onExportComplete }: Props) {
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(isVisible);
  const [format, setFormat] = useState<'square' | 'wallpaper' | 'print'>('square');
  const [resolution, setResolution] = useState<'standard' | 'high'>('high');
  const [transparentBG, setTransparentBG] = useState(true);
  const [includeIntention, setIncludeIntention] = useState(false);
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
      setShowSuccess(true);
    }
  }, [downloadAnchor, format, onExportComplete, resolution, transparentBG, includeIntention]);

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

  const toggleIncludeIntention = useCallback(() => {
    setIncludeIntention((v) => !v);
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
          />

          <Animated.View
            style={[styles.sheet, sheetStyle, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}
            accessibilityViewIsModal
          >
            {/* Handle */}
            <View style={styles.handle} />

            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Export Anchor</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close"
                onPress={onClose}
                style={styles.closeButton}
              >
                <X size={18} color={colors.anchor15.ash} strokeWidth={1.5} />
              </Pressable>
            </View>
            <Text style={styles.subtitle}>Save your primed symbol.</Text>

            {/* Format pills */}
            <Text style={styles.sectionLabel}>FORMAT</Text>
            <View style={styles.pillRow}>
              {FORMAT_PILLS.map(({ key, label, sub }) => (
                <Pressable
                  key={key}
                  style={[styles.pill, format === key && styles.pillActive]}
                  onPress={() => selectFormat(key)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: format === key }}
                >
                  <Text style={[styles.pillLabel, format === key && styles.pillLabelActive]}>
                    {label}
                  </Text>
                  <Text style={[styles.pillSub, format === key && styles.pillSubActive]}>{sub}</Text>
                </Pressable>
              ))}
            </View>

            {/* Resolution */}
            <Text style={styles.sectionLabel}>RESOLUTION</Text>
            <View style={styles.resRow}>
              {(['standard', 'high'] as const).map((res) => {
                const dim = EXPORT_DIMENSIONS[format][res];
                return (
                  <Pressable
                    key={res}
                    style={[styles.resBtn, resolution === res && styles.resBtnActive]}
                    onPress={() => selectResolution(res)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: resolution === res }}
                  >
                    <View style={styles.resLabelRow}>
                      <Text style={[styles.resLabel, resolution === res && styles.resLabelActive]}>
                        {res === 'standard' ? 'STANDARD' : 'HIGH-RES'}
                      </Text>
                      {res === 'high' && (
                        <View style={styles.resBadge}>
                          <Text style={styles.resBadgeText}>3×</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.resDim}>
                      {dim.w} × {dim.h}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Divider */}
            <View style={styles.divider} />

            {/* Transparent background toggle */}
            <View style={styles.toggleRow}>
              <View style={styles.toggleCopy}>
                <Text style={styles.toggleLabel}>TRANSPARENT BACKGROUND</Text>
                <Text style={styles.toggleSub}>PNG alpha channel preserved</Text>
              </View>
              <Pressable
                style={[styles.toggle, transparentBG && styles.toggleOn]}
                onPress={toggleTransparent}
                accessibilityRole="switch"
                accessibilityState={{ checked: transparentBG }}
              >
                <View style={[styles.toggleThumb, transparentBG && styles.toggleThumbOn]} />
              </Pressable>
            </View>

            {/* Include intention toggle */}
            {!!intention && (
              <>
                <View style={styles.toggleRow}>
                  <View style={styles.toggleCopy}>
                    <Text style={styles.toggleLabel}>INCLUDE INTENTION</Text>
                    <Text style={styles.toggleSub}>Embed your words in the image</Text>
                  </View>
                  <Pressable
                    style={[styles.toggle, includeIntention && styles.toggleOn]}
                    onPress={toggleIncludeIntention}
                    accessibilityRole="switch"
                    accessibilityState={{ checked: includeIntention }}
                  >
                    <View style={[styles.toggleThumb, includeIntention && styles.toggleThumbOn]} />
                  </Pressable>
                </View>
                {includeIntention && (
                  <Text style={styles.intentionPreview}>“{intention}”</Text>
                )}
              </>
            )}

            {/* CTA */}
            <Pressable
              style={({ pressed }) => [styles.cta, (pressed || isLoading) && styles.ctaPressed]}
              onPress={handleExport}
              disabled={isLoading}
              accessibilityRole="button"
              accessibilityLabel="Save to Camera Roll"
            >
              <Text style={styles.ctaText}>
                {isLoading ? 'SAVING…' : 'SAVE TO CAMERA ROLL'}
              </Text>
            </Pressable>

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
            intention={includeIntention ? intention : undefined}
          />
        </View>
      </Modal>

      {/* Success confirmation modal */}
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
    backgroundColor: 'rgba(0,0,0,0.62)',
  },
  sheet: {
    backgroundColor: colors.anchor15.veil,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.anchor15.goldHairline,
    paddingHorizontal: 22,
    paddingTop: 6,
  },
  handle: {
    width: 34,
    height: 3,
    borderRadius: 3,
    backgroundColor: 'rgba(244,239,230,0.28)',
    alignSelf: 'center',
    marginTop: 5,
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    color: colors.anchor15.bone,
    fontFamily: typography.fontFamily.voice,
    fontSize: 21,
    lineHeight: 26,
  },
  closeButton: {
    width: 34,
    height: 34,
    marginRight: -6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtitle: {
    color: 'rgba(244,239,230,0.6)',
    fontFamily: typography.fontFamily.voiceItalic,
    fontSize: 14,
    lineHeight: 19,
    marginTop: 2,
    marginBottom: spacing.md,
  },
  sectionLabel: {
    color: 'rgba(242,223,168,0.78)',
    fontFamily: typography.fontFamily.ritual,
    fontSize: 9.5,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  pillRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: spacing.md,
  },
  pill: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(217, 179, 108, 0.2)',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 3,
  },
  pillActive: {
    borderColor: colors.anchor15.giltBright,
    backgroundColor: 'rgba(217, 179, 108, 0.1)',
  },
  pillLabel: {
    color: 'rgba(244, 239, 230, 0.55)',
    fontFamily: typography.fontFamily.ritualSemiBold,
    fontSize: 9.5,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  pillLabelActive: {
    color: colors.anchor15.giltBright,
  },
  pillSub: {
    color: 'rgba(244, 239, 230, 0.4)',
    fontFamily: typography.fontFamily.voiceItalic,
    fontSize: 10,
  },
  pillSubActive: {
    color: 'rgba(217, 179, 108, 0.85)',
  },
  resRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: spacing.md,
  },
  resBtn: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(217, 179, 108, 0.2)',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    paddingVertical: 9,
    paddingHorizontal: 10,
    gap: 2,
  },
  resBtnActive: {
    borderColor: colors.anchor15.giltBright,
    backgroundColor: 'rgba(217, 179, 108, 0.1)',
  },
  resLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  resLabel: {
    color: 'rgba(244, 239, 230, 0.55)',
    fontFamily: typography.fontFamily.ritualSemiBold,
    fontSize: 9.5,
    letterSpacing: 1.2,
  },
  resLabelActive: {
    color: colors.anchor15.giltBright,
  },
  resDim: {
    color: 'rgba(244, 239, 230, 0.4)',
    fontFamily: typography.fontFamily.voiceItalic,
    fontSize: 10,
  },
  resBadge: {
    backgroundColor: 'rgba(217, 179, 108, 0.15)',
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  resBadgeText: {
    color: colors.anchor15.giltBright,
    fontFamily: typography.fontFamily.ritualSemiBold,
    fontSize: 8,
    letterSpacing: 0.5,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.anchor15.hairline,
    marginBottom: spacing.md,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  toggleCopy: {
    flex: 1,
    marginRight: spacing.md,
  },
  toggleLabel: {
    color: colors.anchor15.bone,
    fontFamily: typography.fontFamily.ritualSemiBold,
    fontSize: 9.5,
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  toggleSub: {
    color: 'rgba(244, 239, 230, 0.4)',
    fontFamily: typography.fontFamily.voiceItalic,
    fontSize: 11.5,
  },
  toggle: {
    width: 42,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.anchor15.hairlineGold,
    backgroundColor: 'rgba(255,255,255,0.04)',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleOn: {
    backgroundColor: 'rgba(217, 179, 108, 0.18)',
    borderColor: colors.anchor15.giltBright,
  },
  toggleThumb: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(244,239,230,0.32)',
  },
  toggleThumbOn: {
    backgroundColor: colors.anchor15.giltBright,
    alignSelf: 'flex-end',
  },
  intentionPreview: {
    color: 'rgba(217, 179, 108, 0.75)',
    fontFamily: typography.fontFamily.voiceItalic,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  cta: {
    backgroundColor: colors.anchor15.giltBright,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  ctaPressed: {
    opacity: 0.8,
  },
  ctaText: {
    color: '#10151A',
    fontFamily: typography.fontFamily.ritualSemiBold,
    fontSize: 11.5,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  ctaNote: {
    color: colors.anchor15.ash,
    fontFamily: typography.fontFamily.instrument,
    fontSize: 10.5,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
});
