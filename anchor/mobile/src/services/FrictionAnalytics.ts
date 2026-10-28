import { AnalyticsEvents, AnalyticsService } from './AnalyticsService';

export type FrictionFlow =
  | 'anchor_creation'
  | 'activation'
  | 'paywall'
  | 'burn_release'
  | 'onboarding_auth'
  | 'practice'
  | 'vision'
  | 'chart'
  | 'weekly_insight';

type RouteFlowStep = {
  flow: FrictionFlow;
  step: string;
};

export interface FrictionEventProperties {
  source?: string;
  duration_ms?: number;
  attempt?: number;
  reason?: string;
  error_code?: string;
  anchor_count?: number;
  subscription_status?: 'free' | 'trial' | 'expired' | 'pro' | 'unknown';
  is_first_anchor?: boolean;
  [key: string]: unknown;
}

type ActiveFlowState = {
  flowSessionId: string;
  startedAt: number;
  currentStep?: string;
  currentStepStartedAt?: number;
  attemptsByStep: Record<string, number>;
};

const ROUTE_FLOW_STEPS: Record<string, RouteFlowStep> = {
  LogoBreath: { flow: 'onboarding_auth', step: 'logo_breath' },
  Welcome: { flow: 'onboarding_auth', step: 'narrative' },
  Login: { flow: 'onboarding_auth', step: 'login' },
  SignUp: { flow: 'onboarding_auth', step: 'signup' },
  SaveProgress: { flow: 'onboarding_auth', step: 'save_progress' },
  AuthGate: { flow: 'onboarding_auth', step: 'auth_gate' },
  TrialSignUp: { flow: 'onboarding_auth', step: 'trial_signup' },

  FirstAnchorCreation: { flow: 'anchor_creation', step: 'intention_input' },
  CreateAnchor: { flow: 'anchor_creation', step: 'returning_intention' },
  LetterDistillation: { flow: 'anchor_creation', step: 'letter_distillation' },
  SigilSelection: { flow: 'anchor_creation', step: 'structure_forge' },
  DistillationAnimation: { flow: 'anchor_creation', step: 'distillation_animation' },
  StructureForge: { flow: 'anchor_creation', step: 'structure_forge' },
  ManualReinforcement: { flow: 'anchor_creation', step: 'manual_reinforcement' },
  LockStructure: { flow: 'anchor_creation', step: 'lock_structure' },
  EnhancementChoice: { flow: 'anchor_creation', step: 'enhancement_choice' },
  StyleSelection: { flow: 'anchor_creation', step: 'style_selection' },
  ManualForge: { flow: 'anchor_creation', step: 'manual_forge' },
  AIGenerating: { flow: 'anchor_creation', step: 'ai_generating' },
  AIVariationPicker: { flow: 'anchor_creation', step: 'variation_picker' },
  EnhancedVersionPicker: { flow: 'anchor_creation', step: 'variation_picker' },
  AnchorReveal: { flow: 'anchor_creation', step: 'anchor_reveal' },
  WallpaperPrompt: { flow: 'anchor_creation', step: 'wallpaper_prompt' },
  // Per-beat steps are fired by the flow itself; the route entry marks the handoff from Intention.
  AnchorCreationFlow: { flow: 'anchor_creation', step: 'intention_handoff' },

  ChargeSetup: { flow: 'activation', step: 'charge_setup' },
  Ritual: { flow: 'activation', step: 'ritual' },
  SealAnchor: { flow: 'activation', step: 'seal_anchor' },
  ChargeComplete: { flow: 'activation', step: 'charge_complete' },
  FirstPrimeComplete: { flow: 'activation', step: 'first_prime_complete' },
  ActivationRitual: { flow: 'activation', step: 'activation_ritual' },

  ConfirmBurn: { flow: 'burn_release', step: 'confirm_burn' },
  BurningRitual: { flow: 'burn_release', step: 'burning_ritual' },

  Paywall: { flow: 'paywall', step: 'paywall' },
  V2Paywall: { flow: 'paywall', step: 'paywall' },

  // Anchor 2.0 routes
  V2FirstRun: { flow: 'onboarding_auth', step: 'first_run' },
  V2Auth: { flow: 'onboarding_auth', step: 'v2_auth' },
  V2Creation: { flow: 'anchor_creation', step: 'v2_creation' },
  V2Practice: { flow: 'practice', step: 'practice_hub' },
  V2PracticeSession: { flow: 'practice', step: 'practice_session' },
  V2Vision: { flow: 'vision', step: 'vision_board' },
  V2Chart: { flow: 'chart', step: 'chart_active' },
  V2ChartAdjust: { flow: 'chart', step: 'chart_adjust' },
  V2ChartAsk: { flow: 'chart', step: 'ask_chart' },
  V2Release: { flow: 'burn_release', step: 'v2_release' },
  V2WeeklyInsight: { flow: 'weekly_insight', step: 'weekly_insight' },
};

const FRICTION_EVENT_NAMES = {
  FLOW_STARTED: AnalyticsEvents?.FLOW_STARTED ?? 'flow_started',
  FLOW_STEP_VIEWED: AnalyticsEvents?.FLOW_STEP_VIEWED ?? 'flow_step_viewed',
  FLOW_STEP_COMPLETED: AnalyticsEvents?.FLOW_STEP_COMPLETED ?? 'flow_step_completed',
  FLOW_STEP_ABANDONED: AnalyticsEvents?.FLOW_STEP_ABANDONED ?? 'flow_step_abandoned',
  FLOW_BLOCKED: AnalyticsEvents?.FLOW_BLOCKED ?? 'flow_blocked',
  FLOW_RETRY: AnalyticsEvents?.FLOW_RETRY ?? 'flow_retry',
  FLOW_ERROR: AnalyticsEvents?.FLOW_ERROR ?? 'flow_error',
  FLOW_COMPLETED: AnalyticsEvents?.FLOW_COMPLETED ?? 'flow_completed',
} as const;

const now = (): number => Date.now();

const createFlowSessionId = (flow: FrictionFlow): string =>
  `${flow}_${now()}_${Math.round(Math.random() * 100000)}`;

class FrictionAnalyticsClient {
  private activeFlows: Partial<Record<FrictionFlow, ActiveFlowState>> = {};

  private getState(flow: FrictionFlow, props?: FrictionEventProperties): ActiveFlowState {
    const existing = this.activeFlows[flow];
    if (existing) {
      return existing;
    }

    return this.startFlow(flow, props);
  }

  private track(
    eventName: string,
    flow: FrictionFlow,
    state: ActiveFlowState,
    props?: FrictionEventProperties
  ): void {
    AnalyticsService.track(eventName, {
      flow,
      flow_session_id: state.flowSessionId,
      ...props,
    });
  }

  startFlow(flow: FrictionFlow, props?: FrictionEventProperties): ActiveFlowState {
    const state: ActiveFlowState = {
      flowSessionId: createFlowSessionId(flow),
      startedAt: now(),
      attemptsByStep: {},
    };

    this.activeFlows[flow] = state;
    this.track(FRICTION_EVENT_NAMES.FLOW_STARTED, flow, state, props);
    return state;
  }

  stepViewed(flow: FrictionFlow, step: string, props?: FrictionEventProperties): void {
    const state = this.getState(flow, props);
    state.currentStep = step;
    state.currentStepStartedAt = now();
    this.track(FRICTION_EVENT_NAMES.FLOW_STEP_VIEWED, flow, state, {
      step,
      ...props,
    });
  }

  stepCompleted(flow: FrictionFlow, step: string, props?: FrictionEventProperties): void {
    const state = this.getState(flow, props);
    const duration = this.stepDuration(state, step, props?.duration_ms);
    this.track(FRICTION_EVENT_NAMES.FLOW_STEP_COMPLETED, flow, state, {
      step,
      duration_ms: duration,
      ...props,
    });
  }

  stepAbandoned(
    flow: FrictionFlow,
    step: string,
    reason: string,
    props?: FrictionEventProperties
  ): void {
    const state = this.getState(flow, props);
    this.track(FRICTION_EVENT_NAMES.FLOW_STEP_ABANDONED, flow, state, {
      step,
      reason,
      duration_ms: this.stepDuration(state, step, props?.duration_ms),
      ...props,
    });
  }

  flowBlocked(
    flow: FrictionFlow,
    step: string,
    reason: string,
    props?: FrictionEventProperties
  ): void {
    const state = this.getState(flow, props);
    this.track(FRICTION_EVENT_NAMES.FLOW_BLOCKED, flow, state, {
      step,
      reason,
      ...props,
    });
  }

  flowRetry(flow: FrictionFlow, step: string, props?: FrictionEventProperties): void {
    const state = this.getState(flow, props);
    const attempt = (state.attemptsByStep[step] ?? 0) + 1;
    state.attemptsByStep[step] = attempt;
    this.track(FRICTION_EVENT_NAMES.FLOW_RETRY, flow, state, {
      step,
      attempt,
      ...props,
    });
  }

  flowError(
    flow: FrictionFlow,
    step: string,
    errorCode: string,
    props?: FrictionEventProperties
  ): void {
    const state = this.getState(flow, props);
    this.track(FRICTION_EVENT_NAMES.FLOW_ERROR, flow, state, {
      step,
      error_code: errorCode,
      duration_ms: this.stepDuration(state, step, props?.duration_ms),
      ...props,
    });
  }

  completeFlow(flow: FrictionFlow, props?: FrictionEventProperties): void {
    const state = this.getState(flow, props);
    this.track(FRICTION_EVENT_NAMES.FLOW_COMPLETED, flow, state, {
      duration_ms: props?.duration_ms ?? now() - state.startedAt,
      ...props,
    });
    delete this.activeFlows[flow];
  }

  trackRouteViewed(routeName: string, props?: FrictionEventProperties): void {
    const mapping = ROUTE_FLOW_STEPS[routeName];
    AnalyticsService.screen(routeName, props);

    if (!mapping) {
      return;
    }

    this.stepViewed(mapping.flow, mapping.step, {
      source: 'navigation',
      route_name: routeName,
      ...props,
    });
  }

  reset(): void {
    this.activeFlows = {};
  }

  private stepDuration(
    state: ActiveFlowState,
    step: string,
    explicitDuration?: number
  ): number | undefined {
    if (typeof explicitDuration === 'number') {
      return explicitDuration;
    }

    if (state.currentStep === step && typeof state.currentStepStartedAt === 'number') {
      return Math.max(0, now() - state.currentStepStartedAt);
    }

    return undefined;
  }
}

export const FrictionAnalytics = new FrictionAnalyticsClient();
