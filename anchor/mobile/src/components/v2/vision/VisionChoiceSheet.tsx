import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Camera } from 'lucide-react-native';
import { V2SheetGrabZone, V2SheetModal, V2_SHEET_SKIRT } from '@/components/v2/primitives/V2SheetModal';
import { useV2ReduceMotion, v2Haptics } from '@/hooks/v2';
import { colors, radii, spacing } from '@/theme/v2';
import { VISION_ADD_SHEET_HANDOFF_MS } from './VisionAddSheet';
import { AnimatedPressable, usePressScale } from './VisionMotion';
import { VISION_GOLD, VISION_SERIF } from './VisionPaperChrome';

export type VisionChoiceAction = {
  key: string;
  label: string;
  detail?: string;
  Icon: typeof Camera;
  destructive?: boolean;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  actions: ReadonlyArray<VisionChoiceAction>;
  onChoose: (key: string) => void;
  testID?: string;
};

function ChoiceRow({ action, first, testID, onPress }: { action: VisionChoiceAction; first: boolean; testID: string; onPress: () => void }) {
  const press = usePressScale(0.985);
  const { Icon } = action;
  return (
    <AnimatedPressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={action.label}
      accessibilityHint={action.detail}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      style={[styles.row, !first && styles.rowRule, press.style]}
    >
      <View style={styles.well}>
        <Icon size={20} color={action.destructive ? colors.semantic.error : VISION_GOLD} strokeWidth={1.6} />
      </View>
      <View style={styles.copy}>
        <Text style={[styles.label, action.destructive && styles.labelDestructive]}>{action.label}</Text>
        {action.detail ? <Text style={styles.detail}>{action.detail}</Text> : null}
      </View>
    </AnimatedPressable>
  );
}

/**
 * A short choice on paper: the Vision flow's replacement for a system alert.
 * It rides the shared V2 sheet, so it springs up from the edge over a fading
 * scrim, follows a drag by its handle, and dismisses on a flick. Choosing closes
 * the sheet first and acts once it has left, so a picker never opens over it.
 */
export function VisionChoiceSheet({ visible, onClose, title, subtitle, actions, onChoose, testID = 'vision-choice-sheet' }: Props) {
  const reduceMotion = useV2ReduceMotion();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const choose = (key: string) => {
    v2Haptics.selection();
    onClose();
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onChoose(key), reduceMotion ? 0 : VISION_ADD_SHEET_HANDOFF_MS);
  };

  return (
    <V2SheetModal visible={visible} onClose={onClose} reduceMotion={reduceMotion} scrimAccessibilityLabel="Close" testID={testID}>
      <SafeAreaView edges={['bottom']} style={styles.sheet} accessibilityViewIsModal>
        <V2SheetGrabZone>
          <View style={styles.handle} />
          <Text accessibilityRole="header" style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </V2SheetGrabZone>
        <View>
          {actions.map((action, index) => (
            <ChoiceRow key={action.key} action={action} first={index === 0} testID={`${testID}-${action.key}`} onPress={() => choose(action.key)} />
          ))}
        </View>
      </SafeAreaView>
    </V2SheetModal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: colors.canvas,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
    // The paper continues below the screen edge so the spring's overshoot never opens a gap.
    paddingBottom: spacing[4] + V2_SHEET_SKIRT,
    marginBottom: -V2_SHEET_SKIRT,
    flexShrink: 1,
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -6 },
    elevation: 12,
  },
  handle: { alignSelf: 'center', width: 38, height: 4, borderRadius: 99, backgroundColor: colors.border.default, marginBottom: 14 },
  title: { fontFamily: VISION_SERIF, fontSize: 26, lineHeight: 32, letterSpacing: -0.4, color: colors.text.primary },
  subtitle: { fontFamily: 'Inter-Regular', fontSize: 14, lineHeight: 20, color: colors.text.secondary, marginTop: 2, marginBottom: spacing[3] },
  row: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  rowRule: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border.default },
  well: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(176,138,74,0.45)',
  },
  copy: { flex: 1, gap: 1 },
  label: { fontFamily: VISION_SERIF, fontSize: 21, lineHeight: 27, color: colors.text.primary },
  labelDestructive: { color: colors.semantic.error },
  detail: { fontFamily: 'Inter-Regular', fontSize: 13, lineHeight: 18, color: colors.text.secondary },
});
