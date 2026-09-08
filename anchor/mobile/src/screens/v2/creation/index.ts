/**
 * UI-C creation entry point. Central navigation registration intentionally belongs to the
 * integration branch — it imports `V2CreationScreen` and registers it under `CREATION_ROUTE_NAME`.
 * UI-C never edits `navigation/v2/*`.
 */
export { V2CreationScreen } from './V2CreationScreen';
export type { V2CreationScreenProps } from './V2CreationScreen';

export { V2CreationFlow } from '@/components/v2/creation/V2CreationFlow';
export type { CreationSaveAdapter, V2CreationFlowProps } from '@/components/v2/creation/V2CreationFlow';

export {
  CREATION_ROUTE_NAME,
  CREATION_ROUTE_MANIFEST,
  creationRouteDefinitions,
} from '@/constants/v2/creation';

export type {
  AnchorCandidate,
  CreationContinuation,
  CreationDraft,
} from '@/stores/v2/creationStore';
