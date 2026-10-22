import type { ViewStyle } from 'react-native';
import type { V2ThreadEventSignificance } from '@/constants/v2/threadEvents';

export type V2LivingColorTreatment = {
  intensity: 0 | 1 | 2 | 3;
  bloomOpacity: number;
  haloOpacity: number;
  structuralAccent: boolean;
  darkChamber: boolean;
  /** Static treatments are intentionally used for reduced motion. */
  motionMs: number;
};

export function livingColorForEvent(significance: V2ThreadEventSignificance, reducedMotion = false): V2LivingColorTreatment {
  const base: Record<V2ThreadEventSignificance, V2LivingColorTreatment> = {
    LOW: { intensity: 0, bloomOpacity: 0, haloOpacity: 0, structuralAccent: false, darkChamber: false, motionMs: 160 },
    MEDIUM: { intensity: 1, bloomOpacity: 0, haloOpacity: 0.16, structuralAccent: false, darkChamber: false, motionMs: 350 },
    HIGH: { intensity: 2, bloomOpacity: 0.12, haloOpacity: 0.2, structuralAccent: true, darkChamber: false, motionMs: 750 },
    MAJOR: { intensity: 3, bloomOpacity: 0.2, haloOpacity: 0.25, structuralAccent: true, darkChamber: true, motionMs: 950 },
  };
  const treatment = base[significance];
  return reducedMotion ? { ...treatment, bloomOpacity: treatment.bloomOpacity * 0.55, haloOpacity: treatment.haloOpacity * 0.65, motionMs: 0 } : treatment;
}

/** Keep the visual construction to one bloom, one structural accent, and one object halo. */
export function livingColorLayers(treatment: V2LivingColorTreatment, color: string): { bloom: ViewStyle; halo: ViewStyle; ring: ViewStyle } {
  return {
    bloom: { backgroundColor: color, opacity: treatment.bloomOpacity },
    halo: { backgroundColor: color, opacity: treatment.haloOpacity },
    ring: { borderColor: color, opacity: treatment.structuralAccent ? 0.85 : 0 },
  };
}
