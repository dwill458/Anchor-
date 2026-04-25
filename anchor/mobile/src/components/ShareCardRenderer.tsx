import React, { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import ViewShot from 'react-native-view-shot';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, Ellipse, Line, RadialGradient, Rect, Stop } from 'react-native-svg';
import { SvgXml } from 'react-native-svg';
import { colors, typography } from '@/theme';

const NAVY = '#0F1419';
const GOLD = '#D4AF37';
const BONE = '#F5F5DC';
const SILVER = '#C0C0C0';
const DEEP_PURPLE = '#3E2C5B';
const FALLBACK_SIGIL = `<svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="60" cy="60" r="52" stroke="#D4AF37" stroke-width="1" opacity="0.22"/>
  <path d="M35 34 L35 86 L60 86" stroke="#D4AF37" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M60 34 L60 86" stroke="#D4AF37" stroke-width="2.6" stroke-linecap="round"/>
  <path d="M60 34 L85 34 L85 60" stroke="#D4AF37" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const FORMAT_SIZES = {
  square: { width: 1080, height: 1080 },
  story: { width: 1170, height: 2532 },
} as const;

const GRAIN_DOTS = Array.from({ length: 56 }, (_, index) => ({
  cx: ((index * 73) % 1000) + 20,
  cy: ((index * 131) % 1000) + 18,
  r: index % 5 === 0 ? 1.5 : 1,
  opacity: index % 3 === 0 ? 0.06 : 0.035,
}));

type ShareCardFormat = keyof typeof FORMAT_SIZES;

export interface ShareCardRendererProps {
  anchorSVG: string;
  intention: string;
  daysPrimed: number;
  format?: ShareCardFormat;
}

export interface ShareCardRendererRef {
  capture: () => Promise<string>;
}

interface CardMetrics {
  paddingHorizontal: number;
  paddingTop: number;
  paddingBottom: number;
  cornerInset: number;
  cornerSize: number;
  brandFontSize: number;
  brandLetterSpacing: number;
  ringSize: number;
  sigilSize: number;
  intentFontSize: number;
  intentLineHeight: number;
  intentMaxWidth: number;
  statLabelFontSize: number;
  statValueFontSize: number;
  footerWordmarkSize: number;
  footerUrlSize: number;
  footerGap: number;
  ruleWidth: number;
  showDaysStat: boolean;
}

function buildMetrics(format: ShareCardFormat): CardMetrics {
  if (format === 'story') {
    return {
      paddingHorizontal: 94,
      paddingTop: 140,
      paddingBottom: 120,
      cornerInset: 34,
      cornerSize: 52,
      brandFontSize: 21,
      brandLetterSpacing: 8,
      ringSize: 430,
      sigilSize: 260,
      intentFontSize: 52,
      intentLineHeight: 66,
      intentMaxWidth: 660,
      statLabelFontSize: 18,
      statValueFontSize: 28,
      footerWordmarkSize: 34,
      footerUrlSize: 24,
      footerGap: 8,
      ruleWidth: 140,
      showDaysStat: false,
    };
  }

  return {
    paddingHorizontal: 84,
    paddingTop: 74,
    paddingBottom: 72,
    cornerInset: 32,
    cornerSize: 46,
    brandFontSize: 18,
    brandLetterSpacing: 7,
    ringSize: 340,
    sigilSize: 208,
    intentFontSize: 42,
    intentLineHeight: 55,
    intentMaxWidth: 690,
    statLabelFontSize: 16,
    statValueFontSize: 28,
    footerWordmarkSize: 31,
    footerUrlSize: 20,
    footerGap: 8,
    ruleWidth: 120,
    showDaysStat: true,
  };
}

function Corner({
  position,
  inset,
  size,
}: {
  position: 'tl' | 'tr' | 'bl' | 'br';
  inset: number;
  size: number;
}) {
  return (
    <View
      style={[
        styles.corner,
        {
          width: size,
          height: size,
        },
        position === 'tl' && { top: inset, left: inset, borderTopWidth: 1, borderLeftWidth: 1 },
        position === 'tr' && { top: inset, right: inset, borderTopWidth: 1, borderRightWidth: 1 },
        position === 'bl' && { bottom: inset, left: inset, borderBottomWidth: 1, borderLeftWidth: 1 },
        position === 'br' && { bottom: inset, right: inset, borderBottomWidth: 1, borderRightWidth: 1 },
      ]}
    />
  );
}

function BackgroundArt({ width, height }: { width: number; height: number }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={['#151c24', NAVY]}
        start={{ x: 0.12, y: 0.04 }}
        end={{ x: 0.88, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="share-card-core-glow" cx="50%" cy="36%" rx="55%" ry="45%">
            <Stop offset="0%" stopColor={DEEP_PURPLE} stopOpacity="0.62" />
            <Stop offset="38%" stopColor={DEEP_PURPLE} stopOpacity="0.22" />
            <Stop offset="100%" stopColor={DEEP_PURPLE} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="share-card-bottom-glow" cx="50%" cy="88%" rx="60%" ry="40%">
            <Stop offset="0%" stopColor="#1a2740" stopOpacity="0.18" />
            <Stop offset="100%" stopColor="#1a2740" stopOpacity="0" />
          </RadialGradient>
        </Defs>

        <Rect width={width} height={height} fill={NAVY} />
        <Rect width={width} height={height} fill="url(#share-card-core-glow)" />
        <Rect width={width} height={height} fill="url(#share-card-bottom-glow)" />

        <Ellipse
          cx={width * 0.47}
          cy={height * 0.36}
          rx={width * 0.18}
          ry={height * 0.11}
          fill={DEEP_PURPLE}
          opacity={0.22}
          transform={`rotate(-12 ${width * 0.47} ${height * 0.36})`}
        />
        <Ellipse
          cx={width * 0.62}
          cy={height * 0.41}
          rx={width * 0.11}
          ry={height * 0.07}
          fill="#163253"
          opacity={0.14}
          transform={`rotate(18 ${width * 0.62} ${height * 0.41})`}
        />
        <Ellipse
          cx={width * 0.26}
          cy={height * 0.78}
          rx={width * 0.12}
          ry={height * 0.06}
          fill="#11243c"
          opacity={0.12}
          transform={`rotate(-22 ${width * 0.26} ${height * 0.78})`}
        />

        {GRAIN_DOTS.map((dot, index) => (
          <Circle
            key={`grain-${index}`}
            cx={(dot.cx / 1020) * width}
            cy={(dot.cy / 1020) * height}
            r={dot.r}
            fill="#FFFFFF"
            opacity={dot.opacity}
          />
        ))}
      </Svg>
    </View>
  );
}

function SigilRing({
  sigilXml,
  ringSize,
  sigilSize,
}: {
  sigilXml: string;
  ringSize: number;
  sigilSize: number;
}) {
  return (
    <View
      style={[
        styles.sigilRing,
        {
          width: ringSize,
          height: ringSize,
          borderRadius: ringSize / 2,
        },
      ]}
    >
      <View
        style={[
          styles.sigilGlow,
          {
            width: ringSize * 0.92,
            height: ringSize * 0.92,
            borderRadius: (ringSize * 0.92) / 2,
          },
        ]}
      />

      <Svg
        width={ringSize}
        height={ringSize}
        viewBox={`0 0 ${ringSize} ${ringSize}`}
        style={styles.sigilGuides}
      >
        <Circle
          cx={ringSize / 2}
          cy={ringSize / 2}
          r={ringSize * 0.42}
          stroke="rgba(212,175,55,0.08)"
          strokeWidth="1"
          fill="none"
        />
        <Line
          x1={ringSize / 2}
          y1={ringSize * 0.08}
          x2={ringSize / 2}
          y2={ringSize * 0.18}
          stroke="rgba(212,175,55,0.08)"
          strokeWidth="1"
        />
        <Line
          x1={ringSize / 2}
          y1={ringSize * 0.82}
          x2={ringSize / 2}
          y2={ringSize * 0.92}
          stroke="rgba(212,175,55,0.08)"
          strokeWidth="1"
        />
        <Line
          x1={ringSize * 0.08}
          y1={ringSize / 2}
          x2={ringSize * 0.18}
          y2={ringSize / 2}
          stroke="rgba(212,175,55,0.08)"
          strokeWidth="1"
        />
        <Line
          x1={ringSize * 0.82}
          y1={ringSize / 2}
          x2={ringSize * 0.92}
          y2={ringSize / 2}
          stroke="rgba(212,175,55,0.08)"
          strokeWidth="1"
        />
      </Svg>

      <View style={styles.sigilXmlWrap}>
        <SvgXml xml={sigilXml || FALLBACK_SIGIL} width={sigilSize} height={sigilSize} />
      </View>
    </View>
  );
}

function ShareCardSurface({
  anchorSVG,
  intention,
  daysPrimed,
  format,
}: ShareCardRendererProps & { format: ShareCardFormat }) {
  const size = FORMAT_SIZES[format];
  const metrics = buildMetrics(format);
  const safeIntention = useMemo(() => {
    const raw = intention?.trim() || 'Anchor intention unavailable';
    const maxChars = format === 'story' ? 120 : 140;
    const normalized = raw.replace(/\s+/g, ' ');
    const trimmed = normalized.length > maxChars
      ? `${normalized.slice(0, maxChars - 1).trimEnd()}…`
      : normalized;

    return `"${trimmed.replace(/^"+|"+$/g, '')}"`;
  }, [format, intention]);

  return (
    <View style={{ width: size.width, height: size.height, backgroundColor: NAVY }}>
      <BackgroundArt width={size.width} height={size.height} />
      <Corner position="tl" inset={metrics.cornerInset} size={metrics.cornerSize} />
      <Corner position="tr" inset={metrics.cornerInset} size={metrics.cornerSize} />
      <Corner position="bl" inset={metrics.cornerInset} size={metrics.cornerSize} />
      <Corner position="br" inset={metrics.cornerInset} size={metrics.cornerSize} />

      <View
        style={[
          styles.surfaceContent,
          {
            paddingHorizontal: metrics.paddingHorizontal,
            paddingTop: metrics.paddingTop,
            paddingBottom: metrics.paddingBottom,
          },
        ]}
      >
        <Text
          style={[
            styles.brandLine,
            {
              fontSize: metrics.brandFontSize,
              letterSpacing: metrics.brandLetterSpacing,
            },
          ]}
        >
          Anchor · Cognitive Priming
        </Text>

        <View style={styles.centerStack}>
          <SigilRing
            sigilXml={anchorSVG || FALLBACK_SIGIL}
            ringSize={metrics.ringSize}
            sigilSize={metrics.sigilSize}
          />

          <Text
            style={[
              styles.intentionText,
              {
                fontSize: metrics.intentFontSize,
                lineHeight: metrics.intentLineHeight,
                maxWidth: metrics.intentMaxWidth,
                marginTop: format === 'story' ? 64 : 44,
              },
            ]}
          >
            {safeIntention}
          </Text>

          {metrics.showDaysStat ? (
            <>
              <View style={[styles.rule, { width: metrics.ruleWidth, marginTop: 34 }]} />
              <View style={styles.statBlock}>
                <Text style={[styles.statValue, { fontSize: metrics.statValueFontSize }]}>
                  {Math.max(0, daysPrimed || 0)}
                </Text>
                <Text style={[styles.statLabel, { fontSize: metrics.statLabelFontSize }]}>
                  DAYS PRIMED
                </Text>
              </View>
            </>
          ) : (
            <>
              <View style={[styles.rule, { width: metrics.ruleWidth, marginTop: 40 }]} />
              <Text style={[styles.storyMeta, { fontSize: metrics.statLabelFontSize, marginTop: 22 }]}>
                {Math.max(0, daysPrimed || 0)} DAYS PRIMED
              </Text>
              <View style={[styles.rule, { width: metrics.ruleWidth, marginTop: 22 }]} />
            </>
          )}
        </View>

        <View style={[styles.footer, { gap: metrics.footerGap }]}>
          <Text style={[styles.footerWordmark, { fontSize: metrics.footerWordmarkSize }]}>Anchor</Text>
          <Text style={[styles.footerUrl, { fontSize: metrics.footerUrlSize }]}>anchorintentions.com</Text>
        </View>
      </View>
    </View>
  );
}

const ShareCardRenderer = forwardRef<ShareCardRendererRef, ShareCardRendererProps>(function ShareCardRenderer(
  {
    anchorSVG,
    intention,
    daysPrimed,
    format = 'square',
  },
  ref
) {
  const viewShotRef = useRef<any>(null);
  const size = FORMAT_SIZES[format];

  useImperativeHandle(ref, () => ({
    async capture() {
      const uri = await viewShotRef.current?.capture?.();
      if (!uri) {
        throw new Error('Unable to capture share card.');
      }
      return uri;
    },
  }), []);

  return (
    <View
      pointerEvents="none"
      collapsable={false}
      style={[
        styles.hiddenStage,
        {
          top: -9999,
          left: -9999,
          width: size.width,
          height: size.height,
        },
      ]}
    >
      <ViewShot
        ref={viewShotRef}
        style={{ width: size.width, height: size.height }}
        options={{
          fileName: `anchor-share-card-${format}`,
          format: 'png',
          quality: 1,
          result: 'tmpfile',
        }}
      >
        <ShareCardSurface
          anchorSVG={anchorSVG}
          intention={intention}
          daysPrimed={daysPrimed}
          format={format}
        />
      </ViewShot>
    </View>
  );
});

const styles = StyleSheet.create({
  hiddenStage: {
    position: 'absolute',
  },
  surfaceContent: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brandLine: {
    fontFamily: typography.fontFamily.serif,
    color: 'rgba(212,175,55,0.42)',
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  centerStack: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sigilRing: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.2)',
    backgroundColor: 'rgba(15,20,25,0.74)',
    shadowColor: DEEP_PURPLE,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 32,
    elevation: 12,
    overflow: 'hidden',
  },
  sigilGlow: {
    position: 'absolute',
    backgroundColor: 'rgba(62,44,91,0.22)',
    shadowColor: DEEP_PURPLE,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.58,
    shadowRadius: 42,
    elevation: 10,
  },
  sigilGuides: {
    position: 'absolute',
  },
  sigilXmlWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  intentionText: {
    color: 'rgba(245,245,220,0.76)',
    fontFamily: typography.fontFamily.bodySerifItalic,
    textAlign: 'center',
    letterSpacing: 1,
  },
  rule: {
    height: 1,
    backgroundColor: 'rgba(212,175,55,0.26)',
  },
  statBlock: {
    marginTop: 26,
    alignItems: 'center',
    gap: 8,
  },
  statValue: {
    fontFamily: typography.fontFamily.serifSemiBold,
    color: GOLD,
    letterSpacing: 2,
  },
  statLabel: {
    fontFamily: typography.fontFamily.serif,
    color: 'rgba(192,192,192,0.42)',
    letterSpacing: 4,
  },
  storyMeta: {
    fontFamily: typography.fontFamily.serif,
    color: 'rgba(212,175,55,0.38)',
    letterSpacing: 4,
    textAlign: 'center',
  },
  footer: {
    alignItems: 'center',
  },
  footerWordmark: {
    fontFamily: typography.fontFamily.serif,
    color: 'rgba(212,175,55,0.62)',
    letterSpacing: 7,
    textTransform: 'uppercase',
  },
  footerUrl: {
    fontFamily: typography.fontFamily.bodySerifItalic,
    color: 'rgba(192,192,192,0.3)',
    letterSpacing: 1,
  },
  corner: {
    position: 'absolute',
    borderColor: 'rgba(212,175,55,0.25)',
  },
});

export default ShareCardRenderer;
