import { create } from 'zustand';

export type PostPrimeTraceFlowResult = 'pending' | 'completed' | 'skipped';

export interface PostPrimeTraceFlow {
  flowId: string;
  anchorId: string;
  result: PostPrimeTraceFlowResult;
}

interface PostPrimeTraceState {
  activeFlow: PostPrimeTraceFlow | null;
  beginFlow: (anchorId: string) => string;
  finishFlow: (flowId: string, result: Exclude<PostPrimeTraceFlowResult, 'pending'>) => void;
  clearFlow: (flowId?: string) => void;
}

const createFlowId = (): string =>
  `post-prime-trace-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const usePostPrimeTraceStore = create<PostPrimeTraceState>((set) => ({
  activeFlow: null,

  beginFlow: (anchorId) => {
    const flowId = createFlowId();

    set({
      activeFlow: {
        flowId,
        anchorId,
        result: 'pending',
      },
    });

    return flowId;
  },

  finishFlow: (flowId, result) =>
    set((state) => {
      if (!state.activeFlow || state.activeFlow.flowId !== flowId) {
        return state;
      }

      return {
        activeFlow: {
          ...state.activeFlow,
          result,
        },
      };
    }),

  clearFlow: (flowId) =>
    set((state) => {
      if (!state.activeFlow) {
        return state;
      }

      if (flowId && state.activeFlow.flowId !== flowId) {
        return state;
      }

      return {
        activeFlow: null,
      };
    }),
}));
