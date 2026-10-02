import React, { useEffect, useState } from 'react';
import { DeviceEventEmitter, DevSettings, Image, Linking, StyleSheet, Text, View } from 'react-native';
import { NavigationContainer, useRoute } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

import { AnchorGenerationService } from '@/services/AnchorGenerationService';
import { useAnchorStore } from '@/stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';
import { useCreationPrefsStore } from '@/stores/creationPrefsStore';
import { useFirstAnchorFlowStore } from '@/stores/firstAnchorFlowStore';
import IntentionInputScreen from '../../IntentionInputScreen';
import AnchorCreationFlowScreen from '../AnchorCreationFlowScreen';

/**
 * Development-only host for the creation flow, reachable without the legacy navigator:
 *
 *   anchor://creation-flow-qa?start=intention            real Intention screen -> flow
 *   anchor://creation-flow-qa?start=flow&text=...&category=desire&source=typed|drawn
 *
 * The styling request is replaced by two local images after a short wait, so the whole flow can
 * be exercised on an emulator with no account and no backend. Never mounted in release builds.
 */

const Stack = createStackNavigator<any>();

const FIXTURES = [
  require('@/assets/vision/vision-future-desk.jpg'),
  require('@/assets/vision/vision-future-window.jpg'),
];

interface QAConfig {
  start: 'intention' | 'flow';
  text: string;
  category: string;
  source: 'typed' | 'drawn';
  waitMs: number;
  /** Changes on every link, so opening the same link again restarts the flow. */
  nonce: number;
}

function parse(url: string): QAConfig | null {
  if (!url.includes('creation-flow-qa')) return null;
  const query = new URLSearchParams(url.split('?')[1] ?? '');
  return {
    start: query.get('start') === 'flow' ? 'flow' : 'intention',
    text: query.get('text') ?? 'I do whatever I want whenever I want',
    category: query.get('category') ?? 'desire',
    source: query.get('source') === 'drawn' ? 'drawn' : 'typed',
    waitMs: Number(query.get('wait') ?? '3500'),
    nonce: Date.now(),
  };
}

function Stub() {
  const route = useRoute();
  return (
    <View style={styles.stub}>
      <Text style={styles.stubTitle}>{route.name}</Text>
      <Text style={styles.stubBody}>Reached from the creation flow.</Text>
    </View>
  );
}

export function CreationFlowQADevHost() {
  const [config, setConfig] = useState<QAConfig | null>(null);

  useEffect(() => {
    const openLab = (params?: Partial<QAConfig>) => {
      setConfig({
        start: params?.start ?? 'intention',
        text: params?.text ?? 'I do whatever I want whenever I want',
        category: params?.category ?? 'desire',
        source: params?.source ?? 'typed',
        waitMs: params?.waitMs ?? 3500,
        nonce: Date.now(),
      });
    };
    DevSettings.addMenuItem?.('Creation flow QA lab', () => openLab());
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const devMenu = require('expo-dev-menu') as { registerDevMenuItems?: (items: { name: string; callback: () => void; shouldCollapse?: boolean }[]) => Promise<void> };
      void devMenu.registerDevMenuItems?.([{ name: 'Creation flow QA lab', callback: () => openLab(), shouldCollapse: true }]);
    } catch {
      // Not in dev client
    }
    const emitterSub = DeviceEventEmitter.addListener('openCreationFlowQA', (data?: Partial<QAConfig>) => {
      openLab(data);
    });

    const open = ({ url }: { url: string }) => {
      const parsed = parse(url);
      if (parsed) setConfig(parsed);
    };
    const subscription = Linking.addEventListener('url', open);
    void Linking.getInitialURL().then((url) => url && open({ url }));
    return () => {
      subscription.remove();
      emitterSub.remove();
    };
  }, []);

  // Sealing really saves a (local, guest) anchor. Put every store it touches back as it was found
  // when the host restarts or closes, so exercising the flow leaves the device's data alone.
  useEffect(() => {
    if (!config) return undefined;
    const anchors = useAnchorStore.getState();
    const auth = useAuthStore.getState();
    const before = {
      anchors: anchors.anchors,
      currentAnchorId: anchors.currentAnchorId,
      anchorCount: auth.anchorCount,
      pendingFirstAnchorDraft: auth.pendingFirstAnchorDraft,
      pendingFirstAnchorMutations: auth.pendingFirstAnchorMutations,
      pendingFirstAnchorError: auth.pendingFirstAnchorError,
      flowDraft: useFirstAnchorFlowStore.getState().draft,
      prefs: {
        lastStyleId: useCreationPrefsStore.getState().lastStyleId,
        rotationCounter: useCreationPrefsStore.getState().rotationCounter,
      },
    };
    return () => {
      useAnchorStore.setState({ anchors: before.anchors, currentAnchorId: before.currentAnchorId });
      useAuthStore.setState({
        anchorCount: before.anchorCount,
        pendingFirstAnchorDraft: before.pendingFirstAnchorDraft,
        pendingFirstAnchorMutations: before.pendingFirstAnchorMutations,
        pendingFirstAnchorError: before.pendingFirstAnchorError,
      });
      useFirstAnchorFlowStore.setState({ draft: before.flowDraft });
      useCreationPrefsStore.setState(before.prefs);
    };
  }, [config]);

  // Swap the styling request for local fixtures while the host is open.
  useEffect(() => {
    if (!config) return undefined;
    const original = AnchorGenerationService.generate;
    AnchorGenerationService.generate = async () => {
      await new Promise((resolve) => setTimeout(resolve, config.waitMs));
      return {
        variations: FIXTURES.map((source) => Image.resolveAssetSource(source).uri),
        prompt: 'qa',
        negativePrompt: '',
        modelUsed: 'qa-fixture',
        provider: 'qa',
        controlMethod: 'lineart',
        generationTimeMs: config.waitMs,
        reuseRequestId: '',
        passingCount: 2,
      };
    };
    return () => {
      AnchorGenerationService.generate = original;
    };
  }, [config]);

  if (!config) return null;

  return (
    // An overlay, not a <Modal>: react-native-screens' navigator cannot live inside a Modal on Android.
    <View style={styles.overlay}>
      <NavigationContainer independent key={config.nonce}>
        <Stack.Navigator
          initialRouteName={config.start === 'intention' ? 'FirstAnchorCreation' : 'AnchorCreationFlow'}
          screenOptions={{ headerShown: false, animationEnabled: false }}
        >
          <Stack.Screen name="FirstAnchorCreation" component={IntentionInputScreen} />
          <Stack.Screen
            name="AnchorCreationFlow"
            component={AnchorCreationFlowScreen}
            initialParams={{
              intentionText: config.text,
              category: config.category,
              distilledLetters: [],
              source: config.source,
              entry: 'fade',
            }}
          />
          {['Login', 'Paywall', 'SaveProgress', 'PrimeYourAnchor', 'WallpaperPrompt', 'ChargeSetup'].map((name) => (
            <Stack.Screen key={name} name={name} component={Stub} />
          ))}
        </Stack.Navigator>
      </NavigationContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, zIndex: 99999, elevation: 99999, backgroundColor: '#F4EDE0' },
  stub: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4EDE0' },
  stubTitle: { fontSize: 22, color: '#14162B' },
  stubBody: { fontSize: 14, color: '#6B6B66', marginTop: 8 },
});
