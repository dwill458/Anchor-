import React, { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';

import { OptimizedImage } from '@/components/common/OptimizedImage';
import { useTempStore } from '@/stores/anchorStore';
import { useFirstAnchorFlowStore } from '@/stores/firstAnchorFlowStore';
import { colors, typography } from '@/theme';
import type { RootStackParamList } from '@/types';
import { isCompactPhoneViewport } from '@/utils/layout';

const MAX_VISIBLE_VARIATIONS = 2;
const MAX_INLINE_PREVIEW_BYTES = 700_000;

type PickerRoute = RouteProp<RootStackParamList, 'EnhancedVersionPicker'>;
type PickerNavigation = StackNavigationProp<RootStackParamList, 'EnhancedVersionPicker'>;

type VariationAsset = {
  id: string;
  fullUri: string;
  variationId?: string;
  isHeavyInline: boolean;
  reusedFromPool: boolean;
};

const STYLE_NAMES: Record<string, string> = {
  watercolor: 'Watercolor', sacred_geometry: 'Sacred Geometry', ink_brush: 'Ink Brush',
  gold_leaf: 'Gold Leaf', cosmic: 'Cosmic', architectural_trace: 'Architectural Trace',
  lunar_etch: 'Lunar Etch', aurora_glow: 'Aurora Glow', ember_trace: 'Ember Trace',
  resonance_rings: 'Resonance Rings', monolith_ink: 'Monolith Ink', celestial_grid: 'Celestial Grid',
  minimal_line: 'Minimal Line', obsidian_mono: 'Obsidian Mono', echo_chamber: 'Echo Chamber',
  prism_veil: 'Prism Veil', verdigris_relic: 'Verdigris Relic', solar_halo: 'Solar Halo',
  tideglass: 'Tideglass', velvet_ember: 'Velvet Ember',
};

const STRUCTURE_NAMES: Record<string, string> = {
  balanced: 'Balanced', compact: 'Compact', minimal: 'Minimal', drawn: 'Hand Drawn',
};

function normalizeVariation(variation: unknown, index: number): VariationAsset {
  const rawImage = typeof variation === 'string'
    ? variation
    : variation && typeof variation === 'object' && 'imageUrl' in variation
      ? String((variation as { imageUrl?: unknown }).imageUrl ?? '')
      : '';
  const fullUri = rawImage && !rawImage.startsWith('http') && !rawImage.startsWith('data:image')
    ? `data:image/png;base64,${rawImage}`
    : rawImage;
  const base64Length = fullUri.startsWith('data:image') ? fullUri.split(',')[1]?.length ?? 0 : 0;
  const data = variation && typeof variation === 'object' ? variation as Record<string, unknown> : {};

  return {
    id: `variation_${index}`,
    fullUri,
    variationId: typeof data.variationId === 'string' ? data.variationId : undefined,
    isHeavyInline: base64Length > MAX_INLINE_PREVIEW_BYTES,
    reusedFromPool: data.reusedFromPool === true,
  };
}

/** The selection-only step between generation and the existing AnchorReveal save flow. */
export const AIVariationPickerScreen: React.FC = () => {
  const navigation = useNavigation<PickerNavigation>();
  const route = useRoute<PickerRoute>();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const compact = isCompactPhoneViewport(width, height);
  const {
    intentionText, category, distilledLetters, baseSigilSvg, reinforcedSigilSvg,
    structureVariant, styleChoice, variations, reinforcementMetadata, prompt,
    negativePrompt, modelUsed, provider, controlMethod, generationTimeMs, reuseRequestId,
  } = route.params;
  const [selectedIndex, setSelectedIndex] = useState(0);
  const setTempEnhancedImage = useTempStore((state) => state.setTempEnhancedImage);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const expressionForms = useMemo(
    () => (Array.isArray(variations) ? variations : []).slice(0, MAX_VISIBLE_VARIATIONS)
      .map(normalizeVariation),
    [variations],
  );
  const selectedVariation = expressionForms[selectedIndex];
  const circleSize = Math.min(compact ? 132 : 156, Math.floor((width - (compact ? 52 : 64)) / 2));
  const structureName = STRUCTURE_NAMES[structureVariant] ?? structureVariant ?? 'Balanced';
  const styleName = STYLE_NAMES[styleChoice] ?? styleChoice ?? 'Selected style';

  const handleSetAnchor = useCallback(() => {
    if (!selectedVariation?.fullUri) return;

    useFirstAnchorFlowStore.getState().updateDraft({
      selectedExpressionId: selectedVariation.variationId || `form-${selectedIndex + 1}`,
    });
    if (selectedVariation.isHeavyInline) {
      setTempEnhancedImage(selectedVariation.fullUri);
    }
    navigation.navigate('AnchorReveal', {
      intentionText,
      category,
      distilledLetters,
      baseSigilSvg,
      reinforcedSigilSvg,
      structureVariant,
      reinforcementMetadata,
      enhancementMetadata: {
        styleApplied: styleChoice,
        modelUsed: modelUsed || 'unknown-model',
        provider: provider || 'unknown',
        controlMethod: controlMethod || 'lineart',
        generationTimeMs: generationTimeMs || 0,
        promptUsed: prompt || '',
        negativePrompt: negativePrompt || '',
        appliedAt: new Date(),
        variationId: selectedVariation.variationId,
        reuseRequestId: reuseRequestId || undefined,
        reusedFromPool: selectedVariation.reusedFromPool,
      },
      enhancedImageUrl: selectedVariation.isHeavyInline ? undefined : selectedVariation.fullUri,
    });
  }, [baseSigilSvg, category, controlMethod, distilledLetters, generationTimeMs, intentionText, modelUsed, navigation, negativePrompt, prompt, provider, reinforcedSigilSvg, reinforcementMetadata, reuseRequestId, selectedIndex, selectedVariation, setTempEnhancedImage, structureVariant, styleChoice]);

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <LinearGradient colors={['#1B2530', '#111820', colors.anchor15.navy]} locations={[0, 0.34, 1]} style={StyleSheet.absoluteFill} />
      <View pointerEvents="none" style={styles.goldGlow} />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.topNav}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back to Anchor" style={styles.backControl}>
            <Text style={styles.backArrow}>‹</Text><Text style={styles.backLabel}>Anchor</Text>
          </Pressable>
          <View style={styles.progress} accessibilityLabel="Final step, 3 of 3">
            {[0, 1, 2].map((dot) => <View key={dot} style={[styles.progressDot, dot === 2 && styles.progressDotActive]} />)}
          </View>
        </View>

        <ScrollView contentContainerStyle={[styles.scrollContent, compact && styles.scrollContentCompact, { paddingBottom: insets.bottom + 150 }]} showsVerticalScrollIndicator={false}>
          <Text style={styles.eyebrow}>FINAL STEP</Text>
          <Text style={[styles.title, compact && styles.titleCompact]}>Select Your Expression</Text>
          <Text style={styles.lead}>Two expressions were created from the same intention, structure, and style. Choose the one you want to make yours.</Text>

          <View style={styles.contextCard}>
            <View style={styles.contextCopy}>
              <Text style={styles.contextLabel}>SELECTED STYLE</Text>
              <Text style={styles.contextValue}>{structureName} · {styleName}</Text>
            </View>
            <Text style={styles.contextStatus}>✓ Structure preserved</Text>
          </View>
          <Text style={styles.microTeaching}>Same intention · Same structure · Same style</Text>
          <Text style={styles.microTeachingEmphasis}>Two Expressions</Text>
          <Text style={styles.intention}>“{intentionText}”</Text>
          <View style={styles.guidance}>
            <Text style={styles.guidanceLine}>Trust your first instinct.</Text>
            <Text style={styles.guidanceLine}>Choose the one that holds your attention.</Text>
            <Text style={styles.guidanceLine}>Neither expression is stronger.</Text>
          </View>

          {expressionForms.length > 0 ? (
            <View style={styles.expressionRow}>
              {expressionForms.map((form, index) => {
                const selected = selectedIndex === index;
                return (
                  <Pressable key={form.id} onPress={() => setSelectedIndex(index)} accessibilityRole="button" accessibilityLabel={`Form ${index === 0 ? 'I' : 'II'}`} accessibilityState={{ selected }} style={styles.expressionPressable}>
                    <View style={[styles.expressionCircle, { width: circleSize, height: circleSize, borderRadius: circleSize / 2 }, selected ? styles.expressionCircleSelected : styles.expressionCircleQuiet]}>
                      <OptimizedImage uri={form.fullUri} style={styles.expressionImage} resizeMode="cover" />
                      <View style={styles.imageShade} />
                      {selected && <View style={styles.selectedCheck}><Text style={styles.checkText}>✓</Text></View>}
                    </View>
                    <Text style={[styles.formLabel, selected && styles.formLabelSelected]}>Form {index === 0 ? 'I' : 'II'}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <View style={styles.recoveryCard} accessibilityRole="alert">
              <Text style={styles.recoveryTitle}>Expressions are still unavailable</Text>
              <Text style={styles.recoveryBody}>Return to generation and try again. Your creation draft is preserved.</Text>
            </View>
          )}
        </ScrollView>

        <View style={[styles.bottomArea, { paddingBottom: Math.max(insets.bottom, 14) }]}>
          <Pressable disabled={!selectedVariation?.fullUri} onPress={handleSetAnchor} accessibilityRole="button" accessibilityLabel="Set Anchor" accessibilityState={{ disabled: !selectedVariation?.fullUri }} style={({ pressed }) => [styles.cta, (!selectedVariation?.fullUri || pressed) && styles.ctaPressed]}>
            <LinearGradient colors={[colors.anchor15.giltBright, colors.anchor15.gilt, '#AE813F']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.ctaGradient}>
              <Text style={styles.ctaText}>Set Anchor</Text><Text style={styles.ctaArrow}>→</Text>
            </LinearGradient>
          </Pressable>
          <Text style={styles.ctaHint}>Your selected expression becomes this Anchor’s permanent form.</Text>
        </View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.anchor15.navy }, safeArea: { flex: 1 },
  goldGlow: { position: 'absolute', width: 330, height: 330, top: -175, left: -128, borderRadius: 165, backgroundColor: 'rgba(217, 179, 108, 0.14)' },
  topNav: { height: 52, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backControl: { flexDirection: 'row', alignItems: 'center', minHeight: 36 }, backArrow: { color: colors.anchor15.giltBright, fontSize: 29, lineHeight: 29, marginRight: 4 },
  backLabel: { color: colors.anchor15.bone, fontFamily: typography.fontFamily.instrument, fontSize: 13 },
  progress: { flexDirection: 'row', gap: 6, alignItems: 'center' }, progressDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(244,239,230,0.28)' }, progressDotActive: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.anchor15.giltBright },
  scrollContent: { paddingHorizontal: 24, paddingTop: 20 }, scrollContentCompact: { paddingHorizontal: 20, paddingTop: 12 },
  eyebrow: { color: colors.anchor15.gilt, fontFamily: typography.fontFamily.ritual, fontSize: 10, letterSpacing: 2.5, marginBottom: 10 },
  title: { color: colors.anchor15.bone, fontFamily: typography.fontFamily.voice, fontSize: 34, lineHeight: 39 }, titleCompact: { fontSize: 29, lineHeight: 34 },
  lead: { color: colors.anchor15.ash, fontFamily: typography.fontFamily.instrument, fontSize: 14, lineHeight: 21, marginTop: 12 },
  contextCard: { marginTop: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 14, padding: 14, backgroundColor: 'rgba(30,42,51,0.48)', borderWidth: 1, borderColor: colors.anchor15.hairline },
  contextCopy: { flex: 1, paddingRight: 9 }, contextLabel: { color: colors.anchor15.ash, fontFamily: typography.fontFamily.ritual, fontSize: 9, letterSpacing: 1.7 }, contextValue: { color: colors.anchor15.bone, fontFamily: typography.fontFamily.voice, fontSize: 16, marginTop: 5 }, contextStatus: { color: colors.anchor15.giltBright, fontFamily: typography.fontFamily.instrument, fontSize: 11 },
  microTeaching: { color: colors.anchor15.ash, fontFamily: typography.fontFamily.instrument, fontSize: 11, textAlign: 'center', marginTop: 18 }, microTeachingEmphasis: { color: colors.anchor15.gilt, fontFamily: typography.fontFamily.ritualSemiBold, fontSize: 11, letterSpacing: 1.2, textAlign: 'center', marginTop: 5, textTransform: 'uppercase' },
  intention: { color: 'rgba(244,239,230,0.78)', fontFamily: typography.fontFamily.voice, fontSize: 17, fontStyle: 'italic', lineHeight: 23, textAlign: 'center', marginTop: 15, paddingHorizontal: 8 },
  guidance: { marginTop: 17, gap: 3, alignItems: 'center' }, guidanceLine: { color: 'rgba(135,147,157,0.82)', fontFamily: typography.fontFamily.instrument, fontSize: 12, lineHeight: 17, textAlign: 'center' },
  expressionRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 25 }, expressionPressable: { flex: 1, alignItems: 'center' },
  expressionCircle: { overflow: 'hidden', borderWidth: 1, backgroundColor: colors.anchor15.ink }, expressionCircleSelected: { borderColor: colors.anchor15.giltBright, shadowColor: colors.anchor15.gilt, shadowOpacity: 0.32, shadowRadius: 16, shadowOffset: { width: 0, height: 5 }, elevation: 5 }, expressionCircleQuiet: { borderColor: colors.anchor15.hairline, opacity: 0.68 },
  expressionImage: { width: '100%', height: '100%' }, imageShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(8,11,15,0.08)' }, selectedCheck: { position: 'absolute', right: 9, top: 9, width: 25, height: 25, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.anchor15.giltBright }, checkText: { color: colors.anchor15.ink, fontSize: 15, fontWeight: '800' },
  formLabel: { color: colors.anchor15.ash, fontFamily: typography.fontFamily.ritual, fontSize: 11, letterSpacing: 1.4, marginTop: 11, textTransform: 'uppercase' }, formLabelSelected: { color: colors.anchor15.giltBright },
  recoveryCard: { marginTop: 28, padding: 18, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(217,179,108,0.3)', backgroundColor: 'rgba(30,42,51,0.36)' }, recoveryTitle: { color: colors.anchor15.bone, fontFamily: typography.fontFamily.voice, fontSize: 18 }, recoveryBody: { color: colors.anchor15.ash, fontFamily: typography.fontFamily.instrument, fontSize: 13, lineHeight: 19, marginTop: 7 },
  bottomArea: { paddingHorizontal: 20, paddingTop: 14, backgroundColor: 'rgba(15,20,25,0.96)', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.anchor15.hairline }, cta: { borderRadius: 28, overflow: 'hidden' }, ctaPressed: { opacity: 0.55 }, ctaGradient: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, ctaText: { color: colors.anchor15.ink, fontFamily: typography.fontFamily.ritualSemiBold, fontSize: 13, letterSpacing: 1.5, textTransform: 'uppercase' }, ctaArrow: { color: colors.anchor15.ink, fontSize: 19, lineHeight: 19 }, ctaHint: { color: colors.anchor15.ash, fontFamily: typography.fontFamily.voice, fontSize: 12, fontStyle: 'italic', textAlign: 'center', marginTop: 9 },
});
