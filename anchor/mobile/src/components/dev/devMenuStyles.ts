import { StyleSheet } from 'react-native';
import { colors, radii } from '@/theme/v2';

/** Shared controls for both tabs of the developer pill. */
export const devMenuStyles = StyleSheet.create({
  actionRow: { backgroundColor: '#EDE8DF', paddingVertical: 12, paddingHorizontal: 14, borderRadius: radii.sm, marginBottom: 8 },
  actionRowText: { color: colors.ink.base, fontSize: 14, fontWeight: '600' },
  actionRowDanger: { backgroundColor: 'rgba(180, 40, 40, 0.1)', paddingVertical: 12, paddingHorizontal: 14, borderRadius: radii.sm, marginBottom: 8 },
  actionRowDangerText: { color: '#A02020', fontSize: 13, fontWeight: '600' },
  sectionLabel: { color: colors.text.secondary, fontSize: 12, fontWeight: '700', marginBottom: 8 },
  divider: { height: 1, backgroundColor: '#DDD6C9', marginVertical: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: { minHeight: 44, justifyContent: 'center', backgroundColor: '#EDE8DF', paddingVertical: 8, paddingHorizontal: 12, borderRadius: radii.sm },
  chipActive: { backgroundColor: colors.ink.base },
  chipText: { color: colors.ink.base, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: '#FAF7F2' },
  hint: { color: colors.text.secondary, fontSize: 12, lineHeight: 17, marginTop: 4 },
});
