import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';

import { Anchor15PrimaryButton, Anchor15Screen, Anchor15TextButton } from '@/components/anchor15';
import { SigilSvg } from '@/components/common';
import { useAnchorStore } from '@/stores/anchorStore';
import { colors, typography } from '@/theme';
import type { RootStackParamList } from '@/types';

type PrimeRoute = RouteProp<RootStackParamList, 'PrimeYourAnchor'>;
type PrimeNavigation = StackNavigationProp<RootStackParamList, 'PrimeYourAnchor'>;
type FirstPracticeMode = 'focus' | 'deepPrime';

const MODE_COPY: Record<FirstPracticeMode, { title: string; detail: string }> = {
  focus: { title: 'Focus', detail: 'A short return before the moment that matters.' },
  deepPrime: { title: 'Deep Prime', detail: 'A longer, quieter first session with your Anchor.' },
};

/**
 * The canonical bridge from a newly saved Anchor into Sanctuary. Sessions
 * retain their existing routes; this screen only chooses the first entry.
 */
export function PrimeYourAnchorScreen() {
  const navigation = useNavigation<PrimeNavigation>();
  const route = useRoute<PrimeRoute>();
  const anchor = useAnchorStore((state) => state.getAnchorById(route.params.anchorId));
  const [selectedMode, setSelectedMode] = useState<FirstPracticeMode>('focus');

  const sigil = useMemo(
    () => anchor?.reinforcedSigilSvg || anchor?.baseSigilSvg || '',
    [anchor?.baseSigilSvg, anchor?.reinforcedSigilSvg]
  );

  if (!anchor) {
    return (
      <Anchor15Screen>
        <StatusBar style="light" />
        <View style={styles.missingWrap}>
          <Text style={styles.eyebrow}>YOUR ANCHOR</Text>
          <Text style={styles.missingTitle}>Your Anchor is safely waiting in Sanctuary.</Text>
          <Anchor15PrimaryButton label="Go to Sanctuary" onPress={() => navigation.replace('Vault')} />
        </View>
      </Anchor15Screen>
    );
  }

  const beginSelectedPractice = () => {
    if (selectedMode === 'focus') {
      navigation.replace('ActivationRitual', {
        anchorId: anchor.id,
        activationType: 'visual',
        durationOverride: 60,
        returnTo: 'vault',
      });
      return;
    }

    navigation.replace('ChargeSetup', {
      anchorId: anchor.id,
      initialDuration: 'deep',
      returnTo: 'vault',
      fromOnboarding: true,
    });
  };

  return (
    <Anchor15Screen>
      <StatusBar style="light" />
      <View style={styles.content}>
        <View style={styles.heading}>
          <Text style={styles.eyebrow}>ANCHOR FORGED</Text>
          <Text style={styles.title}>The work begins now.</Text>
          <Text style={styles.subhead}>
            Your intention gave this form meaning. Practice builds your connection to it.
          </Text>
        </View>

        <View accessible={false} style={styles.stage}>
          <View style={styles.outerRing} />
          <View style={styles.innerRing} />
          <View style={styles.sigilWrap}>
            <SigilSvg xml={sigil} width={176} height={176} color={colors.anchor15.giltBright} />
          </View>
        </View>

        <View style={styles.modeList}>
          {(Object.keys(MODE_COPY) as FirstPracticeMode[]).map((mode) => {
            const selected = selectedMode === mode;
            const copy = MODE_COPY[mode];
            return (
              <Pressable
                key={mode}
                accessibilityRole="radio"
                accessibilityLabel={`${copy.title}. ${copy.detail}`}
                accessibilityState={{ selected }}
                onPress={() => setSelectedMode(mode)}
                style={[styles.modeCard, selected && styles.modeCardSelected]}
              >
                <View style={styles.modeCopy}>
                  <Text style={[styles.modeTitle, selected && styles.modeTitleSelected]}>{copy.title}</Text>
                  <Text style={styles.modeDetail}>{copy.detail}</Text>
                </View>
                <View style={[styles.radio, selected && styles.radioSelected]}>
                  {selected ? <View style={styles.radioDot} /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.actions}>
          <Anchor15PrimaryButton
            label={`Begin ${MODE_COPY[selectedMode].title}`}
            onPress={beginSelectedPractice}
            accessibilityHint="Starts the selected first practice session"
          />
          <Anchor15TextButton
            label="Practice later"
            onPress={() => navigation.replace('Vault')}
            accessibilityHint="Return to Sanctuary without starting a session"
          />
        </View>
      </View>
    </Anchor15Screen>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 18, paddingBottom: 18, justifyContent: 'space-between' },
  heading: { gap: 10 },
  eyebrow: { color: colors.anchor15.gilt, fontFamily: typography.fontFamily.ritual, fontSize: 10, letterSpacing: 2.2 },
  title: { color: colors.anchor15.bone, fontFamily: typography.fontFamily.voice, fontSize: 36, lineHeight: 39 },
  subhead: { color: colors.anchor15.ash, fontFamily: typography.fontFamily.instrument, fontSize: 14, lineHeight: 21, maxWidth: 330 },
  stage: { height: 236, alignItems: 'center', justifyContent: 'center' },
  outerRing: { position: 'absolute', width: 226, height: 226, borderRadius: 113, borderWidth: 1, borderColor: 'rgba(217, 179, 108, 0.16)' },
  innerRing: { position: 'absolute', width: 194, height: 194, borderRadius: 97, borderWidth: 1, borderColor: 'rgba(242, 223, 168, 0.24)' },
  sigilWrap: { width: 178, height: 178, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(8, 11, 15, 0.36)', borderRadius: 89 },
  modeList: { gap: 10 },
  modeCard: { minHeight: 74, borderRadius: 16, padding: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: colors.anchor15.hairline, backgroundColor: 'rgba(244, 239, 230, 0.025)' },
  modeCardSelected: { borderColor: colors.anchor15.goldHairline, backgroundColor: 'rgba(217, 179, 108, 0.08)' },
  modeCopy: { flex: 1, paddingRight: 12, gap: 3 },
  modeTitle: { color: colors.anchor15.bone, fontFamily: typography.fontFamily.ritualSemiBold, fontSize: 12, letterSpacing: 1.1, textTransform: 'uppercase' },
  modeTitleSelected: { color: colors.anchor15.giltBright },
  modeDetail: { color: colors.anchor15.ash, fontFamily: typography.fontFamily.voice, fontSize: 15, lineHeight: 18 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: 'rgba(244, 239, 230, 0.32)', alignItems: 'center', justifyContent: 'center' },
  radioSelected: { borderColor: colors.anchor15.giltBright },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.anchor15.giltBright },
  actions: { gap: 6 },
  missingWrap: { flex: 1, justifyContent: 'center', paddingHorizontal: 24, gap: 16 },
  missingTitle: { color: colors.anchor15.bone, fontFamily: typography.fontFamily.voice, fontSize: 30, lineHeight: 36 },
});
