import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Dimensions,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { useNavigation } from '@react-navigation/native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { WebView } from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';
import { useReduceMotionEnabled } from '@/hooks/useReduceMotionEnabled';
import { colors, spacing, typography } from '@/theme';
import { logger } from '@/utils/logger';
import { burnRitualWebViewHtml } from './burnRitualWebViewHtml';

type CommitStatus = 'pending' | 'success' | 'error';
type OverlayState = 'animating' | 'syncing' | 'success' | 'error';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const DEFAULT_ERROR_MESSAGE = "Couldn't complete release. Try again.";
const MAX_INJECTED_IMAGE_DATA_URI_BYTES = 450_000;
const BURN_SIGIL_SIZE = Math.min(SCREEN_WIDTH * 0.58, 240);
const BURN_NATIVE_ARTWORK_SIZE = BURN_SIGIL_SIZE * 0.82;
const AnimatedImage = Animated.createAnimatedComponent(Image);

export type BurnCommitFn = () => Promise<void>;

export interface BurnAnimationOverlayProps {
  sigilSvg: string;
  enhancedImageUrl?: string;
  onCommitBurn: BurnCommitFn;
  onReturnToSanctuary: () => void;
  onReturnToAnchor?: () => void;
  /** Ash Line (Pattern 8): bone-text whisper shown below subtitle in Phase 4 success. */
  ashLineText?: string;
  isCharged: boolean;
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
  isCharged?: boolean;
};

const isInlineRenderableUri = (uri: string): boolean => uri.startsWith('data:');

const isRemoteUri = (uri: string): boolean => /^https?:/i.test(uri);

const isDeviceFileUri = (uri: string): boolean => /^(file|content|ph|assets-library):/i.test(uri);

const inferMimeTypeFromUri = (uri: string): string => {
  const normalizedPath = uri.split('?')[0]?.toLowerCase() ?? '';

  if (normalizedPath.endsWith('.jpg') || normalizedPath.endsWith('.jpeg')) {
    return 'image/jpeg';
  }
  if (normalizedPath.endsWith('.webp')) {
    return 'image/webp';
  }
  if (normalizedPath.endsWith('.gif')) {
    return 'image/gif';
  }
  if (normalizedPath.endsWith('.heic')) {
    return 'image/heic';
  }
  if (normalizedPath.endsWith('.svg')) {
    return 'image/svg+xml';
  }

  return 'image/png';
};

const readDeviceFileUriAsDataUri = async (uri: string): Promise<string> => {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return `data:${inferMimeTypeFromUri(uri)};base64,${base64}`;
};

const getFileExtensionFromMimeType = (mimeType: string): string => {
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'image/gif') return 'gif';
  if (mimeType === 'image/heic') return 'heic';
  if (mimeType === 'image/svg+xml') return 'svg';
  return 'png';
};

const writeInlineImageDataUriToCache = async (uri: string): Promise<string> => {
  const match = uri.match(/^data:([^;,]+);base64,(.*)$/);
  const cacheDirectory = FileSystem.cacheDirectory;
  if (!match || !cacheDirectory) {
    return uri;
  }

  const mimeType = match[1] || 'image/png';
  const base64 = match[2] || '';
  const extension = getFileExtensionFromMimeType(mimeType);
  const fileUri = `${cacheDirectory}burn-artwork-${Date.now()}.${extension}`;

  await FileSystem.writeAsStringAsync(fileUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return fileUri;
};

const encodeArrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';

  for (let index = 0; index < bytes.length; index += 3) {
    const byte1 = bytes[index] ?? 0;
    const byte2 = bytes[index + 1] ?? 0;
    const byte3 = bytes[index + 2] ?? 0;

    const encoded1 = byte1 >> 2;
    const encoded2 = ((byte1 & 3) << 4) | (byte2 >> 4);
    const encoded3 = ((byte2 & 15) << 2) | (byte3 >> 6);
    const encoded4 = byte3 & 63;

    result += chars[encoded1];
    result += chars[encoded2];
    result += index + 1 < bytes.length ? chars[encoded3] : '=';
    result += index + 2 < bytes.length ? chars[encoded4] : '=';
  }

  return result;
};

const readRemoteUriAsDataUri = async (uri: string): Promise<string> => {
  const response = await fetch(uri);
  if (!response.ok) {
    throw new Error(`Burn artwork request failed with ${response.status}`);
  }

  const contentLength = Number(response.headers.get('content-length') ?? 0);
  if (contentLength > MAX_INJECTED_IMAGE_DATA_URI_BYTES) {
    return uri;
  }

  const responseContentType = response.headers.get('content-type') || '';
  const contentType = responseContentType.startsWith('image/')
    ? responseContentType
    : inferMimeTypeFromUri(uri);
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > MAX_INJECTED_IMAGE_DATA_URI_BYTES) {
    return uri;
  }

  const base64 = encodeArrayBufferToBase64(buffer);

  return `data:${contentType};base64,${base64}`;
};

const resolveWebViewImageUri = async (uri: string): Promise<string> => {
  if (isInlineRenderableUri(uri)) {
    if (uri.length > MAX_INJECTED_IMAGE_DATA_URI_BYTES) {
      return writeInlineImageDataUriToCache(uri);
    }

    return uri;
  }

  if (isRemoteUri(uri)) {
    return readRemoteUriAsDataUri(uri);
  }

  if (isDeviceFileUri(uri)) {
    return readDeviceFileUriAsDataUri(uri);
  }

  return uri;
};

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
  isCharged,
}) => {
  const navigation = useNavigation<any>();
  const reduceMotionEnabled = useReduceMotionEnabled();

  const [overlayState, setOverlayState] = useState<OverlayState>('animating');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isRetrying, setIsRetrying] = useState(false);
  const [resolvedWebViewSigilUri, setResolvedWebViewSigilUri] = useState<string | undefined>(undefined);
  const [isWebViewSigilReady, setIsWebViewSigilReady] = useState(false);
  const [isWebViewLoaded, setIsWebViewLoaded] = useState(false);

  const ashLineOpacity = useSharedValue(0);
  const nativeArtworkOpacity = useSharedValue(1);
  const nativeArtworkScale = useSharedValue(1);
  const nativeArtworkTranslateY = useSharedValue(0);

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

  const sigilUri = useMemo(() => enhancedImageUrl || fallbackSigilUri, [enhancedImageUrl, fallbackSigilUri]);
  const hasEnhancedArtwork = Boolean(enhancedImageUrl);

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

      try {
        const dataUri = await resolveWebViewImageUri(sigilUri);

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
    const timer = setTimeout(() => {
      timersRef.current = timersRef.current.filter((queuedTimer) => queuedTimer !== timer);
      fn();
    }, delay);
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
      webViewRef.current?.postMessage(JSON.stringify({ cmd: 'cleanup' }));
    };
  }, [clearTimers, runInitialCommit]);

  const showCancelRitualDialog = useCallback((onConfirm: () => void) => {
    Alert.alert(
      'Cancel Ritual?',
      'Cancelling will stop the burn. Your anchor will not be released.',
      [
        { text: 'Continue Ritual', style: 'cancel' },
        { text: 'Cancel', style: 'destructive', onPress: onConfirm },
      ]
    );
  }, []);

  useEffect(() => {
    navigation.setOptions({ gestureEnabled: false });

    const beforeRemoveUnsubscribe = navigation.addListener('beforeRemove', (event: any) => {
      if (!isLockedRef.current) return;
      event.preventDefault();
      showCancelRitualDialog(() => {
        isLockedRef.current = false;
        navigation.setOptions({ gestureEnabled: true });
        navigation.dispatch(event.data.action);
      });
    });

    const hardwareBackSubscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!isLockedRef.current) return false;
      showCancelRitualDialog(() => {
        isLockedRef.current = false;
        navigation.setOptions({ gestureEnabled: true });
        navigation.goBack();
      });
      return true;
    });

    return () => {
      beforeRemoveUnsubscribe();
      hardwareBackSubscription.remove();
      navigation.setOptions({ gestureEnabled: true });
    };
  }, [navigation, showCancelRitualDialog]);

  const ashLineStyle = useAnimatedStyle(() => ({ opacity: ashLineOpacity.value }));
  const nativeArtworkStyle = useAnimatedStyle(() => ({
    opacity: nativeArtworkOpacity.value,
    transform: [
      { scale: nativeArtworkScale.value },
      { translateY: nativeArtworkTranslateY.value },
    ],
  }));

  const injectStartPayload = useCallback(() => {
    if (startInjectedRef.current || !isWebViewLoaded || !isWebViewSigilReady) {
      return;
    }

    startInjectedRef.current = true;
    nativeArtworkOpacity.value = 1;
    nativeArtworkScale.value = 1;
    nativeArtworkTranslateY.value = 0;
    if (hasEnhancedArtwork) {
      queueTimer(() => {
        nativeArtworkOpacity.value = withTiming(0, {
          duration: reduceMotionEnabled ? 0 : 3200,
          easing: Easing.out(Easing.cubic),
        });
        nativeArtworkScale.value = withTiming(0.74, {
          duration: reduceMotionEnabled ? 0 : 3200,
          easing: Easing.out(Easing.cubic),
        });
        nativeArtworkTranslateY.value = withTiming(-BURN_NATIVE_ARTWORK_SIZE * 0.18, {
          duration: reduceMotionEnabled ? 0 : 3200,
          easing: Easing.out(Easing.cubic),
        });
      }, reduceMotionEnabled ? 0 : 900);
    }

    webViewRef.current?.injectJavaScript(
      buildStartScript({
        cmd: 'start',
        sigilUri: resolvedWebViewSigilUri,
        fallbackSigilUri: hasEnhancedArtwork ? undefined : fallbackSigilUri,
        isCharged,
      })
    );
  }, [
    fallbackSigilUri,
    hasEnhancedArtwork,
    isCharged,
    isWebViewLoaded,
    isWebViewSigilReady,
    nativeArtworkOpacity,
    nativeArtworkScale,
    nativeArtworkTranslateY,
    queueTimer,
    reduceMotionEnabled,
    resolvedWebViewSigilUri,
  ]);

  const handleWebViewLoad = useCallback(() => {
    setIsWebViewLoaded(true);
  }, []);

  useEffect(() => {
    injectStartPayload();
  }, [injectStartPayload]);

  const handleWebViewMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const payload = JSON.parse(event.nativeEvent.data);
        if (payload?.event === 'burnComplete') {
          handleAnimationComplete();
          return;
        }

        if (payload?.event === 'burnArtworkLoaded') {
          logger.info('[BurnAnimationOverlay] Burn artwork loaded', {
            usedFallback: Boolean(payload.usedFallback),
            sourceType: resolvedWebViewSigilUri?.startsWith('data:')
              ? 'data'
              : resolvedWebViewSigilUri?.startsWith('file:')
                ? 'file'
                : resolvedWebViewSigilUri?.startsWith('http')
                  ? 'remote'
                  : 'unknown',
          });
          return;
        }

        if (payload?.event === 'burnArtworkError') {
          logger.warn('[BurnAnimationOverlay] Burn artwork failed in WebView', {
            stage: payload.stage,
            sourceType: resolvedWebViewSigilUri?.startsWith('data:')
              ? 'data'
              : resolvedWebViewSigilUri?.startsWith('file:')
                ? 'file'
                : resolvedWebViewSigilUri?.startsWith('http')
                  ? 'remote'
                  : 'unknown',
          });
        }
      } catch {
        // Ignore non-JSON bridge messages.
      }
    },
    [handleAnimationComplete, resolvedWebViewSigilUri]
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
            mixedContentMode="always"
            allowFileAccess
            allowFileAccessFromFileURLs
            allowUniversalAccessFromFileURLs
            scrollEnabled={false}
            bounces={false}
            overScrollMode="never"
            showsVerticalScrollIndicator={false}
            showsHorizontalScrollIndicator={false}
          />

          {hasEnhancedArtwork && resolvedWebViewSigilUri ? (
            <AnimatedImage
              source={{ uri: resolvedWebViewSigilUri }}
              style={[styles.nativeArtwork, nativeArtworkStyle]}
              resizeMode="cover"
              onLoad={() => {
                logger.info('[BurnAnimationOverlay] Native burn artwork loaded');
              }}
              onError={() => {
                logger.warn('[BurnAnimationOverlay] Native burn artwork failed');
              }}
            />
          ) : null}

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
  nativeArtwork: {
    position: 'absolute',
    left: (SCREEN_WIDTH - BURN_NATIVE_ARTWORK_SIZE) / 2,
    top: (SCREEN_HEIGHT - BURN_NATIVE_ARTWORK_SIZE) / 2,
    width: BURN_NATIVE_ARTWORK_SIZE,
    height: BURN_NATIVE_ARTWORK_SIZE,
    borderRadius: BURN_NATIVE_ARTWORK_SIZE / 2,
    zIndex: 3,
    opacity: 0.92,
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
