import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, ChevronLeft, Info } from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';

import { V2Button, V2IconButton } from '@/components/v2';
import { useV2Responsive } from '@/hooks/v2';
import { V2InlineError } from '@/components/v2/feedback/V2Feedback';
import { CREATION_MAX_INTENTION_LENGTH } from '@/constants/v2/creation';
import { colors, spacing, typography } from '@/theme/v2';
import { CreationSheet, sheetText } from './CreationSheet';
import { InkUnderline } from './InkUnderline';
import { assessIntention } from './intentionGuidance';
import { DraftingSurface } from './DraftingSurface';

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

export type IntentionSuggestionContext = {
  category?: string;
  desiredOutcome?: string;
  desiredWhy?: string;
  desiredFriction?: string;
};

const cleanPhrase = (value?: string) => (value ?? '').trim().replace(/[.!?]+$/, '').replace(/\s+/g, ' ');
const lowerFirst = (phrase: string) => phrase ? `${phrase[0].toLowerCase()}${phrase.slice(1)}` : phrase;

/** Suggests short present-tense intentions from the discovery answers, without changing the user's words. */
export function intentionSuggestions(context?: IntentionSuggestionContext): string[] {
  if (!context) return [];
  const category = cleanPhrase(context.category).toLowerCase();
  const categoryPhrase: Record<string, string> = {
    career: 'in my career', health: 'in my health', relationships: 'in my relationships',
    creativity: 'in my creative work', spirituality: 'in my spiritual life', abundance: 'in my financial life',
    family: 'with my family', learning: 'in my learning', adventure: 'in my adventures',
  };
  const withCategory = (phrase: string) => category && !phrase.toLowerCase().includes(category)
    ? `${phrase} ${categoryPhrase[category] ?? ''}`.trim()
    : phrase;
  const suggestions: string[] = [];

  const outcome = lowerFirst(cleanPhrase(context.desiredOutcome).replace(/^(?:i\s+)?(?:want|need|hope\s+for|would\s+like)\s+/i, ''));
  if (outcome) suggestions.push(`I am open to ${withCategory(outcome)}.`);

  const why = lowerFirst(cleanPhrase(context.desiredWhy).replace(/^(?:i\s+)?(?:want|need|hope\s+to|would\s+like\s+to)\s+/i, ''));
  if (why) suggestions.push(`I am making room for ${withCategory(why)}.`);

  const friction = cleanPhrase(context.desiredFriction);
  if (friction) {
    const normalizedFriction = friction.toLowerCase().replace(/[’']/g, "'");
    const overthinking = friction.match(/^(?:i\s+)?overthink(?:s|ing)?\s+(?:about\s+)?(.+)$/i);
    const secondGuessing = friction.match(/^(?:i\s+)?(?:second-guess|doubt)(?:\s+myself)?(?:\s+about)?\s*(.*)$/i);
    const procrastinating = friction.match(/^(?:i\s+)?(?:procrastinate|put\s+off)\s+(.+)$/i);
    if (overthinking) suggestions.push(`I trust myself to choose ${overthinking[1]}.`);
    else if (secondGuessing) suggestions.push('I trust myself to choose my next step.');
    else if (procrastinating) suggestions.push(`I begin ${procrastinating[1]} with care.`);
    else if (/lose (?:momentum|consistency|focus)|struggle to stay consistent/.test(normalizedFriction)) suggestions.push('I keep moving, one step at a time.');
    else if (/(?:life|daily life|other priorities|work and responsibilities|short-term needs) (?:gets|take|takes) over|life gets crowded|life gets too busy/.test(normalizedFriction)) suggestions.push('I make time for what matters.');
    else if (/stay in (?:my )?comfort zone|stay with what feels familiar/.test(normalizedFriction)) suggestions.push('I take one step beyond what feels familiar.');
    else if (/avoid difficult conversations/.test(normalizedFriction)) suggestions.push('I meet important conversations with honesty.');
    else if (/stop being intentional/.test(normalizedFriction)) suggestions.push('I show up with intention.');
    else if (/fall back into old habits/.test(normalizedFriction)) suggestions.push('I choose habits that support me.');
    else if (/get distracted/.test(normalizedFriction)) suggestions.push('I return my attention to what matters.');
    else if (/struggle to stay present/.test(normalizedFriction)) suggestions.push('I return to the present moment.');
    else if (/wait for inspiration/.test(normalizedFriction)) suggestions.push('I create before I feel ready.');
    else if (/forget what matters/.test(normalizedFriction)) suggestions.push('I return to what matters.');
    else if (/get overwhelmed|get discouraged/.test(normalizedFriction)) suggestions.push('I focus on one step at a time.');
    else if (/don't know what (?:to focus on next|move to make next)/.test(normalizedFriction)) suggestions.push('I trust myself to choose my next step.');
    else if (/assume there will be more time later/.test(normalizedFriction)) suggestions.push('I make this moment count.');
    else if (/keep waiting for the right time|keep putting it off/.test(normalizedFriction)) suggestions.push('I begin now, one step at a time.');
    else if (/same patterns/.test(normalizedFriction)) suggestions.push('We make space for a new pattern together.');
    else {
      const affirmative = friction.replace(/^(?:i\s+)?(?:don't\s+want\s+to|want\s+to\s+stop\s+|struggle\s+to\s+)/i, '').trim();
      if (affirmative) suggestions.push('I move forward with care and attention.');
    }
  }

  return [...new Set(suggestions.map((suggestion) => suggestion.trim()).filter(Boolean))].slice(0, 3);
}

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
  suggestionContext,
}: {
  intention: string;
  formationError?: string;
  onChange: (text: string) => void;
  onSubmit: () => void;
  onExit?: () => void;
  suggestionContext?: IntentionSuggestionContext;
}) {
  const [isFocused, setIsFocused] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const trimmed = intention.trim();
  const wordCount = trimmed ? trimmed.split(/\s+/).length : 0;
  const isReady = trimmed.length > 2;
  const guidance = assessIntention(intention);
  const suggestions = intentionSuggestions(suggestionContext);
  const showSuggestionChips = suggestions.length > 0;
  const metPrinciples = (['short', 'present'] as const).filter((id) => guidance[id] === 'met');
  const { gutter } = useV2Responsive();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.safe, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
    <StatusBar style="dark" />
    {/* The app draws edge to edge, so Android no longer resizes the window for the keyboard:
        both platforms avoid it here, keeping Continue above the keyboard. */}
    <KeyboardAvoidingView style={styles.safe} behavior="padding">
    <DraftingSurface />
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
          <V2IconButton icon={<ChevronLeft size={20} color={colors.text.primary} />} accessibilityLabel="Go back" onPress={onExit} />
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
          {showSuggestionChips ? (
            <View style={styles.suggestionList}>
              {suggestions.map((suggestion, index) => (
                <Pressable
                  key={suggestion}
                  style={styles.suggestionChip}
                  onPress={() => onChange(sanitizeIntention(suggestion))}
                  accessibilityRole="button"
                  accessibilityLabel={`Use suggestion: ${suggestion}`}
                  testID={`intention-suggestion-${index}`}
                >
                  <Text style={styles.suggestionText}>{suggestion}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
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

          {!trimmed && !showSuggestionChips && (
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
  suggestionList: { gap: spacing[2] },
  suggestionChip: { alignSelf: 'flex-start', maxWidth: '100%', borderBottomWidth: 1, borderColor: colors.border.subtle, paddingVertical: spacing[2] },
  suggestionText: { ...typography.bodySM, color: colors.text.primary },
  fieldLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  fieldLabel: { ...typography.labelSM, color: colors.text.secondary, letterSpacing: 1 },
  charCounter: { ...typography.caption, color: colors.text.secondary, fontVariant: ['tabular-nums'] },
  charCounterNear: { color: colors.text.primary },
  // The intention is written on the room's paper, with a single baseline rather than a card.
  intentionSurface: {
    minHeight: 180,
    maxHeight: 260,
    borderBottomWidth: 1,
    borderColor: colors.border.strong,
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
    paddingVertical: spacing[4],
  },
  intentionSurfaceFocused: {
    borderColor: colors.text.primary,
  },
  intentionInput: {
    fontFamily: 'EBGaramond-Medium',
    fontSize: 28,
    lineHeight: 36,
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
