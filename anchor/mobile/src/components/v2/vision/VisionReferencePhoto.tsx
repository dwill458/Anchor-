import { useState } from 'react';
import { Image, Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import { Camera, ImagePlus, Images, X } from 'lucide-react-native';
import { v2Haptics } from '@/hooks/v2';
import { pickVisionPhoto, type VisionPhotoSource } from '@/hooks/v2/vision';
import { colors, radii, spacing } from '@/theme/v2';
import { VisionChoiceSheet, type VisionChoiceAction } from './VisionChoiceSheet';
import { VISION_GOLD, VISION_SERIF } from './VisionPaperChrome';

/** The reference photo a scene is made from. Not uploaded until the person creates. */
export type VisionStartPhoto = { uri: string; mimeType: string };

const SOURCE_ACTIONS: ReadonlyArray<VisionChoiceAction> = [
  { key: 'library', label: 'Choose from library', detail: 'Use a photo you already have', Icon: Images },
  { key: 'camera', label: 'Take a photo', detail: 'Capture something right now', Icon: Camera },
];

type Props = {
  photo: VisionStartPhoto | null;
  onChange: (photo: VisionStartPhoto | null) => void;
  onNotice?: (message: string | null) => void;
  /** Shorter surface for the Add Image sheet. */
  compact?: boolean;
  disabled?: boolean;
  testID?: string;
};

/**
 * One simple surface for an optional reference photo: add it, see it, change it or take it away.
 * A reference is recommended for a more personal result and never required.
 */
export function VisionReferencePhoto({ photo, onChange, onNotice, compact = false, disabled = false, testID = 'vision-reference-photo' }: Props) {
  const [sheet, setSheet] = useState(false);
  const height = compact ? 112 : 208;

  const choose = async (source: VisionPhotoSource) => {
    // Quality 0.6: the server accepts 5 MB per photo, and a reference needs the subject, not every pixel.
    const result = await pickVisionPhoto(source, 0.6);
    if (result.status === 'picked') { onChange({ uri: result.photo.uri, mimeType: result.photo.mimeType }); onNotice?.(null); }
    else if (result.status === 'denied' || result.status === 'error') onNotice?.(result.message);
  };

  const open = () => { if (disabled) return; v2Haptics.selection(); Keyboard.dismiss(); setSheet(true); };

  return (
    <View testID={testID}>
      {photo ? (
        <View style={[styles.surface, styles.surfaceSet, { height }]}>
          <Image source={{ uri: photo.uri }} style={styles.image} resizeMode="cover" resizeMethod="resize" accessibilityLabel="Your reference photo" />
          <Pressable testID={`${testID}-remove`} accessibilityRole="button" accessibilityLabel="Remove reference photo" disabled={disabled} hitSlop={8}
            onPress={() => { v2Haptics.selection(); onChange(null); }} style={styles.remove}>
            <X size={16} color={colors.paper} strokeWidth={2} />
          </Pressable>
          <Pressable testID={`${testID}-change`} accessibilityRole="button" accessibilityLabel="Change reference photo" disabled={disabled} onPress={open} style={styles.change}>
            <Text style={styles.changeLabel}>Change photo</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable testID={`${testID}-add`} accessibilityRole="button" accessibilityLabel="Add a reference photo" disabled={disabled} onPress={open}
          style={({ pressed }) => [styles.surface, styles.surfaceEmpty, { height }, pressed && styles.pressed]}>
          <ImagePlus size={compact ? 24 : 30} color={VISION_GOLD} strokeWidth={1.4} />
          <Text style={styles.title}>Add a photo</Text>
          <Text style={styles.sub}>Optional · for a more personal result</Text>
        </Pressable>
      )}
      <VisionChoiceSheet
        neutral={false}
        visible={sheet}
        onClose={() => setSheet(false)}
        title="Reference photo"
        subtitle="A place, a person or an object you want in your scene."
        actions={SOURCE_ACTIONS}
        onChoose={key => void choose(key === 'camera' ? 'camera' : 'library')}
        testID="vision-reference-source-sheet"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  surface: { borderRadius: radii.lg, overflow: 'hidden', backgroundColor: colors.surface },
  surfaceEmpty: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: VISION_GOLD, alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: spacing[4] },
  surfaceSet: { borderWidth: 1, borderColor: colors.text.primary },
  pressed: { opacity: 0.85 },
  image: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  title: { fontFamily: VISION_SERIF, fontSize: 20, lineHeight: 26, color: colors.text.primary, textAlign: 'center' },
  sub: { fontFamily: 'Inter-Regular', fontSize: 13, lineHeight: 18, color: colors.text.secondary, textAlign: 'center' },
  remove: { position: 'absolute', top: spacing[2], right: spacing[2], width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(10,15,20,0.72)' },
  change: { position: 'absolute', bottom: spacing[2], alignSelf: 'center', minHeight: 44, paddingHorizontal: spacing[4], borderRadius: radii.pill, justifyContent: 'center', backgroundColor: 'rgba(10,15,20,0.72)' },
  changeLabel: { fontFamily: 'Inter-SemiBold', fontSize: 13, lineHeight: 18, color: colors.paper },
});
