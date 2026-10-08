import { useCreationReduceMotion } from '@/hooks/useReduceMotionEnabled';

/**
 * The single Reduce Motion source for celebration scenes (the Home arrival and any future one):
 * the in-app preference OR the system setting, resolved by the same logic creation uses. This is an
 * alias rather than a copy, so celebration scenes and creation can never disagree about it.
 */
export const useCelebrationReduceMotion = useCreationReduceMotion;
