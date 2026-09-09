import React, { useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Check, ChevronRight, Image as ImageIcon, Sparkles, Upload } from 'lucide-react-native';
import { GhostVisionComposition } from './GhostVisionComposition';
import { V2Button, V2TopBar } from '@/components/v2';
import { colors, getCategoryColor, radii, spacing, typography } from '@/theme/v2';
import type { VisionSceneSource } from '@/adapters/v2/vision';

export interface V2VisionCreationFlowProps {
  anchorId: string;
  anchorIntention: string;
  anchorCategory?: string | null;
  initialStep?: 'ready' | 'empty' | 'prompt' | 'curation';
  onBack: () => void;
  onAssemble: (result: {
    description: string;
    source: VisionSceneSource;
    selectedAssets: Array<{ assetId: string; prompt: string; imageUrl?: string }>;
  }) => Promise<void>;
  testID?: string;
}

// Preset candidate scenes for curation
const PRESET_CANDIDATES = [
  {
    id: 'cand-1',
    prompt: 'Focused creative desk at morning light',
    imageUrl: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&q=80',
  },
  {
    id: 'cand-2',
    prompt: 'Calm library sanctuary with notebooks open',
    imageUrl: 'https://images.unsplash.com/photo-1507842229451-79b1be886a29?w=600&q=80',
  },
  {
    id: 'cand-3',
    prompt: 'Open horizon landscape over quiet waters',
    imageUrl: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=600&q=80',
  },
  {
    id: 'cand-4',
    prompt: 'Collaborative workshop table with real blueprints',
    imageUrl: 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=600&q=80',
  },
  {
    id: 'cand-5',
    prompt: 'Evening reflections in a quiet studio space',
    imageUrl: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=600&q=80',
  },
];

export function V2VisionCreationFlow({
  anchorId,
  anchorIntention,
  anchorCategory,
  initialStep = 'prompt',
  onBack,
  onAssemble,
  testID = 'v2-vision-creation-flow',
}: V2VisionCreationFlowProps) {
  const [step, setStep] = useState<'ready' | 'empty' | 'prompt' | 'source' | 'curation'>(
    initialStep,
  );
  const [descriptionText, setDescriptionText] = useState('');
  const [sourceType, setSourceType] = useState<VisionSceneSource>('AI_GENERATED');
  const [keptIds, setKeptIds] = useState<Record<string, boolean>>({
    'cand-1': true,
    'cand-2': true,
    'cand-3': true,
  });
  const [isAssembling, setIsAssembling] = useState(false);

  const categoryColor = getCategoryColor(anchorCategory);
  const isPromptValid = descriptionText.trim().length >= 12;
  const keptCount = Object.values(keptIds).filter(Boolean).length;
  const canAssemble = keptCount >= 3;

  const toggleKept = (id: string) => {
    setKeptIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleAssemble = async () => {
    if (!canAssemble || isAssembling) return;
    setIsAssembling(true);
    const selected = PRESET_CANDIDATES.filter((c) => keptIds[c.id]).map((c) => ({
      assetId: c.id,
      prompt: c.prompt,
      imageUrl: c.imageUrl,
    }));
    try {
      await onAssemble({
        description: descriptionText.trim() || 'A clear picture of where this Anchor is taking you.',
        source: sourceType,
        selectedAssets: selected,
      });
    } finally {
      setIsAssembling(false);
    }
  };

  // Step 1: Anchor Ready
  if (step === 'ready') {
    return (
      <View testID={`${testID}-ready`} style={styles.screen}>
        <V2TopBar title="Vision" onBackPress={onBack} />
        <ScrollView contentContainerStyle={styles.centerContent}>
          <Text style={styles.eyebrow}>YOUR ANCHOR IS READY</Text>
          <Text style={styles.intentionHeading}>{anchorIntention}</Text>
          <View style={[styles.categoryBadge, { borderColor: categoryColor }]}>
            <View style={[styles.categoryDot, { backgroundColor: categoryColor }]} />
            <Text style={styles.categoryText}>{anchorCategory ?? 'Anchor'}</Text>
          </View>

          <View style={styles.readyCard}>
            <Text style={styles.cardTitle}>Give it a future you can see</Text>
            <Text style={styles.cardBody}>
              Create a visual picture of where this Anchor is taking you.
            </Text>
            <V2Button
              accessibilityLabel="Create Vision"
              onPress={() => setStep('prompt')}
            >
              Create Vision →
            </V2Button>
            <Pressable
              onPress={onBack}
              accessibilityRole="button"
              accessibilityLabel="Not now"
              style={styles.notNowButton}
            >
              <Text style={styles.notNowText}>Not now</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    );
  }

  // Step 2: Empty
  if (step === 'empty') {
    return (
      <View testID={`${testID}-empty`} style={styles.screen}>
        <V2TopBar title="Vision" onBackPress={onBack} />
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.miniHeader}>
            <Text numberOfLines={1} style={styles.miniIntention}>
              {anchorIntention}
            </Text>
            <Text style={styles.miniCategory}>{anchorCategory ?? 'Anchor'}</Text>
          </View>

          <GhostVisionComposition />

          <View style={styles.emptyActionBlock}>
            <Text style={styles.sectionTitle}>
              Give this Anchor a future you can see.
            </Text>
            <V2Button
              accessibilityLabel="Create Vision"
              onPress={() => setStep('prompt')}
            >
              Create Vision →
            </V2Button>
          </View>
        </ScrollView>
      </View>
    );
  }

  // Step 3: Prompt Description
  if (step === 'prompt') {
    return (
      <View testID={`${testID}-prompt`} style={styles.screen}>
        <V2TopBar title="Vision" onBackPress={onBack} />
        <View style={styles.flexOne}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.miniHeader}>
              <Text numberOfLines={1} style={styles.miniIntention}>
                {anchorIntention}
              </Text>
              <Text style={styles.miniCategory}>{anchorCategory ?? 'Anchor'}</Text>
            </View>

            <Text style={styles.sectionTitle}>
              What would this look like if it became real?
            </Text>
            <TextInput
              testID="vision-prompt-input"
              value={descriptionText}
              onChangeText={setDescriptionText}
              placeholder="I work on this full time, thousands of people are affected by it, and I have the freedom to spend my days building something meaningful…"
              placeholderTextColor={colors.text.disabled}
              multiline
              numberOfLines={6}
              style={styles.textInput}
              accessibilityLabel="Future description"
            />
            {!isPromptValid && descriptionText.length > 0 && (
              <Text style={styles.hintText}>
                Please enter at least 12 characters to picture your future.
              </Text>
            )}
          </ScrollView>

          <View style={styles.bottomBar}>
            <V2Button
              accessibilityLabel="Continue to photo source"
              disabled={!isPromptValid}
              onPress={() => setStep('source')}
            >
              Continue →
            </V2Button>
          </View>
        </View>
      </View>
    );
  }

  // Step 4: Source Choice
  if (step === 'source') {
    return (
      <View testID={`${testID}-source`} style={styles.screen}>
        <V2TopBar title="Vision" onBackPress={() => setStep('prompt')} />
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.sectionTitle}>How should we picture it?</Text>

          <Pressable
            testID="source-generated-option"
            accessibilityRole="button"
            accessibilityLabel="Generate scenes"
            onPress={() => {
              setSourceType('AI_GENERATED');
              setStep('curation');
            }}
            style={styles.sourceOption}
          >
            <View style={styles.sourceIconBox}>
              <Sparkles size={22} color={categoryColor} />
            </View>
            <View style={styles.sourceTextGroup}>
              <Text style={styles.sourceTitle}>Generate scenes</Text>
              <Text style={styles.sourceDesc}>
                Draft a few scenes from your description — you choose what fits.
              </Text>
            </View>
            <ChevronRight size={18} color={colors.text.secondary} />
          </Pressable>

          <Pressable
            testID="source-upload-option"
            accessibilityRole="button"
            accessibilityLabel="Add my own images"
            onPress={() => {
              setSourceType('USER_UPLOAD');
              setStep('curation');
            }}
            style={styles.sourceOption}
          >
            <View style={styles.sourceIconBox}>
              <Upload size={22} color={categoryColor} />
            </View>
            <View style={styles.sourceTextGroup}>
              <Text style={styles.sourceTitle}>Add my own images</Text>
              <Text style={styles.sourceDesc}>
                Bring your own photos of places, work, and people.
              </Text>
            </View>
            <ChevronRight size={18} color={colors.text.secondary} />
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  // Step 5: Curation
  return (
    <View testID={`${testID}-curation`} style={styles.screen}>
      <V2TopBar title="Vision" onBackPress={() => setStep('source')} />
      <View style={styles.flexOne}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.sectionTitle}>Choose what feels like your future</Text>
          <Text style={styles.subTitle}>Keep the ones that feel true.</Text>

          <View style={styles.candidatesGrid}>
            {PRESET_CANDIDATES.map((cand) => {
              const isKept = Boolean(keptIds[cand.id]);
              return (
                <View
                  key={cand.id}
                  testID={`candidate-card-${cand.id}`}
                  style={[
                    styles.candidateCard,
                    isKept && { borderColor: categoryColor, borderWidth: 2 },
                  ]}
                >
                  <Image
                    source={{ uri: cand.imageUrl }}
                    style={styles.candidateImage}
                    resizeMode="cover"
                  />
                  {isKept && (
                    <View
                      style={[
                        styles.keptIndicator,
                        { backgroundColor: categoryColor },
                      ]}
                    >
                      <Check size={14} color={colors.surface} />
                    </View>
                  )}
                  <View style={styles.cardFooter}>
                    <Text numberOfLines={2} style={styles.candPrompt}>
                      {cand.prompt}
                    </Text>
                    <Pressable
                      onPress={() => toggleKept(cand.id)}
                      accessibilityRole="button"
                      accessibilityLabel={isKept ? `Kept ${cand.prompt}` : `Keep ${cand.prompt}`}
                      style={[
                        styles.keepButton,
                        isKept
                          ? { backgroundColor: categoryColor, borderColor: categoryColor }
                          : { borderColor: colors.border.default },
                      ]}
                    >
                      <Text
                        style={[
                          styles.keepButtonText,
                          isKept ? { color: colors.surface } : { color: colors.text.primary },
                        ]}
                      >
                        {isKept ? 'Kept' : 'Keep'}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>

        <View style={styles.bottomBar}>
          <Text style={styles.countText}>
            {canAssemble
              ? `${keptCount} kept`
              : keptCount === 0
                ? 'Choose 3 images to continue'
                : `${keptCount} kept · Choose ${3 - keptCount} more`}
          </Text>
          <V2Button
            accessibilityLabel="Assemble Vision"
            disabled={!canAssemble || isAssembling}
            onPress={handleAssemble}
          >
            {isAssembling ? 'Assembling…' : 'Assemble Vision →'}
          </V2Button>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flexOne: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing[4],
    gap: spacing[3],
  },
  centerContent: {
    padding: spacing[5],
    alignItems: 'center',
    gap: spacing[3],
  },
  eyebrow: {
    ...typography.caption,
    color: colors.text.secondary,
    letterSpacing: 1.2,
  },
  intentionHeading: {
    ...typography.headingMD,
    color: colors.text.primary,
    textAlign: 'center',
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  categoryText: {
    ...typography.caption,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  readyCard: {
    width: '100%',
    marginTop: spacing[4],
    padding: spacing[4],
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    gap: spacing[3],
  },
  cardTitle: {
    ...typography.headingSM,
    color: colors.text.primary,
  },
  cardBody: {
    ...typography.bodyMD,
    color: colors.text.secondary,
  },
  notNowButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  notNowText: {
    ...typography.bodyMD,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  miniHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  miniIntention: {
    ...typography.labelMD,
    color: colors.text.primary,
    flex: 1,
    marginRight: 8,
  },
  miniCategory: {
    ...typography.caption,
    color: colors.text.secondary,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    ...typography.headingSM,
    color: colors.text.primary,
    marginTop: spacing[2],
  },
  subTitle: {
    ...typography.bodyMD,
    color: colors.text.secondary,
  },
  emptyActionBlock: {
    marginTop: spacing[4],
    gap: spacing[3],
  },
  textInput: {
    ...typography.bodyMD,
    color: colors.text.primary,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radii.md,
    padding: spacing[3],
    minHeight: 120,
    textAlignVertical: 'top',
  },
  hintText: {
    ...typography.caption,
    color: colors.semantic.warning,
  },
  sourceOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[4],
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    marginTop: spacing[2],
  },
  sourceIconBox: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.grouped,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceTextGroup: {
    flex: 1,
  },
  sourceTitle: {
    ...typography.labelMD,
    color: colors.text.primary,
    fontWeight: '700',
  },
  sourceDesc: {
    ...typography.caption,
    color: colors.text.secondary,
    marginTop: 2,
  },
  candidatesGrid: {
    gap: spacing[3],
    marginTop: spacing[2],
  },
  candidateCard: {
    borderRadius: radii.lg,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    position: 'relative',
  },
  candidateImage: {
    width: '100%',
    height: 180,
  },
  keptIndicator: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardFooter: {
    padding: spacing[3],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[2],
  },
  candPrompt: {
    ...typography.bodySM,
    color: colors.text.primary,
    flex: 1,
  },
  keepButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  keepButtonText: {
    ...typography.labelSM,
    fontWeight: '700',
  },
  bottomBar: {
    padding: spacing[4],
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
    backgroundColor: colors.surface,
    gap: spacing[2],
  },
  countText: {
    ...typography.labelSM,
    color: colors.text.secondary,
    textAlign: 'center',
    fontWeight: '600',
  },
});
