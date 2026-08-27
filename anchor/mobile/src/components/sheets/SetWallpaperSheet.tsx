import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Linking,
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
import { SvgXml } from 'react-native-svg';

import type { Anchor } from '@/types';
import {
  AnchorArtworkExportCanvas,
  type AnchorArtworkExportCanvasHandle,
} from '@/components/common';
import { OptimizedImage } from '@/components/common/OptimizedImage';
import { useReduceMotionEnabled } from '@/hooks/useReduceMotionEnabled';
import { AnalyticsService } from '@/services/AnalyticsService';
import { exportAnchorArtwork } from '@/services/AnchorArtworkExportService';
import { colors, typography } from '@/theme';

type WallpaperTrigger = 'first_practice' | 'stage_transition';
type ConfirmationState = 'saved-ios' | 'opened-picker' | 'saved-android';

export interface SetWallpaperSheetProps {
  anchor: Anchor;
  onSetWallpaper: () => void;
  onDismiss: () => void;
  trigger?: WallpaperTrigger;
}

const SHEET_START_Y = Dimensions.get('window').height;

function AnchorDiscPreview({ anchor, size = 66 }: { anchor: Anchor; size?: number }) {
  const artworkUri = anchor.enhancedImageUrl;
  const sigilXml = anchor.reinforcedSigilSvg ?? anchor.baseSigilSvg;

  return (
    <View style={[styles.discPreview, { width: size, height: size, borderRadius: size / 2 }]}>
      {artworkUri ? (
        <OptimizedImage uri={artworkUri} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
      ) : sigilXml ? (
        <SvgXml xml={sigilXml} width={size} height={size} />
      ) : (
        <View style={styles.discFallback} />
      )}
    </View>
  );
}

function confirmationCopy(state: ConfirmationState): string {
  switch (state) {
    case 'opened-picker':
      return 'The wallpaper picker is open. Choose Lock Screen to finish.';
    case 'saved-android':
      return 'Saved to Photos. Open it in your gallery, then choose Set as wallpaper.';
    case 'saved-ios':
      return 'Saved to Photos. Open Settings › Wallpaper to set it.';
  }
}

export const SetWallpaperSheet: React.FC<SetWallpaperSheetProps> = ({
  anchor,
  onSetWallpaper,
  onDismiss,
  trigger = 'first_practice',
}) => {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotionEnabled();
  const exportCanvasRef = useRef<AnchorArtworkExportCanvasHandle | null>(null);
  const scrimOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(SHEET_START_Y)).current;
  const [isSaving, setIsSaving] = useState(false);
  const [confirmation, setConfirmation] = useState<ConfirmationState | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    AnalyticsService.track('wallpaper_sheet_viewed', {
      anchor_id: anchor.id,
      trigger,
    });

    Animated.parallel([
      Animated.timing(scrimOpacity, {
        toValue: 1,
        duration: reduceMotion ? 1 : 500,
        useNativeDriver: true,
      }),
      Animated.timing(sheetTranslateY, {
        toValue: 0,
        duration: reduceMotion ? 1 : 500,
        easing: Easing.bezier(0.22, 0.61, 0.36, 1),
        useNativeDriver: true,
      }),
    ]).start();
  }, [anchor.id, reduceMotion, scrimOpacity, sheetTranslateY, trigger]);

  const dismiss = () => {
    AnalyticsService.track('wallpaper_sheet_dismissed', { anchor_id: anchor.id });
    onDismiss();
  };

  const handleSetWallpaper = async () => {
    if (isSaving || confirmation) return;

    setIsSaving(true);
    setErrorMessage(null);
    AnalyticsService.track('wallpaper_sheet_save_tapped', { anchor_id: anchor.id });

    try {
      const result = await exportAnchorArtwork({
        anchor: {
          anchorName: 'Anchor',
          intentionText: anchor.intentionText,
        },
        mode: 'download',
        captureArtwork: async () => {
          const uri = await exportCanvasRef.current?.capture();
          if (!uri) throw new Error('Unable to generate your anchor artwork right now.');
          return uri;
        },
      });

      onSetWallpaper();

      if (Platform.OS === 'ios') {
        setConfirmation('saved-ios');
        return;
      }

      try {
        // Best effort only: Android has no universal lock-screen wallpaper API.
        // OEMs that handle ATTACH_DATA can open their wallpaper chooser with the image.
        await Linking.sendIntent('android.intent.action.ATTACH_DATA', [
          { key: 'android.intent.extra.STREAM', value: result.localUri },
          { key: 'type', value: 'image/png' },
        ]);
        setConfirmation('opened-picker');
      } catch {
        setConfirmation('saved-android');
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to save this wallpaper right now.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  const sigilXml = anchor.reinforcedSigilSvg ?? anchor.baseSigilSvg;

  return (
    <Modal
      transparent
      visible
      animationType="none"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      onRequestClose={dismiss}
    >
      <View style={styles.root} pointerEvents="box-none">
        <Animated.View style={[styles.backdrop, { opacity: scrimOpacity }]}>
          <BlurView intensity={18} tint="dark" style={StyleSheet.absoluteFillObject} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss wallpaper prompt"
            style={[StyleSheet.absoluteFillObject, styles.scrim]}
            onPress={dismiss}
            testID="wallpaper-sheet-scrim"
          />
        </Animated.View>

        <Animated.View
          accessibilityViewIsModal
          style={[
            styles.sheet,
            {
              paddingBottom: Math.max(30, insets.bottom + 16),
              transform: [{ translateY: sheetTranslateY }],
            },
          ]}
        >
          <View style={styles.handle} />

          <View style={styles.miniPhone}>
            <Text style={styles.phoneTime}>9:41</Text>
            <AnchorDiscPreview anchor={anchor} />
            <Text style={styles.phoneLabel}>YOUR ANCHOR</Text>
          </View>

          {confirmation ? (
            <View style={styles.confirmationWrap}>
              <Text style={styles.confirmationTitle}>SAVED TO PHOTOS</Text>
              <Text style={styles.confirmationBody}>{confirmationCopy(confirmation)}</Text>
              <TouchableOpacity
                activeOpacity={0.84}
                accessibilityRole="button"
                accessibilityLabel="Done"
                style={styles.primaryButton}
                onPress={onDismiss}
              >
                <LinearGradient
                  colors={[colors.anchor15.giltBright, colors.anchor15.gilt, '#B99247']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.primaryGradient}
                >
                  <Text style={styles.primaryLabel}>Done</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <View style={styles.dividerDiamond} />
                <View style={styles.dividerLine} />
              </View>
              <Text style={styles.eyebrow}>THIS ONLY WORKS IF YOU SEE IT.</Text>
              <Text style={styles.title}>
                Set it as your <Text style={styles.titleGold}>lock screen.</Text>
              </Text>
              <Text style={styles.body}>
                Every time you pick up your phone, it primes your next move. 100 exposures a day — that is the practice.
              </Text>
              {errorMessage ? <Text style={styles.errorMessage}>{errorMessage}</Text> : null}
              <TouchableOpacity
                activeOpacity={0.84}
                accessibilityRole="button"
                accessibilityLabel="Set as Wallpaper"
                disabled={isSaving}
                style={styles.primaryButton}
                onPress={handleSetWallpaper}
                testID="set-as-wallpaper-button"
              >
                <LinearGradient
                  colors={[colors.anchor15.giltBright, colors.anchor15.gilt, '#B99247']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.primaryGradient}
                >
                  <Text style={styles.primaryLabel}>{isSaving ? 'Saving…' : 'Set as Wallpaper'}</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.68}
                accessibilityRole="button"
                accessibilityLabel="Maybe later"
                onPress={dismiss}
                style={styles.laterButton}
                testID="wallpaper-sheet-maybe-later"
              >
                <Text style={styles.later}>Maybe later</Text>
              </TouchableOpacity>
            </>
          )}
        </Animated.View>
      </View>

      <AnchorArtworkExportCanvas
        ref={exportCanvasRef}
        anchorName="Anchor"
        intentionText={anchor.intentionText}
        enhancedImageUrl={anchor.enhancedImageUrl}
        sigilSvg={sigilXml}
      />
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject },
  scrim: { backgroundColor: 'rgba(6, 9, 12, 0.62)' },
  sheet: {
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 24,
    paddingTop: 14,
    backgroundColor: colors.anchor15.navy,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderTopWidth: 1,
    borderTopColor: 'rgba(217, 179, 108, 0.34)',
  },
  handle: { width: 34, height: 4, borderRadius: 2, backgroundColor: 'rgba(244, 239, 230, 0.16)' },
  miniPhone: {
    width: 112,
    height: 224,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: colors.anchor15.gilt,
    backgroundColor: colors.anchor15.midnight,
    alignItems: 'center',
    paddingTop: 14,
    overflow: 'hidden',
  },
  phoneTime: { color: colors.anchor15.bone, fontFamily: typography.fontFamily.ritualSemiBold, fontSize: 12, letterSpacing: 0.8 },
  discPreview: { marginTop: 34, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(217, 179, 108, 0.35)' },
  discFallback: { flex: 1, backgroundColor: 'rgba(217, 179, 108, 0.12)' },
  phoneLabel: { position: 'absolute', bottom: 16, color: 'rgba(244, 239, 230, 0.48)', fontFamily: typography.fontFamily.ritual, fontSize: 8, letterSpacing: 1.3 },
  divider: { width: '76%', flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 2 },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(217, 179, 108, 0.30)' },
  dividerDiamond: { width: 5, height: 5, backgroundColor: colors.anchor15.gilt, opacity: 0.72, transform: [{ rotate: '45deg' }] },
  eyebrow: { color: 'rgba(217, 179, 108, 0.84)', fontFamily: typography.fontFamily.ritual, fontSize: 9, letterSpacing: 1.8, textAlign: 'center' },
  title: { color: colors.anchor15.bone, fontFamily: typography.fontFamily.ritualSemiBold, fontSize: 23, lineHeight: 30, textAlign: 'center', textTransform: 'uppercase' },
  titleGold: { color: colors.anchor15.gilt },
  body: { maxWidth: 332, color: 'rgba(244, 239, 230, 0.62)', fontFamily: typography.fontFamily.voiceItalic, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  primaryButton: { width: '100%', borderRadius: 999, overflow: 'hidden', marginTop: 4 },
  primaryGradient: { height: 52, alignItems: 'center', justifyContent: 'center' },
  primaryLabel: { color: colors.anchor15.midnight, fontFamily: typography.fontFamily.ritualSemiBold, fontSize: 13, letterSpacing: 1.8, textTransform: 'uppercase' },
  laterButton: { minHeight: 32, justifyContent: 'center', paddingHorizontal: 12 },
  later: { color: 'rgba(244, 239, 230, 0.34)', fontFamily: typography.fontFamily.sans, fontSize: 13.5 },
  errorMessage: { color: '#E1A58C', fontFamily: typography.fontFamily.sans, fontSize: 13, lineHeight: 18, textAlign: 'center' },
  confirmationWrap: { width: '100%', alignItems: 'center', gap: 14, paddingTop: 8 },
  confirmationTitle: { color: colors.anchor15.gilt, fontFamily: typography.fontFamily.ritualSemiBold, fontSize: 17, letterSpacing: 1.7 },
  confirmationBody: { maxWidth: 300, color: 'rgba(244, 239, 230, 0.66)', fontFamily: typography.fontFamily.voiceItalic, fontSize: 16, lineHeight: 22, textAlign: 'center' },
});
