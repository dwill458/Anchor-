import React, { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { Image, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import ViewShot from 'react-native-view-shot';
import Svg, { Path, Polyline } from 'react-native-svg';
import { useAnchorStore } from '@/stores/anchorStore';
import { useSessionStore } from '@/stores/sessionStore';
import type { WeeklyStats } from '@/hooks/useWeeklyStats';
import type { Anchor } from '@/types';
import { SigilSvg } from '@/components/common/SigilSvg';

const GOLD = '#D4AF37';
const NAVY = '#0F1419';
const BONE = '#F5F5DC';
const SILVER = '#C0C0C0';
const GREEN = '#4a9e58';
const PLACEHOLDER_SIGIL = `<svg viewBox="0 0 36 40" fill="none" xmlns="http://www.w3.org/2000/svg">
  <line x1="18" y1="2" x2="18" y2="38" stroke="#D4AF37" stroke-width="0.8" opacity="0.5"/>
  <line x1="2" y1="13" x2="34" y2="13" stroke="#D4AF37" stroke-width="0.8" opacity="0.5"/>
  <line x1="8" y1="4" x2="28" y2="36" stroke="#D4AF37" stroke-width="0.6" opacity="0.35"/>
  <line x1="28" y1="4" x2="8" y2="36" stroke="#D4AF37" stroke-width="0.6" opacity="0.35"/>
  <circle cx="18" cy="13" r="4.5" stroke="#D4AF37" stroke-width="0.8" fill="rgba(212,175,55,0.08)"/>
</svg>`;

const EXPORT_SIZES = {
  square: { width: 1080, height: 1080 },
  story: { width: 1080, height: 1920 },
} as const;

type ShareCardFormat = keyof typeof EXPORT_SIZES;
type PrimingState = WeeklyStats['days'][number]['state'];
type ExtendedAnchor = Anchor & { sigilImageUri?: string | null };
export interface ShareCardProps {
  stats: WeeklyStats;
  format?: 'square' | 'story';
}

export interface ShareCardRef {
  capture: () => Promise<string>;
}

interface ResolvedAnchorData {
  artworkUri: string | null;
  sigilXml: string;
  intention: string;
  threadStrength: number;
  totalPrimeCount: number;
}

function StarGlyph({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 10 10">
      <Path
        d="M5 0L6 3.5H10L7 5.5L8 9L5 7L2 9L3 5.5L0 3.5H4Z"
        fill={color}
      />
    </Svg>
  );
}

function CheckGlyph({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 9 9">
      <Polyline
        points="1,5 4,8 8,1"
        stroke={GREEN}
        strokeWidth={1.5}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function Corner({ position }: { position: 'tl' | 'tr' | 'bl' | 'br' }) {
  return (
    <View
      style={[
        styles.corner,
        position === 'tl' && styles.cornerTl,
        position === 'tr' && styles.cornerTr,
        position === 'bl' && styles.cornerBl,
        position === 'br' && styles.cornerBr,
      ]}
    />
  );
}

function Node({
  state,
  size,
  starSize,
  dashSize,
}: {
  state: PrimingState;
  size: number;
  starSize: number;
  dashSize: number;
}) {
  const isPrimed = state === 'primed' || state === 'today';
  const isRecovered = state === 'recovered';
  const isMissed = state === 'missed';

  return (
    <View
      style={[
        styles.nodeBase,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
        isPrimed && styles.nodeGold,
        isRecovered && styles.nodeGreen,
        isMissed && styles.nodeGray,
      ]}
    >
      {isPrimed ? <StarGlyph size={starSize} color={GOLD} /> : null}
      {isRecovered ? <CheckGlyph size={starSize} /> : null}
      {isMissed ? (
        <Text style={[styles.nodeDash, { fontSize: dashSize, lineHeight: dashSize + 1 }]}>—</Text>
      ) : null}
    </View>
  );
}

function formatWeekRangeCompact(startValue: string, endValue: string): string {
  const start = new Date(startValue);
  const end = new Date(endValue);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return `${startValue}–${endValue}`;
  }

  const startMonth = start.toLocaleDateString(undefined, { month: 'short' }).toUpperCase();
  const endMonth = end.toLocaleDateString(undefined, { month: 'short' }).toUpperCase();
  const startDay = start.getDate();
  const endDay = end.getDate();

  if (startMonth === endMonth) {
    return `${startMonth} ${startDay}–${endDay}`;
  }

  return `${startMonth} ${startDay}–${endMonth} ${endDay}`;
}

function resolveAnchorData(anchors: Anchor[], stats: WeeklyStats, totalPrimeCount: number): ResolvedAnchorData {
  const dominantAnchor = stats.dominantAnchor;
  const anchor = dominantAnchor
    ? anchors.find((item) => item.id === dominantAnchor.id || item.localId === dominantAnchor.id) as ExtendedAnchor | undefined
    : undefined;

  return {
    artworkUri: anchor?.sigilImageUri ?? anchor?.enhancedImageUrl ?? null,
    sigilXml: anchor?.baseSigilSvg ?? PLACEHOLDER_SIGIL,
    intention: dominantAnchor?.intention ?? '"I close every deal I pursue"',
    threadStrength: dominantAnchor?.threadStrength ?? 72,
    totalPrimeCount,
  };
}

function Artwork({
  artworkUri,
  sigilXml,
  boxSize,
  sigilSize,
}: {
  artworkUri: string | null;
  sigilXml: string;
  boxSize: number;
  sigilSize: number;
}) {
  return (
    <View
      style={[
        styles.artworkBox,
        {
          width: boxSize,
          height: boxSize,
          borderRadius: boxSize >= 190 ? 24 : boxSize >= 130 ? 12 : 8,
        },
      ]}
    >
      {artworkUri ? (
        <Image
          source={{ uri: artworkUri }}
          style={{ width: boxSize, height: boxSize, borderRadius: boxSize >= 190 ? 24 : boxSize >= 130 ? 12 : 8 }}
          resizeMode="cover"
        />
      ) : (
        <View style={styles.artworkSvgCenter}>
          <SigilSvg xml={sigilXml} width={sigilSize} height={sigilSize} />
        </View>
      )}
    </View>
  );
}

function SquareSurface({
  stats,
  anchorData,
}: {
  stats: WeeklyStats;
  anchorData: ResolvedAnchorData;
}) {
  const barWidth: `${number}%` = `${Math.max(0, Math.min(100, anchorData.threadStrength))}%`;

  return (
    <View style={styles.squareCanvas}>
      <Corner position="tl" />
      <Corner position="tr" />
      <Corner position="bl" />
      <Corner position="br" />

      <View style={styles.squareInner}>
        <View style={styles.squareTop}>
          <Text style={styles.squareBrand}>ANCHOR</Text>
          <Text style={styles.squareWeekBadge}>
            {`WEEK ${stats.weekNumber} · ${formatWeekRangeCompact(stats.weekStart, stats.weekEnd)}`}
          </Text>
        </View>

        <View>
          <Text style={styles.squareKicker}>THREAD REVIEW</Text>
          <View style={styles.squareThreadRow}>
            <View style={styles.squareThreadLine} />
            {stats.days.map((day) => (
              <Node key={day.date} state={day.state} size={26} starSize={9} dashSize={14} />
            ))}
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.squareSigilRow}>
          <Artwork
            artworkUri={anchorData.artworkUri}
            sigilXml={anchorData.sigilXml}
            boxSize={48}
            sigilSize={28}
          />
          <View style={styles.squareSigilInfo}>
            <Text style={styles.squareIntent}>{`"${anchorData.intention.replace(/^"|"$/g, '')}"`}</Text>
            <View style={styles.squareThreadBarBg}>
              <View style={[styles.squareThreadBarFill, { width: barWidth }]} />
            </View>
            <Text style={styles.squareThreadMeta}>{`THREAD  ${anchorData.threadStrength}`}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.squareStats}>
          <View style={styles.squareStat}>
            <Text style={[styles.squareStatValue, styles.valueGold]}>{stats.totalPrimes}</Text>
            <Text style={styles.squareStatLabel}>primes{'\n'}this week</Text>
          </View>
          <View style={styles.squareStat}>
            <Text style={styles.squareStatValue}>{`${stats.daysShownUp}/7`}</Text>
            <Text style={styles.squareStatLabel}>days{'\n'}primed</Text>
          </View>
          <View style={styles.squareStat}>
            <Text style={[styles.squareStatValue, styles.valueGreen]}>{`+${stats.threadDelta}`}</Text>
            <Text style={styles.squareStatLabel}>thread{'\n'}gained</Text>
          </View>
        </View>

        <Text style={styles.squareInsight}>
          You prime most on <Text style={styles.insightHighlight}>{`${stats.peakPrimingWindow.day} ${stats.peakPrimingWindow.timeOfDay}.`}</Text>
          {'\n'}
          That's not habit yet — that's identity.
        </Text>

        <View style={styles.squareBottom}>
          <Text style={styles.squareBottomBrand}>ANCHOR</Text>
          <Text style={styles.squareUrl}>anchorintentions.com</Text>
        </View>
      </View>
    </View>
  );
}

function StorySurface({
  stats,
  anchorData,
}: {
  stats: WeeklyStats;
  anchorData: ResolvedAnchorData;
}) {
  return (
    <View style={styles.storyCanvas}>
      <Corner position="tl" />
      <Corner position="tr" />
      <Corner position="bl" />
      <Corner position="br" />

      <View style={styles.storyInner}>
        <Text style={styles.storyBrand}>ANCHOR</Text>

        <View style={styles.storyWeekBlock}>
          <Text style={styles.storyWeekLabel}>THREAD REVIEW</Text>
          <Text style={styles.storyWeekTitle}>{`Week ${stats.weekNumber}`}</Text>
          <Text style={styles.storyWeekDate}>
            {new Date(stats.weekStart).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}
            {' – '}
            {new Date(stats.weekEnd).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
          </Text>
        </View>

        <View style={styles.storySigilBlock}>
          <Artwork
            artworkUri={anchorData.artworkUri}
            sigilXml={anchorData.sigilXml}
            boxSize={64}
            sigilSize={36}
          />
          <Text style={styles.storyIntent}>{`"${anchorData.intention.replace(/^"|"$/g, '')}"`}</Text>
        </View>

        <View>
          <Text style={styles.storyThreadLabel}>THIS WEEK'S THREAD</Text>
          <View style={styles.storyThreadRow}>
            <View style={styles.storyThreadLine} />
            {stats.days.map((day) => (
              <Node key={day.date} state={day.state} size={20} starSize={7} dashSize={11} />
            ))}
          </View>
        </View>

        <View style={styles.storyStats}>
          <View style={styles.storyStat}>
            <Text style={[styles.storyStatValue, styles.valueGold]}>{stats.totalPrimes}</Text>
            <Text style={styles.storyStatLabel}>primes</Text>
          </View>
          <View style={styles.storyStat}>
            <Text style={styles.storyStatValue}>{`${stats.daysShownUp}/7`}</Text>
            <Text style={styles.storyStatLabel}>days</Text>
          </View>
          <View style={styles.storyStat}>
            <Text style={[styles.storyStatValue, styles.valueGreen]}>{`+${stats.threadDelta}`}</Text>
            <Text style={styles.storyStatLabel}>thread</Text>
          </View>
        </View>

        <Text style={styles.storyUrl}>anchorintentions.com</Text>
      </View>
    </View>
  );
}

function ShareCardSurface({
  stats,
  format,
}: {
  stats: WeeklyStats;
  format: ShareCardFormat;
}) {
  const anchors = useAnchorStore((state) => state.anchors);
  const sessionLog = useSessionStore((state) => state.sessionLog);

  const totalPrimeCountForAnchor = useMemo(() => {
    if (!stats.dominantAnchor) {
      return stats.totalPrimes;
    }

    const matchingAnchor = anchors.find(
      (item) => item.id === stats.dominantAnchor?.id || item.localId === stats.dominantAnchor?.id
    );

    return sessionLog.filter(
      (entry) =>
        (entry.type === 'activate' || entry.type === 'reinforce') &&
        (entry.anchorId === stats.dominantAnchor?.id || entry.anchorId === matchingAnchor?.localId)
    ).length || stats.totalPrimes;
  }, [anchors, sessionLog, stats.dominantAnchor, stats.totalPrimes]);

  const anchorData = useMemo(
    () => resolveAnchorData(anchors, stats, totalPrimeCountForAnchor),
    [anchors, stats, totalPrimeCountForAnchor]
  );

  return format === 'story'
    ? <StorySurface stats={stats} anchorData={anchorData} />
    : <SquareSurface stats={stats} anchorData={anchorData} />;
}

export const ShareCard = forwardRef<ShareCardRef, ShareCardProps>(function ShareCard(
  {
    stats,
    format = 'square',
  },
  ref
) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const size = EXPORT_SIZES[format];
  const viewShotRef = useRef<ViewShot | null>(null);
  const scale = Math.min((screenWidth - 24) / size.width, (screenHeight - 24) / size.height, 1);
  const previewWidth = size.width * scale;
  const previewHeight = size.height * scale;
  const translateX = -(size.width * (1 - scale)) / 2;
  const translateY = -(size.height * (1 - scale)) / 2;

  useImperativeHandle(ref, () => ({
    async capture() {
      const uri = await viewShotRef.current?.capture?.();
      if (!uri) {
        throw new Error('Unable to capture weekly share card.');
      }

      return uri;
    },
  }), []);

  return (
    <View style={styles.previewShell}>
      <View style={[styles.previewFrame, { width: previewWidth, height: previewHeight }]}>
        <View
          style={{
            width: size.width,
            height: size.height,
            transform: [{ translateX }, { translateY }, { scale }],
          }}
        >
          <ShareCardSurface stats={stats} format={format} />
        </View>
      </View>

      <View
        pointerEvents="none"
        collapsable={false}
        style={[
          styles.hiddenStage,
          {
            left: -(size.width * 2),
            width: size.width,
            height: size.height,
          },
        ]}
      >
        <ViewShot
          ref={viewShotRef}
          style={{ width: size.width, height: size.height }}
          options={{
            fileName: `anchor-week-${stats.weekNumber}-${format}`,
            format: 'png',
            quality: 1,
            result: 'tmpfile',
          }}
        >
          <ShareCardSurface stats={stats} format={format} />
        </ViewShot>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  previewShell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewFrame: {
    overflow: 'hidden',
    borderRadius: 4,
  },
  hiddenStage: {
    position: 'absolute',
    top: 0,
  },
  squareCanvas: {
    width: 1080,
    height: 1080,
    backgroundColor: NAVY,
    position: 'relative',
    overflow: 'hidden',
  },
  storyCanvas: {
    width: 1080,
    height: 1920,
    backgroundColor: NAVY,
    position: 'relative',
    overflow: 'hidden',
  },
  corner: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderColor: 'rgba(212,175,55,0.3)',
  },
  cornerTl: {
    top: 34,
    left: 34,
    borderTopWidth: 1,
    borderLeftWidth: 1,
  },
  cornerTr: {
    top: 34,
    right: 34,
    borderTopWidth: 1,
    borderRightWidth: 1,
  },
  cornerBl: {
    bottom: 34,
    left: 34,
    borderBottomWidth: 1,
    borderLeftWidth: 1,
  },
  cornerBr: {
    bottom: 34,
    right: 34,
    borderBottomWidth: 1,
    borderRightWidth: 1,
  },
  squareInner: {
    flex: 1,
    paddingHorizontal: 74,
    paddingTop: 72,
    paddingBottom: 60,
    justifyContent: 'space-between',
  },
  squareTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  squareBrand: {
    fontFamily: 'Cinzel-Regular',
    fontSize: 28,
    letterSpacing: 9,
    color: 'rgba(212,175,55,0.5)',
  },
  squareWeekBadge: {
    fontFamily: 'Cinzel-Regular',
    fontSize: 24,
    letterSpacing: 6,
    color: 'rgba(192,192,192,0.35)',
  },
  squareKicker: {
    fontFamily: 'Cinzel-Regular',
    fontSize: 20,
    letterSpacing: 5,
    color: 'rgba(192,192,192,0.3)',
    marginBottom: 26,
  },
  squareThreadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    position: 'relative',
    paddingHorizontal: 12,
  },
  squareThreadLine: {
    position: 'absolute',
    left: 12,
    right: 12,
    top: '50%',
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(212,175,55,0.12)',
  },
  divider: {
    width: '100%',
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(212,175,55,0.1)',
  },
  nodeBase: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  nodeGold: {
    backgroundColor: 'rgba(212,175,55,0.12)',
    borderWidth: 1,
    borderColor: GOLD,
  },
  nodeGray: {
    backgroundColor: 'rgba(30,30,40,0.8)',
    borderWidth: 1,
    borderColor: 'rgba(192,192,192,0.15)',
  },
  nodeGreen: {
    backgroundColor: 'rgba(74,158,88,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(74,158,88,0.5)',
  },
  nodeDash: {
    fontFamily: 'Cinzel-Regular',
    color: 'rgba(192,192,192,0.2)',
  },
  squareSigilRow: {
    flexDirection: 'row',
    gap: 42,
    alignItems: 'center',
  },
  squareSigilInfo: {
    flex: 1,
  },
  artworkBox: {
    backgroundColor: 'rgba(62,44,91,0.4)',
    borderWidth: 0.5,
    borderColor: 'rgba(212,175,55,0.25)',
    overflow: 'hidden',
  },
  artworkSvgCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  squareIntent: {
    fontFamily: 'CormorantGaramond-Italic',
    fontSize: 39,
    lineHeight: 53,
    color: BONE,
  },
  squareThreadBarBg: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 18,
  },
  squareThreadBarFill: {
    height: '100%',
    backgroundColor: GOLD,
    borderRadius: 3,
  },
  squareThreadMeta: {
    marginTop: 14,
    fontFamily: 'Cinzel-Regular',
    fontSize: 18,
    letterSpacing: 2,
    color: 'rgba(212,175,55,0.5)',
  },
  squareStats: {
    flexDirection: 'row',
  },
  squareStat: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 0.5,
    borderRightColor: 'rgba(245,245,220,0.06)',
  },
  squareStatValue: {
    fontFamily: 'Cinzel-Regular',
    fontSize: 34,
    lineHeight: 36,
    color: BONE,
    marginBottom: 8,
  },
  valueGold: {
    color: GOLD,
  },
  valueGreen: {
    color: GREEN,
  },
  squareStatLabel: {
    fontFamily: 'CormorantGaramond-Italic',
    fontSize: 20,
    lineHeight: 26,
    color: 'rgba(192,192,192,0.35)',
    textAlign: 'center',
  },
  squareInsight: {
    fontFamily: 'CormorantGaramond-Italic',
    fontSize: 24,
    lineHeight: 36,
    color: 'rgba(192,192,192,0.45)',
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  insightHighlight: {
    color: 'rgba(212,175,55,0.65)',
  },
  squareBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  squareBottomBrand: {
    fontFamily: 'Cinzel-Regular',
    fontSize: 33,
    letterSpacing: 12,
    color: 'rgba(212,175,55,0.4)',
  },
  squareUrl: {
    fontFamily: 'CormorantGaramond-Italic',
    fontSize: 20,
    color: 'rgba(192,192,192,0.2)',
    letterSpacing: 1,
  },
  storyInner: {
    flex: 1,
    paddingHorizontal: 86,
    paddingVertical: 97,
    justifyContent: 'space-between',
  },
  storyBrand: {
    fontFamily: 'Cinzel-Regular',
    fontSize: 38,
    letterSpacing: 16,
    color: 'rgba(212,175,55,0.5)',
    textAlign: 'center',
  },
  storyWeekBlock: {
    alignItems: 'center',
  },
  storyWeekLabel: {
    fontFamily: 'Cinzel-Regular',
    fontSize: 38,
    letterSpacing: 14,
    color: GOLD,
    marginBottom: 10,
  },
  storyWeekTitle: {
    fontFamily: 'Cinzel-Regular',
    fontSize: 152,
    lineHeight: 168,
    color: BONE,
  },
  storyWeekDate: {
    marginTop: 10,
    fontFamily: 'CormorantGaramond-Italic',
    fontSize: 48,
    color: 'rgba(192,192,192,0.45)',
  },
  storySigilBlock: {
    alignItems: 'center',
    gap: 24,
  },
  storyIntent: {
    fontFamily: 'CormorantGaramond-Italic',
    fontSize: 64,
    lineHeight: 82,
    color: BONE,
    textAlign: 'center',
    paddingHorizontal: 42,
  },
  storyThreadLabel: {
    fontFamily: 'Cinzel-Regular',
    fontSize: 26,
    letterSpacing: 8,
    color: 'rgba(192,192,192,0.3)',
    textAlign: 'center',
    marginBottom: 26,
  },
  storyThreadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    position: 'relative',
    paddingHorizontal: 16,
  },
  storyThreadLine: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: '50%',
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(212,175,55,0.12)',
  },
  storyStats: {
    flexDirection: 'row',
  },
  storyStat: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 0.5,
    borderRightColor: 'rgba(245,245,220,0.06)',
  },
  storyStatValue: {
    fontFamily: 'Cinzel-Regular',
    fontSize: 58,
    lineHeight: 60,
    color: BONE,
    marginBottom: 10,
  },
  storyStatLabel: {
    fontFamily: 'CormorantGaramond-Italic',
    fontSize: 34,
    lineHeight: 42,
    color: 'rgba(192,192,192,0.35)',
  },
  storyUrl: {
    fontFamily: 'CormorantGaramond-Italic',
    fontSize: 34,
    color: 'rgba(192,192,192,0.2)',
    textAlign: 'center',
  },
});
