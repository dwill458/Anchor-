import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Image, PixelRatio, StyleSheet, Text, View } from 'react-native';
import ViewShot, { captureRef, type CaptureOptions } from 'react-native-view-shot';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, Ellipse, Line, RadialGradient, Rect, Stop } from 'react-native-svg';
import { SvgXml } from 'react-native-svg';
import { typography } from '@/theme';

const NAVY = '#0F1419';
const GOLD = '#D4AF37';
const DEEP_PURPLE = '#3E2C5B';
const FALLBACK_SIGIL = `<svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="60" cy="60" r="52" stroke="#D4AF37" stroke-width="1" opacity="0.22"/>
  <path d="M35 34 L35 86 L60 86" stroke="#D4AF37" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M60 34 L60 86" stroke="#D4AF37" stroke-width="2.6" stroke-linecap="round"/>
  <path d="M60 34 L85 34 L85 60" stroke="#D4AF37" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const FORMAT_SIZES = {
  square: { width: 1080, height: 1080 },
  stories: { width: 1170, height: 2532 },
} as const;
const DEVICE_SCALE = PixelRatio.get() || 1;

const GRAIN_DOTS = Array.from({ length: 56 }, (_, index) => ({
  cx: ((index * 73) % 1000) + 20,
  cy: ((index * 131) % 1000) + 18,
  r: index % 5 === 0 ? 1.5 : 1,
  opacity: index % 3 === 0 ? 0.06 : 0.035,
}));

export type ShareCardFormat = keyof typeof FORMAT_SIZES;

export interface ShareCardRendererProps {
  anchorSVG: string;
  artworkUri?: string | null;
  intention: string;
  daysPrimed: number;
  format?: ShareCardFormat;
  onRenderReady?: () => void;
}

export interface ShareCardRendererRef {
  capture: (options?: CaptureOptions) => Promise<string>;
}

interface ShareCardSurfaceProps extends ShareCardRendererProps {
  onArtworkReady?: () => void;
}

interface SquareMetrics {
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
}

function buildSquareMetrics(scale = 1): SquareMetrics {
  const scaled = (value: number) => value * scale;

  return {
    paddingHorizontal: scaled(84),
    paddingTop: scaled(60),
    paddingBottom: scaled(60),
    cornerInset: scaled(32),
    cornerSize: scaled(46),
    brandFontSize: scaled(15),
    brandLetterSpacing: scaled(4),
    ringSize: scaled(580),
    sigilSize: scaled(520),
    intentFontSize: scaled(38),
    intentLineHeight: scaled(50),
    intentMaxWidth: scaled(840),
    statLabelFontSize: scaled(15),
    statValueFontSize: scaled(26),
    footerWordmarkSize: scaled(28),
    footerUrlSize: scaled(18),
    footerGap: scaled(6),
    ruleWidth: scaled(120),
  };
}

function scalePx(value: number) {
  return value / DEVICE_SCALE;
}

function Corner({
  position,
  inset,
  size,
  borderWidth = 1,
}: {
  position: 'tl' | 'tr' | 'bl' | 'br';
  inset: number;
  size: number;
  borderWidth?: number;
}) {
  return (
    <View
      style={[
        styles.corner,
        {
          width: size,
          height: size,
        },
        position === 'tl' && { top: inset, left: inset, borderTopWidth: borderWidth, borderLeftWidth: borderWidth },
        position === 'tr' && { top: inset, right: inset, borderTopWidth: borderWidth, borderRightWidth: borderWidth },
        position === 'bl' && { bottom: inset, left: inset, borderBottomWidth: borderWidth, borderLeftWidth: borderWidth },
        position === 'br' && { bottom: inset, right: inset, borderBottomWidth: borderWidth, borderRightWidth: borderWidth },
      ]}
    />
  );
}

function BackgroundArt({ width, height, stories = false }: { width: number; height: number; stories?: boolean }) {
  const coreCy = stories ? '42%' : '36%';
  const coreOpacity = stories ? '0.45' : '0.62';

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
          <RadialGradient id="share-card-core-glow" cx="50%" cy={coreCy} rx="55%" ry="45%">
            <Stop offset="0%" stopColor={DEEP_PURPLE} stopOpacity={coreOpacity} />
            <Stop offset="55%" stopColor={DEEP_PURPLE} stopOpacity="0" />
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
          cy={height * (stories ? 0.41 : 0.36)}
          rx={width * 0.18}
          ry={height * (stories ? 0.09 : 0.11)}
          fill={DEEP_PURPLE}
          opacity={stories ? 0.16 : 0.22}
          transform={`rotate(-12 ${width * 0.47} ${height * (stories ? 0.41 : 0.36)})`}
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
  artworkUri,
  ringSize,
  sigilSize,
  borderWidth = 1,
  glowOpacity = 0.22,
  glowShadowOpacity = 0.58,
  shadowRadius = 42,
  onArtworkReady,
}: {
  sigilXml: string;
  artworkUri?: string | null;
  ringSize: number;
  sigilSize: number;
  borderWidth?: number;
  glowOpacity?: number;
  glowShadowOpacity?: number;
  shadowRadius?: number;
  onArtworkReady?: () => void;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const didReportArtworkReadyRef = useRef(false);

  const reportArtworkReady = useCallback(() => {
    if (didReportArtworkReadyRef.current) {
      return;
    }

    didReportArtworkReadyRef.current = true;
    onArtworkReady?.();
  }, [onArtworkReady]);

  useEffect(() => {
    setImageFailed(false);
    didReportArtworkReadyRef.current = false;
  }, [artworkUri]);

  useEffect(() => {
    if (!artworkUri || imageFailed) {
      reportArtworkReady();
    }
  }, [artworkUri, imageFailed, reportArtworkReady]);

  return (
    <View
      style={[
        styles.sigilRing,
        {
          width: ringSize,
          height: ringSize,
          borderRadius: ringSize / 2,
          borderWidth,
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
            backgroundColor: `rgba(62,44,91,${glowOpacity})`,
            shadowOpacity: glowShadowOpacity,
            shadowRadius,
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
        {artworkUri && !imageFailed ? (
          <Image
            source={{ uri: artworkUri }}
            style={{ width: sigilSize, height: sigilSize, borderRadius: sigilSize / 2 }}
            resizeMode="cover"
            onLoadEnd={reportArtworkReady}
            onError={() => setImageFailed(true)}
          />
        ) : (
          <SvgXml xml={sigilXml || FALLBACK_SIGIL} width={sigilSize} height={sigilSize} />
        )}
      </View>
    </View>
  );
}

function SquareCardSurface({
  anchorSVG,
  artworkUri,
  intention,
  daysPrimed,
  onArtworkReady,
}: ShareCardSurfaceProps) {
  const size = FORMAT_SIZES.square;
  const scale = 1 / DEVICE_SCALE;
  const layoutSize = {
    width: scalePx(size.width),
    height: scalePx(size.height),
  };
  const metrics = buildSquareMetrics(scale);
  const safeIntention = useMemo(() => {
    const raw = intention?.trim() || 'Anchor intention unavailable';
    const normalized = raw.replace(/\s+/g, ' ');
    const trimmed =
      normalized.length > 140 ? `${normalized.slice(0, 139).trimEnd()}…` : normalized;

    return `"${trimmed.replace(/^"+|"+$/g, '')}"`;
  }, [intention]);

  return (
    <View style={{ width: layoutSize.width, height: layoutSize.height, backgroundColor: NAVY }}>
      <BackgroundArt width={layoutSize.width} height={layoutSize.height} />
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
          Anchor · Intentions Made Visible
        </Text>

        <View style={styles.centerStack}>
          <SigilRing
            sigilXml={anchorSVG || FALLBACK_SIGIL}
            artworkUri={artworkUri}
            ringSize={metrics.ringSize}
            sigilSize={metrics.sigilSize}
            onArtworkReady={onArtworkReady}
          />

          <Text
            style={[
              styles.intentionText,
              {
                fontSize: metrics.intentFontSize,
                lineHeight: metrics.intentLineHeight,
                maxWidth: metrics.intentMaxWidth,
                marginTop: scalePx(28),
              },
            ]}
          >
            {safeIntention}
          </Text>

          <View style={[styles.rule, { width: metrics.ruleWidth, marginTop: scalePx(34) }]} />
          <View style={[styles.statBlock, { marginTop: scalePx(26), gap: scalePx(8) }]}>
            <Text style={[styles.statValue, { fontSize: metrics.statValueFontSize }]}>
              {Math.max(0, daysPrimed || 0)}
            </Text>
            <Text style={[styles.statLabel, { fontSize: metrics.statLabelFontSize }]}>DAYS PRIMED</Text>
          </View>
        </View>

        <View style={[styles.footer, { gap: metrics.footerGap }]}>
          <Text style={[styles.footerWordmark, { fontSize: metrics.footerWordmarkSize }]}>Anchor</Text>
          <Text style={[styles.footerUrl, { fontSize: metrics.footerUrlSize }]}>anchorintentions.com</Text>
        </View>
      </View>
    </View>
  );
}

function StoriesCardSurface({
  anchorSVG,
  artworkUri,
  intention,
  daysPrimed,
  onArtworkReady,
}: ShareCardSurfaceProps) {
  const size = FORMAT_SIZES.stories;
  const safeIntention = useMemo(() => {
    const raw = intention?.trim() || 'Anchor intention unavailable';
    return raw.replace(/\s+/g, ' ').replace(/^"+|"+$/g, '');
  }, [intention]);

  return (
    <View
      style={[
        styles.storiesCanvas,
        {
          width: scalePx(size.width),
          height: scalePx(size.height),
        },
      ]}
    >
      <BackgroundArt width={scalePx(size.width)} height={scalePx(size.height)} stories />
      <Corner position="tl" inset={scalePx(40)} size={scalePx(36)} borderWidth={1.5} />
      <Corner position="tr" inset={scalePx(40)} size={scalePx(36)} borderWidth={1.5} />
      <Corner position="bl" inset={scalePx(40)} size={scalePx(36)} borderWidth={1.5} />
      <Corner position="br" inset={scalePx(40)} size={scalePx(36)} borderWidth={1.5} />

      <View style={[styles.storiesBrandZone, { height: scalePx(180), paddingBottom: scalePx(20) }]}>
        <Text style={[styles.storiesBrandLine, { fontSize: scalePx(24), letterSpacing: scalePx(8) }]}>
          Anchor · Intentions Made Visible
        </Text>
      </View>

      <View style={[styles.storiesSigilZone, { height: scalePx(1460) }]}>
        <View
          style={[
            styles.storiesSigilGlowClamp,
            { width: scalePx(920), height: scalePx(920) },
          ]}
        >
          <SigilRing
            sigilXml={anchorSVG || FALLBACK_SIGIL}
            artworkUri={artworkUri}
            ringSize={scalePx(720)}
            sigilSize={scalePx(664)}
            borderWidth={2}
            glowOpacity={0.18}
            glowShadowOpacity={0.5}
            shadowRadius={scalePx(84)}
            onArtworkReady={onArtworkReady}
          />
        </View>
      </View>

      <View
        style={[
          styles.storiesIntentionZone,
          { height: scalePx(280), paddingHorizontal: scalePx(100) },
        ]}
      >
        <View style={[styles.storiesRule, { width: scalePx(40) }]} />
        <Text
          style={[
            styles.storiesIntentionText,
            {
              marginVertical: scalePx(28),
              maxWidth: scalePx(970),
              fontSize: scalePx(52),
              lineHeight: scalePx(72),
            },
          ]}
          numberOfLines={2}
          ellipsizeMode="tail"
        >
          {safeIntention}
        </Text>
        <View style={[styles.storiesRule, { width: scalePx(40) }]} />
      </View>

      <View style={[styles.storiesStatZone, { height: scalePx(280) }]}>
        <Text
          style={[
            styles.storiesDaysValue,
            {
              fontSize: scalePx(96),
              lineHeight: scalePx(104),
              letterSpacing: scalePx(4),
            },
          ]}
        >
          {Math.max(0, daysPrimed || 0)}
        </Text>
        <Text
          style={[
            styles.storiesDaysLabel,
            {
              marginTop: scalePx(8),
              fontSize: scalePx(28),
              letterSpacing: scalePx(12),
            },
          ]}
        >
          DAYS PRIMED
        </Text>
      </View>

      <View style={[styles.storiesFooterZone, { height: scalePx(372), paddingBottom: scalePx(100) }]}>
        <Text
          style={[
            styles.storiesWordmark,
            {
              fontSize: scalePx(48),
              letterSpacing: scalePx(20),
            },
          ]}
        >
          Anchor
        </Text>
        <Text
          style={[
            styles.storiesUrl,
            {
              marginTop: scalePx(8),
              fontSize: scalePx(32),
            },
          ]}
        >
          anchorintentions.com
        </Text>
      </View>
    </View>
  );
}

const ShareCardRenderer = forwardRef<ShareCardRendererRef, ShareCardRendererProps>(function ShareCardRenderer(
  {
    anchorSVG,
    artworkUri,
    intention,
    daysPrimed,
    format = 'square',
    onRenderReady,
  },
  ref
) {
  const viewShotRef = useRef<ViewShot | null>(null);
  const size = FORMAT_SIZES[format];
  const layoutSize = {
    width: scalePx(size.width),
    height: scalePx(size.height),
  };
  const readyFiredRef = useRef(false);
  const layoutReadyRef = useRef(false);
  const artworkReadyRef = useRef(!artworkUri);

  const maybeNotifyRenderReady = useCallback(() => {
    if (readyFiredRef.current || !layoutReadyRef.current || !artworkReadyRef.current) {
      return;
    }

    readyFiredRef.current = true;
    onRenderReady?.();
  }, [onRenderReady]);

  useImperativeHandle(
    ref,
    () => ({
      async capture(options) {
        const target = viewShotRef.current;
        const uri = target ? await captureRef(target, options) : null;
        if (!uri) {
          throw new Error('Unable to capture share card.');
        }
        return uri;
      },
    }),
    []
  );

  return (
    <View
      pointerEvents="none"
      collapsable={false}
      style={[
        styles.hiddenStage,
        {
          top: -9999,
          left: -9999,
          width: layoutSize.width,
          height: layoutSize.height,
        },
      ]}
    >
      <ViewShot
        ref={viewShotRef}
        style={{ width: layoutSize.width, height: layoutSize.height }}
        options={{
          fileName: `anchor-share-card-${format}`,
          format: 'png',
          quality: 1,
          result: 'tmpfile',
        }}
        onLayout={() => {
          layoutReadyRef.current = true;
          maybeNotifyRenderReady();
        }}
      >
        {format === 'stories' ? (
          <StoriesCardSurface
            anchorSVG={anchorSVG}
            artworkUri={artworkUri}
            intention={intention}
            daysPrimed={daysPrimed}
            format={format}
            onArtworkReady={() => {
              artworkReadyRef.current = true;
              maybeNotifyRenderReady();
            }}
          />
        ) : (
          <SquareCardSurface
            anchorSVG={anchorSVG}
            artworkUri={artworkUri}
            intention={intention}
            daysPrimed={daysPrimed}
            format={format}
            onArtworkReady={() => {
              artworkReadyRef.current = true;
              maybeNotifyRenderReady();
            }}
          />
        )}
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
    shadowColor: DEEP_PURPLE,
    shadowOffset: { width: 0, height: 0 },
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
  storiesCanvas: {
    width: 1170,
    height: 2532,
    backgroundColor: NAVY,
    overflow: 'hidden',
  },
  storiesBrandZone: {
    height: 180,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 20,
  },
  storiesBrandLine: {
    fontFamily: typography.fontFamily.serif,
    fontSize: 24,
    letterSpacing: 8,
    textTransform: 'uppercase',
    textAlign: 'center',
    color: 'rgba(212,175,55,0.45)',
  },
  storiesSigilZone: {
    height: 1140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storiesSigilGlowClamp: {
    width: 720,
    height: 720,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  storiesIntentionZone: {
    height: 280,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 100,
  },
  storiesRule: {
    width: 40,
    height: 1,
    backgroundColor: GOLD,
    opacity: 0.9,
  },
  storiesIntentionText: {
    marginVertical: 28,
    maxWidth: 970,
    textAlign: 'center',
    color: 'rgba(245,245,220,0.6)',
    fontFamily: typography.fontFamily.bodySerifItalic,
    fontSize: 52,
    lineHeight: 72,
  },
  storiesStatZone: {
    height: 280,
    justifyContent: 'center',
    alignItems: 'center',
  },
  storiesDaysValue: {
    fontFamily: typography.fontFamily.serifSemiBold,
    fontSize: 96,
    lineHeight: 104,
    letterSpacing: 4,
    color: GOLD,
    textAlign: 'center',
  },
  storiesDaysLabel: {
    marginTop: 8,
    fontFamily: typography.fontFamily.serif,
    fontSize: 28,
    letterSpacing: 12,
    color: 'rgba(192,192,192,0.45)',
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  storiesFooterZone: {
    height: 372,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 100,
  },
  storiesWordmark: {
    fontFamily: typography.fontFamily.serif,
    fontSize: 48,
    letterSpacing: 20,
    color: 'rgba(212,175,55,0.6)',
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  storiesUrl: {
    marginTop: 8,
    fontFamily: typography.fontFamily.bodySerifItalic,
    fontSize: 32,
    color: 'rgba(192,192,192,0.25)',
    textAlign: 'center',
  },
});

export default ShareCardRenderer;
