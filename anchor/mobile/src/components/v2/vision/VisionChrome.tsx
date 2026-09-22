import React from 'react';
import { Image, Pressable, StatusBar, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { CircularAnchorRenderer } from '@/components/v2/anchor';
import { categoryLabel } from '@/components/v2/anchors/anchorPresentation';
import type { AnchorExpression } from '@/constants/v2/creation';
import { colors, getCategoryColor, spacing, typography } from '@/theme/v2';

/** What the identity row needs to draw the real Anchor (see `anchorRenderProps`). */
export type VisionAnchorArt = { svg: string; imageUrl?: string | null; category?: string | null; expression?: AnchorExpression | null };

export type VisionTone = 'light' | 'dark';

/**
 * Anchor provenance: the real Anchor mark, its intention and category. Small
 * on purpose - on Vision surfaces the photograph is the hero, the Anchor is
 * where it came from.
 */
export function VisionIdentity({
  intention, category, art, imageUrl, tone = 'light', size = 44, testID,
}: {
  intention: string;
  category?: string | null;
  art?: VisionAnchorArt | null;
  /** Legacy fallback when only the enhanced image URL is known. */
  imageUrl?: string | null;
  tone?: VisionTone;
  size?: number;
  testID?: string;
}) {
  const categoryColor = getCategoryColor(category);
  const onDark = tone === 'light';
  return (
    <View testID={testID} style={styles.identity}>
      {art?.svg || art?.imageUrl ? (
        <CircularAnchorRenderer
          svg={art.svg}
          imageUrl={art.imageUrl ?? undefined}
          category={art.category ?? category}
          expression={art.expression ?? undefined}
          size={size}
          appearance="paper"
          accessibilityLabel={`${categoryLabel(category)} Anchor`}
        />
      ) : imageUrl ? (
        <Image source={{ uri: imageUrl }} style={{ width: size, height: size, borderRadius: size / 2 }} />
      ) : (
        <View style={[styles.medallionFallback, { width: size, height: size, borderRadius: size / 2, borderColor: categoryColor }]} />
      )}
      <View style={styles.identityCopy}>
        <Text style={[styles.intention, { color: onDark ? colors.ink.text.primary : colors.text.primary }]} numberOfLines={2}>{intention}</Text>
        <View style={styles.categoryRow}>
          <View style={[styles.categoryDot, { backgroundColor: categoryColor }]} />
          <Text style={[styles.category, { color: onDark ? colors.ink.text.secondary : colors.text.secondary }]}>
            {categoryLabel(category).toUpperCase()}
          </Text>
        </View>
      </View>
    </View>
  );
}

/** Back + centred title + optional utility, for text laid over ink or photography. */
export function VisionHeaderRow({
  title, onBack, utility, tone = 'light', backLabel = 'Go back',
}: { title?: string; onBack?: () => void; utility?: React.ReactNode; tone?: VisionTone; backLabel?: string }) {
  const color = tone === 'light' ? colors.ink.text.primary : colors.text.primary;
  return (
    <View style={styles.header}>
      {onBack ? (
        <Pressable accessibilityRole="button" accessibilityLabel={backLabel} onPress={onBack} hitSlop={8} style={styles.headerSlot}>
          <ArrowLeft size={22} color={color} />
        </Pressable>
      ) : <View style={styles.headerSlot} />}
      {title ? <Text accessibilityRole="header" numberOfLines={1} style={[styles.headerTitle, { color }]}>{title}</Text> : <View style={styles.headerTitleSpacer} />}
      <View style={[styles.headerSlot, styles.headerUtility]}>{utility}</View>
    </View>
  );
}

/**
 * The ink band that opens Vision surfaces (mockup 4/5/7/8): ink at the status
 * bar, dissolving into the cream canvas beneath its content. The status bar
 * is switched to light content only while the band is mounted.
 */
export function VisionInkBand({ children, style, fadeTo = colors.canvas }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; fadeTo?: string }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={style}>
      <StatusBar barStyle="light-content" backgroundColor={colors.ink.base} animated />
      <LinearGradient
        pointerEvents="none"
        colors={[colors.ink.base, colors.ink.base, `${colors.ink.base}CC`, fadeTo]}
        locations={[0, 0.55, 0.8, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={{ paddingTop: insets.top }}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  identityCopy: { flex: 1, gap: 3 },
  intention: { ...typography.labelMD },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  categoryDot: { width: 6, height: 6, borderRadius: 3 },
  category: { ...typography.labelSM, fontSize: 10, letterSpacing: 1 },
  medallionFallback: { borderWidth: 2, backgroundColor: colors.grouped },
  header: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerSlot: { width: 44, height: 44, alignItems: 'flex-start', justifyContent: 'center' },
  headerUtility: { alignItems: 'flex-end' },
  headerTitle: { flex: 1, ...typography.headingMD, textAlign: 'center' },
  headerTitleSpacer: { flex: 1 },
});
