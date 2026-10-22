import 'react-native-gesture-handler';
import React from 'react';
import { registerRootComponent } from 'expo';
import { useFonts } from 'expo-font';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { EBGaramond_500Medium } from '@expo-google-fonts/eb-garamond';
import { Figtree_400Regular, Figtree_600SemiBold } from '@expo-google-fonts/figtree';
import { V2ChartPreview } from '@/screens/v2/system/V2ChartPreview';

function CurrentQA() {
  const [loaded] = useFonts({
    'EBGaramond-Medium': EBGaramond_500Medium,
    'Figtree-Regular': Figtree_400Regular,
    'Figtree-SemiBold': Figtree_600SemiBold,
  });
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        {loaded ? <V2ChartPreview onClose={() => undefined} /> : null}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

registerRootComponent(CurrentQA);
