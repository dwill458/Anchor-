import React, { useEffect } from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Svg, { Circle, Ellipse, Path, Rect, SvgProps } from 'react-native-svg';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Check, ChevronRight } from 'lucide-react-native';
import { colors, spacing, typography } from '@/theme';
import {
  RefineBadge,
  RefineGlyphKey,
  RefineStyleOption,
} from '../constants/refineStyles';

export type RefineStyleCardVariant = 'core' | 'featured' | 'recommended' | 'seasonal' | 'filtered';

interface RefineStyleCardProps {
  option: RefineStyleOption;
  index?: number;
  isSelected: boolean;
  onSelect: (option: RefineStyleOption) => void;
  variant?: RefineStyleCardVariant;
  badgeLabel?: string;
  structureId?: string;
  structureLabel?: string;
  drawnStrokes?: Array<{ points: Array<{ x: number; y: number }> }>;
  style?: StyleProp<ViewStyle>;
}

// ── Abstract Line Glyphs from 06 Refine Style.html ────────────────────────────
export const RefineGlyph: React.FC<{
  name: RefineGlyphKey;
  size?: number;
  color?: string;
}> = ({ name, size = 20, color = '#87939D' }) => {
  const props: SvgProps = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
  };

  switch (name) {
    case 'architectural':
      return (
        <Svg {...props} stroke={color} strokeWidth={1.4}>
          <Path d="M4 20V6M9 20V4M15 20V4M20 20V6" strokeLinecap="round" />
        </Svg>
      );
    case 'ink':
      return (
        <Svg {...props} stroke={color} strokeWidth={1.6} strokeLinecap="round">
          <Path d="M5 18C7 10 10 6 15 5c3-.6 4 1 3 3-1.6 3-7 4-11 4" />
        </Svg>
      );
    case 'sacred':
      return (
        <Svg {...props} stroke={color} strokeWidth={1.3}>
          <Circle cx={12} cy={12} r={8.5} />
          <Path d="M12 6v12M6 12h12" strokeLinecap="round" />
        </Svg>
      );
    case 'watercolor':
      return (
        <Svg {...props} stroke={color} strokeWidth={1.5} strokeLinecap="round">
          <Path d="M3 10c3-3 6 3 9 0s6-3 9 0M3 15c3-3 6 3 9 0s6-3 9 0" />
        </Svg>
      );
    case 'goldleaf':
      return (
        <Svg {...props} stroke={color} strokeWidth={1.3}>
          <Path d="M12 3l6 9-6 9-6-9z" />
          <Path d="M12 3v18M6 12h12" strokeOpacity={0.5} />
        </Svg>
      );
    case 'cosmic':
      return (
        <Svg {...props} stroke={color} strokeWidth={1.3}>
          <Path d="M12 3c.7 5 3.9 8.3 9 9-5.1.7-8.3 3.9-9 9-.7-5.1-3.9-8.3-9-9 5.1-.7 8.3-4 9-9z" />
        </Svg>
      );
    case 'lunar':
      return (
        <Svg {...props} stroke={color} strokeWidth={1.4}>
          <Path d="M18 12.5A7 7 0 1 1 11 5a5.5 5.5 0 0 0 7 7.5z" />
        </Svg>
      );
    case 'aurora':
      return (
        <Svg {...props} stroke={color} strokeWidth={1.4} strokeLinecap="round">
          <Path d="M4 17c2-8 5-11 8-11M8 18c1.5-7 4-10 7-10M12 19c1.2-6 3.4-9 6-9" />
        </Svg>
      );
    case 'ember':
      return (
        <Svg {...props} stroke={color} strokeWidth={1.4} strokeLinecap="round">
          <Path d="M12 21c-3.3 0-6-2.4-6-6 0-3 3-5 3-8 3 1 5 3 5 5 1-.6 1.5-2 1.5-3 2 2 2.5 4 2.5 6 0 3.6-2.7 6-6 6z" />
        </Svg>
      );
    case 'resonance':
      return (
        <Svg {...props} stroke={color} strokeWidth={1.3}>
          <Circle cx={12} cy={12} r={3} />
          <Circle cx={12} cy={12} r={7} strokeOpacity={0.55} />
          <Circle cx={12} cy={12} r={10.5} strokeOpacity={0.3} />
        </Svg>
      );
    case 'monolith':
      return (
        <Svg {...props} stroke={color} strokeWidth={1.4}>
          <Rect x={9} y={3} width={6} height={18} rx={1} />
        </Svg>
      );
    case 'celestial':
      return (
        <Svg {...props} stroke={color} strokeWidth={1.2}>
          <Path d="M5 6l7 4 7-3M12 10l-3 8M12 10l5 6" strokeOpacity={0.55} />
          <Circle cx={5} cy={6} r={1.4} fill={color} stroke="none" />
          <Circle cx={12} cy={10} r={1.6} fill={color} stroke="none" />
          <Circle cx={19} cy={7} r={1.4} fill={color} stroke="none" />
          <Circle cx={9} cy={18} r={1.4} fill={color} stroke="none" />
          <Circle cx={17} cy={16} r={1.4} fill={color} stroke="none" />
        </Svg>
      );
    case 'solar':
      return (
        <Svg {...props} stroke={color} strokeWidth={1.3} strokeLinecap="round">
          <Circle cx={12} cy={12} r={4.5} />
          <Path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M5 5l1.8 1.8M17.2 17.2L19 19M19 5l-1.8 1.8M6.8 17.2L5 19" />
        </Svg>
      );
    case 'ocean':
      return (
        <Svg {...props} stroke={color} strokeWidth={1.5} strokeLinecap="round">
          <Path d="M3 8c2-2 4 2 6 0s4-2 6 0M3 13c2-2 4 2 6 0s4-2 6 0M3 18c2-2 4 2 6 0s4-2 6 0" />
        </Svg>
      );
    case 'harvest':
      return (
        <Svg {...props} stroke={color} strokeWidth={1.3} strokeLinecap="round">
          <Path d="M12 21V7M12 7c0-2 1.5-4 3.5-4M12 7c0-2-1.5-4-3.5-4M12 12c0-1.6 1.4-3 3-3M12 12c0-1.6-1.4-3-3-3M12 17c0-1.6 1.4-3 3-3M12 17c0-1.6-1.4-3-3-3" />
        </Svg>
      );
    case 'bloom':
      return (
        <Svg {...props} stroke={color} strokeWidth={1.3}>
          <Circle cx={12} cy={7} r={3} />
          <Circle cx={7} cy={14} r={3} />
          <Circle cx={17} cy={14} r={3} />
          <Circle cx={12} cy={12} r={1.6} fill={color} stroke="none" />
        </Svg>
      );
    case 'halo':
      return (
        <Svg {...props} stroke={color} strokeWidth={1.3}>
          <Circle cx={12} cy={12} r={5} />
          <Ellipse cx={12} cy={12} rx={10} ry={4} strokeOpacity={0.5} />
        </Svg>
      );
    case 'prism':
      return (
        <Svg {...props} stroke={color} strokeWidth={1.3} strokeLinejoin="round">
          <Path d="M12 3L21 19H3z" />
          <Path d="M12 3v16" strokeOpacity={0.5} />
        </Svg>
      );
    case 'original':
    default:
      return (
        <Svg {...props} stroke={color} strokeWidth={1.3}>
          <Circle cx={12} cy={12} r={7} />
          <Path d="M12 2v4M12 18v4M2 12h4M18 12h4" strokeLinecap="round" />
        </Svg>
      );
  }
};

// ── Structure Glyph Renderer for Your Structure Hero ─────────────────────────
export const StructureHeroGlyph: React.FC<{
  id?: string;
  size?: number;
  color?: string;
  accent?: string;
  strokes?: Array<{ points: Array<{ x: number; y: number }> }>;
}> = ({ id = 'focused', size = 104, color = '#D9B36C', accent = '#F2DFA8', strokes }) => {
  const vb = '0 0 200 200';

  if (id === 'drawn' && strokes && strokes.length > 0) {
    const strokesToPath = (points: Array<{ x: number; y: number }>) => {
      if (!points || points.length < 2) return '';
      return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)} ` +
        points.slice(1).map(p => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    };

    return (
      <Svg width={size} height={size} viewBox={vb} fill="none">
        {strokes.map((s, i) => (
          <Path
            key={i}
            d={strokesToPath(s.points)}
            stroke={accent}
            strokeWidth={5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </Svg>
    );
  }

  if (id === 'contained') {
    return (
      <Svg width={size} height={size} viewBox={vb} fill="none">
        <Circle cx={100} cy={100} r={90} stroke={color} strokeWidth={3.5} opacity={0.55} />
        <Path d="M68 70 L132 70 L78 138" stroke={accent} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
        <Circle cx={100} cy={100} r={11} stroke={color} strokeWidth={1.8} opacity={0.5} />
      </Svg>
    );
  }

  if (id === 'raw') {
    return (
      <Svg width={size} height={size} viewBox={vb} fill="none">
        <Path d="M52 148 L100 50 L148 150" stroke={accent} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" opacity={0.85} />
        <Circle cx={100} cy={100} r={6} stroke={color} strokeWidth={1.4} opacity={0.25} />
      </Svg>
    );
  }

  if (id === 'drawn') {
    return (
      <Svg width={size} height={size} viewBox={vb} fill="none">
        <Path
          d="M55 145 L125 75 L145 95 L75 165 L52 168 Z"
          stroke={accent}
          strokeWidth={4}
          strokeDasharray="6 7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    );
  }

  // default: 'focused'
  return (
    <Svg width={size} height={size} viewBox={vb} fill="none">
      {[20, 35, 50, 65, 80].map(r => (
        <Circle key={r} cx={100} cy={100} r={r} stroke={color} strokeWidth={0.8} opacity={0.3} />
      ))}
      <Path d="M58 62 L142 62 L72 148" stroke={accent} strokeWidth={6.5} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={100} cy={100} r={13} stroke={color} strokeWidth={1.8} opacity={0.5} />
    </Svg>
  );
};

// ── Refine Badge Component (Dot + Tracked Label, No Pill Chrome) ──────────────
export const RefineBadgeView: React.FC<{
  type?: RefineBadge['type'];
  label: string;
}> = ({ type = 'core', label }) => {
  const pulseOpacity = useSharedValue(1);

  useEffect(() => {
    if (type === 'limited') {
      pulseOpacity.value = withRepeat(
        withSequence(
          withTiming(0.35, { duration: 1200 }),
          withTiming(1, { duration: 1200 })
        ),
        -1,
        true
      );
    } else {
      pulseOpacity.value = 1;
    }
  }, [pulseOpacity, type]);

  const animatedDotStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
  }));

  const getColor = () => {
    if (type === 'gold' || type === 'seasonal' || type === 'limited') return colors.anchor15.gilt;
    if (type === 'new') return 'rgba(244, 239, 230, 0.62)';
    return colors.anchor15.ash;
  };

  const color = getColor();

  return (
    <View style={styles.badgeContainer}>
      <Animated.View style={[styles.badgeDot, { backgroundColor: color }, animatedDotStyle]} />
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
};

// ── Standard 2-Column Style Card ──────────────────────────────────────────────
export function RefineStyleCard({
  option,
  isSelected,
  onSelect,
  variant = 'core',
  badgeLabel,
  structureId = 'focused',
  structureLabel = 'Focused',
  drawnStrokes,
  style,
}: RefineStyleCardProps) {
  const isOriginal = option.id === 'original';
  const isReco = variant === 'recommended';

  const complementText =
    typeof option.complement === 'function'
      ? option.complement(structureLabel)
      : option.complement;

  const desc = complementText || option.description || option.shortDescription;
  const badge = badgeLabel ? { type: 'seasonal' as const, label: badgeLabel } : option.badge;

  return (
    <Pressable
      onPress={() => onSelect(option)}
      style={[
        styles.card,
        isReco && styles.cardReco,
        isSelected && styles.cardSelected,
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${option.displayName} style`}
      accessibilityHint={desc}
      accessibilityState={{ selected: isSelected }}
    >
      {isSelected ? (
        <View style={styles.checkCircle}>
          <Check size={10} color="#0B1015" strokeWidth={3} />
        </View>
      ) : null}

      <View style={[styles.glyphCircle, isSelected && styles.glyphCircleSelected]}>
        {isOriginal ? (
          <StructureHeroGlyph
            id={structureId}
            size={22}
            color={isSelected ? colors.anchor15.gilt : colors.anchor15.ash}
            accent={isSelected ? colors.anchor15.giltBright : colors.anchor15.ash}
            strokes={structureId === 'drawn' ? drawnStrokes : undefined}
          />
        ) : (
          <RefineGlyph
            name={option.glyph}
            size={20}
            color={isSelected ? colors.anchor15.gilt : colors.anchor15.ash}
          />
        )}
      </View>

      {!isOriginal ? <Text style={styles.sampleTag}>STYLE SAMPLE</Text> : null}

      <Text style={styles.cardName} numberOfLines={2}>
        {option.displayName}
      </Text>

      {option.tags && option.tags.length > 0 ? (
        <Text style={styles.cardTags} numberOfLines={1}>
          {option.tags.join(' · ')}
        </Text>
      ) : (
        <Text style={styles.cardCat} numberOfLines={1}>
          {option.family}
        </Text>
      )}

      {desc ? (
        <Text style={styles.cardDesc} numberOfLines={2}>
          {desc}
        </Text>
      ) : null}

      {badge ? (
        <View style={styles.badgeSlot}>
          <RefineBadgeView type={badge.type} label={badge.label} />
        </View>
      ) : null}
    </Pressable>
  );
}

// ── Horizontal Rail Featured Card ─────────────────────────────────────────────
export const RefineFeatCard: React.FC<{
  option: RefineStyleOption;
  isSelected: boolean;
  onSelect: (option: RefineStyleOption) => void;
  style?: StyleProp<ViewStyle>;
}> = ({ option, isSelected, onSelect, style }) => {
  return (
    <Pressable
      onPress={() => onSelect(option)}
      style={[styles.featCard, isSelected && styles.cardSelected, style]}
      accessibilityRole="button"
      accessibilityLabel={`${option.displayName} style`}
      accessibilityState={{ selected: isSelected }}
    >
      {isSelected ? (
        <View style={styles.checkCircle}>
          <Check size={10} color="#0B1015" strokeWidth={3} />
        </View>
      ) : null}

      <View style={[styles.featGlyphCircle, isSelected && styles.glyphCircleSelected]}>
        <RefineGlyph
          name={option.glyph}
          size={18}
          color={isSelected ? colors.anchor15.gilt : colors.anchor15.ash}
        />
      </View>

      <Text style={styles.sampleTag}>STYLE SAMPLE</Text>
      <Text style={styles.featCardName} numberOfLines={1}>
        {option.displayName}
      </Text>
      <Text style={styles.featCardCat} numberOfLines={1}>
        {option.family}
      </Text>

      {option.badge ? (
        <View style={{ marginTop: 10 }}>
          <RefineBadgeView type={option.badge.type} label={option.badge.label} />
        </View>
      ) : null}
    </Pressable>
  );
};

// ── Featured Hero Card (This Week Top Spotlight) ──────────────────────────────
export const RefineHeroCard: React.FC<{
  option: RefineStyleOption;
  isSelected: boolean;
  onSelect: (option: RefineStyleOption) => void;
}> = ({ option, isSelected, onSelect }) => {
  const breatheScale = useSharedValue(1);

  useEffect(() => {
    breatheScale.value = withRepeat(
      withSequence(
        withTiming(1.03, { duration: 2750 }),
        withTiming(1.0, { duration: 2750 })
      ),
      -1,
      true
    );
  }, [breatheScale]);

  const animatedSigilStyle = useAnimatedStyle(() => ({
    transform: [{ scale: breatheScale.value }],
  }));

  const badges: RefineBadge[] = [];
  if (option.isSeasonal) badges.push({ type: 'seasonal', label: 'Seasonal Drop' });
  if (option.isLimited && option.badge) badges.push(option.badge);

  return (
    <Pressable
      onPress={() => onSelect(option)}
      style={[styles.heroCard, isSelected && styles.cardSelected]}
      accessibilityRole="button"
      accessibilityLabel={`${option.displayName} featured hero style`}
      accessibilityState={{ selected: isSelected }}
    >
      {isSelected ? (
        <View style={styles.checkCircle}>
          <Check size={10} color="#0B1015" strokeWidth={3} />
        </View>
      ) : null}

      <Animated.View style={[styles.heroSigil, animatedSigilStyle]}>
        <RefineGlyph name={option.glyph} size={36} color={colors.anchor15.gilt} />
      </Animated.View>

      <View style={styles.heroBody}>
        {badges.length > 0 ? (
          <View style={styles.heroBadgesRow}>
            {badges.map((b, i) => (
              <RefineBadgeView key={i} type={b.type} label={b.label} />
            ))}
          </View>
        ) : null}

        <Text style={styles.heroName}>{option.displayName}</Text>

        <View style={styles.heroCatRow}>
          <RefineBadgeView type="core" label={option.family} />
          <RefineBadgeView type="gold" label="Featured" />
        </View>

        <Text style={styles.heroDesc} numberOfLines={2}>
          {option.description}
        </Text>

        <View style={styles.heroFoot}>
          <Text style={styles.heroFootText}>Style sample · tap to select</Text>
          <ChevronRight size={13} color="rgba(217, 179, 108, 0.7)" />
        </View>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  // Badge
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badgeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  badgeText: {
    fontFamily: typography.fontFamily.sans,
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 1.0,
    textTransform: 'uppercase',
  },

  // Standard Card
  card: {
    position: 'relative',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(217, 179, 108, 0.12)',
    backgroundColor: 'rgba(30, 42, 51, 0.20)',
    padding: 16,
    minHeight: 152,
    flexDirection: 'column',
  },
  cardReco: {
    borderColor: 'rgba(217, 179, 108, 0.18)',
  },
  cardSelected: {
    borderColor: colors.anchor15.gilt,
    backgroundColor: 'rgba(30, 42, 51, 0.36)',
    shadowColor: colors.anchor15.gilt,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 3,
  },
  checkCircle: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.anchor15.gilt,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    shadowColor: colors.anchor15.gilt,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 4,
  },
  glyphCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(135, 147, 157, 0.26)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 20, 25, 0.4)',
  },
  glyphCircleSelected: {
    borderColor: 'rgba(217, 179, 108, 0.34)',
  },
  sampleTag: {
    fontFamily: typography.fontFamily.sans,
    fontSize: 8,
    fontWeight: '500',
    letterSpacing: 0.96,
    color: 'rgba(135, 147, 157, 0.5)',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  cardName: {
    fontFamily: typography.fontFamily.serifSemiBold,
    fontSize: 15,
    lineHeight: 18,
    color: colors.anchor15.bone,
    letterSpacing: 0.3,
  },
  cardTags: {
    fontFamily: typography.fontFamily.sans,
    fontSize: 10.5,
    letterSpacing: 0.2,
    color: 'rgba(217, 179, 108, 0.75)',
    marginTop: 6,
  },
  cardCat: {
    fontFamily: typography.fontFamily.serifSemiBold,
    fontSize: 9,
    letterSpacing: 1.44,
    color: colors.anchor15.ash,
    textTransform: 'uppercase',
    marginTop: 6,
  },
  cardDesc: {
    fontFamily: typography.fontFamily.voiceItalic,
    fontSize: 13,
    lineHeight: 17,
    color: 'rgba(244, 239, 230, 0.5)',
    marginTop: 6,
  },
  badgeSlot: {
    marginTop: 'auto',
    paddingTop: 12,
  },

  // Featured Rail Card
  featCard: {
    width: 148,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(217, 179, 108, 0.12)',
    backgroundColor: 'rgba(30, 42, 51, 0.24)',
    padding: 14,
    position: 'relative',
  },
  featGlyphCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(135, 147, 157, 0.26)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 20, 25, 0.4)',
  },
  featCardName: {
    fontFamily: typography.fontFamily.serifSemiBold,
    fontSize: 14,
    lineHeight: 17,
    color: colors.anchor15.bone,
    letterSpacing: 0.28,
  },
  featCardCat: {
    fontFamily: typography.fontFamily.serifSemiBold,
    fontSize: 9,
    letterSpacing: 1.44,
    color: colors.anchor15.ash,
    textTransform: 'uppercase',
    marginTop: 6,
  },

  // Featured Hero Card
  heroCard: {
    position: 'relative',
    marginHorizontal: spacing.lg,
    marginTop: 14,
    padding: 20,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(217, 179, 108, 0.12)',
    backgroundColor: 'rgba(30, 42, 51, 0.34)',
    flexDirection: 'row',
    gap: 16,
  },
  heroSigil: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    borderColor: 'rgba(217, 179, 108, 0.25)',
    backgroundColor: '#16222A',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  heroBody: {
    flex: 1,
    minWidth: 0,
  },
  heroBadgesRow: {
    flexDirection: 'row',
    gap: 14,
    flexWrap: 'wrap',
  },
  heroName: {
    fontFamily: typography.fontFamily.serifSemiBold,
    fontSize: 21,
    lineHeight: 24,
    color: colors.anchor15.bone,
    letterSpacing: 0.42,
    marginTop: 8,
  },
  heroCatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
  },
  heroDesc: {
    fontFamily: typography.fontFamily.voiceItalic,
    fontSize: 14.5,
    lineHeight: 20,
    color: 'rgba(244, 239, 230, 0.58)',
    marginTop: 8,
  },
  heroFoot: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroFootText: {
    fontFamily: typography.fontFamily.sans,
    fontSize: 11,
    color: colors.anchor15.ash,
  },
});
