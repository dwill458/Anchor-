// Dedicated development entry: production session renderers, no account startup or persistence.
import React, { useEffect, useState } from 'react';
import { registerRootComponent } from 'expo';
import { Asset } from 'expo-asset';
import { Image, Linking, Platform, Text, View } from 'react-native';
import { useFonts } from 'expo-font';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Inter_400Regular, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { CrimsonPro_400Regular, CrimsonPro_400Regular_Italic } from '@expo-google-fonts/crimson-pro';
import { Cinzel_400Regular, Cinzel_600SemiBold } from '@expo-google-fonts/cinzel';
import { ProgressiveFocusTransitionProvider } from './src/navigation/v2/ProgressiveFocusTransition';
import { SessionAudioPlaybackLab } from './src/screens/v2/system/SessionAudioPlaybackLab';
import type { V2VisionTile } from './src/adapters/v2/vision';
import { observeSessionAudio } from './src/services/audio/sessionAudioDiagnostics';

const statusKeys = new Map<string, string>();
observeSessionAudio(event => {
  if (event.status) {
    const key = `${event.status.isLoaded}:${event.status.playing}:${event.status.isBuffering}:${Math.floor(event.status.currentTime)}`;
    if (statusKeys.get(event.playerId) === key) return;
    statusKeys.set(event.playerId, key);
  }
  console.info('[SESSION_AUDIO_NATIVE]', JSON.stringify({ ...event, wallTime: new Date().toISOString(),
    ...(typeof event.asset === 'number' ? { uri: Asset.fromModule(event.asset).uri } : {}) }));
});

const Stack = createNativeStackNavigator();
function fixtureUri(source: number): string {
  const resolved = Image.resolveAssetSource(source);
  if (!resolved?.uri) throw new Error('Audio QA image fixture could not resolve.');
  return resolved.uri;
}
const tiles: V2VisionTile[] = [require('./src/assets/vision/vision-future-desk.jpg'), require('./src/assets/vision/vision-future-family.jpg'),
  require('./src/assets/vision/vision-future-home.jpg')].map((source, index) => ({ id: `audio-qa-${index}`, sceneId: `audio-qa-${index}`,
  imageUrl: fixtureUri(source), prompt: null, sortOrder: index, isHero: index === 0, sourceType: 'USER_UPLOAD' }));

function AudioQA() {
  const [runId, setRunId] = useState<string | null>(null);
  const [loaded, fontError] = useFonts({ 'Inter-Regular': Inter_400Regular, 'Inter-SemiBold': Inter_600SemiBold,
    'CrimsonPro-Regular': CrimsonPro_400Regular, 'CrimsonPro-Italic': CrimsonPro_400Regular_Italic,
    'Cinzel-Regular': Cinzel_400Regular, 'Cinzel-SemiBold': Cinzel_600SemiBold });
  useEffect(() => {
    const open = ({ url }: { url: string }) => {
      console.info('[SESSION_AUDIO_QA]', JSON.stringify({ event: 'received_url', url }));
      const surface = decodeURIComponent(url).split('surface=')[1]?.split('&')[0];
      if (surface?.startsWith('audio-')) setRunId(surface);
    };
    const subscription = Linking.addEventListener('url', open);
    void Linking.getInitialURL().then(url => { if (url) open({ url }); });
    console.info('[SESSION_AUDIO_QA]', JSON.stringify({ event: 'entry_ready', persistence: false, nativeReactNative: Platform.constants.reactNativeVersion }));
    return () => subscription.remove();
  }, []);
  useEffect(() => { console.info('[SESSION_AUDIO_QA]', JSON.stringify({ event: 'fonts', loaded, error: fontError?.message })); }, [loaded, fontError]);
  if (!__DEV__) return null;
  return <GestureHandlerRootView style={{ flex: 1 }}><SafeAreaProvider><NavigationContainer independent>
    <ProgressiveFocusTransitionProvider><Stack.Navigator screenOptions={{ headerShown: false, animation: 'none' }}>
      <Stack.Screen name="SessionAudioQA">{() => runId ? <SessionAudioPlaybackLab key={runId} runId={runId} tiles={tiles} />
        : <View style={{ flex: 1, backgroundColor: '#0B0F18', justifyContent: 'center', alignItems: 'center' }}><Text style={{ color: '#FFFFFF' }}>{fontError ? fontError.message : loaded ? 'Audio QA ready' : 'Loading QA fonts'}</Text></View>}</Stack.Screen>
    </Stack.Navigator></ProgressiveFocusTransitionProvider>
  </NavigationContainer></SafeAreaProvider></GestureHandlerRootView>;
}
registerRootComponent(AudioQA);
