import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSettingsStore, type RestDayPolicy } from '@/stores/settingsStore';
import { colors, typography } from '@/theme';

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const RestDayOption: React.FC<{
  title: string;
  selected: boolean;
  onPress: () => void;
}> = ({ title, selected, onPress }) => (
  <TouchableOpacity
    accessibilityRole="radio"
    accessibilityState={{ selected }}
    activeOpacity={0.88}
    onPress={onPress}
    style={styles.radioRow}
  >
    <View style={[styles.radioCircle, selected && styles.radioCircleSelected]}>
      {selected ? <View style={styles.radioInner} /> : null}
    </View>
    <Text style={[styles.radioText, selected && styles.radioTextSelected]}>{title}</Text>
  </TouchableOpacity>
);

export const RestDaysScreen: React.FC = () => {
  const navigation = useNavigation();
  const storedRestDays = useSettingsStore((state) => state.restDays ?? []);
  const storedPolicy = useSettingsStore((state) => state.restDayPolicy ?? 'build');
  const setRestDays = useSettingsStore((state) => state.setRestDays);
  const setRestDayPolicy = useSettingsStore((state) => state.setRestDayPolicy);

  const [restDays, updateRestDays] = useState<number[]>(storedRestDays);
  const [policy, setPolicy] = useState<RestDayPolicy>(storedPolicy);

  const toggleDay = (index: number) => {
    updateRestDays((current) =>
      current.includes(index)
        ? current.filter((day) => day !== index)
        : [...current, index].sort((left, right) => left - right)
    );
  };

  const saveSelection = () => {
    setRestDays(restDays);
    setRestDayPolicy(policy);
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
          <Text style={styles.headerTitle}>Rest Days</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <View style={styles.hero}>
            <Text style={styles.heroTitle}>Rest Days</Text>
            <Text style={styles.heroSubtitle}>
              Days that never count against your thread - even if you skip.
            </Text>
          </View>

          <Text style={styles.sectionLabel}>Select Your Rest Days</Text>
          <View style={styles.dayGrid}>
            {DAY_LABELS.map((label, index) => {
              const selected = restDays.includes(index);
              return (
                <TouchableOpacity
                  key={`${label}-${index}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  activeOpacity={0.85}
                  onPress={() => toggleDay(index)}
                  style={[styles.dayButton, selected && styles.dayButtonSelected]}
                >
                  <Text style={[styles.dayLetter, selected && styles.dayLetterSelected]}>{label}</Text>
                  <View style={[styles.dayDot, selected && styles.dayDotSelected]} />
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.sectionLabel}>If You Practice Anyway</Text>
          <View style={styles.policyCard}>
            <RestDayOption
              title="Still build thread strength (rest days are a floor, not a ceiling)"
              selected={policy === 'build'}
              onPress={() => setPolicy('build')}
            />
            <RestDayOption
              title="Count as bonus - no thread change either way"
              selected={policy === 'neutral'}
              onPress={() => setPolicy('neutral')}
            />
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Rest Is Part of the Practice</Text>
            <Text style={styles.infoBody}>
              Deliberate recovery prevents the compulsion loop. A thread you can sustain for a year is worth more than one you burn out on in 30 days.
            </Text>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity activeOpacity={0.88} onPress={saveSelection}>
            <LinearGradient
              colors={['#D4AF37', '#B8922A']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.saveButton}
            >
              <Text style={styles.saveButtonText}>Save</Text>
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
    paddingBottom: 18,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: colors.gold,
    fontSize: 18,
    letterSpacing: 1,
    fontFamily: typography.fonts.heading,
  },
  headerSpacer: {
    width: 40,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  hero: {
    paddingTop: 8,
    paddingBottom: 18,
  },
  heroTitle: {
    color: colors.bone,
    fontSize: 24,
    lineHeight: 30,
    fontFamily: typography.fonts.headingSemiBold,
    marginBottom: 8,
  },
  heroSubtitle: {
    color: 'rgba(192,192,192,0.75)',
    fontSize: 16,
    lineHeight: 24,
    fontFamily: typography.fonts.bodySerifItalic,
  },
  sectionLabel: {
    color: colors.gold,
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
    fontFamily: typography.fonts.headingSemiBold,
    marginBottom: 14,
  },
  dayGrid: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 24,
  },
  dayButton: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    backgroundColor: '#1C2530',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayButtonSelected: {
    borderColor: colors.gold,
    backgroundColor: 'rgba(212,175,55,0.12)',
  },
  dayLetter: {
    color: 'rgba(192,192,192,0.4)',
    fontSize: 11,
    letterSpacing: 0.8,
    fontFamily: typography.fonts.headingSemiBold,
  },
  dayLetterSelected: {
    color: colors.gold,
  },
  dayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 4,
    backgroundColor: 'transparent',
  },
  dayDotSelected: {
    backgroundColor: colors.gold,
  },
  policyCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: '#1C2530',
    paddingHorizontal: 18,
    paddingVertical: 14,
    marginBottom: 18,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 8,
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: 'rgba(212,175,55,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  radioCircleSelected: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  radioInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#0F1419',
  },
  radioText: {
    flex: 1,
    color: 'rgba(192,192,192,0.72)',
    fontSize: 15,
    lineHeight: 22,
    fontFamily: typography.fonts.bodySerifItalic,
  },
  radioTextSelected: {
    color: colors.bone,
  },
  infoCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(62,44,91,0.7)',
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

