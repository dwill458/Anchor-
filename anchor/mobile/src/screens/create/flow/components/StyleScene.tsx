import React, { useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/colors';
import type { RefineStyleOption } from '../../constants/refineStyles';
import { getStyleById } from '../creationStyles';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../creationFlowConfig';
import type { Pt } from '../geometry';
import type { StyleStepState } from '../useStyleStep';
import { AllStylesSheet } from './AllStylesSheet';
import { Reveal } from './Reveal';
import { CHIP_HEIGHT, CHIP_WIDTH, StyleChip } from './StyleChip';

const SLOT = { x0: 20, y: 492, gap: 10 };

interface StyleSceneProps {
  step: StyleStepState;
  /** The anchor's own strokes, drawn small on every swatch. */
  strokes: Pt[][];
  reduceMotion: boolean;
  onOpenAll: () => void;
  onPick: (style: RefineStyleOption) => void;
}

/**
 * Beat 5 — the style step, before anything is generated. Three chips and "All", the default
 * pre-selected, and "Form it →" as the only trigger. This is a view over `useStyleStep`, which owns
 * the behaviour.
 *
 * Laid out in the 390x844 design space on the ink band, so everything here is cream on ink.
 */
export function StyleScene({ step, strokes, reduceMotion, onOpenAll, onPick }: StyleSceneProps) {
  const chips = step.chipIds.map((id) => getStyleById(id)).filter((s): s is RefineStyleOption => Boolean(s));
  // Chips present on arrival fade in with the scene. One swapped in later (picked from All) is
  // simply there: fading it up from zero under a fresh selection ring read as dimmed.
  const arrivalIds = useRef(new Set(step.chipIds)).current;

  return (
    <View style={styles.root} pointerEvents="box-none">
      <Reveal delay={180} reduceMotion={reduceMotion} style={styles.prompt}>
        <Text style={styles.promptText}>Choose a style.</Text>
      </Reveal>

      {chips.map((style, index) => {
        const left = SLOT.x0 + index * (CHIP_WIDTH + SLOT.gap) - 3;
        const selected = style.id === step.selectedId;
        return (
          <Reveal
            key={style.id}
            delay={210 + index * 70}
            reduceMotion={reduceMotion || !arrivalIds.has(style.id)}
            style={[styles.slot, { left, top: SLOT.y - 3 }]}
          >
            <StyleChip
              style={style}
              selected={selected}
              onPress={() => step.select(style.id)}
              strokes={strokes}
              accessibilityHint={style.id === step.defaultId ? 'Recommended' : undefined}
            />
            <Text style={[styles.name, selected && styles.nameSelected]} numberOfLines={2}>
              {style.displayName}
            </Text>
            {selected && step.showsLongerWait ? (
              <View style={styles.newTag} accessibilityLabel="New style, takes a little longer">
                <Text style={styles.newTagText}>new — takes a little longer</Text>
              </View>
            ) : null}
          </Reveal>
        );
      })}

      <Reveal
        delay={210 + chips.length * 70}
        reduceMotion={reduceMotion}
        style={[styles.slot, { left: SLOT.x0 + chips.length * (CHIP_WIDTH + SLOT.gap) - 3, top: SLOT.y - 3 }]}
      >
        <Pressable
          onPress={onOpenAll}
          accessibilityRole="button"
          accessibilityLabel="All styles"
          style={styles.allTile}
        >
          <View style={styles.allGrid}>
            {Array.from({ length: 6 }).map((_, i) => (
              <View key={i} style={styles.allCell} />
            ))}
          </View>
        </Pressable>
        <Text style={styles.name}>All</Text>
      </Reveal>

      {/* The only trigger: nothing forms until this is pressed. */}
      <Reveal delay={420} duration={240} reduceMotion={reduceMotion} style={styles.commitWrap}>
        <Pressable
          onPress={step.commit}
          accessibilityRole="button"
          accessibilityLabel="Form it"
          style={styles.pill}
        >
          <Text style={styles.pillText}>Form it →</Text>
        </Pressable>
      </Reveal>

      <AllStylesSheet
        open={step.sheetOpen}
        selectedId={step.selectedId}
        strokes={strokes}
        onPick={(style) => {
          step.select(style.id);
          step.closeSheet();
          onPick(style);
        }}
        onClose={step.closeSheet}
        reduceMotion={reduceMotion}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', left: 0, top: 0, width: DESIGN_WIDTH, height: DESIGN_HEIGHT },
  prompt: { position: 'absolute', left: 0, right: 0, top: 449, alignItems: 'center' },
  promptText: {
    fontFamily: 'EBGaramond-Regular',
    fontSize: 20,
    color: colors.creation.cream,
    textAlign: 'center',
  },
  slot: { position: 'absolute', width: CHIP_WIDTH + 6, alignItems: 'center' },
  name: {
    fontFamily: 'Figtree-Regular',
    fontSize: 12,
    lineHeight: 15,
    color: colors.creation.cream,
    opacity: 0.6,
    marginTop: 6,
    textAlign: 'center',
    minHeight: 30,
  },
  nameSelected: { opacity: 0.95 },
  allTile: {
    width: CHIP_WIDTH,
    height: CHIP_HEIGHT,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.creation.cream,
    borderStyle: 'dashed',
    opacity: 0.55,
    alignItems: 'center',
    justifyContent: 'center',
  },
  allGrid: { width: 40, flexDirection: 'row', flexWrap: 'wrap', gap: 2 },
  allCell: { width: 12, height: 14, backgroundColor: colors.creation.cream, opacity: 0.8 },
  commitWrap: { position: 'absolute', left: 0, right: 0, top: 690, alignItems: 'center' },
  pill: {
    width: 124,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.creation.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillText: { fontFamily: 'Figtree-SemiBold', fontSize: 14, color: colors.creation.ink },
  // A tag, not a disabled look: full-strength cream outline, never a dimmed chip.
  newTag: {
    marginTop: 2,
    borderWidth: 1,
    borderColor: 'rgba(244, 237, 224, 0.5)',
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  newTagText: {
    fontFamily: 'Figtree-Regular',
    fontSize: 10,
    lineHeight: 12,
    color: colors.creation.cream,
    opacity: 0.9,
    textAlign: 'center',
  },
});
