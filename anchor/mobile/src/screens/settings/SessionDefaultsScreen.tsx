import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft, Clock3, Music4, VolumeX } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  useSettingsStore,
  type FocusSessionMode,
  type SessionAudioMode,
} from '@/stores/settingsStore';
import { colors, spacing, typography } from '@/theme';

type SessionTab = 'focus' | 'prime';
type FocusDurationOption = 10 | 30 | 60 | 120;
type PrimeDurationOption = 120 | 300 | 600 | 'custom';

const FOCUS_DURATION_OPTIONS: Array<{ label: string; value: FocusDurationOption }> = [
  { label: '10s', value: 10 },
  { label: '30s', value: 30 },
  { label: '1 min', value: 60 },
  { label: '2 min', value: 120 },
];

const PRIME_DURATION_OPTIONS: Array<{ label: string; value: Exclude<PrimeDurationOption, 'custom'> }> = [
  { label: '2 min', value: 120 },
  { label: '5 min', value: 300 },
  { label: '10 min', value: 600 },
];

const clampPrimeMinutes = (value: number): number => Math.min(120, Math.max(2, Math.round(value)));

const resolveInitialPrimeSelection = (durationSeconds: number): PrimeDurationOption => {
  if (durationSeconds === 120 || durationSeconds === 300 || durationSeconds === 600) {
    return durationSeconds;
  }

  return 'custom';
};

const AudioOptionButton: React.FC<{
  icon: React.ReactNode;
  label: string;
  selected: boolean;
  onPress: () => void;
}> = ({ icon, label, selected, onPress }) => (
  <TouchableOpacity
    accessibilityRole="button"
    accessibilityLabel={`Set session audio to ${label}`}
    accessibilityState={{ selected }}
    activeOpacity={0.85}
    onPress={onPress}
    style={[styles.modeButton, selected && styles.selectedButton]}
  >
    <View style={styles.modeButtonIcon}>{icon}</View>
    <Text style={[styles.modeButtonText, selected && styles.selectedButtonText]}>{label}</Text>
  </TouchableOpacity>
);

const DurationButton: React.FC<{
  label: string;
  selected: boolean;
  onPress: () => void;
}> = ({ label, selected, onPress }) => (
  <TouchableOpacity
    accessibilityRole="button"
    accessibilityState={{ selected }}
    activeOpacity={0.85}
    onPress={onPress}
    style={[styles.durationButton, selected && styles.selectedButton]}
  >
    <Text style={[styles.durationButtonText, selected && styles.selectedButtonText]}>{label}</Text>
  </TouchableOpacity>
);

export const SessionDefaultsScreen: React.FC = () => {
  const navigation = useNavigation();
  const focusSessionMode = useSettingsStore((state) => state.focusSessionMode ?? 'quick');
  const { width: screenWidth } = useWindowDimensions();
  const storedFocusDuration = useSettingsStore((state) => state.focusSessionDuration ?? 30);
  const storedFocusAudio = useSettingsStore((state) => state.focusSessionAudio ?? 'silent');
  const storedPrimeDuration = useSettingsStore((state) => state.primeSessionDuration ?? 120);
  const storedPrimeAudio = useSettingsStore((state) => state.primeSessionAudio ?? 'silent');
  const setFocusSessionMode = useSettingsStore((state) => state.setFocusSessionMode);
  const setFocusSessionDuration = useSettingsStore((state) => state.setFocusSessionDuration);
  const setFocusSessionAudio = useSettingsStore((state) => state.setFocusSessionAudio);
  const setPrimeSessionDuration = useSettingsStore((state) => state.setPrimeSessionDuration);
  const setPrimeSessionAudio = useSettingsStore((state) => state.setPrimeSessionAudio);

  const [activeTab, setActiveTab] = useState<SessionTab>(
    focusSessionMode === 'deep' ? 'prime' : 'focus'
  );
  const [focusDuration, setFocusDuration] = useState<FocusDurationOption>(
    (storedFocusDuration as FocusDurationOption) ?? 30
  );
  const [focusAudio, setFocusAudio] = useState<SessionAudioMode>(storedFocusAudio);
  const [primeSelection, setPrimeSelection] = useState<PrimeDurationOption>(
    resolveInitialPrimeSelection(storedPrimeDuration)
  );
  const [customPrimeMinutes, setCustomPrimeMinutes] = useState(
    String(Math.round(storedPrimeDuration / 60))
  );
  const [primeAudio, setPrimeAudio] = useState<SessionAudioMode>(storedPrimeAudio);
  const pillTranslate = useRef(new Animated.Value(activeTab === 'focus' ? 0 : 1)).current;
  const tabPillWidth = (screenWidth - 56) / 2;

  useEffect(() => {
    Animated.spring(pillTranslate, {
      toValue: activeTab === 'focus' ? 0 : 1,
      useNativeDriver: true,
      friction: 8,
      tension: 85,
    }).start();
  }, [activeTab, pillTranslate]);

  const resolvedPrimeDurationSeconds = useMemo(() => {
    if (primeSelection === 'custom') {
      return clampPrimeMinutes(Number(customPrimeMinutes || 2)) * 60;
    }

    return primeSelection;
  }, [customPrimeMinutes, primeSelection]);

  const infoContent = activeTab === 'focus'
    ? {
      title: 'About Focus Sessions',
      body: 'Brief, precise priming. Reinforces the neurological bond between your anchor and intention - fast enough to use anywhere.',
    }
    : {
      title: 'About Prime Sessions',
      body: 'Extended immersive practice. Deepens the motor-memory trace for days when you have time to go further in.',
    };

  const saveDefaults = () => {
    const nextMode: FocusSessionMode = activeTab === 'prime' ? 'deep' : 'quick';
    setFocusSessionMode(nextMode);
    setFocusSessionDuration(focusDuration);
    setFocusSessionAudio(focusAudio);
    setPrimeSessionDuration(resolvedPrimeDurationSeconds);
    setPrimeSessionAudio(primeAudio);
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Go back"
            activeOpacity={0.8}
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <ArrowLeft color={colors.gold} size={20} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Session Defaults</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.tabTrack}>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.tabPill,
              {
                transform: [
                  {
                    translateX: pillTranslate.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, tabPillWidth],
                    }),
                  },
                ],
                width: tabPillWidth,
              },
            ]}
          />
          <TouchableOpacity
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityState={{ selected: activeTab === 'focus' }}
            onPress={() => setActiveTab('focus')}
            style={styles.tabButton}
          >
            <Text style={[styles.tabButtonText, activeTab === 'focus' && styles.tabButtonTextActive]}>
              ⚡ Focus
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityState={{ selected: activeTab === 'prime' }}
            onPress={() => setActiveTab('prime')}
            style={styles.tabButton}
          >
            <Text style={[styles.tabButtonText, activeTab === 'prime' && styles.tabButtonTextActive]}>
              ◎ Prime
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {activeTab === 'focus' ? (
            <>
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Duration</Text>
                <Text style={styles.sectionDescription}>Quick Prime runs 10 seconds to 2 minutes.</Text>
                <View style={styles.focusDurationGrid}>
                  {FOCUS_DURATION_OPTIONS.map((option) => (
                    <DurationButton
                      key={option.value}
                      label={option.label}
                      selected={focusDuration === option.value}
                      onPress={() => setFocusDuration(option.value)}
                    />
                  ))}
                </View>
              </View>

              <View style={styles.sectionDivider} />

              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Mode</Text>
                <Text style={styles.sectionDescription}>How you want to show up for each session.</Text>
                <View style={styles.audioGrid}>
                  <AudioOptionButton
                    icon={<VolumeX color={focusAudio === 'silent' ? colors.gold : colors.silver} size={15} />}
                    label="Silent"
                    selected={focusAudio === 'silent'}
                    onPress={() => setFocusAudio('silent')}
                  />
                  <AudioOptionButton
                    icon={<Music4 color={focusAudio === 'ambient' ? colors.gold : colors.silver} size={15} />}
                    label="Ambient"
                    selected={focusAudio === 'ambient'}
                    onPress={() => setFocusAudio('ambient')}
                  />
                </View>
              </View>
            </>
          ) : (
            <>
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Duration</Text>
                <Text style={styles.sectionDescription}>Deep Prime starts at 2 minutes - no ceiling.</Text>
                <View style={styles.primeDurationGrid}>
                  {PRIME_DURATION_OPTIONS.map((option) => (
                    <DurationButton
                      key={option.value}
                      label={option.label}
                      selected={primeSelection === option.value}
                      onPress={() => setPrimeSelection(option.value)}
                    />
                  ))}
                </View>
                <View style={[styles.customRow, primeSelection === 'custom' && styles.selectedButton]}>
                  <Clock3 color={colors.gold} size={15} />
                  <Text style={styles.customLabel}>Custom:</Text>
                  <TextInput
                    accessibilityLabel="Custom prime duration in minutes"
                    keyboardType={Platform.OS === 'ios' ? 'number-pad' : 'numeric'}
                    value={customPrimeMinutes}
                    onChangeText={(value) => {
                      const digitsOnly = value.replace(/[^0-9]/g, '');
                      setCustomPrimeMinutes(digitsOnly);
                      setPrimeSelection('custom');
                    }}
                    onEndEditing={() => {
                      const normalized = clampPrimeMinutes(Number(customPrimeMinutes || 2));
                      setCustomPrimeMinutes(String(normalized));
                    }}
                    style={styles.customInput}
                    maxLength={3}
                  />
                  <Text style={styles.customLabel}>min</Text>
                </View>
              </View>

              <View style={styles.sectionDivider} />

              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Mode</Text>
                <Text style={styles.sectionDescription}>How you want to show up for each session.</Text>
                <View style={styles.audioGrid}>
                  <AudioOptionButton
                    icon={<VolumeX color={primeAudio === 'silent' ? colors.gold : colors.silver} size={15} />}
                    label="Silent"
                    selected={primeAudio === 'silent'}
                    onPress={() => setPrimeAudio('silent')}
                  />
                  <AudioOptionButton
                    icon={<Music4 color={primeAudio === 'ambient' ? colors.gold : colors.silver} size={15} />}
                    label="Ambient"
                    selected={primeAudio === 'ambient'}
                    onPress={() => setPrimeAudio('ambient')}
                  />
                </View>
              </View>
            </>
          )}

          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>{infoContent.title}</Text>
            <Text style={styles.infoBody}>{infoContent.body}</Text>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity activeOpacity={0.88} onPress={saveDefaults}>
            <LinearGradient
              colors={['#D4AF37', '#B8922A']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.saveButton}
            >
              <Text style={styles.saveButtonText}>Save Defaults</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F1419',
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: colors.gold,
    fontSize: 19,
    letterSpacing: 1.2,
    fontFamily: typography.fonts.heading,
  },
  headerSpacer: {
    width: 40,
  },
  tabTrack: {
    marginHorizontal: 24,
    marginBottom: 28,
    padding: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.14)',
    backgroundColor: '#1C2530',
    flexDirection: 'row',
  },
  tabPill: {
    position: 'absolute',
    top: 4,
    left: 4,
    height: 46,
    borderRadius: 10,
    backgroundColor: colors.gold,
  },
  tabButton: {
    flex: 1,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  tabButtonText: {
    fontFamily: typography.fonts.heading,
    fontSize: 12,
    letterSpacing: 1.2,
    color: 'rgba(192,192,192,0.75)',
  },
  tabButtonTextActive: {
    color: '#0F1419',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  section: {
    marginBottom: 4,
  },
  sectionLabel: {
    color: colors.gold,
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
    fontFamily: typography.fonts.headingSemiBold,
    marginBottom: 6,
  },
  sectionDescription: {
    color: 'rgba(192,192,192,0.72)',
    fontSize: 15,
    lineHeight: 22,
    fontFamily: typography.fonts.bodySerifItalic,
    marginBottom: 14,
  },
  focusDurationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  primeDurationGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  durationButton: {
    minWidth: '47%',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.28)',
    backgroundColor: '#1C2530',
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationButtonText: {
    color: colors.bone,
    fontSize: 13,
    letterSpacing: 0.6,
    fontFamily: typography.fonts.heading,
  },
  selectedButton: {
    borderColor: colors.gold,
    backgroundColor: 'rgba(212,175,55,0.12)',
  },
  selectedButtonText: {
    color: colors.gold,
  },
  sectionDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(212,175,55,0.08)',
    marginVertical: 24,
  },
  audioGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  modeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.28)',
    backgroundColor: '#1C2530',
    paddingVertical: 14,
  },
  modeButtonIcon: {
    marginTop: 1,
  },
  modeButtonText: {
    color: colors.bone,
    fontSize: 12,
    letterSpacing: 0.8,
    fontFamily: typography.fonts.heading,
  },
  customRow: {
    marginTop: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.28)',
    backgroundColor: '#1C2530',
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  customLabel: {
    color: 'rgba(192,192,192,0.72)',
    fontSize: 14,
    fontFamily: typography.fonts.bodySerifItalic,
  },
  customInput: {
    minWidth: 52,
    paddingVertical: 0,
    color: colors.bone,
    fontSize: 16,
    textAlign: 'center',
    fontFamily: typography.fonts.heading,
  },
  infoCard: {
    marginTop: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(62,44,91,0.6)',
    backgroundColor: 'rgba(62,44,91,0.35)',
    padding: 16,
  },
  infoTitle: {
    color: colors.gold,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontFamily: typography.fonts.headingSemiBold,
    marginBottom: 8,
  },
  infoBody: {
    color: 'rgba(192,192,192,0.75)',
    fontSize: 15,
    lineHeight: 22,
    fontFamily: typography.fonts.bodySerifItalic,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  saveButton: {
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  saveButtonText: {
    color: '#0F1419',
    fontSize: 13,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    fontFamily: typography.fonts.headingSemiBold,
  },
});
