import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { ArrowLeft, Sparkles } from 'lucide-react-native';
import { EvolvingAnchor, type AnchorPresence } from '@/components/v2/anchor/EvolvingAnchor';
import type { AnchorExpression } from '@/constants/v2/creation';
import { useV2SelectedAnchor } from '@/hooks/v2/home/useV2SelectedAnchor';
import { useV2ReduceMotion } from '@/hooks/v2';
import { colors, getCategoryColor, spacing, typography } from '@/theme/v2';

const STATES: AnchorPresence[] = ['Surface', 'Grounded', 'Rooted', 'Embedded', 'Sovereign'];

export function V2EvolvingAnchorPrototype() {
  const navigation = useNavigation<any>();
  const isFocused = useIsFocused();
  const reduceMotion = useV2ReduceMotion();
  const { selectedAnchor, activeAnchors } = useV2SelectedAnchor();
  const [presence, setPresence] = useState<AnchorPresence>('Rooted');
  const [strengthening, setStrengthening] = useState(false);
  const [eventKey, setEventKey] = useState(0);
  const accent = getCategoryColor(selectedAnchor?.category);
  const expression = (selectedAnchor?.classifierMeta?.v2Expression ?? 'original') as AnchorExpression;

  useEffect(() => {
    if (!strengthening) return undefined;
    const timeout = setTimeout(() => setStrengthening(false), 2200);
    return () => clearTimeout(timeout);
  }, [eventKey, strengthening]);

  const playStrengthening = () => {
    if (reduceMotion) return;
    setStrengthening(false);
    requestAnimationFrame(() => {
      setEventKey((key) => key + 1);
      setStrengthening(true);
    });
  };

  return <ScrollView style={styles.screen} contentContainerStyle={styles.content} testID="evolving-anchor-prototype">
    <View style={styles.topBar}>
      <Pressable onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Go back" style={styles.back}><ArrowLeft size={20} color={colors.text.primary} /></Pressable>
      <Text style={styles.kicker}>DEVELOPMENT PROTOTYPE</Text>
      <View style={{ width: 40 }} />
    </View>
    <Text style={styles.title}>Evolving Anchors</Text>
    <Text style={styles.intro}>The mark stays the same. Its material gains quiet depth with practice.</Text>

    {selectedAnchor ? <>
      <View style={styles.anchorLabelRow}><View style={[styles.dot, { backgroundColor: accent }]} /><Text style={styles.anchorLabel} numberOfLines={1}>{selectedAnchor.intentionText || 'Your Anchor'}</Text><Text style={styles.category}>{selectedAnchor.category ?? 'Custom'}</Text></View>
      <View style={styles.hero}>
        <EvolvingAnchor svg={selectedAnchor.baseSigilSvg} imageUrl={selectedAnchor.enhancedImageUrl} category={selectedAnchor.category} expression={expression} presence={presence} size={218} active={isFocused} reduceMotion={reduceMotion} strengthening={strengthening} testID="evolving-anchor-active" />
        <Text style={styles.heroState}>{presence.toUpperCase()}</Text>
        <Text style={styles.heroCaption}>Same generated paths · changing light only</Text>
      </View>

      <View style={styles.statePicker} accessibilityRole="radiogroup">
        {STATES.map((item) => {
          const selected = item === presence;
          return <Pressable key={item} onPress={() => setPresence(item)} accessibilityRole="radio" accessibilityState={{ selected }} style={[styles.stateButton, selected && { borderColor: accent, backgroundColor: `${accent}12` }]}>
            <Text style={[styles.stateText, selected && { color: accent }]}>{item}</Text>
          </Pressable>;
        })}
      </View>

      <Pressable onPress={playStrengthening} disabled={reduceMotion} accessibilityRole="button" accessibilityLabel="Play strengthening animation" style={[styles.strengthenButton, { backgroundColor: accent }, reduceMotion && styles.disabled]}>
        <Sparkles size={17} color="#FFFFFF" /><Text style={styles.strengthenText}>{reduceMotion ? 'Motion reduced' : 'Play strengthening animation'}</Text>
      </Pressable>

      <View style={styles.comparison}>
        <Text style={styles.sectionTitle}>Same Anchor, two presences</Text>
        <View style={styles.comparisonRow}>
          <View style={styles.compareItem}><EvolvingAnchor svg={selectedAnchor.baseSigilSvg} imageUrl={selectedAnchor.enhancedImageUrl} category={selectedAnchor.category} expression={expression} presence="Surface" size={112} active={isFocused} reduceMotion /><Text style={styles.compareLabel}>SURFACE</Text><Text style={styles.compareNote}>Ink</Text></View>
          <View style={styles.compareDivider} />
          <View style={styles.compareItem}><EvolvingAnchor svg={selectedAnchor.baseSigilSvg} imageUrl={selectedAnchor.enhancedImageUrl} category={selectedAnchor.category} expression={expression} presence="Sovereign" size={112} active={isFocused} reduceMotion /><Text style={styles.compareLabel}>SOVEREIGN</Text><Text style={styles.compareNote}>Established</Text></View>
        </View>
        {activeAnchors.length > 1 ? <Text style={styles.footnote}>Showing your selected Anchor · {activeAnchors.length} available</Text> : null}
      </View>
    </> : <View style={styles.empty}>
      <Text style={styles.emptyTitle}>Create an Anchor to preview this effect</Text>
      <Text style={styles.emptyCopy}>This prototype uses the stored generated SVG from your selected Anchor. It does not substitute sample geometry.</Text>
    </View>}
  </ScrollView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingHorizontal: spacing[5], paddingTop: spacing[2], paddingBottom: 44 },
  topBar: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing[3] },
  back: { width: 40, height: 40, alignItems: 'flex-start', justifyContent: 'center' },
  kicker: { ...typography.labelSM, letterSpacing: 1.2, color: colors.text.secondary },
  title: { ...typography.displayMedium, color: colors.text.primary },
  intro: { ...typography.bodyMD, color: colors.text.secondary, marginTop: 5, maxWidth: 330 },
  anchorLabelRow: { marginTop: 22, flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  anchorLabel: { ...typography.labelMD, color: colors.text.primary, flex: 1 },
  category: { ...typography.caption, color: colors.text.secondary },
  hero: { alignItems: 'center', paddingTop: 20, paddingBottom: 19 },
  heroState: { ...typography.labelSM, color: colors.text.primary, letterSpacing: 1.4, marginTop: 10 },
  heroCaption: { ...typography.caption, color: colors.text.secondary, marginTop: 4 },
  statePicker: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginBottom: 16 },
  stateButton: { minWidth: '30%', paddingHorizontal: 11, height: 38, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border.default, borderRadius: 20, backgroundColor: colors.surface },
  stateText: { ...typography.labelSM, color: colors.text.secondary },
  strengthenButton: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 46, borderRadius: 24, paddingHorizontal: 19 },
  disabled: { opacity: 0.52 },
  strengthenText: { ...typography.labelMD, color: '#FFFFFF' },
  comparison: { marginTop: 27, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border.default, paddingTop: 17 },
  sectionTitle: { ...typography.headingSM, color: colors.text.primary, textAlign: 'center', marginBottom: 11 },
  comparisonRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 15 },
  compareItem: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  compareDivider: { width: StyleSheet.hairlineWidth, height: 110, backgroundColor: colors.border.default },
  compareLabel: { ...typography.labelSM, color: colors.text.primary, letterSpacing: 0.8, marginTop: 9 },
  compareNote: { ...typography.caption, color: colors.text.secondary, marginTop: 2 },
  footnote: { ...typography.caption, color: colors.text.secondary, textAlign: 'center', marginTop: 6 },
  empty: { marginTop: 36, padding: 22, borderRadius: 18, backgroundColor: colors.surface, gap: 8 },
  emptyTitle: { ...typography.headingSM, color: colors.text.primary },
  emptyCopy: { ...typography.bodySM, color: colors.text.secondary },
});
