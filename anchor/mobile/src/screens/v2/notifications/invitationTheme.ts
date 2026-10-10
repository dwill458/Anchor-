import { StyleSheet } from 'react-native';
import { colors, spacing, typography } from '@/theme/v2';

/**
 * Shared surface language for the invitation and reminder-time screens: cream paper, an
 * EB Garamond display headline (as Home and Chart use), Inter body, ink pill CTA (V2Button), and a
 * warm gold accent drawn from the paywall palette.
 */
export const INVITATION_TOKENS = {
  paper: colors.cream,
  card: colors.surface,
  ink: colors.text.primary,
  inkSoft: colors.text.secondary,
  line: colors.border.subtle,
  gold: colors.paywall.goldDeep,
  goldSoft: 'rgba(201, 154, 69, 0.12)',
  goldEdge: 'rgba(201, 154, 69, 0.28)',
  warm: '#F6EBD6',
} as const;

export const invitationStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: INVITATION_TOKENS.paper },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: spacing[5],
  },
  wordmark: { ...typography.labelSM, letterSpacing: 2.4, color: INVITATION_TOKENS.ink },
  notNow: { ...typography.labelMD, color: INVITATION_TOKENS.inkSoft },
  notNowHit: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing[1] },
  headline: {
    fontFamily: 'EBGaramond-Medium',
    fontSize: 32,
    lineHeight: 37,
    letterSpacing: -0.4,
    color: INVITATION_TOKENS.ink,
    textAlign: 'center',
  },
  support: { ...typography.bodyMD, color: INVITATION_TOKENS.inkSoft, textAlign: 'center' },
  card: {
    backgroundColor: INVITATION_TOKENS.card,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: INVITATION_TOKENS.line,
    shadowColor: '#2A2418',
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  footer: { paddingHorizontal: spacing[5], paddingTop: spacing[3], gap: spacing[2] },
  secondaryHit: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { ...typography.labelMD, color: INVITATION_TOKENS.inkSoft, textDecorationLine: 'underline' },
});
