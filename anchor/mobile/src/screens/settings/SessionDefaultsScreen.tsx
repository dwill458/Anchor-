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
import { ArrowLeft, Clock3, MapPin, Music4, Plus, Trash2, VolumeX } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { updateUserSettings } from '@/services/ApiClient';
import { useAuthStore } from '@/stores/authStore';
import {
  useSettingsStore,
  type FocusSessionMode,
  type SessionAudioMode,
} from '@/stores/settingsStore';
import {
  useLocationPrimingStore,
  type LocationPrimingPreset,
  type LocationPrimingZone,
} from '@/stores/locationPrimingStore';
import { colors, spacing, typography } from '@/theme';
import { logger } from '@/utils/logger';

type SessionTab = 'focus' | 'prime';
type FocusDurationOption = 10 | 30 | 60 | 120;
type PrimeDurationOption = 120 | 300 | 600 | 900 | 'custom';

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
  { label: '15 min', value: 900 },
];

const clampPrimeMinutes = (value: number): number => Math.min(120, Math.max(2, Math.round(value)));

const resolveInitialPrimeSelection = (durationSeconds: number): PrimeDurationOption => {
  if (
    durationSeconds === 120 ||
    durationSeconds === 300 ||
    durationSeconds === 600 ||
    durationSeconds === 900
  ) {
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

const LocationZoneEditor: React.FC<{
  zone: LocationPrimingZone;
  onUpdate: (update: Partial<LocationPrimingZone>) => void;
  onDelete: () => void;
}> = ({ zone, onUpdate, onDelete }) => {
  const durationOptions =
    zone.preset.sessionType === 'focus'
      ? FOCUS_DURATION_OPTIONS
      : PRIME_DURATION_OPTIONS;

  const updatePreset = (update: Partial<LocationPrimingPreset>) => {
    onUpdate({
      preset: {
        ...zone.preset,
        ...update,
      },
    } as Partial<LocationPrimingZone>);
  };

  return (
    <View style={styles.placeCard}>
      <View style={styles.placeHeader}>
        <View style={styles.placeTitleRow}>
          <MapPin color={colors.gold} size={15} />
          <TextInput
            accessibilityLabel="Place name"
            value={zone.label}
            onChangeText={(label) => onUpdate({ label } as Partial<LocationPrimingZone>)}
            style={styles.placeNameInput}
            placeholder="Place name"
            placeholderTextColor="rgba(192,192,192,0.45)"
          />
        </View>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={`Delete ${zone.label}`}
          activeOpacity={0.75}
          onPress={onDelete}
          style={styles.placeIconButton}
        >
          <Trash2 color="rgba(192,192,192,0.72)" size={16} />
        </TouchableOpacity>
      </View>

      <View style={styles.placeControlsRow}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityState={{ selected: zone.enabled }}
          activeOpacity={0.85}
          onPress={() => onUpdate({ enabled: !zone.enabled } as Partial<LocationPrimingZone>)}
          style={[styles.placeChip, zone.enabled && styles.selectedButton]}
        >
          <Text style={[styles.placeChipText, zone.enabled && styles.selectedButtonText]}>
            {zone.enabled ? 'On' : 'Off'}
          </Text>
        </TouchableOpacity>
        <View style={styles.radiusRow}>
          <Text style={styles.customLabel}>Radius</Text>
          <TextInput
            accessibilityLabel={`${zone.label} radius in meters`}
            keyboardType={Platform.OS === 'ios' ? 'number-pad' : 'numeric'}
            value={String(zone.radiusMeters)}
            onChangeText={(value) => {
              const radiusMeters = Number(value.replace(/[^0-9]/g, '') || 150);
              onUpdate({ radiusMeters } as Partial<LocationPrimingZone>);
            }}
            style={styles.radiusInput}
            maxLength={4}
          />
          <Text style={styles.customLabel}>m</Text>
        </View>
      </View>

      <View style={styles.placeSegmentRow}>
        <DurationButton
          label="Focus"
          selected={zone.preset.sessionType === 'focus'}
          onPress={() => updatePreset({ sessionType: 'focus', durationSeconds: 30 })}
        />
        <DurationButton
          label="Prime"
          selected={zone.preset.sessionType === 'prime'}
          onPress={() => updatePreset({ sessionType: 'prime', durationSeconds: 120 })}
        />
      </View>

      <View style={styles.placeDurationGrid}>
        {durationOptions.map((option) => (
          <DurationButton
            key={option.value}
            label={option.label}
            selected={zone.preset.durationSeconds === option.value}
            onPress={() => updatePreset({ durationSeconds: option.value })}
          />
        ))}
      </View>

      <View style={styles.audioGrid}>
        <AudioOptionButton
          icon={<VolumeX color={zone.preset.audioMode === 'silent' ? colors.gold : colors.silver} size={15} />}
          label="Silent"
          selected={zone.preset.audioMode === 'silent'}
          onPress={() => updatePreset({ audioMode: 'silent' })}
        />
        <AudioOptionButton
          icon={<Music4 color={zone.preset.audioMode === 'ambient' ? colors.gold : colors.silver} size={15} />}
          label="Ambient"
          selected={zone.preset.audioMode === 'ambient'}
          onPress={() => updatePreset({ audioMode: 'ambient' })}
        />
      </View>
    </View>
  );
};

export const SessionDefaultsScreen: React.FC = () => {
  const navigation = useNavigation();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const focusSessionMode = useSettingsStore((state) => state.focusSessionMode ?? 'quick');
  const { width: screenWidth } = useWindowDimensions();
  const storedFocusDuration = useSettingsStore((state) => state.focusSessionDuration ?? 30);
  const storedFocusAudio = useSettingsStore((state) => state.focusSessionAudio ?? 'ambient');
  const storedPrimeDuration = useSettingsStore((state) => state.primeSessionDuration ?? 120);
  const storedPrimeAudio = useSettingsStore((state) => state.primeSessionAudio ?? 'ambient');
  const setFocusSessionMode = useSettingsStore((state) => state.setFocusSessionMode);
  const setFocusSessionDuration = useSettingsStore((state) => state.setFocusSessionDuration);
  const setFocusSessionAudio = useSettingsStore((state) => state.setFocusSessionAudio);
  const setPrimeSessionDuration = useSettingsStore((state) => state.setPrimeSessionDuration);
  const setPrimeSessionAudio = useSettingsStore((state) => state.setPrimeSessionAudio);
  const locationSuggestionsEnabled = useLocationPrimingStore((state) => state.enabled);
  const locationZones = useLocationPrimingStore((state) => state.zones);
  const setLocationSuggestionsEnabled = useLocationPrimingStore((state) => state.setEnabled);
  const addLocationZoneFromCurrentLocation = useLocationPrimingStore(
    (state) => state.addZoneFromCurrentLocation
  );
  const updateLocationZone = useLocationPrimingStore((state) => state.updateZone);
  const deleteLocationZone = useLocationPrimingStore((state) => state.deleteZone);

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
  const [isAddingPlace, setIsAddingPlace] = useState(false);
  const [placeStatus, setPlaceStatus] = useState<string | null>(null);
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
    if (isAuthenticated) {
      void updateUserSettings({
        focusSessionMode: nextMode,
        focusSessionDuration: focusDuration,
        focusSessionAudio: focusAudio,
        primeSessionDuration: resolvedPrimeDurationSeconds,
        primeSessionAudio: primeAudio,
      }).catch((error) => {
        logger.warn('[SessionDefaultsScreen] Failed to sync session defaults to profile', error);
      });
    }
    navigation.goBack();
  };

  const addCurrentPlace = async () => {
    if (isAddingPlace) {
      return;
    }

    setIsAddingPlace(true);
    setPlaceStatus(null);

    const preset: LocationPrimingPreset =
      activeTab === 'focus'
        ? {
          sessionType: 'focus',
          durationSeconds: focusDuration,
          audioMode: focusAudio,
        }
        : {
          sessionType: 'prime',
          durationSeconds: resolvedPrimeDurationSeconds,
          audioMode: primeAudio,
        };

    try {
      const zone = await addLocationZoneFromCurrentLocation({
        label: `Place ${locationZones.length + 1}`,
        radiusMeters: 200,
        preset,
      });
      setPlaceStatus(
        zone
          ? 'Place saved on this device.'
          : 'Location unavailable or permission denied.'
      );
    } catch (error) {
      logger.warn('[SessionDefaultsScreen] Failed to add location priming place', error);
      setPlaceStatus('Location unavailable or permission denied.');
    } finally {
      setIsAddingPlace(false);
    }
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

          <View style={styles.sectionDivider} />

          <View style={styles.section}>
            <View style={styles.placeSectionHeader}>
              <View>
                <Text style={styles.sectionLabel}>Places</Text>
                <Text style={styles.sectionDescription}>Use nearby saved places to preselect a session preset.</Text>
              </View>
              <TouchableOpacity
                accessibilityRole="switch"
                accessibilityState={{ checked: locationSuggestionsEnabled }}
                activeOpacity={0.85}
                onPress={() => setLocationSuggestionsEnabled(!locationSuggestionsEnabled)}
                style={[styles.placeToggle, locationSuggestionsEnabled && styles.selectedButton]}
              >
                <Text style={[styles.placeToggleText, locationSuggestionsEnabled && styles.selectedButtonText]}>
                  {locationSuggestionsEnabled ? 'On' : 'Off'}
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Add current place"
              activeOpacity={0.85}
              disabled={isAddingPlace}
              onPress={addCurrentPlace}
              style={[styles.addPlaceButton, isAddingPlace && styles.disabledButton]}
            >
              <Plus color={colors.gold} size={16} />
              <Text style={styles.addPlaceButtonText}>
                {isAddingPlace ? 'Adding...' : 'Add Current Place'}
              </Text>
            </TouchableOpacity>

            {placeStatus ? <Text style={styles.placeStatusText}>{placeStatus}</Text> : null}

            <View style={styles.placesList}>
              {locationZones.map((zone) => (
                <LocationZoneEditor
                  key={zone.id}
                  zone={zone}
                  onUpdate={(update) => updateLocationZone(zone.id, update)}
                  onDelete={() => deleteLocationZone(zone.id)}
                />
              ))}
            </View>
          </View>

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
    flexWrap: 'wrap',
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
  disabledButton: {
    opacity: 0.55,
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
  placeSectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 14,
  },
  placeToggle: {
    minWidth: 58,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.28)',
    backgroundColor: '#1C2530',
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  placeToggleText: {
    color: colors.bone,
    fontSize: 11,
    letterSpacing: 0.8,
    fontFamily: typography.fonts.heading,
  },
  addPlaceButton: {
    marginTop: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.28)',
    backgroundColor: '#1C2530',
    paddingHorizontal: 14,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addPlaceButtonText: {
    color: colors.bone,
    fontSize: 12,
    letterSpacing: 0.8,
    fontFamily: typography.fonts.heading,
  },
  placeStatusText: {
    marginTop: 10,
    color: 'rgba(192,192,192,0.72)',
    fontSize: 13,
    lineHeight: 18,
    fontFamily: typography.fonts.bodySerifItalic,
  },
  placesList: {
    marginTop: 14,
    gap: 12,
  },
  placeCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.18)',
    backgroundColor: 'rgba(28,37,48,0.78)',
    padding: 14,
    gap: 12,
  },
  placeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  placeTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  placeNameInput: {
    flex: 1,
    paddingVertical: 0,
    color: colors.bone,
    fontSize: 16,
    fontFamily: typography.fonts.heading,
  },
  placeIconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  placeControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  placeChip: {
    minWidth: 58,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.28)',
    backgroundColor: '#15202A',
    paddingVertical: 11,
    alignItems: 'center',
  },
  placeChipText: {
    color: colors.bone,
    fontSize: 11,
    letterSpacing: 0.8,
    fontFamily: typography.fonts.heading,
  },
  radiusRow: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.2)',
    backgroundColor: '#15202A',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  radiusInput: {
    minWidth: 48,
    paddingVertical: 0,
    color: colors.bone,
    fontSize: 15,
    textAlign: 'center',
    fontFamily: typography.fonts.heading,
  },
  placeSegmentRow: {
    flexDirection: 'row',
    gap: 10,
  },
  placeDurationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
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
