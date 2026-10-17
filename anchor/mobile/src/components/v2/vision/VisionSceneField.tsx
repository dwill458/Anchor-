import { useImperativeHandle, useRef, useState, type Ref } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';
import { Mic, Square } from 'lucide-react-native';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import { v2Haptics } from '@/hooks/v2';
import { useVisionDictation } from '@/hooks/v2/vision/useVisionDictation';
import { colors, radii, spacing } from '@/theme/v2';
import { VISION_GOLD, VISION_SERIF_ITALIC } from './VisionPaperChrome';

export type VisionSceneFieldHandle = { stopDictation: () => void };

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  maxChars: number;
  placeholder: string;
  accessibilityLabel: string;
  testID?: string;
  minHeight?: number;
  onFocus?: () => void;
  onBlur?: () => void;
  /** Lets the screen release the microphone before it submits. */
  handleRef?: Ref<VisionSceneFieldHandle>;
  style?: StyleProp<ViewStyle>;
};

function recognitionAvailable(): boolean {
  try { return ExpoSpeechRecognitionModule.isRecognitionAvailable(); } catch { return false; }
}

/**
 * The scene description: a multiline field with voice input built into it. Voice is only another way
 * to type here. It adds words after what is already written, never starts creation, and the field stays
 * fully editable throughout. On a device without speech recognition the microphone is simply absent.
 */
export function VisionSceneField({ value, onChangeText, maxChars, placeholder, accessibilityLabel, testID, minHeight = 124, onFocus, onBlur, handleRef, style }: Props) {
  const latest = useRef(value);
  latest.current = value;
  const [available] = useState(recognitionAvailable);
  const dictation = useVisionDictation({ getText: () => latest.current, onText: onChangeText, maxChars });
  useImperativeHandle(handleRef, () => ({ stopDictation: dictation.stop }), [dictation.stop]);
  const listening = dictation.listening;

  return (
    <View style={style}>
      <View style={[styles.frame, listening && styles.frameListening]}>
        <TextInput
          testID={testID}
          accessibilityLabel={accessibilityLabel}
          multiline
          maxLength={maxChars}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="rgba(23,23,23,0.42)"
          onFocus={onFocus}
          onBlur={onBlur}
          style={[styles.input, { minHeight }, available && styles.inputWithMic]}
          textAlignVertical="top"
          scrollEnabled
        />
        {available ? (
          <Pressable
            testID="vision-dictate"
            accessibilityRole="button"
            accessibilityLabel={listening ? 'Stop voice input' : 'Describe it with your voice'}
            accessibilityState={{ busy: dictation.state === 'starting' }}
            hitSlop={6}
            onPress={() => { v2Haptics.selection(); dictation.toggle(); }}
            style={({ pressed }) => [styles.mic, listening && styles.micOn, pressed && styles.pressed]}
          >
            {listening ? <Square size={14} color={colors.paper} fill={colors.paper} /> : <Mic size={20} color={colors.text.primary} strokeWidth={1.6} />}
          </Pressable>
        ) : null}
      </View>
      {listening ? (
        <View style={styles.status} accessibilityLiveRegion="polite" testID="vision-dictate-status">
          <View style={styles.dot} />
          <Text style={styles.statusText}>Listening… tap the square to stop. You can edit afterwards.</Text>
        </View>
      ) : dictation.notice ? (
        <Text accessibilityLiveRegion="polite" style={styles.notice}>{dictation.notice}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { borderRadius: radii.lg, borderWidth: 1, borderColor: colors.text.primary, backgroundColor: colors.surface },
  frameListening: { borderColor: VISION_GOLD, borderWidth: 1.5 },
  input: { fontFamily: VISION_SERIF_ITALIC, fontSize: 20, lineHeight: 28, color: colors.text.primary, maxHeight: 200, padding: spacing[4] },
  inputWithMic: { paddingBottom: 56 },
  mic: {
    position: 'absolute', right: spacing[2], bottom: spacing[2], width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.grouped, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border.default,
  },
  micOn: { backgroundColor: colors.ink.deep, borderColor: colors.ink.deep },
  pressed: { opacity: 0.8 },
  status: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginTop: spacing[2] },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.semantic.error },
  statusText: { flex: 1, fontFamily: 'Inter-Regular', fontSize: 13, lineHeight: 18, color: colors.text.secondary },
  notice: { marginTop: spacing[2], fontFamily: 'Inter-Regular', fontSize: 13, lineHeight: 18, color: colors.text.secondary },
});
