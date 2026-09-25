import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, Info, X } from 'lucide-react-native';

import { V2Button, V2IconButton } from '@/components/v2';
import { useV2Responsive } from '@/hooks/v2';
import { V2InlineError } from '@/components/v2/feedback/V2Feedback';
import { CREATION_MAX_INTENTION_LENGTH } from '@/constants/v2/creation';
import { colors, spacing, typography } from '@/theme/v2';
import { CreationSheet, sheetText } from './CreationSheet';
import { InkUnderline } from './InkUnderline';
import { assessIntention } from './intentionGuidance';

/** Enforces the limit even when text arrives by paste/autofill, and keeps the intention to one flowing line of prose. */
export function sanitizeIntention(value: string): string {
  let next = value.replace(/\s*[\r\n]+\s*/g, ' ');
  if (next.length > CREATION_MAX_INTENTION_LENGTH) {
    next = next.slice(0, CREATION_MAX_INTENTION_LENGTH);
    // Never leave half of a surrogate pair (emoji) at the cut.
    const last = next.charCodeAt(next.length - 1);
    if (last >= 0xd800 && last <= 0xdbff) next = next.slice(0, -1);
  }
  return next;
}

/** Present-tense is the taught form; these show it without requiring it. */
const INTENTION_EXAMPLE = { before: 'I want to stop getting distracted.', after: 'I am fully present with my work.' };

function PrinciplesSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <CreationSheet visible={visible} title="Short · Present · Felt" onClose={onClose}>
      <View style={styles.sheetItem}>
        <Text style={sheetText.label}>SHORT</Text>
        <Text style={sheetText.body}>One intention. One direction.</Text>
      </View>
      <View style={styles.sheetItem}>
        <Text style={sheetText.label}>PRESENT</Text>
        <Text style={sheetText.body}>Write it as true now, not as something you’re trying to escape.</Text>
        <View style={styles.sheetExample}>
          <View style={styles.hintRow}>
            <Text style={styles.hintTag}>Instead of </Text>
            <Text style={styles.hintQuoteBad}>“I don’t want to procrastinate.”</Text>
          </View>
          <View style={styles.hintRow}>
            <Text style={styles.hintTagTry}>TRY </Text>
            <Text style={styles.hintQuoteGood}>“I begin important work immediately.”</Text>
          </View>
        </View>
      </View>
      <View style={styles.sheetItem}>
        <Text style={sheetText.label}>FELT</Text>
        <Text style={sheetText.body}>Use words that feel personally meaningful.</Text>
      </View>
    </CreationSheet>
  );
}

export function IntentionStep({
  intention,
  formationError,
  onChange,
  onSubmit,
  onExit,
}: {
  intention: string;
  formationError?: string;
  onChange: (text: string) => void;
  onSubmit: () => void;
  onExit?: () => void;
}) {
  const [isFocused, setIsFocused] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const trimmed = intention.trim();
  const wordCount = trimmed ? trimmed.split(/\s+/).length : 0;
  const isReady = trimmed.length > 2;
  const guidance = assessIntention(intention);
  const metPrinciples = (['short', 'present'] as const).filter((id) => guidance[id] === 'met');
  const { gutter } = useV2Responsive();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.safe, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
    {/* The app draws edge to edge, so Android no longer resizes the window for the keyboard:
        both platforms avoid it here, keeping Continue above the keyboard. */}
    <KeyboardAvoidingView style={styles.safe} behavior="padding">
    <ScrollView
      // Taps on the CTA / principles row must land while the keyboard is up, and the content
      // fills the viewport so Continue rests on the bottom safe area.
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      contentContainerStyle={[styles.content, { paddingHorizontal: gutter }]}
      showsVerticalScrollIndicator={false}
      testID="v2-creation-intention"
    >
      {onExit ? (
        <View style={styles.top}>
          <V2IconButton icon={<X size={20} color={colors.text.primary} />} accessibilityLabel="Close" onPress={onExit} />
        </View>
      ) : null}

      <View style={styles.flow}>
        <View style={styles.heroBlock}>
          {!isFocused && <Text style={styles.eyebrow}>INTENTION</Text>}
          <View accessible accessibilityRole="header" accessibilityLabel="Every Anchor starts here.">
            <Text style={[styles.heroHeadline, isFocused && styles.heroHeadlineFocused]} accessible={false}>
              Every Anchor starts
            </Text>
            <InkUnderline>
              <Text style={[styles.heroHeadline, isFocused && styles.heroHeadlineFocused]} accessible={false}>here.</Text>
            </InkUnderline>
          </View>
          <Text style={styles.heroSubhead}>Write one clear intention.</Text>
        </View>

        <View style={styles.inputBlock}>
          <View style={styles.fieldLabelRow}>
            <Text style={styles.fieldLabel}>YOUR INTENTION</Text>
            <Text
              style={[styles.charCounter, intention.length >= CREATION_MAX_INTENTION_LENGTH - 10 && styles.charCounterNear]}
              accessibilityLabel={`${intention.length} of ${CREATION_MAX_INTENTION_LENGTH} characters`}
            >
              {intention.length}/{CREATION_MAX_INTENTION_LENGTH}
            </Text>
          </View>
          <View style={[styles.intentionSurface, isFocused && styles.intentionSurfaceFocused]}>
            <TextInput
              value={intention}
              onChangeText={(text) => onChange(sanitizeIntention(text))}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder={INTENTION_EXAMPLE.after}
              placeholderTextColor={colors.text.disabled}
              multiline
              maxLength={CREATION_MAX_INTENTION_LENGTH}
              returnKeyType="done"
              submitBehavior="blurAndSubmit"
              autoCapitalize="sentences"
              selectionColor={colors.text.primary}
              style={styles.intentionInput}
              accessibilityLabel="Your intention"
              accessibilityHint="Write one intention in the present tense."
              testID="intention-input"
            />
          </View>

          {!trimmed && (
            <View style={styles.hintBlock}>
              <View style={styles.hintRow}>
                <Text style={styles.hintTag}>Instead of </Text>
                <Text style={styles.hintQuoteBad}>“{INTENTION_EXAMPLE.before}”</Text>
              </View>
              <View style={styles.hintRow}>
                <Text style={styles.hintTagTry}>TRY </Text>
                <Text style={styles.hintQuoteGood}>“{INTENTION_EXAMPLE.after}”</Text>
              </View>
            </View>
          )}

          {wordCount > 14 ? <Text style={styles.hintGuidance}>Keep it short enough to hold in mind.</Text> : null}
        </View>

        <View style={styles.spacer} />

        <View style={styles.bottom}>
          <Pressable
            style={styles.spfBlock}
            onPress={() => setSheetOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={`About these principles: short, present, felt.${metPrinciples.length ? ` Looks good: ${metPrinciples.join(', ')}.` : ''}`}
            testID="intention-principles-row"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <View style={styles.spfHeadingRow}>
              <View style={styles.spfList}>
                {(['short', 'present', 'felt'] as const).map((id, index) => {
                  const met = guidance[id] === 'met';
                  return (
                    <React.Fragment key={id}>
                      {index > 0 ? <Text style={styles.spfDot}>·</Text> : null}
                      <View style={styles.spfItem}>
                        <Text style={[styles.principleLabel, !met && styles.principleLabelQuiet]}>{id.toUpperCase()}</Text>
                        {met ? (
                          <View style={styles.spfCheck}>
                            <Check size={11} color={colors.text.primary} strokeWidth={2.5} />
                          </View>
                        ) : null}
                      </View>
                    </React.Fragment>
                  );
                })}
              </View>
              <View style={styles.spfInfoIcon}>
                <Info size={14} color={colors.text.secondary} />
              </View>
            </View>
            <Text style={styles.spfHint}>Three rules for a stronger intention.</Text>
          </Pressable>

          {formationError ? <V2InlineError message={formationError} /> : null}

          <V2Button
            size="large"
            style={styles.cta}
            disabled={!isReady}
            onPress={onSubmit}
            accessibilityLabel="Continue with this intention"
            testID="intention-continue"
          >
            Continue →
          </V2Button>
        </View>
      </View>

    </ScrollView>
    </KeyboardAvoidingView>
    <PrinciplesSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  content: { flexGrow: 1, paddingTop: spacing[2], paddingBottom: spacing[3] },
  top: { alignSelf: 'flex-start', marginLeft: -spacing[2], marginBottom: spacing[1] },
  flow: { flex: 1, gap: spacing[5] },
  eyebrow: { ...typography.labelSM, color: colors.text.secondary },
  heroBlock: { gap: spacing[2] },
  heroHeadline: { fontFamily: 'EBGaramond-Regular', fontSize: 34, lineHeight: 38, letterSpacing: -0.4, color: colors.text.primary },
  heroHeadlineFocused: { fontSize: 26, lineHeight: 30, letterSpacing: -0.3 },
  heroSubhead: { fontFamily: typography.body, fontSize: 15, lineHeight: 22, color: colors.text.secondary, marginTop: 2 },
  inputBlock: { gap: spacing[3] },
  fieldLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  fieldLabel: { ...typography.labelSM, color: colors.text.secondary, letterSpacing: 1 },
  charCounter: { ...typography.caption, color: colors.text.secondary, fontVariant: ['tabular-nums'] },
  charCounterNear: { color: colors.text.primary },
  // A refined tactile writing surface: warm fine paper tone, hairline deckle border, subtle material presence
  intentionSurface: {
    minHeight: 180,
    maxHeight: 260,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(216, 210, 200, 0.75)',
    backgroundColor: '#FAF7F0',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    shadowColor: '#171717',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  intentionSurfaceFocused: {
    borderColor: colors.border.strong,
    backgroundColor: '#FCFAF5',
  },
  intentionInput: {
    fontFamily: 'EBGaramond-Medium',
    fontSize: 23,
    lineHeight: 31,
    letterSpacing: -0.2,
    color: colors.text.primary,
    flex: 1,
    minHeight: 140,
    textAlignVertical: 'top',
    padding: 0,
  },
  hintBlock: { marginTop: spacing[1], gap: 4 },
  hintRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline' },
  hintTag: { ...typography.bodySM, color: colors.text.secondary },
  hintQuoteBad: { fontFamily: 'EBGaramond-Italic', fontSize: 16, lineHeight: 21, color: colors.text.secondary },
  hintTagTry: { ...typography.labelSM, color: colors.text.secondary, letterSpacing: 0.8 },
  hintQuoteGood: { fontFamily: 'EBGaramond-Medium', fontSize: 16, lineHeight: 21, color: colors.text.primary },
  hintGuidance: { fontFamily: 'EBGaramond-Italic', fontSize: 15, color: colors.text.secondary, marginTop: spacing[2] },
  spacer: { flex: 1, minHeight: spacing[5] },
  bottom: { gap: spacing[4], paddingBottom: spacing[4] },
  spfBlock: { alignSelf: 'flex-start', gap: 4, paddingVertical: spacing[1] },
  spfHeadingRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  spfList: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  spfItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  spfCheck: { marginLeft: 1 },
  spfDot: { ...typography.labelSM, color: colors.text.disabled },
  spfInfoIcon: { marginLeft: 2, alignItems: 'center', justifyContent: 'center' },
  spfHint: { ...typography.caption, color: colors.text.secondary },
  principleLabel: { ...typography.labelSM, color: colors.text.primary },
  principleLabelQuiet: { color: colors.text.secondary },
  cta: { height: 56, borderRadius: 16 },
  sheetItem: { gap: 4 },
  sheetExample: { marginTop: spacing[1], gap: 4 },
});
