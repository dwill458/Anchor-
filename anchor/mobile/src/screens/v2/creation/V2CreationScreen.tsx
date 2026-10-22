import React from 'react';

import {
  V2CreationFlow,
  type CreationGenerationAdapter,
  type CreationHandoff,
  type CreationSaveAdapter,
  type V2CreationFlowProps,
} from '@/components/v2/creation/V2CreationFlow';
import type { CreationDraft } from '@/stores/v2/creationStore';

export type V2CreationScreenProps = V2CreationFlowProps;

/**
 * The single screen registered under `CREATION_ROUTE_NAME` ('V2Creation'). It owns no backend
 * contract and no navigation; the navigator supplies both through these adapters.
 */
export function V2CreationScreen(props: V2CreationScreenProps) {
  return <V2CreationFlow {...props} />;
}

export type { CreationGenerationAdapter, CreationHandoff, CreationSaveAdapter, CreationDraft };
