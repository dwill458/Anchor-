import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated as RNAnimated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Audio } from 'expo-av';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { colors, spacing, typography } from '@/theme';
import type { Anchor, RootStackParamList, SigilVariant } from '@/types';
import { useAnchorStore } from '@/stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';

type MantraStyle = 'rhythmic' | 'deep' | 'clear';

interface MantraOption {
  id: MantraStyle;
  name: string;
  description: string;
  text: string;
  durationLabel: string;
}

type MantraCreationRouteProp = RouteProp<RootStackParamList, 'MantraCreation'>;
type MantraCreationNavigationProp = StackNavigationProp<RootStackParamList, 'MantraCreation'>;

type AudioPermissionResponse = {
  granted?: boolean;
  status?: string;
};

type AudioRecordingHandle = {
  stopAndUnloadAsync: () => Promise<any>;
  getURI: () => string | null;
};

type AudioApi = {
  requestPermissionsAsync: () => Promise<AudioPermissionResponse>;
  setAudioModeAsync: (mode: { allowsRecordingIOS: boolean; playsInSilentModeIOS: boolean }) => Promise<void>;
  RecordingOptionsPresets?: { HIGH_QUALITY: unknown };
  Recording: {
    createAsync: (options: unknown) => Promise<{ recording: AudioRecordingHandle }>;
  };
};

const PLAYBACK_BAR_HEIGHTS = [35, 55, 80, 60, 90, 50, 70, 40, 60, 75, 45, 65, 55, 35, 50];
const RECORD_BAR_COUNT = 28;
const MAX_RECORD_SECONDS = 30;

const loadAudioApi = () => {
  return Audio ?? null;
};

const formatTimer = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
};

const isSigilVariant = (value: string | undefined): value is SigilVariant =>
  value === 'dense' || value === 'balanced' || value === 'minimal';

const chunkLetters = (letters: string[]) => {
  const chunks: string[] = [];
  for (let index = 0; index < letters.length; index += 3) {
    chunks.push(letters.slice(index, index + 3).join(''));
  }
  return chunks.join(' · ');
};

const generateRhythmic = (letters: string[]) => chunkLetters(letters);
const generateDeep = (letters: string[]) => chunkLetters([...letters].reverse());

const generateClear = (letters: string[]) => {
  const vowels = ['A', 'E', 'I', 'O', 'U'];
  const interleaved = letters.flatMap((letter, index) => [letter, vowels[index % vowels.length]]);
  return chunkLetters(interleaved);
};

const buildFallbackSigil = (letters: string[]) => {
  const label = letters.join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text x="50" y="55" font-size="16" text-anchor="middle">${label}</text></svg>`;
};

const PlaybackBar: React.FC<{
  heightPercent: number;
  isPlaying: boolean;
  isSelected: boolean;
  index: number;
}> = ({ heightPercent, isPlaying, isSelected, index }) => {
  const pulse = useSharedValue(0.7);

  useEffect(() => {
    if (isPlaying) {
      const duration = 220 + (index % 5) * 50;
      pulse.value = withSequence(
        withTiming(1, { duration }),
        withRepeat(
          withSequence(withTiming(0.4, { duration }), withTiming(1, { duration })),
          -1,
          true
        )
      );
      return;
    }
    pulse.value = withTiming(0.7, { duration: 160 });
  }, [index, isPlaying, pulse]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: pulse.value,
  }));

  return (
    <Animated.View
      style={[
        styles.playbackBar,
        {
          backgroundColor: isSelected ? colors.mantra.goldSofter : colors.mantra.playBg,
          height: `${heightPercent}%`,
        },
        animatedStyle,
      ]}
    />
  );
};

const RecordingBar: React.FC<{
  index: number;
  isRecording: boolean;
  isSaved: boolean;
}> = ({ index, isRecording, isSaved }) => {
  const scale = useSharedValue(0.2);

  useEffect(() => {
    const low = 0.2 + (index % 3) * 0.05;
    const high = 0.5 + ((index * 17) % 50) / 100;
    const staticHeight = 0.35 + ((index * 11) % 30) / 100;

    if (isRecording) {
      const duration = 260 + (index % 6) * 45;
      scale.value = withRepeat(
        withSequence(withTiming(high, { duration }), withTiming(low, { duration })),
        -1,
        true
      );
      return;
    }
    scale.value = withTiming(isSaved ? staticHeight : 0.2, { duration: 180 });
  }, [index, isRecording, isSaved, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: scale.value }],
    opacity: isRecording || isSaved ? 1 : 0,
  }));

  return (
    <Animated.View
      style={[
        styles.recordBar,
        { backgroundColor: isSaved && !isRecording ? colors.mantra.savedWave : colors.mantra.redWave },
        animatedStyle,
      ]}
    />
  );
};

export const MantraCreationScreen: React.FC = () => {
  const navigation = useNavigation<MantraCreationNavigationProp>();
  const route = useRoute<MantraCreationRouteProp>();
  const insets = useSafeAreaInsets();
  const audioApi = useMemo(() => loadAudioApi(), []);

  const orbOneProgress = useRef(new RNAnimated.Value(0)).current;
  const orbTwoProgress = useRef(new RNAnimated.Value(0)).current;
  const recordingRef = useRef<AudioRecordingHandle | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const playbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const anchorIdRef = useRef<string | null>(null);

  const addAnchor = useAnchorStore((state) => state.addAnchor);
  const updateAnchor = useAnchorStore((state) => state.updateAnchor);
  const { incrementAnchorCount } = useAuthStore();

  const [selectedMantra, setSelectedMantra] = useState<MantraStyle>('rhythmic');
  const [isPlaying, setIsPlaying] = useState<MantraStyle | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordingAnimation] = useState(new RNAnimated.Value(0));

  const intention = route.params.intentionText.trim();

  const normalizedLetters = useMemo(() => {
    const cleaned = route.params.distilledLetters
      .map((letter) => letter.replace(/[^a-z]/gi, '').charAt(0).toUpperCase())
      .filter(Boolean);
    return cleaned.length > 0 ? cleaned : ['A', 'N', 'C', 'H', 'O', 'R'];
  }, [route.params.distilledLetters]);

  const mantraOptions = useMemo<MantraOption[]>(() => {
    const sourceLetters = normalizedLetters.slice(0, 12);
    return [
      {
        id: 'rhythmic',
        name: 'Rhythmic Flow',
        description: 'Smooth and cyclical. Encourages steady breath and momentum.',
        text: generateRhythmic(sourceLetters),
        durationLabel: '0:04',
      },
      {
        id: 'deep',
        name: 'Deep Current',
        description: 'Low and grounding. Settles your breath into your chest and core.',
        text: generateDeep(sourceLetters),
        durationLabel: '0:04',
      },
      {
        id: 'clear',
        name: 'Clear Lift',
        description: 'Open and airy. Creates space without breaking your focus.',
        text: generateClear(sourceLetters),
        durationLabel: '0:04',
      },
    ];
  }, [normalizedLetters]);

  const selectedMantraOption =
    mantraOptions.find((option) => option.id === selectedMantra) ?? mantraOptions[0];

  const canRecord = Boolean(audioApi?.Recording?.createAsync);

  const recordButtonScale = recordingAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.05],
  });

  useEffect(() => {
    const orbOneLoop = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(orbOneProgress, { toValue: 1, duration: 9000, useNativeDriver: true }),
        RNAnimated.timing(orbOneProgress, { toValue: 0, duration: 9000, useNativeDriver: true }),
      ])
    );
    const orbTwoLoop = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(orbTwoProgress, { toValue: 1, duration: 12000, useNativeDriver: true }),
        RNAnimated.timing(orbTwoProgress, { toValue: 0, duration: 12000, useNativeDriver: true }),
      ])
    );

    orbOneLoop.start();
    orbTwoLoop.start();

    return () => {
      orbOneLoop.stop();
      orbTwoLoop.stop();
    };
  }, [orbOneProgress, orbTwoProgress]);

  useEffect(() => {
    if (isRecording) {
      const pulse = RNAnimated.loop(
        RNAnimated.sequence([
          RNAnimated.timing(recordingAnimation, { toValue: 1, duration: 600, useNativeDriver: true }),
          RNAnimated.timing(recordingAnimation, { toValue: 0, duration: 600, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }

    recordingAnimation.stopAnimation();
    recordingAnimation.setValue(0);
  }, [isRecording, recordingAnimation]);

  useEffect(() => {
    return () => {
      if (playbackTimeoutRef.current) {
        clearTimeout(playbackTimeoutRef.current);
      }
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      if (recordingRef.current) {
        void recordingRef.current.stopAndUnloadAsync();
      }
    };
  }, []);

  const ensureAnchor = useCallback(
    (option: MantraOption) => {
      const providedVariant = route.params.structureVariant;
      const structureVariant: SigilVariant = isSigilVariant(providedVariant)
        ? providedVariant
        : 'balanced';

      const baseSigilSvg = route.params.baseSigilSvg ?? buildFallbackSigil(normalizedLetters.slice(0, 4));
      const anchorPayload: Partial<Anchor> = {
        intentionText: intention,
        category: route.params.category ?? 'custom',
        distilledLetters: normalizedLetters,
        baseSigilSvg,
        reinforcedSigilSvg: route.params.reinforcedSigilSvg,
        structureVariant,
        reinforcementMetadata: route.params.reinforcementMetadata,
        enhancementMetadata: route.params.enhancementMetadata,
        enhancedImageUrl: route.params.finalImageUrl,
        mantraText: option.text,
        mantraAudioUrl: recordingUri ?? undefined,
      };

      if (!anchorIdRef.current) {
        const anchorId = `anchor-${Date.now()}`;
        anchorIdRef.current = anchorId;
        addAnchor({
          id: anchorId,
          userId: 'user-123',
          intentionText: anchorPayload.intentionText || '',
          category: anchorPayload.category || 'custom',
          distilledLetters: anchorPayload.distilledLetters || [],
          baseSigilSvg: anchorPayload.baseSigilSvg || buildFallbackSigil(['A', 'N', 'C', 'H']),
          reinforcedSigilSvg: anchorPayload.reinforcedSigilSvg,
          structureVariant: anchorPayload.structureVariant || 'balanced',
          reinforcementMetadata: anchorPayload.reinforcementMetadata,
          enhancementMetadata: anchorPayload.enhancementMetadata,
          enhancedImageUrl: anchorPayload.enhancedImageUrl,
          mantraText: anchorPayload.mantraText,
          mantraAudioUrl: anchorPayload.mantraAudioUrl,
          isCharged: false,
          activationCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        incrementAnchorCount();
      } else {
        updateAnchor(anchorIdRef.current, anchorPayload);
      }

      return anchorIdRef.current;
    },
    [
      addAnchor,
      incrementAnchorCount,
      intention,
      normalizedLetters,
      recordingUri,
      route.params.baseSigilSvg,
      route.params.category,
      route.params.enhancementMetadata,
      route.params.finalImageUrl,
      route.params.reinforcedSigilSvg,
      route.params.reinforcementMetadata,
      route.params.structureVariant,
      updateAnchor,
    ]
  );

  const stopPlayback = useCallback(() => {
    if (playbackTimeoutRef.current) {
      clearTimeout(playbackTimeoutRef.current);
      playbackTimeoutRef.current = null;
    }
    setIsPlaying(null);
  }, []);

  const handleTogglePlay = useCallback(
    (style: MantraStyle) => {
      if (isPlaying === style) {
        stopPlayback();
        return;
      }
      if (playbackTimeoutRef.current) {
        clearTimeout(playbackTimeoutRef.current);
      }
      setIsPlaying(style);
      playbackTimeoutRef.current = setTimeout(() => {
        setIsPlaying((current) => (current === style ? null : current));
      }, 4000);
    },
    [isPlaying, stopPlayback]
  );

  const stopRecording = useCallback(async () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    const activeRecording = recordingRef.current;
    recordingRef.current = null;

    if (!activeRecording) {
      setIsRecording(false);
      return;
    }

    try {
      await activeRecording.stopAndUnloadAsync();
      const uri = activeRecording.getURI();
      setRecordingUri(uri ?? null);
    } catch {
      Alert.alert('Recording Error', 'Unable to save recording.');
    } finally {
      setIsRecording(false);
    }
  }, []);

  const startRecording = useCallback(async () => {
    if (!audioApi || !audioApi.Recording?.createAsync) {
      Alert.alert('Microphone Unavailable', 'Voice recording requires microphone permissions.');
      return;
    }

    try {
      const permission = await audioApi.requestPermissionsAsync();
      const granted = permission.granted || permission.status === 'granted';
      if (!granted) {
        Alert.alert('Permission Required', 'Voice recording requires microphone permissions.');
        return;
      }

      await audioApi.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const options = audioApi.RecordingOptionsPresets?.HIGH_QUALITY ?? {};
      const { recording } = await audioApi.Recording.createAsync(options);

      recordingRef.current = recording;
      setRecordingSeconds(0);
      setRecordingUri(null);
      setIsRecording(true);

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((previous) => {
          const next = previous + 1;
          if (next >= MAX_RECORD_SECONDS) {
            void stopRecording();
            return MAX_RECORD_SECONDS;
          }
          return next;
        });
      }, 1000);
    } catch {
      Alert.alert('Recording Error', 'Unable to start recording on this device.');
      setIsRecording(false);
    }
  }, [audioApi, stopRecording]);

  const toggleRecording = useCallback(async () => {
    if (isRecording) {
      await stopRecording();
      return;
    }
    await startRecording();
  }, [isRecording, startRecording, stopRecording]);

  const handleContinue = useCallback(() => {
    const anchorId = ensureAnchor(selectedMantraOption);
    if (!anchorId) {
      return;
    }

    navigation.navigate('ChargeSetup', {
      anchorId,
    });
  }, [ensureAnchor, navigation, selectedMantraOption]);

  const orbOneStyle = {
    transform: [
      { translateX: orbOneProgress.interpolate({ inputRange: [0, 1], outputRange: [0, 18] }) },
      { translateY: orbOneProgress.interpolate({ inputRange: [0, 1], outputRange: [0, 14] }) },
    ],
  };

  const orbTwoStyle = {
    transform: [
      { translateX: orbTwoProgress.interpolate({ inputRange: [0, 1], outputRange: [0, -18] }) },
      { translateY: orbTwoProgress.interpolate({ inputRange: [0, 1], outputRange: [0, -14] }) },
    ],
  };

  const recordStatus = !canRecord
    ? 'Voice recording requires microphone permissions'
    : isRecording
      ? 'Recording...'
      : recordingUri
        ? 'Recording saved ✓'
        : 'Tap to Record';

  const recordStatusColor = !canRecord
    ? colors.mantra.redMuted
    : isRecording
      ? colors.mantra.redAccent
      : recordingUri
        ? colors.mantra.recordSaved
        : colors.mantra.redMuted;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[colors.mantra.backgroundTop, colors.mantra.backgroundMid, colors.mantra.backgroundBottom]}
        start={{ x: 0.05, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <RNAnimated.View style={[styles.orbOne, orbOneStyle]} />
      <RNAnimated.View style={[styles.orbTwo, orbTwoStyle]} />

      <View style={[styles.header, { paddingTop: insets.top + spacing.mantra.headerTop }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backIcon}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Create Mantra</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.hero}>
        <Text style={styles.heroTitle}>Tune Your Voice Anchor</Text>
        <Text style={styles.heroSubtitle}>Choose the sound your body responds to.</Text>
      </View>

      <LinearGradient
        colors={[colors.mantra.ctaFadeTop, colors.mantra.goldBorder, colors.mantra.ctaFadeTop]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.divider}
      />

      <View style={styles.tabRow}>
        <Pressable style={[styles.tabPill, styles.tabPillActive]}>
          <Text style={styles.tabActiveText}>Sonic</Text>
        </Pressable>
        <Pressable style={styles.tabPill} onPress={() => Alert.alert('Coming soon', 'Coming soon')}>
          <Text style={styles.tabMutedText}>Visual</Text>
          <Text style={styles.tabSoonText}>Soon</Text>
        </Pressable>
        <Pressable style={styles.tabPill} onPress={() => Alert.alert('Coming soon', 'Coming soon')}>
          <Text style={styles.tabMutedText}>Somatic</Text>
          <Text style={styles.tabSoonText}>Soon</Text>
        </Pressable>
      </View>

      <View style={styles.letterStrip}>
        <Text style={styles.letterStripLabel}>Core</Text>
        {normalizedLetters.slice(0, 6).map((letter, index) => (
          <View key={`${letter}-${index}`} style={styles.letterCircle}>
            <Text style={styles.letterCircleText}>{letter}</Text>
          </View>
        ))}
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + spacing.mantra.scrollBottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {mantraOptions.map((option) => {
          const selected = selectedMantra === option.id;
          const playing = isPlaying === option.id;

          return (
            <Pressable
              key={option.id}
              style={[styles.mantraCard, selected && styles.mantraCardSelected]}
              onPress={() => setSelectedMantra(option.id)}
            >
              <View style={styles.mantraCardTop}>
                <Text style={styles.mantraName}>{option.name}</Text>
                <Text style={[styles.selectedBadge, { opacity: selected ? 1 : 0 }]}>● Selected</Text>
              </View>

              <Text style={styles.mantraDescription}>{option.description}</Text>

              <View style={styles.mantraTextBox}>
                <Text style={styles.mantraText}>{option.text}</Text>
              </View>

              <View style={styles.playbackRow}>
                <Pressable style={[styles.playButton, selected && styles.playButtonSelected]} onPress={() => handleTogglePlay(option.id)}>
                  <Text style={[styles.playIcon, selected && styles.playIconSelected]}>{playing ? '⏸' : '▶'}</Text>
                </Pressable>

                <View style={styles.playbackWaveform}>
                  {PLAYBACK_BAR_HEIGHTS.map((height, index) => (
                    <PlaybackBar
                      key={`${option.id}-bar-${index}`}
                      heightPercent={height}
                      isPlaying={playing}
                      isSelected={selected}
                      index={index}
                    />
                  ))}
                </View>

                <Text style={styles.durationLabel}>{option.durationLabel}</Text>
              </View>
            </Pressable>
          );
        })}

        <View style={styles.recordSection}>
          <View style={styles.recordHeader}>
            <View style={styles.recordIconCircle}>
              <Text style={styles.recordIcon}>🎙</Text>
            </View>
            <Text style={styles.recordTitle}>Your Own Voice</Text>
            <View style={styles.proBadge}>
              <Text style={styles.proBadgeText}>PRO</Text>
            </View>
          </View>

          <View style={styles.recordCard}>
            <Text style={styles.recordDescription}>
              Record yourself speaking your mantra. Your voice carries the deepest resonance.
            </Text>

            <View style={styles.recordVisualizer}>
              {!isRecording && !recordingUri ? <Text style={styles.recordPrompt}>TAP TO RECORD</Text> : null}
              <View style={styles.recordBarsRow}>
                {Array.from({ length: RECORD_BAR_COUNT }).map((_, index) => (
                  <RecordingBar
                    key={`record-bar-${index}`}
                    index={index}
                    isRecording={isRecording}
                    isSaved={Boolean(recordingUri)}
                  />
                ))}
              </View>
            </View>

            <View style={styles.recordControls}>
              <RNAnimated.View style={{ transform: [{ scale: isRecording ? recordButtonScale : 1 }] }}>
                <Pressable
                  style={[styles.recordButton, isRecording && styles.recordButtonActive, !canRecord && styles.recordButtonDisabled]}
                  onPress={() => void toggleRecording()}
                  disabled={!canRecord}
                >
                  <Text style={styles.recordButtonIcon}>{isRecording ? '⏹' : '⏺'}</Text>
                </Pressable>
              </RNAnimated.View>

              <Text style={[styles.recordStatus, { color: recordStatusColor }]}>{recordStatus}</Text>
              <Text style={styles.recordTime}>{formatTimer(recordingSeconds)}</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <View
        style={[styles.ctaWrapper, { paddingBottom: insets.bottom + spacing.mantra.ctaBottom }]}
        pointerEvents="box-none"
      >
        <LinearGradient
          colors={[colors.mantra.ctaFadeTop, colors.mantra.ctaFadeBottom]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <Pressable onPress={handleContinue} style={styles.ctaButtonOuter}>
          <LinearGradient
            colors={[colors.gold, colors.mantra.ctaMid, colors.mantra.ctaEnd]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.ctaButton}
          >
            <Text style={styles.ctaText}>Continue to Ritual ›</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.navy,
  },
  orbOne: {
    position: 'absolute',
    width: 260,
    height: 260,
    top: -60,
    right: -80,
    borderRadius: 130,
    backgroundColor: colors.mantra.orbPurple,
    opacity: 0.3,
    overflow: 'hidden',
  },
  orbTwo: {
    position: 'absolute',
    width: 180,
    height: 180,
    bottom: 80,
    left: -60,
    borderRadius: 90,
    backgroundColor: colors.mantra.orbGold,
    opacity: 0.1,
    overflow: 'hidden',
  },
  header: {
    paddingHorizontal: spacing.mantra.screenHorizontal,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.mantra.glass,
    borderWidth: 1,
    borderColor: colors.mantra.goldBorder,
  },
  backIcon: {
    color: colors.gold,
    fontFamily: typography.fonts.heading,
    fontSize: 14,
  },
  headerTitle: {
    color: colors.gold,
    fontFamily: typography.fonts.heading,
    fontSize: 11,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
  },
  headerSpacer: {
    width: 34,
  },
  hero: {
    paddingHorizontal: spacing.mantra.screenHorizontal,
    paddingTop: spacing.mantra.heroTop,
    alignItems: 'center',
  },
  heroTitle: {
    color: colors.gold,
    fontFamily: typography.fonts.headingBold,
    fontSize: 20,
    textAlign: 'center',
    textShadowColor: colors.mantra.goldTextShadow,
    textShadowRadius: 24,
  },
  heroSubtitle: {
    color: colors.mantra.muted,
    fontFamily: typography.fonts.body,
    fontSize: 12.5,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: spacing.mantra.subtitleTop,
  },
  divider: {
    height: 1,
    marginHorizontal: spacing.mantra.screenHorizontal,
    marginTop: spacing.mantra.dividerTop,
  },
  tabRow: {
    paddingHorizontal: spacing.mantra.screenHorizontal,
    flexDirection: 'row',
    gap: spacing.mantra.tabsGap,
    marginTop: spacing.sm,
  },
  tabPill: {
    flex: 1,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.mantra.glass,
    borderWidth: 1,
    borderColor: colors.mantra.subtleBorder,
    paddingVertical: spacing.sm - 1,
  },
  tabPillActive: {
    backgroundColor: colors.mantra.goldDim,
    borderColor: colors.mantra.goldBorder,
  },
  tabActiveText: {
    fontFamily: typography.fonts.heading,
    color: colors.gold,
    fontSize: 10,
  },
  tabMutedText: {
    fontFamily: typography.fonts.heading,
    color: colors.mantra.muted,
    fontSize: 10,
  },
  tabSoonText: {
    marginTop: 1,
    fontFamily: typography.fonts.heading,
    color: colors.mantra.muted,
    fontSize: 8,
  },
  letterStrip: {
    marginHorizontal: spacing.mantra.screenHorizontal,
    marginTop: spacing.mantra.lettersTop,
    borderRadius: 10,
    paddingVertical: spacing.mantra.stripVertical,
    paddingHorizontal: spacing.mantra.stripHorizontal,
    backgroundColor: colors.mantra.stripBackground,
    borderWidth: 1,
    borderColor: colors.mantra.subtleBorder,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm + spacing.xs,
  },
  letterStripLabel: {
    fontFamily: typography.fonts.heading,
    color: colors.mantra.muted,
    fontSize: 8,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
  },
  letterCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.mantra.goldSoft,
    borderWidth: 1,
    borderColor: colors.mantra.goldDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letterCircleText: {
    color: colors.gold,
    fontFamily: typography.fonts.headingSemiBold,
    fontSize: 13,
  },
  scrollView: {
    flex: 1,
    marginTop: spacing.mantra.contentTop,
  },
  scrollContent: {
    paddingHorizontal: spacing.mantra.screenHorizontal,
    paddingBottom: spacing.mantra.scrollBottom,
  },
  mantraCard: {
    backgroundColor: colors.mantra.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.mantra.subtleBorder,
    paddingVertical: spacing.mantra.cardVertical,
    paddingHorizontal: spacing.mantra.cardHorizontal,
    marginBottom: spacing.mantra.cardGap,
  },
  mantraCardSelected: {
    backgroundColor: colors.mantra.goldTint,
    borderColor: colors.gold,
  },
  mantraCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs + 2,
  },
  mantraName: {
    fontFamily: typography.fonts.headingSemiBold,
    fontSize: 13,
    color: colors.mantra.text,
  },
  selectedBadge: {
    fontFamily: typography.fonts.heading,
    fontSize: 8,
    letterSpacing: 1.2,
    color: colors.gold,
    textTransform: 'uppercase',
  },
  mantraDescription: {
    fontFamily: typography.fonts.body,
    fontSize: 11.5,
    color: colors.mantra.muted,
    fontStyle: 'italic',
    lineHeight: 17,
    marginBottom: spacing.mantra.cardGap,
  },
  mantraTextBox: {
    backgroundColor: colors.mantra.darkOverlay,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.mantra.softBorder,
    paddingVertical: spacing.mantra.cardGap,
    paddingHorizontal: spacing.mantra.stripHorizontal,
    marginBottom: spacing.mantra.cardGap,
  },
  mantraText: {
    textAlign: 'center',
    fontFamily: typography.fonts.headingSemiBold,
    fontSize: 15,
    color: colors.mantra.text,
    letterSpacing: 2,
    textShadowColor: colors.mantra.goldDim,
    textShadowRadius: 20,
  },
  playbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.mantra.playbackGap,
  },
  playButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.mantra.playBg,
    borderWidth: 1,
    borderColor: colors.mantra.playBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButtonSelected: {
    borderColor: colors.mantra.goldBorder,
  },
  playIcon: {
    color: colors.mantra.text,
    fontSize: 11,
    fontFamily: typography.fonts.heading,
  },
  playIconSelected: {
    color: colors.gold,
  },
  playbackWaveform: {
    flex: 1,
    height: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.mantra.waveformGap,
  },
  playbackBar: {
    flex: 1,
    borderRadius: 2,
  },
  durationLabel: {
    fontFamily: typography.fonts.heading,
    fontSize: 9,
    color: colors.mantra.muted,
    letterSpacing: 1,
    flexShrink: 0,
  },
  recordSection: {
    marginTop: spacing.mantra.sectionTop,
    marginBottom: spacing.xs,
  },
  recordHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.mantra.cardGap,
  },
  recordIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.mantra.redDim,
    borderWidth: 1,
    borderColor: colors.mantra.redBorderSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordIcon: {
    fontSize: 11,
  },
  recordTitle: {
    fontFamily: typography.fonts.heading,
    fontSize: 12,
    color: colors.mantra.text,
    letterSpacing: 1,
  },
  proBadge: {
    marginLeft: 'auto',
    backgroundColor: colors.mantra.redDim,
    borderWidth: 1,
    borderColor: colors.mantra.redBorder,
    borderRadius: 10,
    paddingVertical: spacing.mantra.badgeVertical,
    paddingHorizontal: spacing.mantra.badgeHorizontal,
  },
  proBadgeText: {
    fontFamily: typography.fonts.heading,
    color: colors.mantra.redSoft,
    fontSize: 8,
    letterSpacing: 2,
  },
  recordCard: {
    backgroundColor: colors.mantra.card,
    borderRadius: 16,
    paddingVertical: spacing.mantra.cardVertical,
    paddingHorizontal: spacing.mantra.cardHorizontal,
    borderWidth: 1,
    borderColor: colors.mantra.subtleBorder,
  },
  recordDescription: {
    fontFamily: typography.fonts.body,
    fontSize: 11.5,
    color: colors.mantra.muted,
    fontStyle: 'italic',
    lineHeight: 17,
    marginBottom: spacing.mantra.visualizerBottom,
  },
  recordVisualizer: {
    height: 48,
    borderRadius: 10,
    marginBottom: spacing.mantra.visualizerBottom,
    borderWidth: 1,
    borderColor: colors.mantra.redBorderSofter,
    backgroundColor: colors.mantra.darkOverlay,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  recordPrompt: {
    position: 'absolute',
    fontFamily: typography.fonts.heading,
    color: colors.mantra.redMutedSoft,
    fontSize: 8,
    letterSpacing: 3,
  },
  recordBarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs - 1,
    width: '100%',
    height: '100%',
    paddingHorizontal: spacing.sm,
  },
  recordBar: {
    width: 3,
    borderRadius: 3,
    height: '70%',
  },
  recordControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.mantra.playbackGap,
  },
  recordButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.mantra.redDim,
    borderWidth: 1,
    borderColor: colors.mantra.redBorder,
  },
  recordButtonActive: {
    backgroundColor: colors.mantra.redAccent,
    borderColor: colors.mantra.redAccent,
  },
  recordButtonDisabled: {
    opacity: 0.45,
  },
  recordButtonIcon: {
    color: colors.mantra.text,
    fontSize: 12,
  },
  recordStatus: {
    flex: 1,
    fontFamily: typography.fonts.heading,
    fontSize: 10,
    letterSpacing: 2,
  },
  recordTime: {
    marginLeft: 'auto',
    fontFamily: typography.fonts.heading,
    fontSize: 10,
    color: colors.mantra.muted,
  },
  ctaWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.mantra.screenHorizontal,
    paddingTop: spacing.md,
    zIndex: 20,
    elevation: 20,
  },
  ctaButtonOuter: {
    borderRadius: 14,
    shadowColor: colors.gold,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  ctaButton: {
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    color: colors.charcoal,
    fontFamily: typography.fonts.headingSemiBold,
    fontSize: 14,
    letterSpacing: 1.5,
  },
});
