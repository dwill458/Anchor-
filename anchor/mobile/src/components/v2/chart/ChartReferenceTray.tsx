import { chartTypography as typography } from './chartTypography';
import React, { useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Camera, FileText, MapPin, X } from 'lucide-react-native';
import { CHART_COPY } from '@/constants/v2/chartCopy';
import { pickVisionPhoto, type VisionPhotoSource } from '@/hooks/v2/vision/visionPhotoInput';
import { colors, radii, spacing } from '@/theme/v2';
import {
  MAX_CHART_REFERENCES,
  MAX_DOCUMENT_CHARS,
  referenceId,
  type ChartReference,
} from './chartReferences';

type Kind = 'photo' | 'place' | 'document';

type Props = {
  references: ChartReference[];
  onChange: (next: ChartReference[]) => void;
  /** Which kinds to offer. The context step offers only the photo (see ChartContextStep). */
  kinds?: Kind[];
  testID?: string;
};

const COPY = CHART_COPY.followUp;

/**
 * Add-a-reference row: Photo, Place, Document. Photos use the shared Vision picker (camera or library).
 * Place and Document open a small inline field. Added references show as removable chips.
 */
export function ChartReferenceTray({ references, onChange, kinds = ['photo', 'place', 'document'], testID }: Props) {
  const [open, setOpen] = useState<'place' | 'document' | null>(null);
  const [placeText, setPlaceText] = useState('');
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [documentText, setDocumentText] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const full = references.length >= MAX_CHART_REFERENCES;

  const add = (reference: ChartReference) => {
    setNotice(null);
    onChange([...references, reference]);
  };
  const remove = (id: string) => onChange(references.filter((reference) => reference.id !== id));

  const pick = async (source: VisionPhotoSource) => {
    const result = await pickVisionPhoto(source);
    if (result.status === 'picked') {
      add({ kind: 'photo', id: referenceId(), uri: result.photo.uri, mimeType: result.photo.mimeType, role: 'extra' });
    } else if (result.status === 'denied' || result.status === 'error') {
      setNotice(result.message);
    }
  };

  const choosePhoto = () => {
    if (full) return setNotice(COPY.limit);
    Alert.alert(COPY.photo, undefined, [
      { text: COPY.takePhoto, onPress: () => void pick('camera') },
      { text: COPY.choosePhoto, onPress: () => void pick('library') },
      { text: COPY.cancel, style: 'cancel' },
    ]);
  };

  const useLocation = async () => {
    try {
      // Lazy: the module is only needed if the person asks for their location.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Location = require('expo-location') as typeof import('expo-location');
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') return setNotice('Allow location access to add where you are.');
      const position = await Location.getCurrentPositionAsync({});
      setCoords({ latitude: position.coords.latitude, longitude: position.coords.longitude });
      if (!placeText.trim()) setPlaceText(COPY.currentLocation);
    } catch {
      setNotice('Your location is not available right now.');
    }
  };

  const addPlace = () => {
    const label = placeText.trim();
    if (!label) return;
    add({ kind: 'place', id: referenceId(), label: label.slice(0, 120), ...(coords ?? {}) });
    setPlaceText('');
    setCoords(null);
    setOpen(null);
  };

  const addDocument = () => {
    const text = documentText.trim();
    if (!text) return;
    // TODO(privacy): documents are sent for one request and not stored; the storage policy is still undecided.
    add({ kind: 'document', id: referenceId(), name: COPY.documentName, text: text.slice(0, MAX_DOCUMENT_CHARS) });
    setDocumentText('');
    setOpen(null);
  };

  const toggle = (kind: 'place' | 'document') => {
    if (full) return setNotice(COPY.limit);
    setOpen((current) => (current === kind ? null : kind));
  };

  return (
    <View testID={testID} style={styles.root}>
      <View style={styles.row}>
        {kinds.includes('photo') ? (
          <Pressable accessibilityRole="button" accessibilityLabel={COPY.photo} onPress={choosePhoto} style={styles.kind} testID="chart-reference-photo">
            <Camera size={20} color={colors.text.primary} />
            <Text style={styles.kindLabel}>{COPY.photo}</Text>
          </Pressable>
        ) : null}
        {kinds.includes('place') ? (
          <Pressable accessibilityRole="button" accessibilityLabel={COPY.place} onPress={() => toggle('place')} style={styles.kind} testID="chart-reference-place">
            <MapPin size={20} color={colors.text.primary} />
            <Text style={styles.kindLabel}>{COPY.place}</Text>
          </Pressable>
        ) : null}
        {kinds.includes('document') ? (
          <Pressable accessibilityRole="button" accessibilityLabel={COPY.document} onPress={() => toggle('document')} style={styles.kind} testID="chart-reference-document">
            <FileText size={20} color={colors.text.primary} />
            <Text style={styles.kindLabel}>{COPY.document}</Text>
          </Pressable>
        ) : null}
      </View>

      {open === 'place' ? (
        <View style={styles.form} testID="chart-reference-place-form">
          <TextInput
            value={placeText}
            onChangeText={setPlaceText}
            placeholder={COPY.placePlaceholder}
            placeholderTextColor={colors.text.tertiary}
            maxLength={120}
            accessibilityLabel={COPY.place}
            style={styles.input}
            testID="chart-reference-place-input"
          />
          <View style={styles.formActions}>
            <Pressable accessibilityRole="button" onPress={() => void useLocation()} style={styles.link} testID="chart-reference-use-location">
              <Text style={styles.linkText}>{coords ? `${COPY.useLocation} ✓` : COPY.useLocation}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={addPlace} disabled={!placeText.trim()} style={[styles.add, !placeText.trim() && styles.addOff]} testID="chart-reference-place-add">
              <Text style={styles.addText}>{COPY.add}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {open === 'document' ? (
        <View style={styles.form} testID="chart-reference-document-form">
          <TextInput
            value={documentText}
            onChangeText={setDocumentText}
            placeholder={COPY.documentPlaceholder}
            placeholderTextColor={colors.text.tertiary}
            maxLength={MAX_DOCUMENT_CHARS}
            multiline
            accessibilityLabel={COPY.document}
            style={[styles.input, styles.inputTall]}
            testID="chart-reference-document-input"
          />
          <View style={styles.formActions}>
            <View />
            <Pressable accessibilityRole="button" onPress={addDocument} disabled={!documentText.trim()} style={[styles.add, !documentText.trim() && styles.addOff]} testID="chart-reference-document-add">
              <Text style={styles.addText}>{COPY.add}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {references.length ? (
        <View style={styles.chips} testID="chart-reference-list">
          {references.map((reference) => (
            <View key={reference.id} style={styles.chip}>
              {reference.kind === 'photo' ? (
                <Image source={{ uri: reference.uri }} style={styles.thumb} accessibilityIgnoresInvertColors />
              ) : reference.kind === 'place' ? (
                <MapPin size={14} color={colors.text.secondary} />
              ) : (
                <FileText size={14} color={colors.text.secondary} />
              )}
              <Text style={styles.chipText} numberOfLines={1}>
                {reference.kind === 'photo' ? COPY.photo : reference.kind === 'place' ? reference.label : reference.name}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${COPY.remove} ${reference.kind}`}
                onPress={() => remove(reference.id)}
                hitSlop={8}
                testID={`chart-reference-remove-${reference.id}`}
              >
                <X size={14} color={colors.text.secondary} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
      {notice ? <Text style={styles.notice} accessibilityLiveRegion="polite">{notice}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing[3] },
  row: { flexDirection: 'row', gap: spacing[2] },
  kind: {
    flex: 1,
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.default,
    backgroundColor: colors.surface,
  },
  kindLabel: { ...typography.labelSM, color: colors.text.secondary },
  form: { gap: spacing[2] },
  input: {
    ...typography.bodyMD,
    color: colors.text.primary,
    minHeight: 46,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  inputTall: { minHeight: 96, maxHeight: 160, textAlignVertical: 'top' },
  formActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  link: { minHeight: 44, justifyContent: 'center' },
  linkText: { ...typography.labelMD, color: colors.text.secondary, textDecorationLine: 'underline' },
  add: { minHeight: 40, paddingHorizontal: spacing[4], borderRadius: radii.pill, backgroundColor: colors.text.primary, alignItems: 'center', justifyContent: 'center' },
  addOff: { opacity: 0.4 },
  addText: { ...typography.labelMD, color: colors.text.inverse },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    maxWidth: '100%',
    paddingVertical: 6,
    paddingHorizontal: spacing[3],
    borderRadius: radii.pill,
    backgroundColor: colors.grouped,
  },
  thumb: { width: 22, height: 22, borderRadius: 4 },
  chipText: { ...typography.labelMD, color: colors.text.primary, flexShrink: 1 },
  notice: { ...typography.bodySM, color: colors.text.secondary },
});
