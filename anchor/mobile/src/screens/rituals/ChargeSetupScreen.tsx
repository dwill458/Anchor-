import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  BackHandler,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { type StackNavigationProp } from '@react-navigation/stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useAnchorStore } from '@/stores/anchorStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { safeHaptics } from '@/utils/haptics';
import type { Anchor, RootStackParamList } from '@/types';
import { spacing } from '@/theme';

type ChargeSetupRouteProp = RouteProp<RootStackParamList, 'ChargeSetup'>;
type ChargeSetupNavigationProp = StackNavigationProp<RootStackParamList, 'ChargeSetup'>;
type DurationChoice = 'quick' | 'deep';

const NAVY = '#0F1419';
const GOLD = '#D4AF37';
const GOLD_DIM = '#A8892A';
const BONE = '#F5F5DC';
const SILVER = '#C0C0C0';
const BLACK = '#080C10';
const PANEL_OVERLAP = 24;

const FALLBACK_SIGIL_SVG = `
<svg viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <circle cx="120" cy="120" r="86" fill="rgba(8,12,16,0.74)" stroke="rgba(212,175,55,0.28)" stroke-width="2"/>
  <path
    d="M72 90h96M72 90l34 68h58M168 90l-62 68"
    fill="none"
    stroke="#D4AF37"
    stroke-width="6"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
</svg>
`.trim();

const PRIME_WEBVIEW_HTML = `
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: radial-gradient(ellipse 70% 60% at 50% 55%, #1a2a18 0%, #0d1a0e 40%, #080C10 100%);
    width: 100vw;
    height: 100vh;
    overflow: hidden;
    position: relative;
  }
  body.reduce-motion *,
  body.reduce-motion *::before,
  body.reduce-motion *::after {
    animation: none !important;
    transition: none !important;
  }
  .mist {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background:
      radial-gradient(ellipse 70% 50% at 50% 75%, rgba(212,175,55,0.07) 0%, transparent 65%),
      radial-gradient(ellipse 55% 30% at 50% 100%, rgba(62,44,91,0.35) 0%, transparent 55%);
  }
  .rings {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
  }
  .ring-base {
    position: absolute;
    width: 268px;
    height: 268px;
    border-radius: 50%;
    border: 1px solid rgba(212,175,55,0.10);
  }
  .ring-rotate {
    position: absolute;
    width: 300px;
    height: 300px;
    border-radius: 50%;
    border: 1px dashed rgba(212,175,55,0.14);
    animation: slow-rotate 18s linear infinite;
  }
  .ring-breathe {
    position: absolute;
    width: 334px;
    height: 334px;
    border-radius: 50%;
    border: 1px solid rgba(212,175,55,0.07);
    animation: breathe-ring 4s ease-in-out infinite;
  }
  @keyframes slow-rotate { to { transform: rotate(360deg); } }
  @keyframes breathe-ring {
    0%,100% { opacity: 0.4; transform: scale(1); }
    50% { opacity: 1; transform: scale(1.025); }
  }
  #glow-canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }
  .medallion-wrap {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .medallion {
    width: 220px;
    height: 220px;
    position: relative;
    animation: float-medallion 6s ease-in-out infinite;
  }
  @keyframes float-medallion {
    0%,100% { transform: translateY(0px); }
    50% { transform: translateY(-9px); }
  }
  .aura-outer {
    position: absolute;
    inset: -50px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(212,175,55,0.10) 0%, transparent 65%);
    animation: aura-outer 4s ease-in-out infinite;
  }
  .aura-mid {
    position: absolute;
    inset: -28px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(212,175,55,0.20) 0%, transparent 60%);
    animation: aura-mid 4s ease-in-out infinite 0.5s;
  }
  .aura-inner {
    position: absolute;
    inset: -10px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(240,203,85,0.30) 0%, transparent 55%);
    animation: aura-inner 3s ease-in-out infinite 0.25s;
  }
  @keyframes aura-outer {
    0%,100% { opacity: 0.5; transform: scale(1); }
    50% { opacity: 1; transform: scale(1.12); }
  }
  @keyframes aura-mid {
    0%,100% { opacity: 0.6; transform: scale(1); }
    50% { opacity: 1; transform: scale(1.08); }
  }
  @keyframes aura-inner {
    0%,100% { opacity: 0.7; transform: scale(1); }
    50% { opacity: 1; transform: scale(1.05); }
  }
  .medallion-svg {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: sigil-glow 3s ease-in-out infinite;
  }
  .medallion-svg svg {
    width: 100%;
    height: 100%;
    display: block;
  }
  .medallion-svg img {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: cover;
    border-radius: 50%;
  }
  @keyframes sigil-glow {
    0%,100% { filter: drop-shadow(0 0 10px rgba(212,175,55,0.35)) drop-shadow(0 0 30px rgba(212,175,55,0.15)); }
    50% { filter: drop-shadow(0 0 18px rgba(240,203,85,0.7)) drop-shadow(0 0 50px rgba(212,175,55,0.30)); }
  }
  .ground-glow {
    position: absolute;
    bottom: -12px;
    left: 50%;
    transform: translateX(-50%);
    width: 200px;
    height: 40px;
    border-radius: 50%;
    background: radial-gradient(ellipse, rgba(212,175,55,0.28) 0%, transparent 70%);
    filter: blur(6px);
    animation: ground-breathe 4s ease-in-out infinite;
    pointer-events: none;
  }
  @keyframes ground-breathe {
    0%,100% { opacity: 0.6; transform: translateX(-50%) scaleX(1); }
    50% { opacity: 1; transform: translateX(-50%) scaleX(1.15); }
  }
</style>
</head>
<body>
  <div class="mist"></div>
  <canvas id="glow-canvas"></canvas>
  <div class="rings">
    <div class="ring-base"></div>
    <div class="ring-rotate"></div>
    <div class="ring-breathe"></div>
  </div>
  <div class="medallion-wrap">
    <div class="medallion">
      <div class="aura-outer"></div>
      <div class="aura-mid"></div>
      <div class="aura-inner"></div>
      <div class="medallion-svg" id="sigil-host">SIGIL_CONTENT_PLACEHOLDER</div>
      <div class="ground-glow"></div>
    </div>
  </div>
<script>
  const REDUCE_MOTION = REDUCE_MOTION_PLACEHOLDER;
  if (REDUCE_MOTION) {
    document.body.classList.add('reduce-motion');
  }

  const canvas = document.getElementById('glow-canvas');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const ctx = canvas.getContext('2d');
  const CX = canvas.width / 2;
  const CY = canvas.height / 2;

  const ripples = [];
  function spawnRipple() {
    ripples.push({ r: 110, opacity: 0.6, speed: 0.8 });
  }

  const PARTICLE_COUNT = 28;
  const particles = [];
  function spawnParticle(phase) {
    return {
      angle: Math.random() * Math.PI * 2,
      orbitR: 110 + Math.random() * 80,
      driftAngle: Math.random() * Math.PI * 2,
      driftSpeed: 0.0004 + Math.random() * 0.0006,
      size: 1 + Math.random() * 2,
      life: phase !== undefined ? phase : Math.random(),
      lifeSpeed: 0.003 + Math.random() * 0.004,
      twinklePhase: Math.random() * Math.PI * 2,
      twinkleSpeed: 0.04 + Math.random() * 0.06
    };
  }
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    particles.push(spawnParticle(i / PARTICLE_COUNT));
  }

  function drawFrame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = ripples.length - 1; i >= 0; i--) {
      const rp = ripples[i];
      if (!REDUCE_MOTION) {
        rp.r += rp.speed;
        rp.opacity -= 0.0028;
      }
      if (rp.opacity <= 0) {
        ripples.splice(i, 1);
        continue;
      }

      ctx.beginPath();
      ctx.arc(CX, CY, rp.r, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(212,175,55,' + (rp.opacity * 0.7) + ')';
      ctx.lineWidth = 1;
      ctx.stroke();

      if (rp.opacity > 0.4) {
        const g = ctx.createRadialGradient(CX, CY, rp.r - 20, CX, CY, rp.r + 8);
        g.addColorStop(0, 'rgba(212,175,55,0)');
        g.addColorStop(0.5, 'rgba(212,175,55,' + ((rp.opacity - 0.4) * 0.06) + ')');
        g.addColorStop(1, 'rgba(212,175,55,0)');
        ctx.beginPath();
        ctx.arc(CX, CY, rp.r + 8, 0, Math.PI * 2);
        ctx.fillStyle = g;
        ctx.fill();
      }
    }

    for (const p of particles) {
      if (!REDUCE_MOTION) {
        p.life += p.lifeSpeed;
        if (p.life >= 1) {
          Object.assign(p, spawnParticle(0));
          continue;
        }
        p.driftAngle += p.driftSpeed;
        p.twinklePhase += p.twinkleSpeed;
      }

      const rise = p.life * 110;
      const spread = Math.sin(p.driftAngle) * 30;
      const px = CX + Math.cos(p.angle) * (p.orbitR + spread) * (1 - p.life * 0.4);
      const py = CY + Math.sin(p.angle) * (p.orbitR + spread) * (1 - p.life * 0.3) - rise;

      let opacity = p.life < 0.2 ? p.life / 0.2 : p.life < 0.7 ? 1 : 1 - (p.life - 0.7) / 0.3;
      opacity *= 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(p.twinklePhase));
      const alpha = opacity * 0.85;

      const bloom = ctx.createRadialGradient(px, py, 0, px, py, p.size * 5);
      bloom.addColorStop(0, 'rgba(240,203,85,' + (alpha * 0.5) + ')');
      bloom.addColorStop(1, 'rgba(212,175,55,0)');
      ctx.beginPath();
      ctx.arc(px, py, p.size * 5, 0, Math.PI * 2);
      ctx.fillStyle = bloom;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(px, py, p.size, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,235,130,' + alpha + ')';
      ctx.fill();
    }
  }

  if (REDUCE_MOTION) {
    ripples.push({ r: 128, opacity: 0.22, speed: 0 });
    drawFrame();
  } else {
    setInterval(spawnRipple, 2200);
    spawnRipple();
    function draw() {
      drawFrame();
      requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);
  }
</script>
</body>
</html>
`.trim();

const chargeConfigByChoice = {
  quick: {
    mode: 'focus' as const,
    preset: '30s' as const,
    customMinutes: undefined,
    ritualType: 'focus' as const,
    durationSeconds: 30,
    icon: '⚡',
    name: 'Quick Prime',
    lineOne: '30 seconds',
    lineTwo: 'Daily reset',
  },
  deep: {
    mode: 'ritual' as const,
    preset: 'custom' as const,
    customMinutes: 3,
    ritualType: 'ritual' as const,
    durationSeconds: 180,
    icon: '🔥',
    name: 'Deep Prime',
    lineOne: '3 minutes',
    lineTwo: 'Deep focus',
  },
};

const stripUnsafeSvgTags = (markup: string): string =>
  markup
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '')
    .replace(/<(?:iframe|object|embed|audio|video|canvas|style)\b[\s\S]*?<\/(?:iframe|object|embed|audio|video|canvas|style)>/gi, '');

const stripUnsafeSvgAttributes = (markup: string): string =>
  markup
    .replace(/\son[a-z0-9_-]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s(?:href|xlink:href|src)\s*=\s*("|')((?:(?!\1).)*)\1/gi, (_match, quote, value: string) => {
      const trimmedValue = value.trim();
      return trimmedValue.startsWith('#') ? ` href=${quote}${trimmedValue}${quote}` : '';
    })
    .replace(/\s(?:href|xlink:href|src)\s*=\s*([^\s>]+)/gi, (_match, value: string) => {
      const trimmedValue = value.trim();
      return trimmedValue.startsWith('#') ? ` href="${trimmedValue}"` : '';
    })
    .replace(/\s[a-z0-9:_-]+\s*=\s*("|')\s*javascript:[\s\S]*?\1/gi, '')
    .replace(/\sstyle\s*=\s*("|')[\s\S]*?url\s*\([\s\S]*?\)[\s\S]*?\1/gi, '');

const sanitizeSvgMarkup = (svg?: string): string => {
  if (!svg) return FALLBACK_SIGIL_SVG;

  const normalized = svg
    .replace(/<\?xml[\s\S]*?\?>/gi, '')
    .replace(/<!DOCTYPE[\s\S]*?>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .trim();

  if (!/^<svg[\s>][\s\S]*<\/svg>$/i.test(normalized)) {
    return FALLBACK_SIGIL_SVG;
  }

  const withoutUnsafeTags = stripUnsafeSvgTags(normalized);
  const sanitized = stripUnsafeSvgAttributes(withoutUnsafeTags).trim();

  if (
    /<(?:script|foreignObject|iframe|object|embed|audio|video|canvas|style)\b/i.test(sanitized) ||
    /\son[a-z0-9_-]+\s*=\s*/i.test(sanitized) ||
    /\s(?:href|xlink:href|src)\s*=\s*("|')\s*(?!#)/i.test(sanitized)
  ) {
    return FALLBACK_SIGIL_SVG;
  }

  return /<svg[\s>]/i.test(sanitized) ? sanitized : FALLBACK_SIGIL_SVG;
};

const escapeHtmlAttribute = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const isAllowedImageUrl = (imageUrl?: string): imageUrl is string => {
  if (!imageUrl) return false;

  const trimmedUrl = imageUrl.trim();
  if (!trimmedUrl) return false;

  try {
    const parsedUrl = new URL(trimmedUrl);
    return parsedUrl.protocol.toLowerCase() === 'https:';
  } catch {
    return false;
  }
};

const getPrimeSigilMarkup = (anchor?: Anchor): string => {
  if (isAllowedImageUrl(anchor?.enhancedImageUrl)) {
    return `<img src="${escapeHtmlAttribute(anchor.enhancedImageUrl)}" alt="" />`;
  }

  return sanitizeSvgMarkup(anchor?.reinforcedSigilSvg ?? anchor?.baseSigilSvg);
};

const buildPrimeWebViewHtml = (sigilMarkup: string, reduceMotionEnabled: boolean): string =>
  PRIME_WEBVIEW_HTML
    .replace('SIGIL_CONTENT_PLACEHOLDER', sigilMarkup)
    .replace('REDUCE_MOTION_PLACEHOLDER', reduceMotionEnabled ? 'true' : 'false');

export const ChargeSetupScreen: React.FC = () => {
  const navigation = useNavigation<ChargeSetupNavigationProp>();
  const route = useRoute<ChargeSetupRouteProp>();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const { anchorId, returnTo, autoStartOnSelection = false } = route.params || {};

  const getAnchorById = useAnchorStore((state) => state.getAnchorById);
  const setDefaultCharge = useSettingsStore((state) => state.setDefaultCharge);
  const anchor = getAnchorById(anchorId);

  const [selectedDuration, setSelectedDuration] = useState<DurationChoice>('quick');
  const [reduceMotionEnabled, setReduceMotionEnabled] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const isNavigatingRef = useRef(false);
  const heroHeight = Math.max(360, Math.min(500, Math.round(screenHeight * 0.55)));

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotionEnabled);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotionEnabled);
    return () => subscription.remove();
  }, []);

  useFocusEffect(
    useCallback(() => {
      isNavigatingRef.current = false;
      setIsTransitioning(false);

      const onBackPress = () => isTransitioning;
      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [isTransitioning])
  );

  const webViewHtml = useMemo(
    () => buildPrimeWebViewHtml(getPrimeSigilMarkup(anchor), reduceMotionEnabled),
    [anchor, reduceMotionEnabled]
  );

  const navigateToRitual = useCallback(
    (choice: DurationChoice) => {
      const config = chargeConfigByChoice[choice];
      navigation.navigate('Ritual', {
        anchorId,
        ritualType: config.ritualType,
        durationSeconds: config.durationSeconds,
        returnTo,
      });
    },
    [anchorId, navigation, returnTo]
  );

  const handleBeginRitual = useCallback(
    (choice: DurationChoice = selectedDuration) => {
      if (isNavigatingRef.current || isTransitioning) return;

      const config = chargeConfigByChoice[choice];
      isNavigatingRef.current = true;
      setIsTransitioning(true);

      setDefaultCharge({
        mode: config.mode,
        preset: config.preset,
        customMinutes: config.customMinutes,
      });

      void safeHaptics.impact(Haptics.ImpactFeedbackStyle.Medium);
      navigateToRitual(choice);
    },
    [isTransitioning, navigateToRitual, selectedDuration, setDefaultCharge]
  );

  const handleSelectDuration = useCallback(
    (choice: DurationChoice) => {
      if (isTransitioning) return;
      setSelectedDuration(choice);
      void safeHaptics.selection();

      if (autoStartOnSelection) {
        handleBeginRitual(choice);
      }
    },
    [autoStartOnSelection, handleBeginRitual, isTransitioning]
  );

  const handleBack = useCallback(() => {
    if (isTransitioning) return;
    if (autoStartOnSelection) {
      // Came from creation flow — navigate to Vault so the new anchor is visible
      navigation.navigate('Vault');
    } else {
      navigation.goBack();
    }
  }, [isTransitioning, navigation, autoStartOnSelection]);

  if (!anchorId || !anchor) {
    return (
      <View style={styles.screen}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Anchor Not Found</Text>
          <Text style={styles.errorText}>We could not load your anchor. Please try again.</Text>
          <TouchableOpacity
            style={styles.errorButton}
            onPress={handleBack}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Go Back"
          >
            <Text style={styles.errorButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const cards = (['quick', 'deep'] as const).map((choice) => ({
    choice,
    ...chargeConfigByChoice[choice],
    isSelected: selectedDuration === choice,
  }));

  return (
    <View style={styles.screen}>
      <View style={[styles.heroSection, { height: heroHeight }]}>
        <WebView
          originWhitelist={['about:blank']}
          source={{ html: webViewHtml, baseUrl: 'about:blank' }}
          setSupportMultipleWindows={false}
          javaScriptCanOpenWindowsAutomatically={false}
          allowingReadAccessToURL={'about:blank'}
          allowFileAccess={false}
          allowFileAccessFromFileURLs={false}
          allowUniversalAccessFromFileURLs={false}
          mixedContentMode="never"
          onShouldStartLoadWithRequest={(request) => request.url === 'about:blank'}
          style={styles.webview}
          scrollEnabled={false}
          bounces={false}
          overScrollMode="never"
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
        />

        <View style={[styles.navBar, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity
            onPress={handleBack}
            activeOpacity={0.82}
            accessibilityRole="button"
            accessibilityLabel="Close prime selection"
            disabled={isTransitioning}
            style={styles.navButton}
          >
            <BlurView intensity={18} tint="dark" style={styles.navBlur}>
              <Text style={styles.closeButtonText}>✕</Text>
            </BlurView>
          </TouchableOpacity>

          <View style={styles.titleShell}>
            <BlurView intensity={18} tint="dark" style={styles.titleBlur}>
              <Text style={styles.navTitle}>Prime Your Anchor</Text>
            </BlurView>
          </View>
        </View>
      </View>

      <View style={[styles.panel, { marginTop: -PANEL_OVERLAP, paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
        <LinearGradient
          colors={['transparent', 'rgba(212,175,55,0.5)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.panelSeam}
        />

        <ScrollView
          bounces={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.panelContent}
        >
          <View style={styles.badgeRow}>
            <LinearGradient
              colors={['transparent', 'rgba(212,175,55,0.3)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.badgeLine}
            />
            <Text style={styles.badgeText}>YOUR ANCHOR IS FORGED</Text>
            <LinearGradient
              colors={['rgba(212,175,55,0.3)', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.badgeLine}
            />
          </View>

          <Text style={styles.headline}>Set Your Intention in Motion</Text>
          <Text style={styles.subline}>Hold focus on your anchor.{'\n'}Choose how long to prime.</Text>
          <Text style={styles.durationLabel}>SELECT DURATION</Text>

          <View style={styles.cardsRow}>
            {cards.map((card) => (
              <TouchableOpacity
                key={card.choice}
                activeOpacity={0.88}
                onPress={() => handleSelectDuration(card.choice)}
                accessibilityRole="radio"
                accessibilityLabel={`${card.name} duration`}
                accessibilityState={{ selected: card.isSelected }}
                disabled={isTransitioning}
                style={[styles.durationCard, card.isSelected ? styles.durationCardSelected : null]}
              >
                {card.isSelected ? (
                  <View style={styles.checkCircle}>
                    <Text style={styles.checkText}>✓</Text>
                  </View>
                ) : null}
                <Text style={styles.cardIcon}>{card.icon}</Text>
                <Text style={[styles.cardName, card.isSelected ? styles.cardNameSelected : null]}>{card.name}</Text>
                <Text style={styles.cardLine}>{card.lineOne}</Text>
                <Text style={styles.cardLine}>{card.lineTwo}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            onPress={() => handleBeginRitual()}
            activeOpacity={0.9}
            disabled={isTransitioning}
            accessibilityRole="button"
            accessibilityLabel="BEGIN PRIMING"
            style={styles.ctaTouchable}
          >
            <LinearGradient
              colors={['#C9A227', '#D4AF37', '#E8C84A']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.ctaButton}
            >
              <Text style={styles.ctaText}>BEGIN PRIMING</Text>
            </LinearGradient>
          </TouchableOpacity>

          <Text style={styles.safetyText}>You can stop anytime.</Text>
        </ScrollView>
      </View>

      {/*
        DEFERRED: old ChargeSetupScreen UI
        <ScrollView>{legacy ChargedGlowCanvas/PremiumAnchorGlow prime-selection layout}</ScrollView>
      */}
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BLACK,
  },
  heroSection: {
    width: '100%',
    backgroundColor: BLACK,
    overflow: 'hidden',
  },
  webview: {
    flex: 1,
    backgroundColor: BLACK,
  },
  navBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
  },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
  },
  navBlur: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.25)',
    backgroundColor: 'rgba(8,12,16,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    color: SILVER,
    fontSize: 16,
    lineHeight: 16,
    marginTop: Platform.OS === 'android' ? -1 : 0,
  },
  titleShell: {
    flex: 1,
    marginRight: 52,
    borderRadius: 24,
    overflow: 'hidden',
  },
  titleBlur: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.25)',
    backgroundColor: 'rgba(8,12,16,0.7)',
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  navTitle: {
    fontFamily: 'Cinzel-Regular',
    fontSize: 13,
    letterSpacing: 1.6,
    color: GOLD,
    textAlign: 'center',
  },
  panel: {
    flex: 1,
    backgroundColor: NAVY,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderTopColor: 'rgba(212,175,55,0.2)',
    zIndex: 5,
  },
  panelSeam: {
    position: 'absolute',
    top: 0,
    left: '20%',
    right: '20%',
    height: 1,
  },
  panelContent: {
    paddingTop: 32,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  badgeLine: {
    flex: 1,
    height: 1,
  },
  badgeText: {
    fontFamily: 'Cinzel-Regular',
    fontSize: 9,
    letterSpacing: 3.5,
    color: GOLD_DIM,
    textAlign: 'center',
  },
  headline: {
    fontFamily: 'Cinzel-SemiBold',
    fontSize: 26,
    lineHeight: 32,
    color: BONE,
    textAlign: 'center',
    marginBottom: 10,
  },
  subline: {
    fontFamily: 'CormorantGaramond-Italic',
    fontSize: 16,
    lineHeight: 22,
    color: SILVER,
    opacity: 0.85,
    textAlign: 'center',
    marginBottom: 28,
  },
  durationLabel: {
    fontFamily: 'Cinzel-Regular',
    fontSize: 9,
    letterSpacing: 3,
    color: GOLD_DIM,
    textAlign: 'center',
    marginBottom: 14,
  },
  cardsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  durationCard: {
    flex: 1,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 12,
    paddingVertical: 18,
    minHeight: 144,
  },
  durationCardSelected: {
    borderColor: 'rgba(212,175,55,0.45)',
    backgroundColor: 'rgba(212,175,55,0.10)',
    shadowColor: GOLD,
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  checkCircle: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 12,
  },
  cardIcon: {
    fontSize: 26,
    marginBottom: 10,
  },
  cardName: {
    fontFamily: 'Cinzel-Regular',
    fontSize: 12,
    letterSpacing: 1,
    color: BONE,
    textAlign: 'center',
    marginBottom: 6,
  },
  cardNameSelected: {
    color: GOLD,
  },
  cardLine: {
    fontFamily: 'CormorantGaramond-Italic',
    fontSize: 12,
    lineHeight: 16,
    color: SILVER,
    opacity: 0.7,
    textAlign: 'center',
  },
  ctaTouchable: {
    width: '100%',
  },
  ctaButton: {
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: GOLD,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  ctaText: {
    fontFamily: 'Cinzel-Bold',
    fontSize: 13,
    letterSpacing: 3,
    color: BLACK,
  },
  safetyText: {
    marginTop: 14,
    fontFamily: 'CormorantGaramond-Italic',
    fontSize: 13,
    color: SILVER,
    opacity: 0.5,
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    backgroundColor: BLACK,
  },
  errorTitle: {
    fontFamily: 'Cinzel-SemiBold',
    fontSize: 24,
    color: BONE,
    marginBottom: spacing.md,
  },
  errorText: {
    fontFamily: 'CormorantGaramond-Italic',
    fontSize: 16,
    lineHeight: 22,
    color: SILVER,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  errorButton: {
    borderRadius: 14,
    backgroundColor: GOLD,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  errorButtonText: {
    fontFamily: 'Cinzel-Bold',
    fontSize: 13,
    letterSpacing: 1.4,
    color: BLACK,
  },
});
