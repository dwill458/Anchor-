import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { WebView } from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';
import { useReduceMotionEnabled } from '@/hooks/useReduceMotionEnabled';
import { colors, spacing, typography } from '@/theme';
import { burnRitualWebViewHtml } from './burnRitualWebViewHtml';

type CommitStatus = 'pending' | 'success' | 'error';
type OverlayState = 'animating' | 'syncing' | 'success' | 'error';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DEFAULT_ERROR_MESSAGE = "Couldn't complete release. Try again.";

export type BurnCommitFn = () => Promise<void>;

export interface BurnAnimationOverlayProps {
  sigilSvg: string;
  enhancedImageUrl?: string;
  onCommitBurn: BurnCommitFn;
  onReturnToSanctuary: () => void;
  onReturnToAnchor?: () => void;
  /** Ash Line (Pattern 8): bone-text whisper shown below subtitle in Phase 4 success. */
  ashLineText?: string;
}

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return DEFAULT_ERROR_MESSAGE;
};

const toSvgDataUri = (svg: string): string => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

type BurnStartPayload = {
  cmd: 'start';
  sigilUri?: string;
  fallbackSigilUri?: string;
};

const isInlineRenderableUri = (uri: string): boolean =>
  uri.startsWith('data:') || uri.startsWith('file:') || uri.startsWith('content:');

const blobToDataUri = async (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => {
      reject(new Error('Failed to serialize burn artwork.'));
    };

    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }

      reject(new Error('Failed to serialize burn artwork.'));
    };

    reader.readAsDataURL(blob);
  });

const buildStartScript = (payload: BurnStartPayload): string => {
  const serialized = JSON.stringify(payload);
  return `
    (function() {
      const payload = ${serialized};
      window.dispatchEvent(new MessageEvent('message', {
        data: JSON.stringify(payload)
      }));
    })();
    true;
  `;
};

export const BurnAnimationOverlay: React.FC<BurnAnimationOverlayProps> = ({
  sigilSvg,
  enhancedImageUrl,
  onCommitBurn,
  onReturnToSanctuary,
  onReturnToAnchor,
  ashLineText,
}) => {
  const navigation = useNavigation<any>();
  const reduceMotionEnabled = useReduceMotionEnabled();

  const [overlayState, setOverlayState] = useState<OverlayState>('animating');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isRetrying, setIsRetrying] = useState(false);
  const [resolvedWebViewSigilUri, setResolvedWebViewSigilUri] = useState<string | undefined>(undefined);
  const [isWebViewSigilReady, setIsWebViewSigilReady] = useState(false);

  const ashLineOpacity = useSharedValue(0);

  const webViewRef = useRef<WebView>(null);
  const isMountedRef = useRef(true);
  const isLockedRef = useRef(true);
  const commitStartedRef = useRef(false);
  const startInjectedRef = useRef(false);
  const animationCompleteRef = useRef(false);
  const commitStatusRef = useRef<CommitStatus>('pending');
  const commitErrorRef = useRef('');
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const fallbackSigilUri = useMemo(() => {
    if (sigilSvg) {
      return toSvgDataUri(sigilSvg);
    }
    return undefined;
  }, [sigilSvg]);

  const sigilUri = useMemo(() => enhancedImageUrl ?? fallbackSigilUri, [enhancedImageUrl, fallbackSigilUri]);

  useEffect(() => {
    let isCancelled = false;

    const resolveSigilUri = async (): Promise<void> => {
      if (!sigilUri) {
        if (!isCancelled) {
          setResolvedWebViewSigilUri(undefined);
          setIsWebViewSigilReady(true);
        }
        return;
      }

      if (isInlineRenderableUri(sigilUri)) {
        if (!isCancelled) {
          setResolvedWebViewSigilUri(sigilUri);
          setIsWebViewSigilReady(true);
        }
        return;
      }

      try {
        const response = await fetch(sigilUri);
        if (!response.ok) {
          throw new Error(`Burn artwork request failed with ${response.status}`);
        }

        const blob = await response.blob();
        const dataUri = await blobToDataUri(blob);

        if (!isCancelled) {
          setResolvedWebViewSigilUri(dataUri);
          setIsWebViewSigilReady(true);
        }
      } catch {
        if (!isCancelled) {
          setResolvedWebViewSigilUri(sigilUri);
          setIsWebViewSigilReady(true);
        }
      }
    };

    setIsWebViewSigilReady(false);
    setResolvedWebViewSigilUri(undefined);
    void resolveSigilUri();

    return () => {
      isCancelled = true;
    };
  }, [sigilUri]);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((timer) => clearTimeout(timer));
    timersRef.current = [];
  }, []);

  const queueTimer = useCallback((fn: () => void, delay: number): void => {
    const timer = setTimeout(fn, delay);
    timersRef.current.push(timer);
  }, []);

  const transitionToSuccess = useCallback(() => {
    if (!isMountedRef.current) return;

    setOverlayState('success');
    setErrorMessage('');
    commitErrorRef.current = '';

    ashLineOpacity.value = 0;
    if (ashLineText) {
      queueTimer(() => {
        ashLineOpacity.value = withTiming(0.75, {
          duration: reduceMotionEnabled ? 0 : 600,
          easing: Easing.out(Easing.cubic),
        });
      }, reduceMotionEnabled ? 0 : 800);
    }
  }, [ashLineOpacity, ashLineText, queueTimer, reduceMotionEnabled]);

  const transitionToError = useCallback(
    (message: string) => {
      if (!isMountedRef.current) return;
      ashLineOpacity.value = 0;
      setOverlayState('error');
      setErrorMessage(message);
    },
    [ashLineOpacity]
  );

  const handleAnimationComplete = useCallback(() => {
    animationCompleteRef.current = true;

    if (commitStatusRef.current === 'success') {
      transitionToSuccess();
      return;
    }

    if (commitStatusRef.current === 'error') {
      transitionToError(commitErrorRef.current || DEFAULT_ERROR_MESSAGE);
      return;
    }

    if (isMountedRef.current) {
      setOverlayState('syncing');
    }
  }, [transitionToError, transitionToSuccess]);

  const runInitialCommit = useCallback(async () => {
    if (commitStartedRef.current) return;

    commitStartedRef.current = true;
    commitStatusRef.current = 'pending';
    commitErrorRef.current = '';

    try {
      await onCommitBurn();
      commitStatusRef.current = 'success';

      if (animationCompleteRef.current) {
        transitionToSuccess();
      }
    } catch (error) {
      const message = getErrorMessage(error);
      commitStatusRef.current = 'error';
      commitErrorRef.current = message;

      if (animationCompleteRef.current) {
        transitionToError(message);
      } else if (isMountedRef.current) {
        setErrorMessage(message);
      }
    }
  }, [onCommitBurn, transitionToError, transitionToSuccess]);

  useEffect(() => {
    isMountedRef.current = true;
    void runInitialCommit();

    return () => {
      isMountedRef.current = false;
      clearTimers();
    };
  }, [clearTimers, runInitialCommit]);

  useEffect(() => {
    navigation.setOptions({ gestureEnabled: false });

    const beforeRemoveUnsubscribe = navigation.addListener('beforeRemove', (event: any) => {
      if (!isLockedRef.current) return;
      event.preventDefault();
    });

    const hardwareBackSubscription = BackHandler.addEventListener('hardwareBackPress', () => {
      return isLockedRef.current;
    });

    return () => {
      beforeRemoveUnsubscribe();
      hardwareBackSubscription.remove();
      navigation.setOptions({ gestureEnabled: true });
    };
  }, [navigation]);

  const ashLineStyle = useAnimatedStyle(() => ({ opacity: ashLineOpacity.value }));

  const injectStartPayload = useCallback(() => {
    if (startInjectedRef.current || !isWebViewSigilReady) {
      return;
    }

    startInjectedRef.current = true;
    webViewRef.current?.injectJavaScript(
      buildStartScript({
        cmd: 'start',
        sigilUri: resolvedWebViewSigilUri,
        fallbackSigilUri,
      })
    );
  }, [fallbackSigilUri, isWebViewSigilReady, resolvedWebViewSigilUri]);

  const handleWebViewLoad = useCallback(() => {
    injectStartPayload();
  }, [injectStartPayload]);

  useEffect(() => {
    injectStartPayload();
  }, [injectStartPayload]);

  const handleWebViewMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const payload = JSON.parse(event.nativeEvent.data);
        if (payload?.event === 'burnComplete') {
          handleAnimationComplete();
        }
      } catch {
        // Ignore non-JSON bridge messages.
      }
    },
    [handleAnimationComplete]
  );

  const unlockNavigation = useCallback(() => {
    isLockedRef.current = false;
    navigation.setOptions({ gestureEnabled: true });
  }, [navigation]);

  const handleReturnToSanctuaryPress = useCallback(() => {
    unlockNavigation();
    onReturnToSanctuary();
  }, [onReturnToSanctuary, unlockNavigation]);

  const handleReturnToAnchorPress = useCallback(() => {
    unlockNavigation();
    if (onReturnToAnchor) {
      onReturnToAnchor();
      return;
    }
    onReturnToSanctuary();
  }, [onReturnToAnchor, onReturnToSanctuary, unlockNavigation]);

  const handleRetryPress = useCallback(async () => {
    if (isRetrying) return;

    setIsRetrying(true);
    setErrorMessage('');

    try {
      await onCommitBurn();
      commitStatusRef.current = 'success';
      commitErrorRef.current = '';
      transitionToSuccess();
    } catch (error) {
      const message = getErrorMessage(error);
      commitStatusRef.current = 'error';
      commitErrorRef.current = message;
      transitionToError(message);
    } finally {
      if (isMountedRef.current) {
        setIsRetrying(false);
      }
    }
  }, [isRetrying, onCommitBurn, transitionToError, transitionToSuccess]);

  const title = overlayState === 'error' ? "Couldn't complete release." : 'It Is Done';
  const subtitle =
    overlayState === 'error'
      ? errorMessage || DEFAULT_ERROR_MESSAGE
      : 'The intention has served its purpose. The symbol returns to silence.';

  return (
    <View style={styles.screen}>
      {overlayState === 'animating' || overlayState === 'syncing' ? (
        <View style={styles.webviewContainer}>
          <WebView
            ref={webViewRef}
            source={{ html: burnRitualWebViewHtml }}
            style={styles.webview}
            onLoad={handleWebViewLoad}
            onMessage={handleWebViewMessage}
            originWhitelist={['*']}
            allowFileAccess={true}
            mixedContentMode="always"
            scrollEnabled={false}
            bounces={false}
            overScrollMode="never"
            showsVerticalScrollIndicator={false}
            showsHorizontalScrollIndicator={false}
          />

          {overlayState === 'syncing' ? (
            <View style={styles.syncOverlay}>
              <ActivityIndicator color={colors.gold} size="small" />
              <Text style={styles.syncText}>Finalizing ritual</Text>
            </View>
          ) : null}
        </View>
      ) : (
        <View style={styles.resultContainer}>
          <Text style={styles.resultTitle}>{title}</Text>
          <View style={styles.resultDivider} />
          <Text style={styles.resultSubtitle}>{subtitle}</Text>

          {overlayState === 'success' && ashLineText ? (
            <Animated.Text style={[styles.ashLine, ashLineStyle]} accessibilityRole="text">
              {ashLineText}
            </Animated.Text>
          ) : null}

          {overlayState === 'success' ? (
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleReturnToSanctuaryPress}
              activeOpacity={0.88}
              accessibilityRole="button"
              accessibilityLabel="Return to Sanctuary"
            >
              <Text style={styles.primaryButtonText}>Return to Sanctuary</Text>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity
                style={[styles.primaryButton, isRetrying && styles.primaryButtonDisabled]}
                onPress={handleRetryPress}
                disabled={isRetrying}
                activeOpacity={0.88}
                accessibilityRole="button"
                accessibilityLabel="Try again"
              >
                {isRetrying ? (
                  <ActivityIndicator color={colors.background.primary} size="small" />
                ) : (
                  <Text style={styles.primaryButtonText}>Try again</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={handleReturnToAnchorPress}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Return to Anchor"
              >
                <Text style={styles.secondaryButtonText}>Return to Anchor</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#050208',
  },
  webviewContainer: {
    flex: 1,
    backgroundColor: '#050208',
  },
  webview: {
    flex: 1,
    backgroundColor: '#050208',
  },
  syncOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  syncText: {
    fontFamily: 'CrimsonPro-Regular',
    fontSize: 13,
    color: 'rgba(232,223,200,0.65)',
  },
  resultContainer: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingBottom: 40,
  },
  resultTitle: {
    fontFamily: 'Cinzel-Regular',
    fontSize: 26,
    color: '#E8DFC8',
    letterSpacing: 2,
    textAlign: 'center',
  },
  resultDivider: {
    width: 60,
    height: 1,
    marginTop: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: 'rgba(201,168,76,0.45)',
  },
  resultSubtitle: {
    fontFamily: 'CrimsonPro-Italic',
    fontSize: 15,
    color: 'rgba(232,223,200,0.52)',
    textAlign: 'center',
    lineHeight: 25,
    maxWidth: 280,
  },
  ashLine: {
    marginTop: spacing.lg,
    fontFamily: typography.fonts.body,
    fontSize: 15,
    fontStyle: 'italic',
    color: colors.bone,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: spacing.xl,
  },
  primaryButton: {
    marginTop: spacing.xl,
    minWidth: SCREEN_WIDTH * 0.72,
    paddingVertical: spacing.md,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gold,
    shadowColor: colors.gold,
    shadowOpacity: 0.38,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  primaryButtonDisabled: {
    opacity: 0.55,
  },
  primaryButtonText: {
    fontFamily: typography.fonts.bodyBold,
    fontSize: typography.sizes.button,
    color: colors.background.primary,
    letterSpacing: 0.8,
  },
  secondaryButton: {
    marginTop: spacing.md,
    minWidth: SCREEN_WIDTH * 0.72,
    paddingVertical: spacing.md,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.ritual.border,
    backgroundColor: 'rgba(15, 20, 25, 0.66)',
  },
  secondaryButtonText: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.body1,
    color: colors.text.primary,
  },
});
