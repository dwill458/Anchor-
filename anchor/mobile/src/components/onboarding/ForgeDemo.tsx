import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import { View, StyleSheet, Image as RNImage } from 'react-native';
import { WebView } from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';

/** Interactive sigil forge demonstration for onboarding slide 3. */
interface ForgeDemoProps {
  /** When this flips false → true, the demo resets to idle state. */
  isActive: boolean;
  onForgeComplete?: () => void;
}

const ForgeWebView = require('../../assets/webviews/OnboardingForgeWebView.html');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const forgeRevealAsset = require('../../../assets/onboarding anchor.png') as number;

export const ForgeDemo: React.FC<ForgeDemoProps> = ({ isActive, onForgeComplete }) => {
  const webViewRef = useRef<WebView>(null);
  const prevActiveRef = useRef(false);

  const imageUri = useMemo(
    () => RNImage.resolveAssetSource(forgeRevealAsset).uri,
    []
  );

  const injectImageUri = useCallback(() => {
    webViewRef.current?.injectJavaScript(`
      (function() {
        var img = document.getElementById('forgeSigil');
        if (img) img.src = ${JSON.stringify(imageUri)};
      })();
      true;
    `);
  }, [imageUri]);

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
        source={ForgeWebView}
        style={styles.webview}
        onLoad={injectImageUri}
        onMessage={handleMessage}
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
