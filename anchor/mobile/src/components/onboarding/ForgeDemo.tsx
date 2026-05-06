import React, { useRef, useEffect, useCallback, useState } from 'react';
import { View, StyleSheet, Image as RNImage } from 'react-native';
import { WebView } from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import { forgeWebViewHtml } from './forgeWebViewHtml';

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
    async function loadAsset() {
      try {
        const asset = Asset.fromModule(forgeRevealAsset);
        if (!asset.localUri) {
          await asset.downloadAsync();
        }
        if (isCancelled) return;

        const uri = asset.localUri || asset.uri;
        if (uri.startsWith('file:') || uri.startsWith('content:')) {
          const base64 = await FileSystem.readAsStringAsync(uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          setResolvedImageUri(`data:image/png;base64,${base64}`);
        } else {
          setResolvedImageUri(uri);
        }
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

  const injectImageUri = useCallback(() => {
    if (!resolvedImageUri) return;
    webViewRef.current?.injectJavaScript(`
      (function() {
        var img = document.getElementById('forgeSigil');
        if (img) img.src = ${JSON.stringify(resolvedImageUri)};
      })();
      true;
    `);
  }, [resolvedImageUri]);

  useEffect(() => {
    if (resolvedImageUri) {
      injectImageUri();
    }
  }, [resolvedImageUri, injectImageUri]);

  useEffect(() => {
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
  }, [isActive]);

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
      <WebView
        ref={webViewRef}
        source={{ html: forgeWebViewHtml }}
        style={styles.webview}
        onLoad={injectImageUri}
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
});
