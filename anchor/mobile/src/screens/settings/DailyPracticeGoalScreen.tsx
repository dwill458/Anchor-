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
import { ArrowLeft, Check } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  useSettingsStore,
  type DailyPracticeGoalPreset,
} from '@/stores/settingsStore';
import { colors, typography } from '@/theme';

type GoalSelection =
  | { goal: 1; preset: 'once' }
  | { goal: 3; preset: 'three' }
  | { goal: 5; preset: 'five' }
  | { goal: number; preset: 'custom' };

const clampCustomGoal = (value: number): number => Math.min(20, Math.max(1, Math.round(value)));

const GoalCard: React.FC<{
  title: string;
  description: string;
  selected: boolean;
  badge?: string;
  onPress: () => void;
  children?: React.ReactNode;
}> = ({ title, description, selected, badge, onPress, children }) => (
  <TouchableOpacity
    accessibilityRole="button"
    accessibilityState={{ selected }}
    activeOpacity={0.88}
    onPress={onPress}
    style={[styles.optionCard, selected && styles.optionCardSelected]}
  >
    <View style={styles.optionHeader}>
      <View style={styles.optionTitleRow}>
        <Text style={[styles.optionTitle, selected && styles.optionTitleSelected]}>{title}</Text>
        {badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        ) : null}
      </View>
      <View style={[styles.checkCircle, selected && styles.checkCircleSelected]}>
        {selected ? <Check color="#0F1419" size={12} /> : null}
      </View>
    </View>
    <Text style={styles.optionDescription}>{description}</Text>
    {children}
  </TouchableOpacity>
);

export const DailyPracticeGoalScreen: React.FC = () => {
  const navigation = useNavigation();
  const storedGoal = useSettingsStore((state) => state.dailyPracticeGoal ?? 3);
  const storedPreset = useSettingsStore((state) => state.dailyPracticeGoalPreset ?? 'three');
  const setDailyPracticeGoal = useSettingsStore((state) => state.setDailyPracticeGoal);
  const setDailyPracticeGoalPreset = useSettingsStore((state) => state.setDailyPracticeGoalPreset);

  const initialSelection: GoalSelection =
    storedPreset === 'once'
      ? { goal: 1, preset: 'once' }
      : storedPreset === 'five'
        ? { goal: 5, preset: 'five' }
        : storedPreset === 'custom'
          ? { goal: storedGoal, preset: 'custom' }
          : { goal: 3, preset: 'three' };

  const [selection, setSelection] = useState<GoalSelection>(initialSelection);
  const progressPercent = ((selection.goal - 1) / 19) * 100;

  const saveGoal = () => {
    setDailyPracticeGoal(selection.goal);
    setDailyPracticeGoalPreset(selection.preset as DailyPracticeGoalPreset);
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
          <Text style={styles.headerTitle}>Daily Practice Goal</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <View style={styles.hero}>
            <Text style={styles.heroTitle}>Daily Practice Goal</Text>
            <Text style={styles.heroSubtitle}>
              A target, not a rule. Choose what consistency looks like for you.
            </Text>
          </View>

          <GoalCard
            title="Once"
            description="One anchor. One moment of clarity per day."
            selected={selection.preset === 'once'}
            onPress={() => setSelection({ goal: 1, preset: 'once' })}
          />

          <GoalCard
            title="Three times"
            description="Morning, midday, before bed."
            selected={selection.preset === 'three'}
            badge="Recommended"
            onPress={() => setSelection({ goal: 3, preset: 'three' })}
          />

          <GoalCard
            title="Five times"
            description="High-rep consistency. For builders who want depth."
            selected={selection.preset === 'five'}
            onPress={() => setSelection({ goal: 5, preset: 'five' })}
          />

          <GoalCard
            title="Custom"
            description="Choose a target between 1 and 20 sessions per day."
            selected={selection.preset === 'custom'}
            onPress={() => setSelection({ goal: selection.goal, preset: 'custom' })}
          >
            <View style={styles.customStepperRow}>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Decrease custom daily practice goal"
                activeOpacity={0.8}
                onPress={() =>
                  setSelection({
                    goal: clampCustomGoal(selection.goal - 1),
                    preset: 'custom',
                  })
                }
                style={styles.stepButton}
              >
                <Text style={styles.stepButtonText}>-</Text>
              </TouchableOpacity>
              <View style={styles.stepValueBox}>
                <Text style={styles.stepValueText}>{selection.goal}</Text>
              </View>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Increase custom daily practice goal"
                activeOpacity={0.8}
                onPress={() =>
                  setSelection({
                    goal: clampCustomGoal(selection.goal + 1),
                    preset: 'custom',
                  })
                }
                style={styles.stepButton}
              >
                <Text style={styles.stepButtonText}>+</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.progressHintRow}>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
              </View>
              <Text style={styles.progressLabel}>{selection.goal} / 20</Text>
            </View>
          </GoalCard>

          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Gentle Targets</Text>
            <Text style={styles.infoBody}>
              Only Focus sessions count toward your daily goal. Prime sessions deepen your practice whenever you have the time - they do not count against you if you skip them.
            </Text>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity activeOpacity={0.88} onPress={saveGoal}>
            <LinearGradient
              colors={['#D4AF37', '#B8922A']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.saveButton}
            >
              <Text style={styles.saveButtonText}>Save Goal</Text>
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
  optionCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: '#1C2530',
    paddingHorizontal: 20,
    paddingVertical: 18,
    marginBottom: 10,
  },
  optionCardSelected: {
    borderColor: colors.gold,
    backgroundColor: 'rgba(212,175,55,0.12)',
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  optionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    flex: 1,
  },
  optionTitle: {
    color: colors.bone,
    fontSize: 15,
    fontFamily: typography.fonts.heading,
    letterSpacing: 0.6,
  },
  optionTitleSelected: {
    color: colors.gold,
  },
  optionDescription: {
    marginTop: 6,
    color: 'rgba(192,192,192,0.68)',
    fontSize: 15,
    lineHeight: 22,
    fontFamily: typography.fonts.bodySerifItalic,
  },
  badge: {
    borderRadius: 999,
    backgroundColor: colors.gold,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeText: {
    color: '#0F1419',
    fontSize: 9,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontFamily: typography.fonts.headingSemiBold,
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: 'rgba(212,175,55,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircleSelected: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  customStepperRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepButton: {
    width: 42,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.28)',
    backgroundColor: 'rgba(0,0,0,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepButtonText: {
    color: colors.gold,
    fontSize: 22,
    lineHeight: 24,
    fontFamily: typography.fonts.heading,
  },
  stepValueBox: {
    minWidth: 54,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.28)',
    backgroundColor: 'rgba(0,0,0,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepValueText: {
    color: colors.gold,
    fontSize: 18,
    fontFamily: typography.fonts.heading,
  },
  progressHintRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: colors.gold,
  },
  progressLabel: {
    color: colors.gold,
    fontSize: 10,
    letterSpacing: 1,
    fontFamily: typography.fonts.heading,
  },
  infoCard: {
    marginTop: 8,
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

