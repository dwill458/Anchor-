import React, { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Image,
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  TrendingUp,
} from "lucide-react-native";
import { useFirstRunStore } from "@/stores/v2/firstRunStore";
import {
  LIFE_CHANGES,
  MOTIVATIONS,
  ONBOARDING_STEPS,
  PRIMARY_NEEDS,
  type OnboardingStep,
} from "@/constants/v2/onboarding";
import { colors } from "@/theme/v2";
import { useV2ReduceMotion, v2Haptics } from "@/hooks/v2";
import { detectCategoryFromText } from "@/utils/categoryDetection";

const panorama = require("@/assets/onboarding/welcome-panorama.jpg");
const story = require("@/assets/onboarding/personalization-story.jpg");
const desk = require("@/assets/onboarding/creation-desk.png");
const mark = require("@/assets/home/anchor-brand-mark-light.png");
const areaArt: Record<string, number> = {
  career: require("@/assets/onboarding/area-career.jpg"),
  health: require("@/assets/onboarding/area-health.jpg"),
  relationships: require("@/assets/onboarding/area-relationships.jpg"),
  creativity: require("@/assets/onboarding/area-creativity.jpg"),
  spirituality: require("@/assets/onboarding/area-spirituality.jpg"),
  abundance: require("@/assets/onboarding/area-abundance.jpg"),
  family: require("@/assets/onboarding/area-family.jpg"),
  learning: require("@/assets/onboarding/area-learning.jpg"),
  adventure: require("@/assets/onboarding/area-adventure.jpg"),
  desire: require("@/assets/onboarding/area-desire.jpg"),
  custom: require("@/assets/onboarding/area-custom.jpg"),
};
function areaFor(context: string): string {
  return detectCategoryFromText(context);
}

type Props = { onSignIn: () => void; onCreate: () => void };

function Cta({
  label,
  onPress,
  dark = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  dark?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.cta, dark && styles.ctaDark, disabled && styles.disabled]}
    >
      <Text style={[styles.ctaText, dark && styles.ctaTextLight]}>{label}</Text>
      <ArrowRight
        size={19}
        color={dark ? colors.surface : colors.text.primary}
      />
    </Pressable>
  );
}

function Header({
  step,
  onBack,
  dark,
}: {
  step: number;
  onBack: () => void;
  dark: boolean;
}) {
  return (
    <View style={styles.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        onPress={onBack}
        hitSlop={12}
        style={styles.back}
      >
        <ArrowLeft
          size={22}
          color={dark ? colors.surface : colors.text.primary}
        />
      </Pressable>
      <View
        style={[styles.progressTrack, dark && styles.progressTrackDark]}
        accessibilityLabel={`Step ${step} of 8`}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 1, max: 8, now: step }}
      >
        <View
          style={[
            styles.progressFill,
            { width: `${(step / 8) * 100}%` },
            dark && styles.progressFillDark,
          ]}
        />
      </View>
      <Text style={[styles.counter, dark && styles.lightText]}>{step} / 8</Text>
    </View>
  );
}

function ChoiceRow({
  label,
  selected,
  onPress,
  multi = false,
  dark = false,
  compact = false,
  accent,
  index,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  multi?: boolean;
  dark?: boolean;
  compact?: boolean;
  accent?: string;
  index?: number;
}) {
  return (
    <Pressable
      accessibilityRole={multi ? "checkbox" : "radio"}
      accessibilityLabel={label}
      accessibilityState={{ checked: selected, selected }}
      onPress={onPress}
      style={[
        styles.row,
        compact && styles.rowCompact,
        dark && styles.rowDark,
        selected && styles.rowSelected,
      ]}
    >
      {index != null ? (
        <Text
          style={[styles.rowIndex, { color: accent ?? colors.text.secondary }]}
        >
          {String(index + 1).padStart(2, "0")}
        </Text>
      ) : null}
      <Text style={[styles.rowLabel, dark && styles.rowLabelDark]}>
        {label}
      </Text>
      {selected ? (
        <View style={[styles.check, dark && styles.checkDark]}>
          <Check
            size={15}
            strokeWidth={3}
            color={dark ? colors.ink.base : colors.surface}
          />
        </View>
      ) : multi ? (
        <View style={styles.emptyCheck} />
      ) : (
        <ChevronRight
          size={17}
          color={dark ? colors.surface : colors.text.secondary}
        />
      )}
    </Pressable>
  );
}

function SectionHeading({
  title,
  support,
  dark = false,
  compact = false,
}: {
  title: string;
  support: string;
  dark?: boolean;
  compact?: boolean;
}) {
  return (
    <View style={[styles.headingBlock, compact && styles.headingBlockCompact]}>
      <Text
        style={[
          styles.title,
          compact && styles.titleCompact,
          dark && styles.titleLight,
        ]}
      >
        {title}
      </Text>
      <Text
        style={[
          styles.support,
          compact && styles.supportCompact,
          dark && styles.supportLight,
        ]}
      >
        {support}
      </Text>
    </View>
  );
}

function Welcome({
  onStart,
  onSignIn,
  reduceMotion,
}: {
  onStart: () => void;
  onSignIn: () => void;
  reduceMotion: boolean;
}) {
  const { width, height } = useWindowDimensions();
  // Keep the approved panorama near its native resolution on tall phones. A
  // full-height cover crop magnifies this ultra-wide source several times.
  const panoramaHeight = Math.min(height * 0.34, width * 0.74);
  const panoramaWidth = panoramaHeight * (1280 / 427);
  const pan = useSharedValue(0);
  const wash = useSharedValue(0);
  const transitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  useEffect(() => {
    if (reduceMotion) return;
    pan.value = withRepeat(withTiming(1, { duration: 16000 }), -1, true);
  }, [reduceMotion, pan]);
  useEffect(() => () => {
    if (transitionTimer.current) clearTimeout(transitionTimer.current);
  }, []);
  const panStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -Math.max(0, panoramaWidth - width) * pan.value }],
  }));
  const washStyle = useAnimatedStyle(() => ({ opacity: wash.value }));
  const start = () => {
    if (transitioning) return;
    setTransitioning(true);
    // The screen remains mounted under the cream wash until the JS handoff.
    wash.value = withTiming(1, { duration: reduceMotion ? 180 : 560 });
    transitionTimer.current = setTimeout(onStart, reduceMotion ? 180 : 560);
  };
  return (
    <View style={styles.fullBleed} testID="v2-onboarding-welcome">
      <View style={styles.fullBleed}>
        <Animated.Image
          source={panorama}
          resizeMode="stretch"
            style={[
              styles.panorama,
              {
                width: panoramaWidth,
                height: panoramaHeight,
                top: height * 0.21,
                left: 0,
              },
              panStyle,
            ]}
          accessibilityIgnoresInvertColors
        />
        <View style={styles.welcomeShade} />
        <LinearGradient
          colors={["transparent", "rgba(7,13,18,0.22)", "rgba(7,13,18,0.70)"]}
          locations={[0, 0.36, 1]}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
        <View style={styles.welcomeCenter}>
          <Image
            source={mark}
            resizeMode="contain"
            style={styles.brandMark}
            accessibilityLabel="Anchor symbol"
          />
          <Text style={styles.wordmark}>ANCHOR</Text>
          <Text style={styles.brandSub}>VISUAL GOAL SETTING</Text>
        </View>
        <View style={styles.welcomeBottom}>
          <Text style={styles.welcomeTitle}>
            Turn intention{"\n"}into movement.
          </Text>
          <Text style={styles.welcomeBody}>
            A visual goal setting system to help you see it, reinforce it, and
            move toward what matters.
          </Text>
          <Cta label="Get started" onPress={start} disabled={transitioning} />
          <Pressable
            accessibilityRole="button"
            onPress={onSignIn}
            style={styles.signIn}
          >
            <Text style={styles.signInText}>
              Already use Anchor?{" "}
              <Text style={styles.signInUnderline}>Sign in</Text>
            </Text>
          </Pressable>
        </View>
        <Animated.View pointerEvents="none" style={[styles.transitionWash, washStyle]} />
      </View>
    </View>
  );
}

function SystemDiagram({ reduceMotion }: { reduceMotion: boolean }) {
  const progress = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    progress.value = reduceMotion ? 1 : withDelay(750, withTiming(1, { duration: 2100 }));
  }, [progress, reduceMotion]);
  const lineStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));
  const stages = [
    {
      verb: "SEE",
      name: "Vision",
      text: "See what you're moving toward.",
    },
    {
      verb: "REINFORCE",
      name: "Practice",
      text: "Keep it present through focused sessions.",
    },
    {
      verb: "MOVE",
      name: "Chart",
      text: "Turn it into a path with clear next steps.",
    },
  ];
  return (
    <View
      style={styles.diagram}
      accessibilityLabel="See with Vision, reinforce with Practice, move with Chart. Progress shows the movement you are making."
    >
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(10,20,29,0)", "rgba(10,20,29,0.90)", colors.ink.base]}
        locations={[0, 0.42, 1]}
        style={styles.diagramWash}
      />
      <View style={styles.stages}>
        <View style={styles.connectorTrack}>
          <Animated.View style={[styles.lineFill, lineStyle]} />
          <View style={[styles.connectorNode, { left: "33.3%" }]} />
          <View style={[styles.connectorNode, { left: "66.6%" }]} />
        </View>
        {stages.map(({ verb, name, text }, index) => (
          <Animated.View
            entering={
              reduceMotion ? undefined : FadeIn.delay(350 + index * 1050).duration(420)
            }
            key={name}
            style={styles.stage}
          >
            <View style={[styles.stageArt, styles.stageArtMasked]}>
              {name === "Vision" ? <Image source={require("@/assets/vision/vision-future-window-wide.jpg")} resizeMode="cover" style={styles.stageImage} /> : null}
              {name === "Practice" ? <View style={styles.practiceMiniature}><Image source={mark} resizeMode="contain" style={styles.practiceMark} /></View> : null}
              {name === "Chart" ? <Image source={require("@/assets/anchor-details/chart-empty-card.jpg")} resizeMode="cover" style={styles.stageImage} /> : null}
            </View>
            <Text style={styles.stageVerb}>{verb}</Text>
            <Text style={styles.stageName}>{name}</Text>
            <Text style={styles.stageText}>{text}</Text>
          </Animated.View>
        ))}
      </View>
      <View style={styles.lineTrack}>
        <Animated.View style={[styles.lineFill, lineStyle]} />
      </View>
      <Animated.View
        entering={reduceMotion ? undefined : FadeIn.delay(3150).duration(400)}
        style={styles.progressLayer}
      >
        <TrendingUp size={21} color="#E9D5AB" />
        <View>
          <Text style={styles.progressName}>PROGRESS</Text>
          <Text style={styles.progressCopy}>
            See the movement you're making.
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}

function StoryBridge({ reduceMotion, skipReveal }: { reduceMotion: boolean; skipReveal: boolean }) {
  const reveal = useSharedValue(0);
  useEffect(() => {
    reveal.value = withDelay(
      skipReveal || reduceMotion ? 0 : 160,
      withTiming(1, { duration: skipReveal ? 0 : reduceMotion ? 360 : 1320 }),
    );
  }, [reduceMotion, reveal, skipReveal]);
  const anchorStyle = useAnimatedStyle(() => ({
    opacity: reveal.value,
    transform: [{ translateY: reduceMotion ? 0 : 64 * (1 - reveal.value) }],
  }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: reveal.value * 0.24 }));
  return (
    <View style={styles.storyFrame}>
      <Image source={story} resizeMode="contain" style={styles.storyImage} accessibilityLabel="A person looking toward a horizon, surrounded by scenes of possible futures" />
      <Animated.View style={[styles.storySunGlow, glowStyle]} pointerEvents="none" />
      <View style={styles.storyAnchorMask} pointerEvents="none">
        <Animated.Image source={mark} resizeMode="contain" style={[styles.storyAnchor, anchorStyle]} accessibilityLabel="Example Anchor symbol" accessibilityRole="image" />
      </View>
    </View>
  );
}

export function V2OnboardingJourney({ onSignIn, onCreate }: Props) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useV2ReduceMotion();
  const {
    draft,
    setStep,
    setMotivation,
    setDesiredOutcome,
    setCustomDesiredChange,
    toggleLifeChange,
    setPrimaryNeed,
    markAnswersComplete,
  } = useFirstRunStore();
  const step = ONBOARDING_STEPS.includes(draft.currentStep as OnboardingStep)
    ? (draft.currentStep as OnboardingStep)
    : "welcome";
  const stepNumber = ONBOARDING_STEPS.indexOf(step) + 1;
  const dark = step === "outcome" || step === "need";
  const bridgeRevealPlayed = useRef(false);
  useEffect(() => {
    if (step === "bridge") bridgeRevealPlayed.current = true;
  }, [step]);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
  }, []);
  const setNext = (next: OnboardingStep) => {
    v2Haptics.selection();
    setStep(next);
  };
  const back = () => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    if (stepNumber > 1) setStep(ONBOARDING_STEPS[stepNumber - 2]);
  };
  const motivation = (draft.motivation ?? "").trim();
  const effectiveChange = (draft.desiredOutcome ?? "").trim();
  const chooseMotivation = (change: string) => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    setMotivation(change);
    v2Haptics.selection();
    if (change !== "Something else")
      advanceTimer.current = setTimeout(() => setStep("outcome"), reduceMotion ? 0 : 280);
  };
  const footer = (label: string, next: () => void, disabled = false) => (
    <View style={styles.footer}>
      <Cta label={label} onPress={next} dark={!dark} disabled={disabled} />
    </View>
  );

  if (step === "welcome")
    return (
      <View
        style={[
          styles.screen,
          { paddingTop: insets.top, paddingBottom: insets.bottom },
        ]}
      >
        <StatusBar style="light" translucent backgroundColor="transparent" />
        <Welcome
          onStart={() => setNext("bridge")}
          onSignIn={onSignIn}
          reduceMotion={reduceMotion}
        />
      </View>
    );

  return (
    <View
      style={[
        styles.screen,
        dark ? styles.darkScreen : styles.paperScreen,
        { paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}
      testID={`v2-onboarding-${step}`}
    >
      <StatusBar
        style={dark ? "light" : "dark"}
        translucent
        backgroundColor="transparent"
      />
      {step === "handoff" ? (
        <ImageBackground
          source={desk}
          style={StyleSheet.absoluteFillObject}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
        >
          <View style={styles.handoffShade} />
        </ImageBackground>
      ) : null}
      <Header step={stepNumber} onBack={back} dark={dark} />
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          step === "handoff" && styles.handoffScroll,
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {step === "bridge" && (
          <>
            <StoryBridge reduceMotion={reduceMotion} skipReveal={bridgeRevealPlayed.current} />
            <SectionHeading title="Let's make Anchor yours." support="Answer a few quick questions about what you want to change and what matters most right now. We'll use your answers to help shape your Vision and Chart around where you want to go." />
            <Text style={styles.reassurance}>Takes about a minute.</Text>
          </>
        )}
        {step === "motivation" && (
          <>
            <SectionHeading
              compact
              title={"What are you hoping\nwill change?"}
              support="Start with what has been on your mind lately."
            />
            <View style={styles.list}>
              {MOTIVATIONS.map((change, index) => (
                <ChoiceRow
                  key={change}
                  label={change}
                  index={index}
                  compact
                  selected={draft.motivation === change}
                  onPress={() => chooseMotivation(change)}
                />
              ))}
            </View>
            {draft.motivation === "Something else" ? (
              <TextInput
                value={draft.customDesiredChange ?? ""}
                onChangeText={setCustomDesiredChange}
                placeholder="What's been on your mind?"
                placeholderTextColor="#716B62"
                accessibilityLabel="Describe what has been on your mind"
                maxLength={120}
                style={styles.customInput}
                returnKeyType="done"
                onSubmitEditing={() => {
                  if ((draft.customDesiredChange ?? "").trim()) setNext("outcome");
                }}
              />
            ) : null}
          </>
        )}
        {step === "outcome" && (
          <>
            <SectionHeading compact dark title={"If this changed,\nwhat would be different\nin your life?"} support="Put the outcome in your own words." />
            <TextInput value={draft.desiredOutcome ?? ""} onChangeText={setDesiredOutcome} placeholder="What would you like to see change?" placeholderTextColor="#B8B2A8" accessibilityLabel="Describe the outcome you want" maxLength={500} multiline style={[styles.customInput, styles.outcomeInput]} />
            <Image
              source={
                areaArt[
                  areaFor(
                    `${motivation === "Something else" ? draft.customDesiredChange ?? "" : motivation} ${effectiveChange}`,
                  )
                ] ?? areaArt.custom
              }
              resizeMode="cover"
              style={styles.changeArt}
              accessibilityLabel="Illustration chosen from your answer"
            />
          </>
        )}
        {step === "life" && (
          <>
            <SectionHeading
              compact
              title={"Picture this working out.\nWhat changes first?"}
              support="Select all that apply."
            />
            <View style={styles.list}>
              {LIFE_CHANGES.map((change, index) => (
                <ChoiceRow
                  key={change}
                  label={change}
                  index={index}
                  compact
                  multi
                  selected={draft.lifeChanges?.includes(change) ?? false}
                  onPress={() => {
                    toggleLifeChange(change);
                    v2Haptics.selection();
                    AccessibilityInfo.announceForAccessibility(
                      `${change} ${draft.lifeChanges?.includes(change) ? "deselected" : "selected"}`,
                    );
                  }}
                />
              ))}
            </View>
          </>
        )}
        {step === "need" && (
          <>
            <SectionHeading
              compact
              dark
              title={"What matters most\nright now?"}
              support={"What would make the biggest\ndifference for you?"}
            />
            <View style={styles.list}>
              {PRIMARY_NEEDS.map((need, index) => (
                <ChoiceRow
                  key={need}
                  label={need}
                  index={index}
                  compact
                  dark
                  accent="#E9D5AB"
                  selected={draft.primaryNeed === need}
                  onPress={() => {
                    setPrimaryNeed(need);
                    v2Haptics.selection();
                  }}
                />
              ))}
            </View>
          </>
        )}
        {step === "summary" && (
          <>
            <SectionHeading title="Your path, connected." support="See it clearly. Reinforce it daily. Move toward it with clarity." />
            <Text style={styles.reflection}>
              {personalizedReflection(
                motivation,
                draft.customDesiredChange ?? "",
                effectiveChange,
                draft.lifeChanges ?? [],
                draft.primaryNeed ?? "",
              )}
            </Text>
            <SystemDiagram reduceMotion={reduceMotion} />
          </>
        )}
        {step === "handoff" && (
          <>
            <View style={styles.handoffBrand}>
              <Text style={styles.handoffWordmark}>ANCHOR</Text>
              <Text style={styles.handoffBrandSub}>VISUAL GOAL SETTING</Text>
            </View>
            <View style={styles.handoffMessage}>
              <Text style={styles.handoffTitle}>Let's give it a form.</Text>
              <Text style={styles.handoffSupport}>
                Turn what you discovered into a present-tense intention about the change you want to see.
              </Text>
            </View>
            <Text style={styles.handwriting}>I...</Text>
          </>
        )}
      </ScrollView>
      {step === "bridge" ? footer("Continue", () => setNext("motivation")) : null}
      {step === "motivation" && draft.motivation === "Something else"
        ? footer("Continue", () => setNext("outcome"), !(draft.customDesiredChange ?? "").trim())
        : null}
      {step === "outcome" ? footer("Continue", () => setNext("life"), !effectiveChange) : null}
      {step === "life"
        ? footer("Continue", () => setNext("need"), !draft.lifeChanges?.length)
        : null}
      {step === "need"
        ? footer("Continue", () => setNext("summary"), !draft.primaryNeed)
        : null}
      {step === "summary"
        ? footer("Looks good", () => {
            markAnswersComplete();
            setNext("handoff");
          })
        : null}
      {step === "handoff" ? footer("Create my first Anchor", onCreate) : null}
    </View>
  );
}

function personalizedReflection(
  motivation: string,
  customMotivation: string,
  outcome: string,
  lifeChanges: string[],
  primaryNeed: string,
) {
  const hope = motivation === "Something else" ? customMotivation : motivation;
  const changes = lifeChanges.join(" and ");
  return `“${hope}.” You want ${outcome}. First, ${changes.toLowerCase()} shift. ${primaryNeed} would help most.`;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  paperScreen: { backgroundColor: colors.background },
  darkScreen: { backgroundColor: colors.ink.base },
  fullBleed: { flex: 1, backgroundColor: colors.ink.base },
  panorama: { position: "absolute", top: 0, left: 0 },
  transitionWash: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.background, zIndex: 5 },
  welcomeShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(9,15,20,0.18)",
  },
  welcomeCenter: {
    alignItems: "center",
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },
  brandMark: { width: 62, height: 82 },
  wordmark: {
    color: "#FBF1DF",
    fontSize: 21,
    letterSpacing: 7,
    fontFamily: "Inter-Regular",
    marginTop: 4,
  },
  brandSub: { color: "#FBF1DF", fontSize: 7, letterSpacing: 2.6, marginTop: 3 },
  welcomeBottom: {
    marginTop: "auto",
    paddingHorizontal: 28,
    paddingBottom: 18,
    alignItems: "center",
  },
  storyFrame: { height: 300, width: "100%", alignItems: "center", justifyContent: "center", overflow: "hidden", marginBottom: 8 },
  storyImage: { width: "100%", height: "100%" },
  storySunGlow: { position: "absolute", top: "40%", left: "50%", width: 70, height: 70, marginLeft: -35, borderRadius: 35, backgroundColor: "rgba(244,221,184,0.36)", shadowColor: "#E9B96E", shadowOpacity: 0.42, shadowRadius: 22, shadowOffset: { width: 0, height: 0 } },
  storyAnchorMask: { position: "absolute", top: "43%", left: "50%", width: 62, height: 86, marginLeft: -31, overflow: "hidden", alignItems: "center", justifyContent: "flex-start" },
  storyAnchor: { width: 46, height: 76, tintColor: "#F4DDB8" },
  reassurance: { color: colors.text.secondary, fontSize: 12, textAlign: "center", marginTop: 2 },
  welcomeTitle: {
    color: "#FFF9EF",
    fontSize: 32,
    lineHeight: 36,
    fontFamily: "EBGaramond-Regular",
    textAlign: "center",
  },
  welcomeBody: {
    color: "#F8F3E9",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 10,
    marginBottom: 20,
    maxWidth: 310,
  },
  signIn: { padding: 16, marginTop: 4 },
  signInText: { color: "#F7EFE3", fontSize: 13 },
  signInUnderline: { textDecorationLine: "underline", color: "#F7D99F" },
  header: {
    height: 54,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 22,
    gap: 22,
  },
  back: { width: 36, height: 44, justifyContent: "center" },
  progressTrack: {
    height: 5,
    flex: 1,
    backgroundColor: "#C9C8C2",
    borderRadius: 8,
    overflow: "hidden",
  },
  progressTrackDark: { backgroundColor: "#3A4248" },
  progressFill: {
    height: 5,
    backgroundColor: colors.ink.base,
    borderRadius: 8,
  },
  progressFillDark: { backgroundColor: "#E9D5AB" },
  counter: {
    width: 38,
    textAlign: "right",
    color: colors.text.primary,
    fontSize: 13,
  },
  lightText: { color: colors.surface },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 27,
    paddingTop: 18,
    paddingBottom: 22,
  },
  headingBlock: { alignItems: "center", marginBottom: 21 },
  title: {
    color: colors.text.primary,
    fontFamily: "EBGaramond-Regular",
    fontSize: 31,
    lineHeight: 33,
    textAlign: "center",
  },
  titleLight: { color: colors.surface },
  support: {
    color: "#4F4C48",
    fontSize: 14,
    lineHeight: 19,
    textAlign: "center",
    marginTop: 10,
  },
  supportLight: { color: "#E0DDD5" },
  list: { gap: 3 },
  row: {
    minHeight: 49,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderColor: "#DCD6CC",
    flexDirection: "row",
    alignItems: "center",
    gap: 15,
  },
  rowDark: { borderColor: "#39434B" },
  rowSelected: {
    backgroundColor: "rgba(211,171,105,0.14)",
    borderRadius: 8,
    borderColor: "#B99661",
  },
  rowIndex: { width: 26, fontSize: 13, fontFamily: "Inter-SemiBold" },
  rowLabel: {
    flex: 1,
    color: colors.text.primary,
    fontSize: 14,
    lineHeight: 19,
  },
  rowLabelDark: { color: colors.surface },
  check: {
    width: 22,
    height: 22,
    borderRadius: 5,
    backgroundColor: colors.ink.base,
    alignItems: "center",
    justifyContent: "center",
  },
  checkDark: { backgroundColor: "#E9D5AB" },
  emptyCheck: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "#87847E",
  },
  customInput: {
    color: colors.surface,
    borderBottomWidth: 1,
    borderColor: "#D9C199",
    minHeight: 48,
    marginTop: 14,
    fontSize: 15,
  },
  changeArt: {
    width: "100%",
    height: 190,
    overflow: "hidden",
    marginTop: 12,
    borderRadius: 4,
  },
  outcomeInput: { minHeight: 84, paddingTop: 8, paddingBottom: 8, textAlignVertical: "top" },
  changeArtImage: { borderRadius: 5 },
  changeArtShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(8,16,21,0.33)",
  },
  changeArtText: {
    color: "#FFF5E4",
    fontFamily: "EBGaramond-Italic",
    fontSize: 20,
    textAlign: "center",
    zIndex: 1,
  },
  footer: { paddingHorizontal: 27, paddingTop: 9, paddingBottom: 12 },
  cta: {
    height: 52,
    borderRadius: 28,
    backgroundColor: "#F4DDB8",
    paddingHorizontal: 23,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  ctaDark: { backgroundColor: colors.ink.base },
  ctaText: {
    color: colors.text.primary,
    fontFamily: "Inter-SemiBold",
    fontSize: 15,
    textAlign: "center",
    flex: 1,
  },
  ctaTextLight: { color: colors.surface },
  disabled: { opacity: 0.45 },
  summary: { borderTopWidth: 1, borderColor: "#CFC6B8", marginTop: 4 },
  summaryLine: {
    borderBottomWidth: 1,
    borderColor: "#D8D0C3",
    paddingVertical: 12,
  },
  summaryLabel: { color: "#756E65", fontSize: 12 },
  summaryLabelDark: { color: "#E9D5AB" },
  summaryValue: {
    color: colors.text.primary,
    fontSize: 17,
    lineHeight: 23,
    marginTop: 3,
  },
  summaryValueDark: { color: colors.surface },
  reflection: {
    color: colors.text.primary,
    fontSize: 12,
    lineHeight: 17,
    paddingHorizontal: 8,
    textAlign: "center",
    marginBottom: 2,
  },
  statement: {
    color: colors.text.primary,
    fontFamily: "EBGaramond-Italic",
    fontSize: 22,
    lineHeight: 27,
    textAlign: "center",
    marginTop: 30,
    paddingHorizontal: 10,
  },
  diagram: { marginHorizontal: -27, paddingHorizontal: 27, marginTop: 9, minHeight: 215, justifyContent: "center", overflow: "hidden" },
  diagramWash: { ...StyleSheet.absoluteFillObject, top: -18 },
  stages: { flexDirection: "row", gap: 8 },
  stage: { flex: 1, alignItems: "center" },
  stageArt: {
    width: 68,
    height: 64,
    borderBottomWidth: 1,
    borderColor: "#BB9D67",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 9,
  },
  stageVerb: { color: "#E9D5AB", fontSize: 10, letterSpacing: 1.4 },
  stageName: {
    color: colors.surface,
    fontFamily: "EBGaramond-Regular",
    fontSize: 20,
    marginTop: 3,
  },
  stageText: {
    color: "#E0DDD5",
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center",
    marginTop: 7,
  },
  lineTrack: { height: 2, marginTop: 18, backgroundColor: "#303B44" },
  lineFill: { height: 2, backgroundColor: "#D1B27D" },
  progressLayer: {
    alignSelf: "center",
    flexDirection: "row",
    gap: 13,
    alignItems: "center",
    marginTop: 14,
  },
  progressName: { color: "#E9D5AB", fontSize: 11, letterSpacing: 1 },
  progressCopy: { color: "#DADAD6", fontSize: 12, marginTop: 3 },
  handoffShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(9,14,19,0.19)",
  },
  handoffScroll: { justifyContent: "space-between" },
  handoffBrand: { alignItems: "center", marginTop: 28 },
  handoffWordmark: { color: "#FAF3E8", fontSize: 27, letterSpacing: 8 },
  handoffBrandSub: { color: "#FAF3E8", fontSize: 9, letterSpacing: 3 },
  handoffMessage: { alignItems: "center", marginTop: 35 },
  handoffTitle: {
    color: "#FFF7E9",
    fontFamily: "EBGaramond-Regular",
    fontSize: 34,
    textAlign: "center",
  },
  handoffSupport: {
    color: "#FFF7E9",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    maxWidth: 290,
  },
  handwriting: {
    color: "#1D2020",
    fontFamily: "EBGaramond-Italic",
    fontSize: 30,
    textAlign: "center",
    marginTop: "auto",
    marginBottom: "25%",
  },
  headingBlockCompact: { marginBottom: 10 },
  titleCompact: { fontSize: 25, lineHeight: 26 },
  supportCompact: { fontSize: 12, lineHeight: 16, marginTop: 7 },
  rowCompact: { minHeight: 44 },
  connectorTrack: {
    position: "absolute",
    left: "13%",
    right: "13%",
    top: 33,
    height: 2,
    backgroundColor: "#334049",
  },
  connectorNode: {
    position: "absolute",
    top: -4,
    width: 10,
    height: 10,
    marginLeft: -5,
    borderRadius: 5,
    backgroundColor: "#E9D5AB",
  },
  stageArtMasked: { backgroundColor: colors.ink.base, zIndex: 1 },
  stageImage: { width: 78, height: 66, borderWidth: 1, borderColor: '#8B7756' },
  practiceMiniature: { width: 68, height: 66, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#8B7756', backgroundColor: '#19232B' },
  practiceMark: { width: 36, height: 50 },
});
