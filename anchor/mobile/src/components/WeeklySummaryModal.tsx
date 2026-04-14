import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Polyline } from 'react-native-svg';
import { useAnchorStore } from '@/stores/anchorStore';
import { useSessionStore, type SessionLogEntry } from '@/stores/sessionStore';
import { useWeeklyStats, type WeeklyStats } from '@/hooks/useWeeklyStats';
import type { Anchor } from '@/types';
import { SigilSvg } from '@/components/common/SigilSvg';
import { ShareCard, type ShareCardRef } from '@/components/ShareCard';

const GOLD = '#D4AF37';
const NAVY = '#0F1419';
const BONE = '#F5F5DC';
const SILVER = '#C0C0C0';
const GREEN = '#4a9e58';
const PLACEHOLDER_SIGIL = `<svg viewBox="0 0 32 36" fill="none" xmlns="http://www.w3.org/2000/svg">
  <line x1="16" y1="2" x2="16" y2="34" stroke="#D4AF37" stroke-width="1" opacity="0.6"/>
  <line x1="2" y1="12" x2="30" y2="12" stroke="#D4AF37" stroke-width="1" opacity="0.6"/>
  <line x1="8" y1="4" x2="24" y2="32" stroke="#D4AF37" stroke-width="0.8" opacity="0.4"/>
  <line x1="24" y1="4" x2="8" y2="32" stroke="#D4AF37" stroke-width="0.8" opacity="0.4"/>
  <circle cx="16" cy="12" r="4" stroke="#D4AF37" stroke-width="1" fill="rgba(212,175,55,0.1)"/>
  <circle cx="16" cy="18" r="8" stroke="#D4AF37" stroke-width="0.5" opacity="0.25" fill="none"/>
</svg>`;
const NODE_STAGGER_MS = 120;
const BAR_TRACK_WIDTH = 168;

type PrimingState = WeeklyStats['days'][number]['state'];
type ExtendedAnchor = Anchor & { sigilImageUri?: string | null };

export interface WeeklySummaryModalProps {
  visible: boolean;
  onDismiss: () => void;
}

interface ResolvedAnchorData {
  artworkUri: string | null;
  sigilXml: string;
  intention: string;
  forgedAt: string;
  threadStrength: number;
  totalPrimeCount: number;
}

function StarGlyph({ color = GOLD }: { color?: string }) {
  return (
    <Svg width={12} height={12} viewBox="0 0 12 12">
      <Path
        d="M6 1L7.2 4.5H11L8.1 6.8L9.3 10.3L6 8L2.7 10.3L3.9 6.8L1 4.5H4.8Z"
        fill={color}
      />
    </Svg>
  );
}

function CheckGlyph() {
  return (
    <Svg width={11} height={11} viewBox="0 0 11 11">
      <Polyline
        points="2,6 5,9 9,2"
        stroke={GREEN}
        strokeWidth={1.5}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function Node({
  state,
  dominant,
}: {
  state: PrimingState;
  dominant?: boolean;
}) {
  const isPrimed = state === 'primed' || state === 'today';
  const isRecovered = state === 'recovered';
  const isMissed = state === 'missed';

  return (
    <View
      style={[
        styles.nodeCircle,
        isPrimed && styles.nodeGold,
        dominant && styles.nodeDominant,
        isRecovered && styles.nodeRecover,
        isMissed && styles.nodeGray,
      ]}
    >
      {isPrimed ? <StarGlyph /> : null}
      {isRecovered ? <CheckGlyph /> : null}
      {isMissed ? <Text style={styles.nodeDash}>—</Text> : null}
    </View>
  );
}

function formatDateRange(startValue: string, endValue: string): string {
  const start = new Date(startValue);
  const end = new Date(endValue);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return `${startValue} – ${endValue}`;
  }

  const startLabel = start.toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
  });
  const endLabel = end.toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return `${startLabel} – ${endLabel}`;
}

function formatForgedDate(dateString: string): string {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return dateString;
  }

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  }).toUpperCase();
}

function dominantPrimingDay(days: WeeklyStats['days']): WeeklyStats['days'][number] {
  return [...days].sort((left, right) => {
    if (right.primeCount !== left.primeCount) {
      return right.primeCount - left.primeCount;
    }

    return left.date.localeCompare(right.date);
  })[0] ?? days[0];
}

function resolveAnchorData(anchors: Anchor[], stats: WeeklyStats, sessionLog: SessionLogEntry[]): ResolvedAnchorData {
  const dominantAnchor = stats.dominantAnchor;
  const anchor = dominantAnchor
    ? anchors.find((item) => item.id === dominantAnchor.id || item.localId === dominantAnchor.id) as ExtendedAnchor | undefined
    : undefined;
  const totalPrimeCount = dominantAnchor
    ? sessionLog.filter(
      (entry) =>
        (entry.type === 'activate' || entry.type === 'reinforce') &&
        (entry.anchorId === dominantAnchor.id || entry.anchorId === anchor?.localId)
    ).length
    : stats.totalPrimes;

  return {
    artworkUri: anchor?.sigilImageUri ?? anchor?.enhancedImageUrl ?? null,
    sigilXml: anchor?.baseSigilSvg ?? PLACEHOLDER_SIGIL,
    intention: dominantAnchor?.intention ?? 'I close every deal I pursue',
    forgedAt: dominantAnchor?.forgedAt ?? stats.weekStart,
    threadStrength: dominantAnchor?.threadStrength ?? 72,
    totalPrimeCount: totalPrimeCount || stats.totalPrimes,
  };
}

function LegendItem({
  label,
  color,
  borderColor,
}: {
  label: string;
  color: string;
  borderColor?: string;
}) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color, borderColor: borderColor ?? color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

export function WeeklySummaryModal({
  visible,
  onDismiss,
}: WeeklySummaryModalProps) {
  const stats = useWeeklyStats();
  const anchors = useAnchorStore((state) => state.anchors);
  const sessionLog = useSessionStore((state) => state.sessionLog);
  const shareCardRef = useRef<ShareCardRef | null>(null);
  const sheetTranslateY = useRef(new Animated.Value(48)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const strengthProgress = useRef(new Animated.Value(0)).current;
  const nodeAnimations = useRef(Array.from({ length: 7 }, () => new Animated.Value(0))).current;
  const [isSharing, setIsSharing] = useState(false);

  const anchorData = useMemo(
    () => resolveAnchorData(anchors, stats, sessionLog),
    [anchors, sessionLog, stats]
  );
  const dominantDay = useMemo(() => dominantPrimingDay(stats.days), [stats.days]);
  const barScaleX = strengthProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, Math.max(0, Math.min(1, anchorData.threadStrength / 100))],
  });
  const barTranslateX = strengthProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [-BAR_TRACK_WIDTH / 2, -(BAR_TRACK_WIDTH * (1 - Math.max(0, Math.min(1, anchorData.threadStrength / 100)))) / 2],
  });

  useEffect(() => {
    if (!visible) {
      return;
    }

    sheetTranslateY.setValue(48);
    backdropOpacity.setValue(0);
    strengthProgress.setValue(0);
    nodeAnimations.forEach((value) => value.setValue(0));

    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.spring(sheetTranslateY, {
        toValue: 0,
        damping: 16,
        stiffness: 170,
        mass: 0.9,
        useNativeDriver: true,
      }),
      Animated.stagger(
        NODE_STAGGER_MS,
        nodeAnimations.map((value) =>
          Animated.timing(value, {
            toValue: 1,
            duration: 220,
            useNativeDriver: true,
          })
        )
      ),
      Animated.timing(strengthProgress, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),
    ]).start();
  }, [backdropOpacity, nodeAnimations, sheetTranslateY, strengthProgress, visible]);

  const handleShare = async () => {
    if (isSharing) {
      return;
    }

    try {
      setIsSharing(true);
      const uri = await shareCardRef.current?.capture();

      if (!uri) {
        throw new Error('Unable to capture weekly summary.');
      }

      await Share.share({
        title: `Week ${stats.weekNumber} — threaded`,
        message: `Week ${stats.weekNumber} — threaded. #AnchorApp`,
        url: uri,
      });
    } catch (error) {
      Alert.alert(
        'Share failed',
        error instanceof Error ? error.message : 'Unable to open the weekly share card right now.'
      );
    } finally {
      setIsSharing(false);
    }
  };

  if (!visible) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <View style={styles.overlayRoot}>
        <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: backdropOpacity }]}>
          <Pressable style={styles.backdrop} onPress={onDismiss} />
        </Animated.View>

        <Animated.View style={[styles.sheetContainer, { transform: [{ translateY: sheetTranslateY }] }]}>
          <LinearGradient
            colors={['#1a1330', NAVY]}
            start={{ x: 0.18, y: 0 }}
            end={{ x: 0.85, y: 1 }}
            style={styles.sheet}
          >
            <View style={styles.handle} />

            <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
              <View style={styles.header}>
                <Text style={styles.weekLabel}>THREAD REVIEW</Text>
                <Text style={styles.weekTitle}>{`Week ${stats.weekNumber}`}</Text>
                <Text style={styles.weekDate}>{formatDateRange(stats.weekStart, stats.weekEnd)}</Text>
              </View>

              <View style={styles.threadSection}>
                <Text style={styles.sectionLabel}>YOUR WEEK, THREADED</Text>
                <View style={styles.threadTrack}>
                  <View style={styles.threadLine} />
                  {stats.days.map((day, index) => {
                    const scale = nodeAnimations[index].interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.2, 1],
                    });

                    return (
                      <Animated.View
                        key={day.date}
                        style={[
                          styles.threadNode,
                          {
                            opacity: nodeAnimations[index],
                            transform: [{ scale }],
                          },
                        ]}
                      >
                        <Node state={day.state} dominant={dominantDay.date === day.date} />
                        <Text style={styles.nodeDay}>{day.dayLabel}</Text>
                      </Animated.View>
                    );
                  })}
                </View>

                <View style={styles.legendRow}>
                  <LegendItem label="Primed" color={GOLD} />
                  <LegendItem label="Missed" color="rgba(192,192,192,0.2)" borderColor="rgba(192,192,192,0.3)" />
                  <LegendItem label="Recovered" color={GREEN} />
                </View>
              </View>

              <View style={styles.spotlightSection}>
                <Text style={styles.sectionLabel}>Dominant focus</Text>
                <View style={styles.anchorCard}>
                  <View style={styles.anchorSigil}>
                    {anchorData.artworkUri ? (
                      <Image source={{ uri: anchorData.artworkUri }} style={styles.anchorSigilImage} resizeMode="cover" />
                    ) : (
                      <SigilSvg xml={anchorData.sigilXml} width={32} height={36} />
                    )}
                  </View>

                  <View style={styles.anchorInfo}>
                    <Text style={styles.anchorIntent}>{`"${anchorData.intention.replace(/^"|"$/g, '')}"`}</Text>
                    <Text style={styles.anchorMeta}>
                      {`FORGED ${formatForgedDate(anchorData.forgedAt)} · ${anchorData.totalPrimeCount} PRIMES TOTAL`}
                    </Text>
                    <View style={styles.threadBarWrap}>
                      <View style={styles.threadBarBg}>
                        <Animated.View
                          style={[
                            styles.threadBarFill,
                            {
                              transform: [{ translateX: barTranslateX }, { scaleX: barScaleX }],
                            },
                          ]}
                        />
                      </View>
                      <Text style={styles.threadScore}>
                        {anchorData.threadStrength}
                        <Text style={styles.threadScoreSuffix}> THREAD</Text>
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              <View style={styles.statsSection}>
                <View style={styles.statsGrid}>
                  <View style={styles.statPill}>
                    <Text style={[styles.statValue, styles.statValueGold]}>{stats.totalPrimes}</Text>
                    <Text style={styles.statLabel}>total{'\n'}primes</Text>
                  </View>
                  <View style={styles.statPill}>
                    <Text style={styles.statValue}>{`${stats.daysShownUp}/7`}</Text>
                    <Text style={styles.statLabel}>days{'\n'}shown up</Text>
                  </View>
                  <View style={styles.statPill}>
                    <Text style={[styles.statValue, styles.statValueGreen]}>{`+${stats.threadDelta}`}</Text>
                    <Text style={styles.statLabel}>thread{'\n'}gained</Text>
                  </View>
                </View>
              </View>

              <Text style={styles.insightLine}>
                You prime most on <Text style={styles.insightHighlight}>{`${stats.peakPrimingWindow.day} ${stats.peakPrimingWindow.timeOfDay}.`}</Text>
                {'\n'}
                That's not habit yet — that's identity.
              </Text>

              <View style={styles.actions}>
                <TouchableOpacity style={styles.primaryButton} onPress={handleShare} activeOpacity={0.84} disabled={isSharing}>
                  <StarGlyph color={NAVY} />
                  <Text style={styles.primaryButtonText}>
                    {isSharing ? 'SHARING THIS WEEK' : 'SHARE THIS WEEK'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.ghostButton} onPress={onDismiss} activeOpacity={0.8}>
                  <Text style={styles.ghostButtonText}>{`Begin Week ${stats.weekNumber + 1} →`}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </LinearGradient>
        </Animated.View>

        <View pointerEvents="none" collapsable={false} style={styles.hiddenShare}>
          <ShareCard ref={shareCardRef} stats={stats} format="square" />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlayRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(10,10,18,0.85)',
  },
  sheetContainer: {
    maxHeight: '88%',
  },
  sheet: {
    width: '100%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 0.5,
    borderColor: 'rgba(212,175,55,0.25)',
    paddingBottom: 32,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(212,175,55,0.25)',
    marginTop: 14,
    marginBottom: 20,
    alignSelf: 'center',
  },
  header: {
    paddingHorizontal: 24,
    paddingBottom: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(245,245,220,0.06)',
  },
  weekLabel: {
    fontFamily: 'Cinzel-Regular',
    fontSize: 10,
    letterSpacing: 3,
    color: GOLD,
    marginBottom: 4,
  },
  weekTitle: {
    fontFamily: 'Cinzel-SemiBold',
    fontSize: 22,
    color: BONE,
    lineHeight: 26,
    marginBottom: 2,
  },
  weekDate: {
    fontFamily: 'CormorantGaramond-Italic',
    fontSize: 13,
    color: 'rgba(192,192,192,0.6)',
  },
  threadSection: {
    paddingHorizontal: 24,
    paddingVertical: 24,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(245,245,220,0.06)',
  },
  sectionLabel: {
    fontFamily: 'Cinzel-Regular',
    fontSize: 9,
    letterSpacing: 2.5,
    color: 'rgba(192,192,192,0.45)',
    textTransform: 'uppercase',
    marginBottom: 20,
  },
  threadTrack: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    position: 'relative',
    paddingHorizontal: 8,
  },
  threadLine: {
    position: 'absolute',
    left: 8,
    right: 8,
    top: '50%',
    height: 1,
    backgroundColor: 'rgba(212,175,55,0.15)',
  },
  threadNode: {
    alignItems: 'center',
    gap: 8,
    zIndex: 1,
  },
  nodeCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeGold: {
    backgroundColor: 'rgba(212,175,55,0.15)',
    borderWidth: 1.5,
    borderColor: GOLD,
  },
  nodeDominant: {
    backgroundColor: 'rgba(212,175,55,0.22)',
  },
  nodeRecover: {
    backgroundColor: 'rgba(74,158,88,0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(74,158,88,0.6)',
  },
  nodeGray: {
    backgroundColor: 'rgba(192,192,192,0.04)',
    borderWidth: 1.5,
    borderColor: 'rgba(192,192,192,0.2)',
  },
  nodeDash: {
    fontFamily: 'Cinzel-Regular',
    fontSize: 14,
    color: 'rgba(192,192,192,0.2)',
  },
  nodeDay: {
    fontFamily: 'Cinzel-Regular',
    fontSize: 8,
    color: 'rgba(192,192,192,0.35)',
    letterSpacing: 0.5,
  },
  legendRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    borderWidth: 0.5,
  },
  legendText: {
    fontFamily: 'CormorantGaramond-Italic',
    fontSize: 10,
    color: 'rgba(192,192,192,0.45)',
  },
  spotlightSection: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(245,245,220,0.06)',
  },
  anchorCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 0.5,
    borderColor: 'rgba(212,175,55,0.2)',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    gap: 16,
    alignItems: 'flex-start',
  },
  anchorSigil: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: 'rgba(62,44,91,0.5)',
    borderWidth: 0.5,
    borderColor: 'rgba(212,175,55,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  anchorSigilImage: {
    width: 56,
    height: 56,
  },
  anchorInfo: {
    flex: 1,
    minWidth: 0,
  },
  anchorIntent: {
    fontFamily: 'CormorantGaramond-Italic',
    fontSize: 15,
    lineHeight: 20,
    color: BONE,
    marginBottom: 6,
  },
  anchorMeta: {
    fontFamily: 'Cinzel-Regular',
    fontSize: 9,
    letterSpacing: 2,
    color: 'rgba(212,175,55,0.6)',
    marginBottom: 10,
  },
  threadBarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  threadBarBg: {
    flex: 1,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  threadBarFill: {
    width: BAR_TRACK_WIDTH,
    height: '100%',
    borderRadius: 2,
    backgroundColor: GOLD,
  },
  threadScore: {
    fontFamily: 'Cinzel-Regular',
    fontSize: 11,
    color: GOLD,
  },
  threadScoreSuffix: {
    color: 'rgba(192,192,192,0.35)',
    fontSize: 9,
  },
  statsSection: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(245,245,220,0.06)',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  statPill: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 0.5,
    borderColor: 'rgba(245,245,220,0.07)',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  statValue: {
    fontFamily: 'Cinzel-SemiBold',
    fontSize: 18,
    color: BONE,
    lineHeight: 18,
    marginBottom: 5,
  },
  statValueGold: {
    color: GOLD,
  },
  statValueGreen: {
    color: GREEN,
  },
  statLabel: {
    fontFamily: 'CormorantGaramond-Italic',
    fontSize: 10,
    lineHeight: 12,
    color: 'rgba(192,192,192,0.45)',
    textAlign: 'center',
  },
  insightLine: {
    paddingHorizontal: 24,
    paddingTop: 16,
    fontFamily: 'CormorantGaramond-Italic',
    fontSize: 14,
    lineHeight: 21,
    color: 'rgba(192,192,192,0.5)',
    textAlign: 'center',
  },
  insightHighlight: {
    color: 'rgba(212,175,55,0.7)',
  },
  actions: {
    paddingHorizontal: 24,
    paddingTop: 20,
    gap: 10,
  },
  primaryButton: {
    height: 48,
    borderRadius: 10,
    backgroundColor: GOLD,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryButtonText: {
    fontFamily: 'Cinzel-Regular',
    fontSize: 11,
    letterSpacing: 2,
    color: NAVY,
  },
  ghostButton: {
    height: 46,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: 'rgba(192,192,192,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostButtonText: {
    fontFamily: 'CormorantGaramond-Italic',
    fontSize: 14,
    color: 'rgba(192,192,192,0.4)',
    letterSpacing: 0.5,
  },
  hiddenShare: {
    position: 'absolute',
    left: -2400,
    top: 0,
  },
});
