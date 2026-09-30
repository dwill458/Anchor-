import React, { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera, ChevronRight, Images, Sparkles } from 'lucide-react-native';
import { V2SheetGrabZone, V2SheetModal, V2_SHEET_SKIRT } from '@/components/v2/primitives/V2SheetModal';
import { useV2ReduceMotion } from '@/hooks/v2';
import { colors, radii, spacing, typography } from '@/theme/v2';

export type VisionAddChoice = 'generate' | 'library' | 'camera';

type Props = {
  visible: boolean;
  onClose: () => void;
  onChoose: (choice: VisionAddChoice) => void;
  testID?: string;
};

/** A native picker cannot open over a dismissing Modal on iOS; the sheet's exit finishes first. */
export const VISION_ADD_SHEET_HANDOFF_MS = 360;

const OPTIONS: Array<{ choice: VisionAddChoice; title: string; detail: string; Icon: typeof Sparkles }> = [
  { choice: 'generate', title: 'Generate with AI', detail: 'Describe a scene and see it appear', Icon: Sparkles },
  { choice: 'library', title: 'Choose from Photos', detail: 'Add a photo from your library', Icon: Images },
  { choice: 'camera', title: 'Take Photo', detail: 'Capture something from your world', Icon: Camera },
];

/**
 * The one place "Add image" leads: three ways to put a moment on the board.
 * Choosing closes the sheet, then acts once it has left the screen.
 */
export function VisionAddSheet({ visible, onClose, onChoose, testID = 'vision-add-sheet' }: Props) {
  const reduceMotion = useV2ReduceMotion();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const choose = (choice: VisionAddChoice) => {
    onClose();
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onChoose(choice), reduceMotion ? 0 : VISION_ADD_SHEET_HANDOFF_MS);
  };

  return (
    <V2SheetModal visible={visible} onClose={onClose} reduceMotion={reduceMotion} scrimAccessibilityLabel="Close" testID={testID}>
      <SafeAreaView edges={['bottom']} style={styles.sheet} accessibilityViewIsModal>
        <V2SheetGrabZone>
          <View style={styles.handle} />
          <Text accessibilityRole="header" style={styles.title}>Add to your Vision</Text>
          <Text style={styles.subtitle}>Another moment from the future around this Anchor.</Text>
        </V2SheetGrabZone>
        <View style={styles.options}>
          {OPTIONS.map(({ choice, title, detail, Icon }) => {
            const isFeatured = choice === 'generate';
            return (
              <Pressable key={choice} testID={`${testID}-${choice}`} accessibilityRole="button" accessibilityLabel={title}
                accessibilityHint={detail} onPress={() => choose(choice)}
                style={({ pressed }) => [styles.option, isFeatured && styles.optionFeatured, pressed && styles.pressed]}>
                <View style={[styles.iconWell, isFeatured && styles.iconWellFeatured]}>
                  <Icon size={20} color={isFeatured ? '#8B5CF6' : colors.text.primary} />
                </View>
                <View style={styles.copy}>
                  <Text style={[styles.optionTitle, isFeatured && styles.optionTitleFeatured]}>{title}</Text>
                  <Text style={styles.optionDetail}>{detail}</Text>
                </View>
                {isFeatured && <ChevronRight size={18} color="#8B5CF6" style={styles.chevron} />}
              </Pressable>
            );
          })}
        </View>
      </SafeAreaView>
    </V2SheetModal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
    // The surface continues below the screen edge so the spring's overshoot never opens a gap.
    paddingBottom: spacing[5] + V2_SHEET_SKIRT,
    marginBottom: -V2_SHEET_SKIRT,
    flexShrink: 1,
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -6 },
    elevation: 12,
  },
  handle: { alignSelf: 'center', width: 38, height: 4, borderRadius: 99, backgroundColor: colors.border.default, marginBottom: 14 },
  title: { ...typography.headingMD, color: colors.text.primary },
  subtitle: { ...typography.bodySM, color: colors.text.secondary, marginTop: 2, marginBottom: spacing[3] },
  options: { gap: spacing[2] },
  option: {
    minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingHorizontal: spacing[3],
    borderRadius: radii.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border.default, backgroundColor: colors.canvas,
  },
  optionFeatured: {
    backgroundColor: '#F5EEFA',
    borderColor: '#E9D5FF',
  },
  iconWell: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border.default },
  iconWellFeatured: {
    backgroundColor: '#EDE4F7',
    borderColor: '#D8B4FE',
  },
  copy: { flex: 1, gap: 1 },
  optionTitle: { ...typography.labelLG, color: colors.text.primary },
  optionTitleFeatured: { color: '#6B21A8' },
  optionDetail: { ...typography.caption, color: colors.text.secondary },
  chevron: { marginLeft: spacing[1] },
  pressed: { opacity: 0.72 },
});
