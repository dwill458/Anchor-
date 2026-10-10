import React, { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { ArrowLeft, Check } from 'lucide-react-native';
import type { VisionNoteStyleId } from '@/adapters/v2/vision';
import { useV2ReduceMotion } from '@/hooks/v2';
import { colors, radii, spacing, typography } from '@/theme/v2';
import { VisionNoteRenderer } from '@/components/v2/vision/notes/VisionNoteRenderer';
import { VISION_SERIF } from '@/components/v2/vision/VisionPaperChrome';
import {
  VISION_NOTE_FAMILIES, VISION_NOTE_MAX_CHARS,
  VISION_NOTE_PRESETS, VISION_NOTE_STYLE_TRANSITION_MS, type VisionNoteFamily,
} from '@/components/v2/vision/notes/visionNoteStyles';

type RouteParams = { anchorId: string; visionId?: string };
type Props = {
  route: { params: RouteParams };
  navigation: { goBack: () => void };
};

const FAMILY_LABELS: Record<VisionNoteFamily, string> = { sticky: 'Sticky Notes', paper: 'Paper', editorial: 'Editorial' };

/** Preview-only note composer. Saving is intentionally unavailable until notes have a server contract. */
export function V2VisionNoteComposer({ route, navigation }: Props) {
  const reduceMotion = useV2ReduceMotion();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState('');
  const [family, setFamily] = useState<VisionNoteFamily>('sticky');
  const [styleId, setStyleId] = useState<VisionNoteStyleId>('sticky_blush_pink');
  const [previousStyleId, setPreviousStyleId] = useState<VisionNoteStyleId | null>(null);
  const progress = useSharedValue(1);
  const settle = useSharedValue(1);
  const text = draft || 'Your note will appear here';
  const previewSize = Math.min(288, screenWidth - spacing[5] * 2 - spacing[4], Math.max(196, screenHeight * 0.32));
  const previewWidth = previewSize;
  const previewHeight = previewSize;
  const swatchWidth = (Math.min(screenWidth, 540) - spacing[5] * 2 - spacing[3] * 3) / 4;

  const clearPrevious = useCallback(() => setPreviousStyleId(null), []);
  const selectStyle = useCallback((next: VisionNoteStyleId) => {
    if (next === styleId) return;
    if (reduceMotion) {
      setPreviousStyleId(null);
      progress.value = 1;
      settle.value = 1;
    } else {
      setPreviousStyleId(styleId);
      progress.value = 0;
      settle.value = 1.02;
      progress.value = withTiming(1, { duration: VISION_NOTE_STYLE_TRANSITION_MS }, finished => {
        if (finished) runOnJS(clearPrevious)();
      });
      settle.value = withSpring(1, { damping: 20, stiffness: 210, mass: 0.8 });
    }
    setStyleId(next);
  }, [clearPrevious, progress, reduceMotion, settle, styleId]);

  const currentMaterial = useAnimatedStyle(() => ({
    opacity: reduceMotion ? 1 : progress.value,
    transform: reduceMotion ? [] : [{ translateY: (1 - settle.value) * 150 }, { scale: settle.value }],
  }), [reduceMotion]);
  const previousMaterial = useAnimatedStyle(() => ({ opacity: reduceMotion ? 0 : 1 - progress.value }), [reduceMotion]);

  const selectFamily = (next: VisionNoteFamily) => {
    setFamily(next);
    const first = VISION_NOTE_PRESETS.find(preset => preset.family === next);
    if (first) selectStyle(first.id);
  };

  const changeDraft = (value: string) => setDraft(Array.from(value).slice(0, VISION_NOTE_MAX_CHARS).join(''));
  return (
    <SafeAreaView testID={`v2-vision-note-composer-${route.params.anchorId}`} style={styles.safe} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.header}>
          <Pressable onPress={navigation.goBack} accessibilityRole="button" accessibilityLabel="Go back" hitSlop={10} style={styles.back}>
            <ArrowLeft size={21} color={colors.text.primary} />
          </Pressable>
          <Text accessibilityRole="header" style={styles.title}>Add a Note</Text>
          <View style={styles.headerBalance} />
        </View>
        <ScrollView style={styles.flex} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'} showsVerticalScrollIndicator={false}>
          <View style={styles.previewSection}>
              <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(240).withInitialValues({ transform: [{ translateY: 6 }] })}
                testID="vision-note-preview" accessibilityLabel={`Note preview. ${text}`} style={[styles.previewStage, { width: previewWidth, height: previewHeight }]}>
              {previousStyleId ? <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
                style={[styles.materialLayer, previousMaterial]}>
                <VisionNoteRenderer styleId={previousStyleId} text={text} width={previewWidth} height={previewHeight} testID="vision-note-previous-material" />
              </Animated.View> : null}
              <Animated.View style={[styles.materialLayer, currentMaterial]}>
                <VisionNoteRenderer styleId={styleId} text={text} width={previewWidth} height={previewHeight} testID="vision-note-current-renderer" />
              </Animated.View>
            </Animated.View>
            <Text style={styles.previewCaption}>{draft ? 'Live preview' : 'Preview'}</Text>
          </View>

          <View style={styles.inputBlock}>
            <TextInput testID="vision-note-input" value={draft} onChangeText={changeDraft} multiline
              // Native input counts UTF-16; allow two units per emoji, then clamp and count Unicode code points above.
              maxLength={VISION_NOTE_MAX_CHARS * 2}
              textAlignVertical="top" placeholder="Write a note…" placeholderTextColor={colors.text.tertiary}
              accessibilityLabel="Write a note" style={styles.input} returnKeyType="default" />
            <Text accessibilityLiveRegion="polite" style={styles.counter}>{Array.from(draft).length} / {VISION_NOTE_MAX_CHARS}</Text>
          </View>

          <View style={styles.styleHeader}>
            <Text style={styles.sectionTitle}>Choose a material</Text>
            <Text style={styles.styleHint}>Your words stay the same as you explore.</Text>
          </View>
          <View accessibilityRole="tablist" style={styles.tabs}>
            {VISION_NOTE_FAMILIES.map(option => {
              const selected = family === option;
              return <Pressable key={option} testID={`vision-note-family-${option}`} accessibilityRole="tab"
                accessibilityLabel={`${FAMILY_LABELS[option]} styles`} accessibilityState={{ selected }} onPress={() => selectFamily(option)}
                style={[styles.tab, selected && styles.tabSelected]}>
                <Text style={[styles.tabText, selected && styles.tabTextSelected]}>{FAMILY_LABELS[option]}</Text>
              </Pressable>;
            })}
          </View>
          <View testID="vision-note-style-grid" accessibilityLabel={`${family} styles`} style={styles.grid}>
            {VISION_NOTE_PRESETS.filter(preset => preset.family === family).map(preset => {
              const selected = styleId === preset.id;
              return <View key={preset.id} style={[styles.swatchCell, { width: swatchWidth }]}>
                <Pressable testID={`vision-note-style-${preset.id}`} accessibilityRole="button"
                  accessibilityLabel={`${preset.label} note style`} accessibilityState={{ selected }} onPress={() => selectStyle(preset.id)}
                  style={[styles.swatch, { width: swatchWidth, height: swatchWidth }, selected && styles.swatchSelected]}>
                  <VisionNoteRenderer styleId={preset.id} text="" width={swatchWidth - 12} height={swatchWidth - 12} testID={`vision-note-swatch-${preset.id}`} scrollText={false} shadowOverride="none" />
                  {selected ? <View style={styles.check}><Check size={13} color={colors.paper} /></View> : null}
                </Pressable>
                <Text numberOfLines={2} style={[styles.swatchText, { width: swatchWidth }]}>{preset.label}</Text>
              </View>;
            })}
          </View>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing[3]) }]}>
          <Text style={styles.notice}>Preview only. Saving notes will be available in a future update.</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Add to Vision" accessibilityState={{ disabled: true }} disabled
            style={styles.addButton}>
            <Text style={styles.addButtonText}>Add to Vision</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  header: { height: 56, paddingHorizontal: spacing[4], flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { width: 44, height: 44, alignItems: 'flex-start', justifyContent: 'center' },
  title: { fontFamily: VISION_SERIF, fontSize: 26, lineHeight: 32, color: colors.text.primary },
  headerBalance: { width: 44 },
  content: { alignSelf: 'center', width: '100%', maxWidth: 540, paddingHorizontal: spacing[5], paddingBottom: spacing[5] },
  previewSection: { alignItems: 'center', marginTop: spacing[2], marginBottom: spacing[4] },
  previewStage: { alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  materialLayer: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  previewCaption: { ...typography.caption, color: colors.text.secondary, marginTop: spacing[1] },
  inputBlock: { minHeight: 104, padding: spacing[3], borderRadius: radii.md, borderWidth: 1, borderColor: colors.border.default, backgroundColor: colors.surface },
  input: { ...typography.bodyMD, color: colors.text.primary, minHeight: 62, maxHeight: 132, padding: 0 },
  counter: { ...typography.caption, color: colors.text.tertiary, textAlign: 'right', marginTop: spacing[1] },
  styleHeader: { marginTop: spacing[4], marginBottom: spacing[2] },
  sectionTitle: { ...typography.headingSM, color: colors.text.primary },
  styleHint: { ...typography.caption, color: colors.text.secondary, marginTop: spacing[1] },
  tabs: { flexDirection: 'row', padding: 3, gap: spacing[1], borderRadius: radii.md, backgroundColor: colors.grouped },
  tab: { minHeight: 42, flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: radii.sm },
  tabSelected: { backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border.default },
  tabText: { ...typography.labelMD, color: colors.text.secondary },
  tabTextSelected: { color: colors.text.primary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start', columnGap: spacing[3], rowGap: spacing[2], marginTop: spacing[3] },
  swatchCell: { alignItems: 'center', gap: spacing[1] },
  swatch: { borderRadius: radii.sm, borderWidth: 1, justifyContent: 'center', alignItems: 'center', overflow: 'visible' },
  swatchSelected: { borderWidth: 2, borderColor: colors.text.primary },
  swatchText: { ...typography.caption, color: colors.text.secondary, textAlign: 'center', minHeight: 30 },
  check: { position: 'absolute', top: 5, right: 5, width: 20, height: 20, borderRadius: 10, backgroundColor: colors.ink.base, justifyContent: 'center', alignItems: 'center' },
  footer: { paddingHorizontal: spacing[5], paddingTop: spacing[2], paddingBottom: spacing[3], borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border.subtle, backgroundColor: colors.background },
  notice: { ...typography.caption, color: colors.text.secondary, textAlign: 'center', marginBottom: spacing[2] },
  addButton: { minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 26, backgroundColor: colors.ink.base },
  addButtonText: { ...typography.labelLG, color: colors.paper, opacity: 0.55 },
});
