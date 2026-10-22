import type { AskActionStatus, AskMessage, AskMode, AskPlanInput, AskStage, AskTurnResult } from '@/services/v2/askChartApi';
import type { ChartFailureKind } from '@/services/v2/chartV2Api';

/**
 * Conversation state for Ask Chart, kept as a pure reducer so the rules that matter (ordering, retry, stable keys,
 * what counts as "sent") can be tested without rendering anything.
 */

export type AskSendStatus = 'sent' | 'queued' | 'sending' | 'failed';

export type AskUiMessage = AskMessage & {
  /** Never changes for a message, so a list item is not remounted when the server's copy replaces the local one. */
  key: string;
  status: AskSendStatus;
  /** Only messages created during this visit animate in; restored history appears at rest. */
  animate: boolean;
  /** The idempotency key for this message's turn. Reused on every retry. */
  sendKey?: string;
  /** Local thumbnails of photos sent with this message (this visit only; restored history shows a label instead). */
  previewUris?: string[];
};

export type AskError = { kind: ChartFailureKind | 'cancelled'; messageKey: string | null };

export type AskState = {
  status: 'loading' | 'ready' | 'load_failed';
  conversationId: string | null;
  mode: AskMode | null;
  messages: AskUiMessage[];
  /** The assistant's reply while it is still being written. */
  draft: { key: string; text: string } | null;
  turn: 'idle' | 'thinking' | 'streaming';
  stage: AskStage | null;
  error: AskError | null;
  /** The greeting could not be fetched; retry re-runs it with the same key. */
  openingFailed: boolean;
};

export const initialAskState: AskState = {
  status: 'loading',
  conversationId: null,
  mode: null,
  messages: [],
  draft: null,
  turn: 'idle',
  stage: null,
  error: null,
  openingFailed: false,
};

export type AskAction =
  | { type: 'loaded'; conversationId: string | null; mode: AskMode; messages: AskMessage[] }
  | { type: 'load_failed' }
  | { type: 'queued'; message: AskUiMessage }
  | { type: 'turn_started'; messageKey: string | null; draftKey: string }
  | { type: 'delta'; text: string }
  | { type: 'stage'; stage: AskStage }
  | { type: 'turn_done'; messageKey: string | null; draftKey: string; result: AskTurnResult; animate: boolean }
  | { type: 'turn_failed'; messageKey: string | null; kind: ChartFailureKind | 'cancelled' }
  | { type: 'cleared' }
  | { type: 'reset' }
  /** A proposal was applied or dismissed on the server. */
  | { type: 'action_status'; messageId: string; status: AskActionStatus }
  /** Re-read statuses from the server (e.g. a route revision was applied on another screen). Nothing else changes. */
  | { type: 'sync_actions'; messages: AskMessage[] };

const fromServer = (message: AskMessage, key: string, animate: boolean): AskUiMessage => ({ ...message, key, status: 'sent', animate });

export function askReducer(state: AskState, action: AskAction): AskState {
  switch (action.type) {
    case 'loaded':
      return {
        ...state,
        status: 'ready',
        conversationId: action.conversationId,
        mode: action.mode,
        messages: action.messages.map(message => fromServer(message, message.id, false)),
      };
    case 'load_failed':
      return { ...state, status: 'load_failed' };
    case 'queued':
      return { ...state, messages: [...state.messages, action.message], error: state.error && state.error.messageKey === null ? null : state.error };
    case 'turn_started':
      return {
        ...state,
        turn: 'thinking',
        stage: null,
        error: null,
        openingFailed: false,
        draft: { key: action.draftKey, text: '' },
        messages: state.messages.map(message => (message.key === action.messageKey ? { ...message, status: 'sending' } : message)),
      };
    case 'delta':
      return state.draft ? { ...state, turn: 'streaming', draft: { ...state.draft, text: action.text } } : state;
    case 'stage':
      return { ...state, stage: action.stage };
    case 'turn_done': {
      const { result } = action;
      const assistant = fromServer(result.assistantMessage, action.draftKey, action.animate);
      const messages = state.messages.map(message =>
        message.key === action.messageKey && result.userMessage
          ? { ...fromServer(result.userMessage, message.key, false), animate: message.animate }
          : message.key === action.messageKey
            ? { ...message, status: 'sent' as const }
            : message
      );
      // A replayed answer may already be on screen (restored history); never show it twice.
      const withoutDuplicate = messages.filter(message => message.id !== assistant.id);
      // The answer belongs directly after the message it answers, even if the person has typed more since.
      const after = withoutDuplicate.findIndex(message => message.key === action.messageKey);
      const ordered = after < 0 ? [...withoutDuplicate, assistant] : [...withoutDuplicate.slice(0, after + 1), assistant, ...withoutDuplicate.slice(after + 1)];
      return {
        ...state,
        conversationId: result.conversationId,
        mode: result.mode,
        messages: ordered,
        draft: null,
        turn: 'idle',
        stage: null,
        error: null,
        openingFailed: false,
      };
    }
    case 'turn_failed':
      return {
        ...state,
        draft: null,
        turn: 'idle',
        stage: null,
        error: { kind: action.kind, messageKey: action.messageKey },
        openingFailed: action.messageKey === null,
        messages: state.messages.map(message => (message.key === action.messageKey ? { ...message, status: 'failed' } : message)),
      };
    case 'reset':
      return initialAskState;
    case 'action_status':
      return {
        ...state,
        messages: state.messages.map(message => (message.id === action.messageId && message.action ? { ...message, action: { ...message.action, status: action.status } } : message)),
      };
    case 'sync_actions': {
      const latest = new Map(action.messages.filter(message => message.action).map(message => [message.id, message.action!.status]));
      let changed = false;
      const messages = state.messages.map(message => {
        const status = latest.get(message.id);
        if (!message.action || !status || status === message.action.status) return message;
        changed = true;
        return { ...message, action: { ...message.action, status } };
      });
      return changed ? { ...state, messages } : state;
    }
    case 'cleared':
      return { ...initialAskState, status: 'ready', conversationId: null, mode: state.mode };
  }
}

/** The assistant's latest message, only while nothing from the person has followed it. */
export function latestAssistant(state: AskState): AskUiMessage | null {
  const last = state.messages[state.messages.length - 1];
  return last && last.role === 'ASSISTANT' ? last : null;
}

export type AskAffordances = {
  suggestions: string[];
  requestPhoto: { reason: string } | null;
  planInput: AskPlanInput | null;
};

/** What the composer area offers right now: only ever from the newest assistant message, and not mid-turn. */
export function affordances(state: AskState): AskAffordances {
  const last = state.turn === 'idle' ? latestAssistant(state) : null;
  return {
    suggestions: last?.suggestions ?? [],
    requestPhoto: last?.requestPhoto ?? null,
    planInput: last?.readyToPlan ? last.planInput : null,
  };
}

/**
 * A plan request built only from what the person actually wrote, for "Draft my route now". Nothing is invented:
 * with no messages at all the route is planned from the intention alone.
 */
export function draftPlanInput(messages: AskUiMessage[], intention: string): AskPlanInput {
  const written = messages.filter(message => message.role === 'USER' && message.status !== 'failed');
  const said = written
    .map(message => message.text.trim())
    .filter(Boolean)
    .join(' ')
    .slice(0, 500);
  const photoAssetIds = written
    .flatMap(message => message.attachments.map(item => item.assetId))
    .filter(id => !id.startsWith('local-'))
    .slice(-3);
  return { actualStartingPoint: said || intention.slice(0, 500), startingContext: null, photoAssetIds };
}
