import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Images, MapPin, Package, Sparkles, UserRound } from 'lucide-react-native';
import { colors, typography } from '@/theme/v2';
import type { VisionReferenceRole } from '@/types/visionConversation';
import { VisionChoiceSheet, type VisionChoiceAction } from './VisionChoiceSheet';
import { VISION_GOLD } from './VisionPaperChrome';

const ROLE_LABELS: Record<VisionReferenceRole, string> = {
  identity: 'Person',
  place: 'Place',
  object: 'Object',
  inspiration: 'Inspiration',
  world: 'Vision board',
};

const ROLE_ACTIONS: ReadonlyArray<VisionChoiceAction> = [
  { key: 'identity', label: 'Person', detail: 'Keep someone recognizable in the scene', Icon: UserRound },
  { key: 'place', label: 'Place', detail: 'Use a location as visual context', Icon: MapPin },
  { key: 'object', label: 'Object', detail: 'Include a specific item', Icon: Package },
  { key: 'inspiration', label: 'Inspiration', detail: 'Guide the look or feeling', Icon: Sparkles },
  { key: 'world', label: 'Vision board', detail: 'Continue relevant details from this Vision', Icon: Images },
];

type Props = {
  role: VisionReferenceRole;
  onChange: (role: VisionReferenceRole) => void;
  /** Uses a parent-provided inline editor instead of this chip's default choice sheet. */
  onPress?: () => void;
  disabled?: boolean;
  testID?: string;
};

/** A quiet label over a reference image; role is optional context for generation. */
export function VisionRoleChip({ role, onChange, onPress, disabled = false, testID = 'vision-reference-role' }: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${ROLE_LABELS[role]} reference role`}
        accessibilityHint="Choose how this photo should guide your scene"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => onPress ? onPress() : setVisible(true)}
        testID={testID}
        hitSlop={{ top: 9, bottom: 9, left: 2, right: 2 }}
        style={({ pressed }) => [styles.target, pressed && styles.pressed, disabled && styles.disabled]}
      >
        <Text numberOfLines={1} style={styles.label}>{ROLE_LABELS[role]} <Text style={styles.chevron}>⌄</Text></Text>
      </Pressable>
      <VisionChoiceSheet
        visible={!onPress && visible}
        onClose={() => setVisible(false)}
        title="How should this photo help?"
        subtitle="Choose the role that best describes this reference."
        actions={ROLE_ACTIONS}
        onChoose={key => {
          if (key in ROLE_LABELS) onChange(key as VisionReferenceRole);
        }}
        testID={`${testID}-chooser`}
      />
    </>
  );
}

const styles = StyleSheet.create({
  target: {
    minHeight: 26,
    minWidth: 44,
    maxWidth: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: 2,
    backgroundColor: 'rgba(14, 21, 28, 0.68)',
  },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.5 },
  label: { color: colors.paper, fontFamily: typography.bodySemiBold, fontSize: 8, lineHeight: 10, textAlign: 'center' },
  chevron: { color: VISION_GOLD, fontSize: 8 },
});
