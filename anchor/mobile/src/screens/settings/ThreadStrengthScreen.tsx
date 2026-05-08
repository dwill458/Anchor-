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
  type ThreadStrengthSensitivity,
} from '@/stores/settingsStore';
import { colors, typography } from '@/theme';

type VisualTone = 'hit' | 'soft' | 'miss';

const VISUALS: Record<
  ThreadStrengthSensitivity,
  {
    description: string;
    heights: number[];
    tones: VisualTone[];
  }
> = {
  lenient: {
    description:
      "Missing up to 2 days does not break your thread. Decay is gradual - life happens.",
    heights: [100, 100, 100, 95, 90, 95, 100],
    tones: ['hit', 'hit', 'hit', 'soft', 'soft', 'hit', 'hit'],
  },
  balanced: {
    description:
      'One missed day pauses your thread. Two in a row begins decay. Keeps you accountable without punishing you.',
    heights: [100, 100, 100, 100, 70, 85, 100],
    tones: ['hit', 'hit', 'hit', 'soft', 'miss', 'hit', 'hit'],
  },
  strict: {
    description:
      'Any missed day immediately begins decay. For those who want zero tolerance.',
    heights: [100, 100, 100, 65, 35, 70, 100],
    tones: ['hit', 'hit', 'hit', 'miss', 'miss', 'hit', 'hit'],
  },
};

const BAR_COLORS: Record<VisualTone, string> = {
  hit: '#D4AF37',
  soft: 'rgba(212,175,55,0.45)',
  miss: 'rgba(255,80,80,0.35)',
};

const DOT_COLORS: Record<VisualTone, string> = {
  hit: '#D4AF37',
  soft: 'rgba(255,160,60,0.5)',
  miss: 'rgba(255,80,80,0.48)',
};

const OptionCard: React.FC<{
  name: string;
  description: string;
  heights: number[];
  tones: VisualTone[];
  selected: boolean;
  onPress: () => void;
}> = ({ name, description, heights, tones, selected, onPress }) => (
  <TouchableOpacity
    accessibilityRole="button"
    accessibilityState={{ selected }}
    activeOpacity={0.88}
    onPress={onPress}
    style={[styles.optionCard, selected && styles.optionCardSelected]}
  >
    <View style={styles.optionHeader}>
      <Text style={[styles.optionTitle, selected && styles.optionTitleSelected]}>{name}</Text>
      <View style={[styles.checkCircle, selected && styles.checkCircleSelected]}>
        {selected ? <Check color="#0F1419" size={12} /> : null}
      </View>
    </View>
    <Text style={styles.optionDescription}>{description}</Text>
    <View style={styles.visualizerRow}>
      {heights.map((height, index) => (
        <View
          key={`${name}-bar-${index}`}
          style={[
            styles.visualizerBar,
            {
              height: `${height}%`,
              backgroundColor: BAR_COLORS[tones[index]],
            },
          ]}
        />
      ))}
    </View>
    <View style={styles.dotRow}>
      {tones.map((tone, index) => (
        <View
          key={`${name}-dot-${index}`}
          style={[styles.dot, { backgroundColor: DOT_COLORS[tone], borderColor: DOT_COLORS[tone] }]}
        />
      ))}
    </View>
  </TouchableOpacity>
);

export const ThreadStrengthScreen: React.FC = () => {
  const navigation = useNavigation();
  const storedSensitivity = useSettingsStore((state) => state.threadStrengthSensitivity ?? 'balanced');
  const setThreadStrengthSensitivity = useSettingsStore(
    (state) => state.setThreadStrengthSensitivity
  );
  const [selection, setSelection] = useState<ThreadStrengthSensitivity>(storedSensitivity);

  const saveSelection = () => {
    setThreadStrengthSensitivity(selection);
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
          <Text style={styles.headerTitle}>Thread Strength</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <View style={styles.hero}>
            <Text style={styles.heroTitle}>Thread Strength</Text>
            <Text style={styles.heroSubtitle}>How the system responds when you miss a day.</Text>
          </View>

          {(Object.keys(VISUALS) as ThreadStrengthSensitivity[]).map((sensitivity) => (
            <OptionCard
              key={sensitivity}
              name={sensitivity.charAt(0).toUpperCase() + sensitivity.slice(1)}
              description={VISUALS[sensitivity].description}
              heights={VISUALS[sensitivity].heights}
              tones={VISUALS[sensitivity].tones}
              selected={selection === sensitivity}
              onPress={() => setSelection(sensitivity)}
            />
          ))}

          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>About Thread Strength</Text>
            <Text style={styles.infoBody}>
              Thread strength measures the neurological depth of your anchor&apos;s bond. The visualizer in your Sanctuary reflects this directly - not as punishment, but as signal.
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
    marginTop: 8,
    color: 'rgba(192,192,192,0.68)',
    fontSize: 15,
    lineHeight: 22,
    fontFamily: typography.fonts.bodySerifItalic,
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
  visualizerRow: {
    marginTop: 14,
    height: 32,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
  },
  visualizerBar: {
    flex: 1,
    borderRadius: 3,
  },
  dotRow: {
    marginTop: 8,
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    flex: 1,
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

