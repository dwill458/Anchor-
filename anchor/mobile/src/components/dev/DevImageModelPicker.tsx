import React, { useState } from 'react';
import { Keyboard, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Settings2 } from 'lucide-react-native';
import { DEV_IMAGE_MODELS, useDevImageModelStore, type DevImagePurpose } from '@/stores/devImageModelStore';
import { colors } from '@/theme/colors';

/** A compact development control; selecting a model affects the next request only. */
export function DevImageModelPicker({ purpose, disabled = false, tone = 'default', compact = false }: { purpose: DevImagePurpose; disabled?: boolean; tone?: 'default' | 'paper'; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const model = useDevImageModelStore(state => state[purpose]);
  const select = useDevImageModelStore(state => state.select);
  if (!__DEV__) return null;
  const label = DEV_IMAGE_MODELS.find(item => item.id === model)?.label ?? 'Auto';
  const options = [{ id: null, label: 'Auto — normal routing' }, ...DEV_IMAGE_MODELS];
  return <>
    <Pressable testID={`dev-image-model-${purpose}`} accessibilityRole="button" accessibilityLabel={`Dev model: ${label}`}
      accessibilityState={{ disabled }} disabled={disabled} onPress={() => { Keyboard.dismiss(); setOpen(true); }} style={[styles.trigger, tone === 'paper' && styles.triggerPaper, compact && styles.triggerCompact]}>
      {compact ? <Settings2 size={15} color={tone === 'paper' ? colors.creation.ink : colors.creation.cream} /> : <Text style={[styles.triggerText, tone === 'paper' && styles.triggerTextPaper]}>Dev model: {label} ▾</Text>}
    </Pressable>
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel="Close model picker" onPress={() => setOpen(false)} />
        <View accessibilityViewIsModal style={styles.sheet}>
          <Text accessibilityRole="header" style={styles.title}>Compare image models</Text>
          <Text style={styles.note}>Developer account required. Pinned models run without provider fallback.</Text>
          {options.map(option => <Pressable key={option.id ?? 'auto'} accessibilityRole="radio"
            accessibilityLabel={option.label} accessibilityState={{ selected: model === option.id }}
            onPress={() => { select(purpose, option.id); setOpen(false); }} style={styles.option}>
            <Text style={styles.optionText}>{model === option.id ? '●' : '○'}  {option.label}</Text>
          </Pressable>)}
          <Pressable accessibilityRole="button" accessibilityLabel="Done" onPress={() => setOpen(false)} style={styles.option}><Text style={styles.optionText}>Done</Text></Pressable>
        </View>
      </View>
    </Modal>
  </>;
}

const styles = StyleSheet.create({
  trigger: { minHeight: 44, paddingHorizontal: 12, alignSelf: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.creation.ink },
  triggerText: { fontFamily: 'Figtree-Regular', fontSize: 12, color: colors.creation.cream },
  triggerPaper: { paddingHorizontal: 8, borderRadius: 0, backgroundColor: 'transparent' },
  triggerCompact: { width: 44, height: 44, minHeight: 44, paddingHorizontal: 0, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: 'transparent' },
  triggerTextPaper: { fontSize: 13, color: colors.creation.ink },
  overlay: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: { borderRadius: 18, padding: 20, backgroundColor: colors.creation.cream },
  title: { fontFamily: 'Figtree-SemiBold', fontSize: 18, color: colors.creation.ink },
  note: { marginVertical: 12, fontFamily: 'Figtree-Regular', fontSize: 12, lineHeight: 18, color: colors.creation.ink },
  option: { minHeight: 48, justifyContent: 'center' },
  optionText: { fontFamily: 'Figtree-Regular', fontSize: 15, color: colors.creation.ink },
});
