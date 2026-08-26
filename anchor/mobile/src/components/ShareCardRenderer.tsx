import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Image, PixelRatio, StyleSheet, Text, View } from 'react-native';
import ViewShot, { captureRef, type CaptureOptions } from 'react-native-view-shot';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { SvgXml } from 'react-native-svg';
import { typography } from '@/theme';
import { getThreadStrengthState } from '@/utils/threadStrength';
import type { ThreadStrengthStage } from '@/types/practice';

const BACKGROUND = '#0F1419';
const BACKGROUND_DEEP = '#080B0F';
const GOLD = '#D9B36C';
const IVORY = '#F2ECDD';
const ENDPOINT = '#F7E9C8';

const FORMAT_SIZES = {
  square: { width: 1080, height: 1080 },
  stories: { width: 1080, height: 1920 },
} as const;

const DEVICE_SCALE = PixelRatio.get() || 1;

const FALLBACK_SIGIL = `<svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="60" cy="60" r="52" stroke="#D9B36C" stroke-width="1" opacity="0.3"/>
  <path d="M35 34 L35 86 L60 86 M60 34 L60 86 M60 34 L85 34 L85 60" stroke="#D9B36C" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const PARTICLES: Array<{ top: `${number}%`; left: `${number}%`; opacity: number }> = [
  { top: '12%', left: '16%', opacity: 0.22 },
  { top: '20%', left: '84%', opacity: 0.16 },
  { top: '78%', left: '11%', opacity: 0.18 },
  { top: '88%', left: '89%', opacity: 0.12 },
  { top: '6%', left: '52%', opacity: 0.12 },
];

const STAGE_TREATMENT: Record<ThreadStrengthStage, { haloOpacity: number; ringOpacity: number; endpointOpacity: number }> = {
  nascent: { haloOpacity: 0.55, ringOpacity: 0.85, endpointOpacity: 0.74 },
  kindling: { haloOpacity: 0.65, ringOpacity: 0.9, endpointOpacity: 0.82 },
  tempered: { haloOpacity: 0.8, ringOpacity: 1, endpointOpacity: 0.92 },
  forged: { haloOpacity: 1, ringOpacity: 1, endpointOpacity: 1 },
};

export type ShareCardFormat = keyof typeof FORMAT_SIZES;

export interface ShareCardRendererProps {
  anchorSVG: string;
  artworkUri?: string | null;
  intention: string;
  daysPrimed: number;
  /** The canonical 0–100 score that controls ring fill and progression treatment. */
  threadStrength?: number;
  format?: ShareCardFormat;
  onRenderReady?: () => void;
}

export interface ShareCardRendererRef {
  capture: (options?: CaptureOptions) => Promise<string>;
}

interface SurfaceProps extends ShareCardRendererProps {
  onArtworkReady?: () => void;
}

function scalePx(value: number) {
  return value / DEVICE_SCALE;
}

function clampStrength(value?: number) {
  return Math.max(0, Math.min(100, Math.round(value ?? 0)));
}

function Corner({ position, inset, size }: { position: 'tl' | 'tr' | 'bl' | 'br'; inset: number; size: number }) {
  return (
    <View
      style={[
        styles.corner,
        { width: size, height: size },
        position === 'tl' && { top: inset, left: inset, borderTopWidth: 1, borderLeftWidth: 1 },
        position === 'tr' && { top: inset, right: inset, borderTopWidth: 1, borderRightWidth: 1 },
        position === 'bl' && { bottom: inset, left: inset, borderBottomWidth: 1, borderLeftWidth: 1 },
        position === 'br' && { bottom: inset, right: inset, borderBottomWidth: 1, borderRightWidth: 1 },
      ]}
    />
  );
}

function Background({ width, height }: { width: number; height: number }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={['#131A22', BACKGROUND, BACKGROUND_DEEP]}
        locations={[0, 0.46, 1]}
        start={{ x: 0.5, y: 0.12 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="share-card-bg" cx="50%" cy="34%" r="68%">
            <Stop offset="0%" stopColor="#26364B" stopOpacity="0.26" />
            <Stop offset="70%" stopColor="#131A22" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx={width / 2} cy={height * 0.34} r={Math.max(width, height) * 0.66} fill="url(#share-card-bg)" />
      </Svg>
      <View style={styles.vignette} />
    </View>
  );
}

function ParticleField() {
  return (
    <>
      {PARTICLES.map((particle, index) => (
        <View
          key={`${particle.top}-${particle.left}`}
          style={[styles.particle, { top: particle.top, left: particle.left, opacity: particle.opacity, width: index === 0 ? 2 : 1.5, height: index === 0 ? 2 : 1.5 }]}
        />
      ))}
    </>
  );
}

function Artwork({ artworkUri, sigilXml, size, onArtworkReady }: { artworkUri?: string | null; sigilXml: string; size: number; onArtworkReady?: () => void }) {
  const [imageFailed, setImageFailed] = useState(false);
  const didReportReady = useRef(false);
  const reportReady = useCallback(() => {
    if (didReportReady.current) return;
    didReportReady.current = true;
    onArtworkReady?.();
  }, [onArtworkReady]);

  useEffect(() => {
    setImageFailed(false);
    didReportReady.current = false;
  }, [artworkUri]);

  useEffect(() => {
    if (!artworkUri || imageFailed) reportReady();
  }, [artworkUri, imageFailed, reportReady]);

  return (
    <View style={[styles.artworkOutset, { width: size + 12, height: size + 12, borderRadius: (size + 12) / 2 }]}>
      <View style={[styles.artwork, { width: size, height: size, borderRadius: size / 2 }]}>
        {artworkUri && !imageFailed ? (
          <Image source={{ uri: artworkUri }} resizeMode="cover" onLoadEnd={reportReady} onError={() => setImageFailed(true)} style={{ width: size, height: size, borderRadius: size / 2 }} />
        ) : (
          <SvgXml xml={sigilXml || FALLBACK_SIGIL} width={size * 0.56} height={size * 0.56} />
        )}
      </View>
    </View>
  );
}

function ThreadStrengthRing({ strength, stage, ringSize, artworkSize, sigilXml, artworkUri, onArtworkReady }: {
  strength: number;
  stage: ThreadStrengthStage;
  ringSize: number;
  artworkSize: number;
  sigilXml: string;
  artworkUri?: string | null;
  onArtworkReady?: () => void;
}) {
  const treatment = STAGE_TREATMENT[stage];
  const strokeWidth = scalePx(3);
  const radius = ringSize / 2 - strokeWidth / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = strength / 100;
  const angle = (progress * 360 - 90) * (Math.PI / 180);
  const endpointX = ringSize / 2 + radius * Math.cos(angle);
  const endpointY = ringSize / 2 + radius * Math.sin(angle);
  const endpointRadius = scalePx(2.75);
  const haloSize = ringSize + scalePx(144);

  return (
    <View style={[styles.ringStage, { width: ringSize, height: ringSize }]}>
      <Svg width={haloSize} height={haloSize} style={[styles.halo, { left: -scalePx(72), top: -scalePx(72), opacity: treatment.haloOpacity }]}>
        <Defs>
          <RadialGradient id="thread-strength-halo" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#6084C0" stopOpacity="0.2" />
            <Stop offset="45%" stopColor="#7E60C0" stopOpacity="0.1" />
            <Stop offset="100%" stopColor="#7E60C0" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx={haloSize / 2} cy={haloSize / 2} r={haloSize / 2} fill="url(#thread-strength-halo)" />
      </Svg>
      <Svg width={ringSize} height={ringSize} style={styles.ringSvg}>
        <Circle cx={ringSize / 2} cy={ringSize / 2} r={radius} stroke="rgba(217,179,108,0.12)" strokeWidth={strokeWidth} fill="none" />
        <Circle
          cx={ringSize / 2}
          cy={ringSize / 2}
          r={radius}
          stroke={GOLD}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={circumference * (1 - progress)}
          fill="none"
          opacity={treatment.ringOpacity}
          rotation="-90"
          origin={`${ringSize / 2}, ${ringSize / 2}`}
        />
        <Circle cx={endpointX} cy={endpointY} r={endpointRadius * 3} fill={GOLD} opacity={0.07 * treatment.endpointOpacity} />
        <Circle cx={endpointX} cy={endpointY} r={endpointRadius * 1.8} fill={GOLD} opacity={0.16 * treatment.endpointOpacity} />
        <Circle cx={endpointX} cy={endpointY} r={endpointRadius} fill={ENDPOINT} opacity={treatment.endpointOpacity} />
      </Svg>
      <View style={styles.artworkPosition}>
        <Artwork artworkUri={artworkUri} sigilXml={sigilXml} size={artworkSize} onArtworkReady={onArtworkReady} />
      </View>
    </View>
  );
}

function Brand() {
  return <View style={styles.brand}><Text style={styles.brandWord}>ANCHOR</Text><Text style={styles.brandTag}>Visual goal setting</Text></View>;
}

function CardMetric({ daysPrimed, strength, isStory }: { daysPrimed: number; strength: number; isStory: boolean }) {
  const label = getThreadStrengthState(strength).label.toUpperCase();
  const days = Math.max(0, daysPrimed || 0);
  return (
    <View style={[styles.metric, isStory && styles.storyMetric]}>
      <Text style={[styles.metricNumber, isStory && styles.storyMetricNumber]}>{days}</Text>
      <Text style={[styles.metricCaption, isStory && styles.storyMetricCaption]}>DAY{days === 1 ? '' : 'S'} PRIMED</Text>
      <Text style={[styles.metricThread, isStory && styles.storyMetricThread]}>{`${label} · ${strength}% THREAD STRENGTH`}</Text>
    </View>
  );
}

function ShareCardSurface({ anchorSVG, artworkUri, intention, daysPrimed, threadStrength, format = 'square', onArtworkReady }: SurfaceProps) {
  const size = FORMAT_SIZES[format];
  const isStory = format === 'stories';
  const strength = clampStrength(threadStrength);
  const stage = getThreadStrengthState(strength).stage;
  const safeIntention = useMemo(() => {
    const text = (intention?.trim() || 'I return to what matters').replace(/\s+/g, ' ').replace(/^"+|"+$/g, '');
    const limited = text.length > 112 ? `${text.slice(0, 111).trimEnd()}…` : text;
    return `“${limited}”`;
  }, [intention]);
  const ringSize = scalePx(isStory ? 560 : 480);
  const artworkSize = scalePx(isStory ? 500 : 420);

  return (
    <View style={[styles.canvas, { width: scalePx(size.width), height: scalePx(size.height) }]}>
      <Background width={scalePx(size.width)} height={scalePx(size.height)} />
      <ParticleField />
      <Corner position="tl" inset={scalePx(40)} size={scalePx(22)} />
      <Corner position="tr" inset={scalePx(40)} size={scalePx(22)} />
      <Corner position="bl" inset={scalePx(40)} size={scalePx(22)} />
      <Corner position="br" inset={scalePx(40)} size={scalePx(22)} />
      <View style={[styles.content, isStory ? styles.storyContent : styles.squareContent]}>
        <Brand />
        <View style={[styles.stageWrap, { width: ringSize, height: ringSize }, isStory ? styles.storyStageWrap : styles.squareStageWrap]}>
          <ThreadStrengthRing strength={strength} stage={stage} ringSize={ringSize} artworkSize={artworkSize} sigilXml={anchorSVG || FALLBACK_SIGIL} artworkUri={artworkUri} onArtworkReady={onArtworkReady} />
          <View style={[styles.threadMotif, { top: ringSize, height: scalePx(isStory ? 52 : 58) }]} />
        </View>
        <Text style={[styles.intention, isStory ? styles.storyIntention : styles.squareIntention]} numberOfLines={isStory ? 3 : 2} ellipsizeMode="tail">{safeIntention}</Text>
        <View style={[styles.divider, isStory ? styles.storyDivider : styles.squareDivider]} />
        <CardMetric daysPrimed={daysPrimed} strength={strength} isStory={isStory} />
        <Text style={[styles.footer, isStory ? styles.storyFooter : styles.squareFooter]}>Made with Anchor</Text>
      </View>
    </View>
  );
}

const ShareCardRenderer = forwardRef<ShareCardRendererRef, ShareCardRendererProps>(function ShareCardRenderer(props, ref) {
  const viewShotRef = useRef<ViewShot | null>(null);
  const size = FORMAT_SIZES[props.format ?? 'square'];
  const readyFired = useRef(false);
  const layoutReady = useRef(false);
  const artworkReady = useRef(!props.artworkUri);
  const notifyReady = useCallback(() => {
    if (readyFired.current || !layoutReady.current || !artworkReady.current) return;
    readyFired.current = true;
    props.onRenderReady?.();
  }, [props]);

  useEffect(() => {
    readyFired.current = false;
    layoutReady.current = false;
    artworkReady.current = !props.artworkUri;
  }, [props.artworkUri, props.format]);

  useImperativeHandle(ref, () => ({
    async capture(options) {
      const uri = viewShotRef.current ? await captureRef(viewShotRef.current, options) : null;
      if (!uri) throw new Error('Unable to capture share card.');
      return uri;
    },
  }), []);

  return (
    <View pointerEvents="none" collapsable={false} style={[styles.hiddenStage, { top: -9999, left: -9999, width: scalePx(size.width), height: scalePx(size.height) }]}>
      <ViewShot ref={viewShotRef} style={{ width: scalePx(size.width), height: scalePx(size.height) }} options={{ fileName: `anchor-share-card-${props.format ?? 'square'}`, format: 'png', quality: 1, result: 'tmpfile' }} onLayout={() => { layoutReady.current = true; notifyReady(); }}>
        <ShareCardSurface {...props} onArtworkReady={() => { artworkReady.current = true; notifyReady(); }} />
      </ViewShot>
    </View>
  );
});

const styles = StyleSheet.create({
  hiddenStage: { position: 'absolute' },
  canvas: { position: 'relative', overflow: 'hidden', backgroundColor: BACKGROUND },
  vignette: { ...StyleSheet.absoluteFillObject, shadowColor: '#000000', shadowOpacity: 0.6, shadowRadius: 100, shadowOffset: { width: 0, height: 0 } },
  particle: { position: 'absolute', borderRadius: 99, backgroundColor: GOLD },
  corner: { position: 'absolute', borderColor: 'rgba(217,179,108,0.14)' },
  content: { flex: 1, alignItems: 'center', zIndex: 1 },
  squareContent: { paddingTop: scalePx(64), paddingBottom: scalePx(56) },
  storyContent: { paddingTop: scalePx(96), paddingBottom: scalePx(170) },
  brand: { alignItems: 'center' },
  brandWord: { fontFamily: typography.fontFamily.serifSemiBold, fontSize: scalePx(20), lineHeight: scalePx(24), letterSpacing: scalePx(8), paddingLeft: scalePx(8), color: GOLD },
  brandTag: { marginTop: scalePx(8), fontFamily: typography.fontFamily.serif, fontSize: scalePx(9), lineHeight: scalePx(11), letterSpacing: scalePx(2.7), paddingLeft: scalePx(2.7), color: 'rgba(217,179,108,0.55)', textTransform: 'uppercase' },
  stageWrap: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  squareStageWrap: { marginTop: scalePx(48) },
  storyStageWrap: { marginTop: scalePx(103) },
  ringStage: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute' },
  ringSvg: { position: 'absolute' },
  artworkPosition: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  artworkOutset: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(6,8,11,0.92)', shadowColor: '#12121C', shadowOpacity: 0.5, shadowRadius: 22, shadowOffset: { width: 0, height: 0 }, elevation: 4 },
  artwork: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(217,179,108,0.5)', backgroundColor: '#111820' },
  threadMotif: { position: 'absolute', width: 1, backgroundColor: 'rgba(217,179,108,0.25)' },
  intention: { fontFamily: typography.fontFamily.bodySerifItalic, fontStyle: 'italic', fontWeight: '500', color: IVORY, textAlign: 'center' },
  squareIntention: { marginTop: scalePx(40), fontSize: scalePx(40), lineHeight: scalePx(48), paddingHorizontal: scalePx(100) },
  storyIntention: { marginTop: scalePx(25), fontSize: scalePx(48), lineHeight: scalePx(58), paddingHorizontal: scalePx(110) },
  divider: { width: scalePx(52), height: 1, backgroundColor: GOLD, opacity: 0.7 },
  squareDivider: { marginTop: scalePx(24) },
  storyDivider: { marginTop: scalePx(28) },
  metric: { alignItems: 'center', marginTop: scalePx(30) },
  metricNumber: { fontFamily: typography.fontFamily.bodySerif, fontSize: scalePx(72), lineHeight: scalePx(72), fontWeight: '600', color: GOLD },
  metricCaption: { marginTop: scalePx(10), fontFamily: typography.fontFamily.serif, fontSize: scalePx(14), lineHeight: scalePx(17), letterSpacing: scalePx(4.8), paddingLeft: scalePx(4.8), color: 'rgba(242,236,221,0.78)' },
  metricThread: { marginTop: scalePx(12), fontFamily: typography.fontFamily.serif, fontSize: scalePx(12), lineHeight: scalePx(15), letterSpacing: scalePx(2.16), paddingLeft: scalePx(2.16), color: 'rgba(217,179,108,0.6)' },
  storyMetric: { marginTop: scalePx(36) },
  storyMetricNumber: { fontSize: scalePx(80), lineHeight: scalePx(80) },
  storyMetricCaption: { marginTop: scalePx(12), fontSize: scalePx(15), lineHeight: scalePx(18), letterSpacing: scalePx(5.1), paddingLeft: scalePx(5.1) },
  storyMetricThread: { marginTop: scalePx(14), fontSize: scalePx(13), lineHeight: scalePx(16), letterSpacing: scalePx(2.34), paddingLeft: scalePx(2.34) },
  footer: { marginTop: 'auto', fontFamily: typography.fontFamily.instrument, fontSize: scalePx(11), lineHeight: scalePx(14), letterSpacing: scalePx(0.44), color: 'rgba(217,179,108,0.32)' },
  squareFooter: {},
  storyFooter: { fontSize: scalePx(12), lineHeight: scalePx(15) },
});

export default ShareCardRenderer;
