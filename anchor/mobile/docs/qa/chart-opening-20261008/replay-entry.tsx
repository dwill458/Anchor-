import 'react-native-gesture-handler';
import React, { useState } from 'react';
import { Dimensions, PixelRatio, Pressable, Text, View } from 'react-native';
import { registerRootComponent } from 'expo';
import { useFonts } from 'expo-font';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { EBGaramond_500Medium } from '@expo-google-fonts/eb-garamond';
import { Figtree_400Regular, Figtree_600SemiBold } from '@expo-google-fonts/figtree';
import { ChartCreationFlow } from '@/components/v2/chart/ChartCreationFlow';
import { V2_SAMPLE_ANCHOR_SVGS } from '@/constants/v2';

type ReplayMode = 'full' | 'short' | 'reduced';

function ChartOpeningReplayQA() {
  const [loaded] = useFonts({
    'EBGaramond-Medium': EBGaramond_500Medium,
    'Figtree-Regular': Figtree_400Regular,
    'Figtree-SemiBold': Figtree_600SemiBold,
  });
  const [mode, setMode] = useState<ReplayMode | null>(null);
  const window = Dimensions.get('window');
  console.info(`[chart-opening-qa] replay-window=${window.width}x${window.height} scale=${PixelRatio.get()} fontScale=${PixelRatio.getFontScale()}`);
  const selectMode = (selected: ReplayMode) => {
    console.info(`[chart-opening-qa] selected=${selected} at=${performance.now().toFixed(1)}ms`);
    setMode(selected);
  };
  const identity = { intention: 'Launch my app and make it my full-time work', category: 'career', art: null, imageUrl: null };
  const anchorArt = { svg: V2_SAMPLE_ANCHOR_SVGS.medium, category: 'career' };
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#F4F1E9' }} onLayout={event => {
      const { width, height } = event.nativeEvent.layout;
      console.info(`[chart-opening-qa] replay-root-layout=${width}x${height}`);
    }}>
      <SafeAreaProvider>
        {loaded ? mode ? (
          <ChartCreationFlow
            key={mode}
            anchorId="chart-opening-fixture"
            identity={identity}
            anchorArt={anchorArt}
            vision={null}
            reducedMotion={mode === 'reduced'}
            introReplayMode={mode === 'short' ? 'short' : 'full'}
            initialPhase="intro"
            onBack={() => setMode(null)}
            onOpenVision={() => undefined}
            onCreated={() => undefined}
            onExplore={() => undefined}
          />
        ) : (
          <View style={{ flex: 1, justifyContent: 'center', padding: 32, gap: 18 }}>
            <Text style={{ color: '#181716', fontSize: 24, textAlign: 'center' }}>Chart opening QA</Text>
            {(['full', 'short', 'reduced'] as const).map(item => (
              <Pressable
                key={item}
                accessibilityRole="button"
                accessibilityLabel={`Start ${item} opening`}
                onPress={() => selectMode(item)}
                style={{ minHeight: 64, borderRadius: 32, backgroundColor: '#191817', justifyContent: 'center', alignItems: 'center' }}
              >
                <Text style={{ color: '#FFFFFF', fontFamily: 'Figtree-SemiBold', fontSize: 18 }}>{item === 'reduced' ? 'Reduced motion' : `${item[0].toUpperCase()}${item.slice(1)} opening`}</Text>
              </Pressable>
            ))}
            <Text style={{ color: '#6F6A63', fontFamily: 'Figtree-Regular', fontSize: 14, textAlign: 'center' }}>Tap a map background to skip the sequence, then tap Continue to verify handoff.</Text>
          </View>
        ) : null}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

registerRootComponent(ChartOpeningReplayQA);
