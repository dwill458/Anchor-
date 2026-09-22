import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { Compass, Sparkles, X } from 'lucide-react-native';
import { CircularAnchorRenderer } from '@/components/v2/anchor';
import { V2Button } from '@/components/v2';
import type { Anchor } from '@/types';
import type { ChartRouteTemplate } from '@/adapters/v2/chart';
import { useV2ReduceMotion } from '@/hooks/v2/useV2ReduceMotion';
import { colors, radii, spacing, typography } from '@/theme/v2';

export interface V2ChartEmptyStateProps {
  activeAnchor?: Anchor | null;
  hasAnchor?: boolean;
  anchorName?: string;
  onCreateChart?: (
    destinationText: string,
    template: ChartRouteTemplate,
  ) => Promise<any> | void;
  onCreateChartPress?: () => void;
  onCreateAnchor?: () => void;
  onCreateAnchorPress?: () => void;
  onSubmitCreateChart?: (
    destinationText: string,
    waypoints?: Array<{ title: string; description?: string }>,
  ) => Promise<boolean>;
  testID?: string;
}

const landscapeImage = require('../../../../assets/chart/landscape.jpg');

const ROUTE_TEMPLATES: Array<{ id: ChartRouteTemplate; label: string }> = [
  { id: 'gentle-s', label: 'Gentle S curve' },
  { id: 'wide-zigzag', label: 'Wide zig-zag' },
  { id: 'rising-arc', label: 'Rising arc' },
  { id: 'double-bend', label: 'Double bend' },
];

export function V2ChartEmptyState({
  activeAnchor,
  hasAnchor,
  anchorName,
  onCreateChart,
  onCreateChartPress,
  onCreateAnchor,
  onCreateAnchorPress,
  onSubmitCreateChart,
  testID = 'v2-chart-empty-state',
}: V2ChartEmptyStateProps) {
  const reduceMotion = useV2ReduceMotion();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ChartRouteTemplate>('gentle-s');
  const [destinationText, setDestinationText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const effectiveHasAnchor =
    hasAnchor !== undefined ? hasAnchor : Boolean(activeAnchor);
  const effectiveAnchorName =
    anchorName ??
    (activeAnchor as any)?.name ??
    activeAnchor?.intentionText ??
    (activeAnchor as any)?.intention ??
    'your Anchor';

  const handleOpenCreation = () => {
    if (onCreateChartPress) {
      onCreateChartPress();
    } else {
      setIsCreateModalOpen(true);
    }
  };

  const handleCreateSubmit = async () => {
    const trimmed = destinationText.trim();
    if (!trimmed) {
      setFieldError('Destination cannot be empty.');
      return;
    }
    if (trimmed.length > 140) {
      setFieldError('Destination must be under 140 characters.');
      return;
    }

    setFieldError(null);
    setIsSubmitting(true);

    try {
      if (onCreateChart) {
        await onCreateChart(trimmed, selectedTemplate);
        setIsSubmitting(false);
        setIsCreateModalOpen(false);
      } else if (onSubmitCreateChart) {
        const success = await onSubmitCreateChart(trimmed);
        setIsSubmitting(false);
        if (success) {
          setIsCreateModalOpen(false);
        }
      } else {
        setIsSubmitting(false);
        setIsCreateModalOpen(false);
      }
    } catch {
      setIsSubmitting(false);
    }
  };

  // State A: Dependency State — No Anchor
  if (!effectiveHasAnchor) {
    return (
      <View testID={`${testID}-no-anchor`} style={styles.container}>
        <Image
          source={landscapeImage}
          style={styles.landscapeBackground}
          resizeMode="cover"
        />
        <View style={styles.contentCard}>
          <View style={styles.compassBadge}>
            <Compass size={36} color="#3157D8" strokeWidth={1.8} />
          </View>
          <Text style={styles.eyebrow}>NO ANCHOR YET</Text>
          <Text style={styles.headline}>Every journey begins with an Anchor</Text>
          <Text style={styles.supportingText}>
            Chart turns what you’re actively reinforcing into a destination and a path you can move
            through. Create an Anchor to give your journey a beginning.
          </Text>
          <View style={styles.ctaContainer}>
            <V2Button
              accessibilityLabel="Create your first Anchor"
              onPress={onCreateAnchor ?? onCreateAnchorPress}
            >
              Create your first Anchor →
            </V2Button>
          </View>
        </View>
      </View>
    );
  }

  // State B: Dedicated First-Use Chart State — Active Anchor, No Chart
  const stateBTestId =
    testID === 'v2-chart-empty-state' ? 'v2-chart-empty-state-no-chart' : testID;

  return (
    <View testID={stateBTestId} style={styles.container}>
      {/* Illustrated terrain with soft opacity */}
      <Image
        source={landscapeImage}
        style={styles.landscapeBackground}
        resizeMode="cover"
      />

      {/* Unfinished Canvas: faint emerging path from Anchor */}
      <View style={styles.canvasArea} pointerEvents="box-none">
        <Svg
          width="100%"
          height="100%"
          viewBox="0 0 390 340"
          style={StyleSheet.absoluteFill}
        >
          <Defs>
            <LinearGradient id="faintEmerge" x1="0" y1="1" x2="1" y2="0">
              <Stop offset="0" stopColor="#7C5CFA" stopOpacity="0.4" />
              <Stop offset="0.4" stopColor="#3157D8" stopOpacity="0.25" />
              <Stop offset="0.8" stopColor="#39BFF0" stopOpacity="0.1" />
              <Stop offset="1" stopColor="#E3E1DC" stopOpacity="0" />
            </LinearGradient>
          </Defs>

          {/* Faint emerging path that dissolves into the open horizon */}
          <Path
            d="M 64 260 C 90 210, 140 190, 170 170 C 210 145, 250 140, 300 110"
            stroke="url(#faintEmerge)"
            strokeWidth="10"
            strokeLinecap="round"
            fill="none"
          />
          {/* Subtle dashed sketch line */}
          <Path
            d="M 64 260 C 90 210, 140 190, 170 170 C 210 145, 250 140, 300 110"
            stroke="#B9B9C6"
            strokeWidth="1.8"
            strokeDasharray="5,8"
            strokeLinecap="round"
            fill="none"
            opacity={0.6}
          />
          {/* Faint horizon shimmer */}
          <Circle cx="300" cy="110" r="14" fill="#F28A2E" opacity={0.12} />
          <Circle cx="300" cy="110" r="4" fill="#F28A2E" opacity={0.25} />
        </Svg>

        {/* User's active Anchor starting point */}
        <View style={styles.anchorOrigin}>
          <View style={styles.anchorBadgeWrapper}>
            {activeAnchor?.baseSigilSvg ? (
              <CircularAnchorRenderer
                svg={activeAnchor.baseSigilSvg}
                category={activeAnchor.category}
                size="thumbnail"
                accessibilityLabel={`Your active Anchor: ${effectiveAnchorName}`}
              />
            ) : (
              <View style={styles.fallbackAnchorDot} />
            )}
          </View>
          <View style={styles.startCaptionPill}>
            <Text style={styles.startCaptionText}>START</Text>
          </View>
        </View>
      </View>

      {/* Crafted editorial text & single clear CTA */}
      <View style={styles.bottomCard}>
        <View style={styles.textGroup}>
          <View style={styles.eyebrowRow}>
            <Text style={styles.eyebrow}>CHART</Text>
            <Sparkles size={11} color="#FFA32C" />
          </View>
          <Text style={styles.headline}>Give this Anchor somewhere to go.</Text>
          <Text style={styles.supportingText}>
            A destination, broken into real waypoints you can actually reach.
          </Text>
        </View>

        {/* Intention Pill */}
        <View style={styles.intentionPill}>
          <Text style={styles.intentionLabel}>REINFORCING</Text>
          <Text numberOfLines={2} style={styles.intentionText}>
            {effectiveAnchorName}
          </Text>
        </View>

        <View style={styles.ctaContainer}>
          <V2Button
            accessibilityLabel="Create a Chart"
            onPress={handleOpenCreation}
          >
            Create a Chart →
          </V2Button>
        </View>
      </View>

      {/* Modal for Destination setup if inline flow triggered */}
      <Modal
        visible={isCreateModalOpen}
        animationType={reduceMotion ? 'none' : 'slide'}
        transparent
        onRequestClose={() => setIsCreateModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View testID="chart-creation-modal" style={styles.sheetContainer}>
            <View style={styles.handle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetEyebrow}>NEW CHART</Text>
              <Pressable
                onPress={() => setIsCreateModalOpen(false)}
                accessibilityRole="button"
                accessibilityLabel="Close"
                hitSlop={8}
                style={styles.closeButton}
              >
                <X size={18} color={colors.text.secondary} />
              </Pressable>
            </View>

            <Text style={styles.sheetTitle}>Map your route</Text>
            <Text style={styles.sheetDesc}>
              Define the destination you are working toward. We'll map your initial milestones.
            </Text>

            {/* Template Selector */}
            <Text style={styles.templateSectionHeader}>CHOOSE A ROUTE SHAPE</Text>
            <View style={styles.templatePicker}>
              {ROUTE_TEMPLATES.map((tmpl) => (
                <Pressable
                  key={tmpl.id}
                  onPress={() => setSelectedTemplate(tmpl.id)}
                  hitSlop={4}
                  style={[
                    styles.templateOption,
                    selectedTemplate === tmpl.id && styles.templateOptionSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.templateOptionText,
                      selectedTemplate === tmpl.id && styles.templateOptionTextSelected,
                    ]}
                  >
                    {tmpl.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.inputGroup}>
              <TextInput
                value={destinationText}
                onChangeText={(t) => {
                  setDestinationText(t);
                  if (fieldError) setFieldError(null);
                }}
                placeholder="e.g., Launch my first product, Speak at conference"
                placeholderTextColor={colors.text.disabled}
                maxLength={140}
                multiline
                style={styles.textInput}
                accessibilityLabel="Chart destination"
                autoFocus
              />
              <Text style={styles.characterCount}>{destinationText.length}/140</Text>
            </View>

            {Boolean(fieldError) && (
              <Text style={styles.fieldErrorText}>{fieldError}</Text>
            )}

            <View style={styles.sheetActions}>
              <Pressable
                onPress={() => setIsCreateModalOpen(false)}
                hitSlop={6}
                style={styles.cancelButton}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>

              <Pressable
                testID="submit-create-chart-btn"
                onPress={handleCreateSubmit}
                disabled={isSubmitting || !destinationText.trim()}
                hitSlop={6}
                style={[
                  styles.submitButton,
                  (!destinationText.trim() || isSubmitting) && styles.submitButtonDisabled,
                ]}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color={colors.surface} />
                ) : (
                  <Text style={styles.submitButtonText}>Begin Chart</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#FAF5EE',
    justifyContent: 'space-between',
  },
  landscapeBackground: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    opacity: 0.85,
  },
  contentCard: {
    margin: spacing[4],
    marginTop: 'auto',
    marginBottom: 'auto',
    backgroundColor: '#FDFBF8',
    borderRadius: 24,
    padding: spacing[6],
    borderWidth: 1,
    borderColor: '#E9E5DE',
    shadowColor: '#182235',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 4,
    alignItems: 'center',
    gap: spacing[3],
  },
  compassBadge: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#EEF2FC',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[2],
  },
  eyebrow: {
    ...typography.caption,
    color: '#717686',
    letterSpacing: 1.2,
    fontWeight: '700',
    fontSize: 10,
    textTransform: 'uppercase',
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headline: {
    ...typography.headingMD,
    color: colors.text.primary,
    textAlign: 'center',
    fontSize: 22,
    lineHeight: 28,
  },
  supportingText: {
    ...typography.bodyMD,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    fontSize: 14,
  },
  ctaContainer: {
    width: '100%',
    marginTop: spacing[2],
  },
  canvasArea: {
    flex: 1,
    width: '100%',
    minHeight: 280,
    position: 'relative',
  },
  anchorOrigin: {
    position: 'absolute',
    left: 42,
    top: 225,
    alignItems: 'center',
    gap: 6,
  },
  anchorBadgeWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#223B6A',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#182235',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  fallbackAnchorDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#223B6A',
  },
  startCaptionPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAE6DF',
  },
  startCaptionText: {
    ...typography.caption,
    color: '#223B6A',
    fontWeight: '800',
    fontSize: 9,
    letterSpacing: 0.8,
  },
  bottomCard: {
    backgroundColor: '#FDFBF8',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: spacing[5],
    borderWidth: 1,
    borderColor: '#E9E5DE',
    gap: spacing[3],
    shadowColor: '#182235',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 6,
  },
  textGroup: {
    gap: 4,
  },
  intentionPill: {
    backgroundColor: '#FAF5EE',
    borderWidth: 1,
    borderColor: '#EAE6DF',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 2,
  },
  intentionLabel: {
    ...typography.caption,
    fontSize: 9,
    color: '#717686',
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  intentionText: {
    ...typography.bodyMD,
    color: colors.text.primary,
    fontWeight: '600',
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(18, 32, 51, 0.45)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#FDFBF8',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[6],
    borderWidth: 1,
    borderColor: '#E9E5DE',
    gap: spacing[3],
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D5D3CE',
    alignSelf: 'center',
    marginVertical: 10,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sheetEyebrow: {
    ...typography.caption,
    color: '#717686',
    letterSpacing: 1,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  closeButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetTitle: {
    ...typography.headingMD,
    color: colors.text.primary,
    fontSize: 22,
  },
  sheetDesc: {
    ...typography.bodyMD,
    color: '#6B7280',
    lineHeight: 20,
    fontSize: 13.5,
  },
  templateSectionHeader: {
    ...typography.caption,
    color: '#717686',
    fontWeight: '700',
    fontSize: 10,
    letterSpacing: 0.8,
    marginTop: spacing[1],
  },
  templatePicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  templateOption: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAE6DF',
  },
  templateOptionSelected: {
    backgroundColor: '#3157D8',
    borderColor: '#3157D8',
  },
  templateOptionText: {
    ...typography.caption,
    color: '#717686',
    fontWeight: '600',
    fontSize: 11.5,
  },
  templateOptionTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  inputGroup: {
    position: 'relative',
    marginTop: spacing[1],
  },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAE6DF',
    borderRadius: 14,
    padding: spacing[3],
    paddingBottom: 24,
    minHeight: 80,
    ...typography.bodyMD,
    color: colors.text.primary,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  characterCount: {
    position: 'absolute',
    bottom: 8,
    right: 12,
    ...typography.caption,
    color: colors.text.tertiary,
    fontSize: 11,
  },
  fieldErrorText: {
    ...typography.caption,
    color: '#D32F2F',
  },
  sheetActions: {
    flexDirection: 'row',
    gap: spacing[3],
    marginTop: spacing[2],
  },
  cancelButton: {
    flex: 1,
    minHeight: 44,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EAE6DF',
    backgroundColor: '#FFFFFF',
  },
  cancelButtonText: {
    ...typography.labelMD,
    color: colors.text.primary,
    fontWeight: '600',
  },
  submitButton: {
    flex: 1.5,
    minHeight: 44,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#3157D8',
  },
  submitButtonDisabled: {
    opacity: 0.45,
  },
  submitButtonText: {
    ...typography.labelMD,
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
