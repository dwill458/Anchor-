import 'react-native-gesture-handler';
import React from 'react';
import { registerRootComponent } from 'expo';
import { useFonts } from 'expo-font';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { EBGaramond_500Medium } from '@expo-google-fonts/eb-garamond';
import { Figtree_400Regular, Figtree_600SemiBold } from '@expo-google-fonts/figtree';
import { ChartCreationFlow } from '@/components/v2/chart/ChartCreationFlow';
import { V2_SAMPLE_ANCHOR_SVGS } from '@/constants/v2';

function Baseline() {
  const [loaded] = useFonts({
    'EBGaramond-Medium': EBGaramond_500Medium,
    'Figtree-Regular': Figtree_400Regular,
    'Figtree-SemiBold': Figtree_600SemiBold,
  });
  const identity = {
    intention: 'Launch my app and make it my full-time work',
    category: 'career',
    art: null,
    imageUrl: null,
  };
  const anchorArt = { svg: V2_SAMPLE_ANCHOR_SVGS.medium, category: 'career' };
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        {loaded ? (
          <ChartCreationFlow
            anchorId="chart-opening-fixture"
            identity={identity}
            anchorArt={anchorArt}
            vision={null}
            reducedMotion={false}
            initialPhase="intro"
            onBack={() => undefined}
            onOpenVision={() => undefined}
            onCreated={() => undefined}
            onExplore={() => undefined}
          />
        ) : null}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

registerRootComponent(Baseline);
