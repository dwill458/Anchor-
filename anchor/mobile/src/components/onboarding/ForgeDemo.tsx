import React, { useRef, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, Image as RNImage } from 'react-native';
import { WebView } from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import { getForgeWebViewHtml } from './forgeWebViewHtml';

/** Interactive sigil forge demonstration for onboarding slide 3. */
interface ForgeDemoProps {
  /** When this flips false → true, the demo resets to idle state. */
  isActive: boolean;
  onForgeComplete?: () => void;
}

// eslint-disable-next-line @typescript-eslint/no-var-requires
const forgeRevealAsset = require('../../../assets/onboarding anchor.png') as number;

export const ForgeDemo: React.FC<ForgeDemoProps> = ({ isActive, onForgeComplete }) => {
  const webViewRef = useRef<WebView>(null);
  const prevActiveRef = useRef(false);

  const [resolvedImageUri, setResolvedImageUri] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    const toInlineDataUri = async (sourceUri: string): Promise<string | null> => {
      const looksReadable =
        sourceUri.startsWith('file:') ||
        sourceUri.startsWith('content:') ||
        sourceUri.startsWith('/');

      if (!looksReadable) {
        return null;
      }

      try {
        const base64 = await FileSystem.readAsStringAsync(sourceUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        return `data:image/png;base64,${base64}`;
      } catch {
        return null;
      }
    };

    async function loadAsset() {
      try {
        const asset = Asset.fromModule(forgeRevealAsset);
        if (!asset.localUri) {
          await asset.downloadAsync();
        }
        if (isCancelled) return;

        const resolvedAssetUri = RNImage.resolveAssetSource(forgeRevealAsset).uri;
        const candidateUris = [asset.localUri, resolvedAssetUri, asset.uri].filter(
          (uri): uri is string => Boolean(uri)
        );

        for (const candidateUri of candidateUris) {
          const inlinedUri = await toInlineDataUri(candidateUri);
          if (isCancelled) return;
          if (inlinedUri) {
            setResolvedImageUri(inlinedUri);
            return;
          }
        }

        setResolvedImageUri(candidateUris[0] ?? null);
      } catch (err) {
        if (!isCancelled) {
          setResolvedImageUri(RNImage.resolveAssetSource(forgeRevealAsset).uri);
        }
      }
    }
    loadAsset();
    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!resolvedImageUri) {
      return;
    }

    if (isActive && !prevActiveRef.current) {
      // Transitioned from inactive → active: reset to idle
      webViewRef.current?.injectJavaScript(`
        (function() {
          var e = new MessageEvent('message', { data: JSON.stringify({ cmd: 'reset' }) });
          document.dispatchEvent(e);
          window.dispatchEvent(e);
        })();
        true;
      `);
    }
    prevActiveRef.current = isActive;
  }, [isActive, resolvedImageUri]);

  const webViewHtml = useMemo(
    () => (resolvedImageUri ? getForgeWebViewHtml(resolvedImageUri) : null),
    [resolvedImageUri]
  );

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data) as { event: string };
      if (data.event === 'forgeComplete') {
        onForgeComplete?.();
      }
    } catch {
      // ignore
    }
  };

  return (
    <View style={styles.container}>
      {webViewHtml ? (
        <WebView
          ref={webViewRef}
          source={{ html: webViewHtml }}
          style={styles.webview}
          onMessage={handleMessage}
          originWhitelist={['*']}
          allowFileAccess
          allowFileAccessFromFileURLs
          allowUniversalAccessFromFileURLs
          mixedContentMode="always"
          scrollEnabled={false}
          bounces={false}
          overScrollMode="never"
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
        />
      ) : (
        <View style={styles.placeholder} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 320,
    height: 320,
    borderRadius: 4,
    overflow: 'hidden',
  },
  webview: {
    width: 320,
    height: 320,
    backgroundColor: 'transparent',
  },
  placeholder: {
    width: 320,
    height: 320,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.2)',
    backgroundColor: 'rgba(15, 20, 25, 0.85)',
  },
});
