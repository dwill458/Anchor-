import { chartTypography as typography } from './chartTypography';
import React from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ArrowRight, Camera, X } from 'lucide-react-native';
import { V2Button } from '@/components/v2/primitives/V2Button';
import { CHART_COPY } from '@/constants/v2/chartCopy';
import { pickVisionPhoto, type VisionPhotoSource } from '@/hooks/v2/vision/visionPhotoInput';
import { colors, spacing } from '@/theme/v2';
import { CHART_MAP_TOKENS as TOKENS } from './map/chartMapTokens';
import { referenceId, type ChartPhotoReference } from './chartReferences';

type Props = {
  /** The person's Vision: the destination Chart already knows about. */
  vision: { imageUrl: string | null; description: string | null } | null;
  startPhoto: ChartPhotoReference | null;
  onStartPhoto: (photo: ChartPhotoReference | null) => void;
  onContinue: () => void;
  onSkip: () => void;
  /** Falls back to the written "What would make this real?" question. */
  onDescribe: () => void;
  bottomInset: number;
  notice?: string | null;
  busy?: boolean;
  testID?: string;
};

const COPY = CHART_COPY.creation;

/**
 * "Your context": the Vision Chart already has (destination) plus an optional photo of where they are now.
 * Continue works with or without the photo; nothing here is required.
 */
export function ChartContextStep({ vision, startPhoto, onStartPhoto, onContinue, onSkip, onDescribe, bottomInset, notice, busy, testID }: Props) {
  const [message, setMessage] = React.useState<string | null>(null);

  const pick = async (source: VisionPhotoSource) => {
    const result = await pickVisionPhoto(source);
    if (result.status === 'picked') {
      setMessage(null);
      onStartPhoto({ kind: 'photo', id: referenceId(), uri: result.photo.uri, mimeType: result.photo.mimeType, role: 'start' });
    } else if (result.status === 'denied' || result.status === 'error') {
      setMessage(result.message);
    }
  };
  const choose = () =>
    Alert.alert(CHART_COPY.followUp.photo, undefined, [
      { text: CHART_COPY.followUp.takePhoto, onPress: () => void pick('camera') },
      { text: CHART_COPY.followUp.choosePhoto, onPress: () => void pick('library') },
      { text: CHART_COPY.followUp.cancel, style: 'cancel' },
    ]);

  return (
    <View style={styles.root} testID={testID ?? 'chart-context-step'}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {vision && (vision.imageUrl || vision.description) ? (
          <View style={styles.block} testID="chart-vision-context">
            <Text style={styles.label}>{COPY.destinationLabel}</Text>
            <View style={styles.row}>
              <View style={[styles.polaroid, styles.tiltLeft]}>
                {vision.imageUrl ? (
                  <Image source={{ uri: vision.imageUrl }} style={styles.photo} accessibilityIgnoresInvertColors accessibilityLabel="Your Vision" />
                ) : (
                  <View style={[styles.photo, styles.photoEmpty]} />
                )}
                <Text style={styles.tag}>VISION</Text>
              </View>
              <Text style={styles.note}>{COPY.destinationNote}</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.block}>
          <Text style={styles.label}>{COPY.startingLabel}</Text>
          <View style={styles.row}>
            <View style={[styles.polaroid, styles.tiltRight]}>
              {startPhoto ? (
                <Image source={{ uri: startPhoto.uri }} style={styles.photo} accessibilityIgnoresInvertColors accessibilityLabel={COPY.startingPhotoAdded} />
              ) : (
                <View style={[styles.photo, styles.photoEmpty]} />
              )}
              <Text style={styles.tag}>NOW</Text>
            </View>
            <View style={styles.noteColumn}>
              <Text style={styles.note}>{COPY.startingNote}</Text>
              <View style={styles.photoActions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={startPhoto ? COPY.startingPhotoAdded : CHART_COPY.followUp.photo}
                  onPress={choose}
                  style={styles.camera}
                  testID="chart-start-photo"
                >
                  <Camera size={22} color={colors.text.primary} />
                </Pressable>
                {startPhoto ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${CHART_COPY.followUp.remove} photo`}
                    onPress={() => onStartPhoto(null)}
                    style={styles.camera}
                    testID="chart-start-photo-remove"
                  >
                    <X size={20} color={colors.text.secondary} />
                  </Pressable>
                ) : null}
              </View>
            </View>
          </View>
        </View>
        {message || notice ? <Text style={styles.message} accessibilityLiveRegion="polite">{message ?? notice}</Text> : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: bottomInset + spacing[3] }]}>
        <V2Button
          size="large"
          onPress={onContinue}
          loading={busy}
          disabled={busy}
          iconRight={<ArrowRight size={18} color={colors.text.inverse} />}
          testID="chart-context-photo-continue"
          accessibilityLabel={COPY.continue}
        >
          {COPY.continue}
        </V2Button>
        <View style={styles.links}>
          <Pressable accessibilityRole="button" onPress={onSkip} style={styles.link} testID="chart-context-skip">
            <Text style={styles.linkText}>{COPY.skip}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={onDescribe} style={styles.link} testID="chart-context-describe">
            <Text style={styles.linkText}>{COPY.describeInstead}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: spacing[5], paddingTop: spacing[4], paddingBottom: spacing[4], gap: spacing[6] },
  block: { gap: spacing[3] },
  label: { ...typography.labelSM, letterSpacing: 1.6, color: TOKENS.ink },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[4] },
  polaroid: {
    width: 150,
    padding: 8,
    paddingBottom: 26,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  tiltLeft: { transform: [{ rotate: '-3deg' }] },
  tiltRight: { transform: [{ rotate: '3deg' }] },
  photo: { width: '100%', aspectRatio: 1.15, backgroundColor: TOKENS.muted },
  photoEmpty: { backgroundColor: 'rgba(17,24,32,.08)' },
  tag: { position: 'absolute', bottom: 6, alignSelf: 'center', fontFamily: TOKENS.sansStrong, fontSize: 10, letterSpacing: 1.4, color: TOKENS.ink },
  noteColumn: { flex: 1, gap: spacing[3] },
  note: { ...typography.bodyMD, color: colors.text.secondary, flex: 1 },
  photoActions: { flexDirection: 'row', gap: spacing[3] },
  camera: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: 'rgba(255,255,255,.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: { ...typography.bodySM, color: colors.text.secondary },
  footer: { paddingHorizontal: spacing[5], paddingTop: spacing[3], gap: spacing[2] },
  links: { flexDirection: 'row', justifyContent: 'space-between' },
  link: { minHeight: 44, justifyContent: 'center' },
  linkText: { ...typography.labelMD, color: colors.text.secondary, textDecorationLine: 'underline' },
});
