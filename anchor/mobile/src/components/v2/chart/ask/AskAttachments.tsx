import React, { memo, useEffect } from 'react';
import { ActivityIndicator, BackHandler, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Camera, Image as ImageIcon, Mic, Plus, RotateCcw, X } from 'lucide-react-native';
import { colors, radii, spacing } from '@/theme/v2';
import type { AskAttachment } from '@/hooks/v2/chart/askChartPhoto';
import { chartTypography as typography } from '../chartTypography';
import type { AskAccent } from './askChartTheme';

const THUMB = 64;

type StripProps = {
  items: AskAttachment[];
  accent: AskAccent;
  reducedMotion: boolean;
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
  onPreview: (uri: string) => void;
};

/**
 * The photos on the message being written: a thumbnail each, with a progress bar while it uploads, a retry when it
 * fails, and a remove control. The person can send once every photo is ready, or remove the ones that are not.
 */
export const AskAttachmentStrip = memo(function AskAttachmentStrip({ items, accent, reducedMotion, onRemove, onRetry, onPreview }: StripProps) {
  if (items.length === 0) return null;
  return (
    <View style={styles.strip} testID="ask-attachments">
      {items.map(item => (
        <Animated.View key={item.id} entering={reducedMotion ? undefined : FadeIn.duration(180)} exiting={reducedMotion ? undefined : FadeOut.duration(140)} style={styles.thumbWrap}>
          <Pressable
            accessibilityRole="imagebutton"
            accessibilityLabel={item.status === 'failed' ? 'Photo failed to upload' : 'Photo attached. Tap to preview'}
            onPress={() => (item.status === 'failed' ? onRetry(item.id) : onPreview(item.uri))}
            style={[styles.thumb, { borderColor: item.status === 'failed' ? colors.semantic.error : accent.border }]}
            testID={`ask-attachment-${item.status}`}
          >
            <Image source={{ uri: item.uri }} style={styles.image} accessibilityIgnoresInvertColors />
            {item.status === 'preparing' ? (
              <View style={styles.veil}><ActivityIndicator size="small" color={colors.text.inverse} /></View>
            ) : null}
            {item.status === 'uploading' ? (
              <View style={styles.veil} testID="ask-attachment-progress" accessibilityLabel={`Uploading ${Math.round(item.progress * 100)} percent`}>
                <View style={styles.track}><View style={[styles.fill, { width: `${Math.max(6, Math.round(item.progress * 100))}%`, backgroundColor: accent.fill }]} /></View>
              </View>
            ) : null}
            {item.status === 'failed' ? (
              <View style={[styles.veil, styles.failed]}>
                <RotateCcw size={20} color={colors.text.inverse} />
              </View>
            ) : null}
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Remove photo" onPress={() => onRemove(item.id)} hitSlop={10} style={styles.remove} testID={`ask-attachment-remove`}>
            <X size={13} color={colors.text.inverse} strokeWidth={3} />
          </Pressable>
        </Animated.View>
      ))}
    </View>
  );
});

/** Full-screen look at a photo before it is sent. Tap anywhere, the close control, or back, to return. */
export const AskPhotoPreview = memo(function AskPhotoPreview({ uri, onClose, reducedMotion }: { uri: string | null; onClose: () => void; reducedMotion: boolean }) {
  const insets = useSafeAreaInsets();
  useEffect(() => {
    if (!uri) return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => subscription.remove();
  }, [onClose, uri]);
  if (!uri) return null;
  return (
    <Animated.View entering={reducedMotion ? undefined : FadeIn.duration(180)} exiting={reducedMotion ? undefined : FadeOut.duration(140)} style={[StyleSheet.absoluteFill, styles.preview]} testID="ask-photo-preview">
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close preview">
        <Image source={{ uri }} style={styles.previewImage} resizeMode="contain" accessibilityIgnoresInvertColors />
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Close preview" onPress={onClose} hitSlop={12} style={[styles.close, { top: insets.top + spacing[3] }]} testID="ask-photo-preview-close">
        <X size={22} color={colors.text.inverse} />
      </Pressable>
    </Animated.View>
  );
});

type RequestProps = {
  accent: AskAccent;
  onCamera: () => void;
  onLibrary: () => void;
  onSkip: () => void;
};

/**
 * Shown under an assistant message that asked for a photo. It is a request, never a requirement: the person can
 * take one, choose one, or simply carry on.
 */
export const AskPhotoRequest = memo(function AskPhotoRequest({ accent, onCamera, onLibrary, onSkip }: RequestProps) {
  return (
    <View style={styles.request} testID="ask-photo-request">
      <View style={styles.requestRow}>
        <Pressable accessibilityRole="button" accessibilityLabel="Take photo" onPress={onCamera} style={[styles.requestButton, { borderColor: accent.border }]} testID="ask-request-camera">
          <Camera size={18} color={accent.text} />
          <Text style={styles.requestText}>Take photo</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Choose photo" onPress={onLibrary} style={[styles.requestButton, { borderColor: accent.border }]} testID="ask-request-library">
          <ImageIcon size={18} color={accent.text} />
          <Text style={styles.requestText}>Choose photo</Text>
        </Pressable>
      </View>
      <Pressable accessibilityRole="button" onPress={onSkip} hitSlop={8} style={styles.skip} testID="ask-request-skip">
        <Text style={[styles.skipText, { color: accent.text }]}>Continue without a photo</Text>
      </Pressable>
    </View>
  );
});

/** The composer's attach control. */
export const AskPlusButton = memo(function AskPlusButton({ accent, onPress, disabled }: { accent: AskAccent; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Add a photo" accessibilityState={{ disabled: Boolean(disabled) }} disabled={disabled} onPress={onPress} style={[styles.plus, { borderColor: accent.border, opacity: disabled ? 0.4 : 1 }]} testID="ask-plus">
      <Plus size={22} color={colors.text.primary} />
    </Pressable>
  );
});

/** The composer's microphone. Only rendered where speech recognition is actually available. */
export const AskMicButton = memo(function AskMicButton({ accent, onPress }: { accent: AskAccent; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Speak your message" onPress={onPress} hitSlop={6} style={styles.mic} testID="ask-mic">
      <Mic size={21} color={accent.text} />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  strip: { flexDirection: 'row', gap: spacing[3], paddingHorizontal: spacing[5], paddingTop: spacing[1], paddingBottom: spacing[1] },
  thumbWrap: { width: THUMB, height: THUMB },
  thumb: { width: THUMB, height: THUMB, borderRadius: radii.md, borderWidth: 1, overflow: 'hidden', backgroundColor: colors.grouped },
  image: { width: '100%', height: '100%' },
  veil: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'flex-end', backgroundColor: 'rgba(17,24,32,.38)', padding: 6 },
  failed: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(182,59,56,.62)' },
  track: { width: '100%', height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,.35)', overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2 },
  remove: { position: 'absolute', top: -7, right: -7, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.text.primary },
  preview: { backgroundColor: 'rgba(10,15,20,.94)', zIndex: 20 },
  previewImage: { flex: 1, width: '100%' },
  close: { position: 'absolute', right: spacing[4], width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,.14)' },
  request: { gap: spacing[1], paddingTop: spacing[3] },
  requestRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  requestButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingHorizontal: spacing[4], borderRadius: radii.pill, borderWidth: 1, backgroundColor: colors.surface },
  requestText: { ...typography.labelMD, color: colors.text.primary },
  skip: { alignSelf: 'flex-start', minHeight: 36, justifyContent: 'center' },
  skipText: { ...typography.labelMD, textDecorationLine: 'underline' },
  plus: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 1, backgroundColor: colors.surface },
  mic: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
