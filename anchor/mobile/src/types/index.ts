/**
 * Anchor App - TypeScript Type Definitions
 *
 * Core domain types and interfaces used throughout the application.
 */

import type {
  SessionAudioConfiguration,
  SessionAudioDefaultsByType,
} from './sessionAudio';
export * from './sessionAudio';
import type { PracticeEntrySource } from './practice';
export * from './chart';
import type { ChartFeatureFlags } from './chart';

// ============================================================================
// Core Domain Types
// ============================================================================

/**
 * Main Anchor object - represents a user's intention-based symbol
 *
 * Architecture: Deterministic structure + optional reinforcement + optional AI enhancement
 * Data lineage: baseSigilSvg → reinforcedSigilSvg → enhancedImageUrl
 */
export interface Anchor {
  id: string;
  localId?: string;
  userId: string;
  intentionText: string;
  category: AnchorCategory;
  planetaryTier?: PlanetaryTier | string;
  classifierVersion?: number;
  classifierMeta?: Record<string, any>;
  distilledLetters: string[];

  // ───────────────────────────────────────────────────
  // STRUCTURE LINEAGE (Clear Provenance)
  // ───────────────────────────────────────────────────
  /** Deterministic structure from traditional generator (source of truth) */
  baseSigilSvg: string;

  /** User-traced reinforcement version (if manual reinforcement completed) */
  reinforcedSigilSvg?: string;

  /** AI-styled appearance image URL (if AI enhancement applied) */
  enhancedImageUrl?: string;

  // ───────────────────────────────────────────────────
  // CREATION PATH METADATA
  // ───────────────────────────────────────────────────
  /** Which deterministic variant was chosen: 'dense' | 'balanced' | 'minimal' */
  structureVariant: SigilVariant;

  /** Manual reinforcement session data (if user traced the structure) */
  reinforcementMetadata?: ReinforcementMetadata;

  /** AI enhancement details (if AI styling was applied) */
  enhancementMetadata?: EnhancementMetadata;

  // ───────────────────────────────────────────────────
  // MANTRA & ACTIVATION
  // ───────────────────────────────────────────────────
  mantraText?: string;
  mantraPronunciation?: string;
  mantraAudioUrl?: string;
  isCharged: boolean;
  chargeCount?: number;
  chargedAt?: Date;
  firstChargedAt?: Date;
  ignitedAt?: Date;
  activationCount: number;
  threadStrength?: number;
  lastActivatedAt?: Date;
  isReleased?: boolean;
  releasedAt?: Date;
  archivedAt?: Date;

  // ───────────────────────────────────────────────────
  // TIMESTAMPS
  // ───────────────────────────────────────────────────
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Available anchor categories with keywords
 */
export type AnchorCategory =
  | 'desire'
  | 'health'
  | 'career'
  | 'relationships'
  | 'creativity'
  | 'spirituality'
  | 'abundance'
  | 'family'
  | 'learning'
  | 'adventure'
  | 'custom';

/**
 * Category metadata with keywords and descriptions
 */
export const CATEGORY_METADATA: Record<AnchorCategory, { keywords: string[]; description: string }> = {
  desire: {
    keywords: ['passion', 'attraction', 'want', 'goal', 'aspiration', 'longing'],
    description: 'Personal desires, passions, and aspirations',
  },
  health: {
    keywords: ['wellness', 'fitness', 'healing', 'vitality', 'energy', 'recovery'],
    description: 'Physical and mental wellbeing',
  },
  career: {
    keywords: ['work', 'professional', 'job', 'success', 'ambition', 'calling'],
    description: 'Career growth and professional development',
  },
  relationships: {
    keywords: ['love', 'connection', 'friendship', 'intimacy', 'bond', 'partnership'],
    description: 'Romantic and personal relationships',
  },
  creativity: {
    keywords: ['art', 'expression', 'innovation', 'craft', 'creation', 'inspiration'],
    description: 'Creative pursuits and artistic expression',
  },
  spirituality: {
    keywords: ['meditation', 'mindfulness', 'sacred', 'consciousness', 'awakening', 'purpose'],
    description: 'Spiritual growth and inner awareness',
  },
  abundance: {
    keywords: ['finances', 'prosperity', 'wealth', 'money', 'flow', 'generosity'],
    description: 'Financial wellbeing and material abundance',
  },
  family: {
    keywords: ['parents', 'children', 'siblings', 'kin', 'home', 'belonging'],
    description: 'Family bonds and household harmony',
  },
  learning: {
    keywords: ['education', 'skill', 'knowledge', 'growth', 'mastery', 'development'],
    description: 'Learning, education, and skill development',
  },
  adventure: {
    keywords: ['travel', 'exploration', 'experience', 'journey', 'discovery', 'freedom'],
    description: 'Travel, exploration, and new experiences',
  },
  custom: {
    keywords: ['personal', 'unique', 'bespoke'],
    description: 'Custom intention categories',
  },
};

/**
 * Planetary Tier for Anchor classification (5-tier system)
 */
export enum PlanetaryTier {
  SATURN = 'saturn',    // 3×3, Discipline/Boundaries
  JUPITER = 'jupiter',  // 4×4, Wealth/Growth
  MARS = 'mars',        // 5×5, Energy/Physicality
  SUN = 'sun',          // 6×6, Identity/Clarity
  VENUS = 'venus'       // 7×7, Peace/Harmony
}

/**
 * Maps legacy categories to the new 5-tier planetary system
 */
export const CATEGORY_TO_TIER: Record<AnchorCategory, PlanetaryTier> = {
  desire: PlanetaryTier.SUN,
  health: PlanetaryTier.MARS,
  career: PlanetaryTier.JUPITER,
  relationships: PlanetaryTier.VENUS,
  creativity: PlanetaryTier.SUN,
  spirituality: PlanetaryTier.SATURN,
  abundance: PlanetaryTier.JUPITER,
  family: PlanetaryTier.VENUS,
  learning: PlanetaryTier.SATURN,
  adventure: PlanetaryTier.VENUS,
  custom: PlanetaryTier.SATURN,
};

/**
 * Result of the letter distillation process (Austin Osman Spare method)
 */
export interface DistillationResult {
  original: string;
  finalLetters: string[];
  removedVowels: string[];
  removedDuplicates: string[];
}

/**
 * User account and stats
 */
export interface User {
  id: string;
  email: string;
  displayName?: string;
  profilePictureUrl?: string | null;
  hasCompletedOnboarding?: boolean;
  isComped?: boolean;
  settings?: UserSettings | null;
  subscriptionStatus: SubscriptionStatus;
  totalAnchorsCreated: number;
  totalActivations: number;
  currentStreak: number;
  longestStreak: number;
  stabilizesTotal: number;
  stabilizeStreakDays: number;
  lastStabilizeAt?: Date;
  createdAt: Date;
  // Server-authoritative trial anchor (resettable per-account). Optional for
  // backward-compat with backends that predate the column.
  trialStartedAt?: string;
  isTrialExpired?: boolean;
  /** Server-driven Chart flags from /api/auth/me. Defaults off when absent. */
  chartFlags?: ChartFeatureFlags;
}

export type AuthScreenContext = 'onboarding' | 'first_anchor_gate' | 'save_progress' | 'paywall';
export type AuthScreenInitialTab = 'signin' | 'signup';
export type AuthPreferredPlanId = 'monthly' | 'annual';

export interface AuthScreenParams {
  context?: AuthScreenContext;
  initialTab?: AuthScreenInitialTab;
  preferredPlanId?: AuthPreferredPlanId;
  anchorId?: string;
}

export interface PendingFirstAnchorDraft {
  tempAnchorId: string;
  source: 'onboarding_first_anchor';
  requiresAccountGate: boolean;
  createdAt: Date;
  backendAnchorId?: string;
  nextPendingMutationIndex?: number;
}

export type PendingFirstAnchorMutation =
  | {
    type: 'create_anchor';
    tempAnchorId: string;
    queuedAt: string;
  }
  | {
    type: 'charge_anchor';
    tempAnchorId: string;
    chargeType: ChargeType;
    durationSeconds: number;
    idempotencyKey?: string;
    queuedAt: string;
  }
  | {
    type: 'activate_anchor';
    tempAnchorId: string;
    activationType: ActivationType;
    durationSeconds: number;
    idempotencyKey?: string;
    queuedAt: string;
  };

/**
 * User subscription status
 */
export type SubscriptionStatus = 'free' | 'pro' | 'pro_annual';

/**
 * User settings and preferences
 */
export interface UserSettings {
  userId: string;
  notificationsEnabled: boolean;
  dailyReminderTime: string; // HH:MM format
  streakProtection: boolean;
  defaultChargeDuration: number; // in seconds
  focusSessionMode: 'quick' | 'deep';
  focusSessionDuration: number;
  /** @deprecated Read sessionAudioDefaults instead. Retained for rolling migration. */
  focusSessionAudio: 'silent' | 'ambient';
  primeSessionDuration: number;
  visualizeSessionDuration?: number;
  /** @deprecated Read sessionAudioDefaults instead. Retained for rolling migration. */
  primeSessionAudio: 'silent' | 'ambient';
  /** Voice & Sound defaults. Optional while older backends roll forward. */
  sessionAudioDefaults?: SessionAudioDefaultsByType;
  hapticIntensity: number; // 1-5 scale
  vaultViewType: 'grid' | 'list';
  updatedAt: Date;
}

/**
 * Firebase User object (subset of properties)
 */
export interface FirebaseUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL?: string | null;
  emailVerified?: boolean;
}

/**
 * Activation event - tracks when user activates an anchor
 */
export interface Activation {
  id: string;
  userId: string;
  anchorId: string;
  activationType: ActivationType;
  durationSeconds?: number;
  activatedAt: Date;
}

/**
 * Types of activation rituals
 */
export type ActivationType = 'visual' | 'mantra' | 'deep';

/**
 * Charging ritual record
 */
export interface Charge {
  id: string;
  userId: string;
  anchorId: string;
  chargeType: ChargeType;
  durationSeconds?: number;
  completed: boolean;
  chargedAt: Date;
}

/**
 * Types of charging rituals
 */
export type ChargeType = 'initial_quick' | 'initial_deep' | 'recharge';

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  meta?: {
    page?: number;
    total?: number;
    nextCursor?: string | null;
  };
}

// ============================================================================
// UI State Types
// ============================================================================

/**
 * Loading state for async operations
 */
export interface LoadingState {
  isLoading: boolean;
  error: string | null;
}

/**
 * Vault view preferences
 */
export type VaultViewType = 'grid' | 'list';

/**
 * Vault sorting options
 */
export type VaultSortOption =
  | 'recent'
  | 'most_activated'
  | 'least_activated'
  | 'oldest'
  | 'name'
  | 'status';

/**
 * Vault filter options
 */
export type VaultFilterOption = 'all' | 'charged' | 'uncharged' | 'archived';

// ============================================================================
// Creation Flow Types
// ============================================================================

/**
 * Enhancement method choice during creation (LEGACY - being replaced)
 * @deprecated Use EnhancementPath instead
 */
export type EnhancementMethod = 'ai_decide' | 'traditional' | 'manual_forge';

/**
 * Enhancement path choice in new architecture
 */
export type EnhancementPath = 'keep_pure' | 'enhance_ai' | 'skip';

/**
 * Reinforcement quality metrics
 * Tracks user's manual reinforcement/tracing session
 */
export interface ReinforcementMetadata {
  /** Whether user completed the reinforcement step */
  completed: boolean;

  /** Whether user skipped reinforcement */
  skipped: boolean;

  /** Number of strokes user drew during reinforcement */
  strokeCount: number;

  /** Overlap percentage with base structure (0-100) */
  fidelityScore: number;

  /** Time spent on reinforcement in milliseconds */
  timeSpentMs: number;

  /** When reinforcement was completed (if applicable) */
  completedAt?: Date;
}

/**
 * AI enhancement tracking metadata
 * Records which AI style was applied and generation details
 */
export interface EnhancementMetadata {
  /** Style that was applied (e.g., 'watercolor', 'sacred_geometry') */
  styleApplied: AIStyle | LegacyAIStyle | string;

  /** AI model identifier (e.g., 'sdxl-controlnet-canny-v1') */
  modelUsed: string;

  /** Provider that generated the artwork (e.g., 'gemini', 'replicate') */
  provider?: string;

  /** ControlNet method used (e.g., 'canny', 'lineart') */
  controlMethod: 'canny' | 'lineart' | string;

  /** Generation time in milliseconds */
  generationTimeMs: number;

  /** Prompt used for generation */
  promptUsed: string;

  /** Negative prompt used */
  negativePrompt: string;

  /** When AI enhancement was applied */
  appliedAt: Date;

  /** Reserved pool variation selected by the user, if applicable */
  variationId?: string;

  /** Reservation group returned by the AI enhancement endpoint */
  reuseRequestId?: string;

  /** Whether this option came from the saved variation pool */
  reusedFromPool?: boolean;
}

/**
 * AI style options (ControlNet-based style transfer)
 * Updated to reflect validated styles from spike phase
 */
export type AIStyle =
  | 'architectural_trace'
  | 'lunar_etch'
  | 'resonance_rings'
  | 'watercolor'
  | 'ink_brush'
  | 'gold_leaf'
  | 'cosmic'
  | 'minimal_line'
  | 'obsidian_mono'
  | 'aurora_glow'
  | 'ember_trace'
  | 'monolith_ink'
  | 'celestial_grid'
  | 'echo_chamber'
  | 'prism_veil'
  | 'verdigris_relic'
  | 'solar_halo'
  | 'tideglass'
  | 'sacred_geometry'
  | 'velvet_ember';

export type PaywallSource =
  | 'post_trial'
  | 'gated_feature'
  | 'create_anchor_free_locked'
  | 'trial_anchor_cap_reached'
  | 'free_weekly_sessions_used'
  | 'premium_practice_locked';

export type NavigationResumeTarget =
  | { kind: 'visualize_prepare'; anchorId: string }
  | { kind: 'chart_ai_plan'; destinationText: string }
  | { kind: 'chart_waypoint'; courseId: string; waypointId: string };

export interface GeneratedVariation {
  variationId?: string;
  imageUrl: string;
  structureMatchScore?: number;
  iouScore?: number;
  edgeOverlapScore?: number;
  structurePreserved?: boolean;
  classification?: string;
  wasComposited?: boolean;
  seed?: number;
  reusedFromPool?: boolean;
}

/**
 * Legacy AI styles (deprecated, kept for backward compatibility)
 */
export type LegacyAIStyle =
  | 'grimoire'
  | 'minimal'
  | 'geometric'
  | 'organic'
  | 'celestial';

/**
 * Traditional sigil variation styles
 */
export type SigilVariationStyle = 'dense' | 'balanced' | 'minimal';

/**
 * Sigil variant (alias for SigilVariationStyle for consistency)
 */
export type SigilVariant = SigilVariationStyle;

/**
 * Mantra generation style
 */
export type MantraStyle = 'syllabic' | 'rhythmic' | 'letter_by_letter';

// ============================================================================
// AI Analysis Types
// ============================================================================

/**
 * Symbol from the symbol database
 */
export interface Symbol {
  id?: string;
  name: string;
  description: string;
  themes: string[];
  origin?: string;
  unicode: string;
}

/**
 * Result of AI intention analysis
 */
export interface AnalysisResult {
  intentionText: string;
  keywords: string[];
  themes: string[];
  selectedSymbols: Symbol[];
  aesthetic: AIStyle | string;
  explanation: string;
}

// ============================================================================
// Navigation Types
// ============================================================================

/**
 * Navigation stack parameter lists
 *
 * UPDATED FOR NEW ARCHITECTURE:
 * Linear flow with optional steps (reinforcement, AI enhancement)
 */
export type RootStackParamList = {
  // ═══════════════════════════════════════════════════
  // VAULT & ANCHOR MANAGEMENT
  // ═══════════════════════════════════════════════════
  Vault: undefined;
  SaveProgress: { anchor: Anchor };
  TrialSignUp: undefined;
  AnchorDetail: { anchorId: string };
  VisualizePreparation: { anchorId: string; source?: string };
  VisualizeSession: {
    anchorId: string;
    durationSeconds: 60 | 180 | 300;
    sceneText: string;
    guidanceVoice: 'female' | 'male' | 'none';
    backgroundAudio: 'ambient' | 'off';
    source?: 'practice_screen' | 'anchor_detail' | 'deep_link';
  };
  VisualizeCompletion: {
    anchorId: string;
    sessionId: string;
    durationSeconds: 60 | 180 | 300;
    source?: 'practice_screen' | 'anchor_detail' | 'deep_link';
    sceneText?: string;
  };
  AuthGate: undefined;
  Paywall:
    | {
      source?: PaywallSource;
      preferredPlanId?: AuthPreferredPlanId;
      resumeTarget?: NavigationResumeTarget;
    }
    | undefined;
  CreateAnchor: undefined;
  /** First anchor creation after onboarding — shows new-user IntentionInputScreen */
  FirstAnchorCreation: undefined;
  Login: AuthScreenParams | undefined;
  SignUp: AuthScreenParams | undefined;

  // ═══════════════════════════════════════════════════
  // CREATION FLOW (New Canonical Order)
  // ═══════════════════════════════════════════════════

  /** Step 1: User inputs intention */
  IntentionInput: undefined;

  /** Step 2: Letter distillation sequence (typed stage flow) */
  LetterDistillation: {
    intentionText: string;
    distilledLetters: string[];
    category: AnchorCategory;
  };

  /** Step 2: Distillation animation (spaces → vowels → duplicates) */
  DistillationAnimation: {
    intentionText: string;
    category: AnchorCategory;
    distilledLetters: string[];
  };

  /** Step 3: Structure Forge (choose 1 of 3 deterministic variants) */
  StructureForge: {
    intentionText: string;
    category: AnchorCategory;
    distilledLetters: string[];
  };

  /** Step 4: Manual Reinforcement (guided tracing over base structure) */
  ManualReinforcement:
    | {
      source: 'creation';
      intentionText: string;
      category: AnchorCategory;
      distilledLetters: string[];
      baseSigilSvg: string;
      structureVariant: SigilVariant;
    }
    | {
      source: 'post_prime_trace';
      anchorId: string;
    };

  /** Step 5: Lock Structure (confirmation screen) */
  LockStructure: {
    intentionText: string;
    category: AnchorCategory;
    distilledLetters: string[];
    baseSigilSvg: string;
    reinforcedSigilSvg?: string;
    structureVariant: SigilVariant;
    reinforcementMetadata?: ReinforcementMetadata;
  };

  /** Step 6: Enhancement Choice (Keep Pure / Enhance / Skip) */
  EnhancementChoice: {
    intentionText: string;
    category: AnchorCategory;
    distilledLetters: string[];
    baseSigilSvg: string;
    reinforcedSigilSvg?: string;
    structureVariant: SigilVariant;
    reinforcementMetadata?: ReinforcementMetadata;
  };

  /** Step 7a: Style Selection (choose AI aesthetic) */
  StyleSelection: {
    intentionText: string;
    category: AnchorCategory;
    distilledLetters: string[];
    baseSigilSvg: string;
    reinforcedSigilSvg?: string;
    structureVariant: SigilVariant;
    reinforcementMetadata?: ReinforcementMetadata;
  };

  /** Step 7b: AI Generating (ControlNet style transfer) */
  AIGenerating: {
    intentionText: string;
    category: AnchorCategory;
    distilledLetters: string[];
    baseSigilSvg: string;
    reinforcedSigilSvg?: string;
    structureVariant: SigilVariant;
    styleChoice: AIStyle;
    reinforcementMetadata?: ReinforcementMetadata;
    generationAttempt?: number;
  };

  /** Step 7c: Enhanced Version Picker (choose from 4 styled variations) */
  EnhancedVersionPicker: {
    intentionText: string;
    category: AnchorCategory;
    distilledLetters: string[];
    baseSigilSvg: string;
    reinforcedSigilSvg?: string;
    structureVariant: SigilVariant;
    styleChoice: AIStyle;
    variations: Array<string | GeneratedVariation>;
    reinforcementMetadata?: ReinforcementMetadata;
    prompt?: string;
    negativePrompt?: string;
    modelUsed?: string;
    provider?: string;
    controlMethod?: string;
    generationTimeMs?: number;
    reuseRequestId?: string;
  };

  /** Step 7d: Anchor Reveal (Show selected anchor before mantra) */
  AnchorReveal: {
    intentionText: string;
    category: AnchorCategory;
    distilledLetters: string[];
    baseSigilSvg: string;
    reinforcedSigilSvg?: string;
    structureVariant: SigilVariant;
    enhancedImageUrl?: string;
    reinforcementMetadata?: ReinforcementMetadata;
    enhancementMetadata?: EnhancementMetadata;
  };
  /** Canonical first-time bridge from a saved Anchor to Sanctuary/practice. */
  PrimeYourAnchor: { anchorId: string };

  // DEFERRED: Mantra feature removed from launch flow — reintroduce in v1.1.
  // MantraCreation: {
  //   intentionText: string;
  //   category: AnchorCategory;
  //   distilledLetters: string[];
  //   baseSigilSvg: string;
  //   reinforcedSigilSvg?: string;
  //   structureVariant: SigilVariant;
  //   finalImageUrl?: string;
  //   reinforcementMetadata?: ReinforcementMetadata;
  //   enhancementMetadata?: EnhancementMetadata;
  // };

  // ═══════════════════════════════════════════════════
  // LEGACY ROUTES (Deprecated - kept for backward compatibility during transition)
  // ═══════════════════════════════════════════════════
  /** @deprecated Use StructureForge instead */
  SigilSelection: {
    intentionText: string;
    category: AnchorCategory;
    distilledLetters: string[];
  };

  /** Pro-only feature: Advanced manual anchor creation with blank canvas */
  ManualForge: {
    intentionText: string;
    category: AnchorCategory;
    distilledLetters: string[];
    sigilSvg?: string;
    isFromScratch?: boolean; // If true, start with blank canvas; if false, use sigilSvg as background
  };

  /** @deprecated No longer used in new flow */
  PostForgeChoice: {
    intentionText: string;
    category: AnchorCategory;
    distilledLetters: string[];
    sigilSvg: string;
  };

  /** @deprecated No longer used in new flow */
  AIAnalysis: {
    intentionText: string;
    category: AnchorCategory;
    distilledLetters: string[];
    sigilSvg?: string;
    sigilVariant?: string;
  };

  /** @deprecated Use EnhancedVersionPicker instead */
  AIVariationPicker: {
    intentionText: string;
    category: AnchorCategory;
    distilledLetters: string[];
    sigilSvg: string;
    sigilVariant: string;
    variations: string[];
    prompt: string;
  };

  // ═══════════════════════════════════════════════════
  // CHARGING & ACTIVATION
  // ═══════════════════════════════════════════════════

  // Zen Architect Ritual Flow (Phase 2.7)
  WallpaperPrompt: {
    anchorId: string;
    intentionText: string;
    enhancedImageUrl?: string;
    sigilSvg?: string;
    returnTo?: 'charge_setup' | 'vault';
    fromOnboarding?: boolean;
  };
  ChargeSetup: {
    anchorId: string;
    returnTo?: 'vault' | 'practice' | 'detail';
    autoStartOnSelection?: boolean;
    initialDuration?: 'quick' | 'deep';
    fromOnboarding?: boolean;
  };
  BreathingAnimation: {
    source?: 'charge' | 'practice';
    anchorId?: string;
    mode?: string;
    duration?: number;
    returnTo?: 'vault' | 'practice' | 'detail';
  };
  Ritual: {
    anchorId: string;
    ritualType: 'focus' | 'ritual' | 'quick' | 'deep'; // Legacy types for compatibility
    durationSeconds?: number; // Optional custom duration for focus/ritual modes
    mantraAudioEnabled?: boolean;
    audioConfiguration?: SessionAudioConfiguration;
    /** @deprecated Compatibility for location presets saved before Voice & Sound v2. */
    audioModeOverride?: 'silent' | 'ambient';
    returnTo?: 'vault' | 'practice' | 'detail';
  };
  SealAnchor: { anchorId: string; returnTo?: 'vault' | 'practice' | 'detail' };
  ChargeComplete: {
    anchorId: string;
    durationSeconds?: number;
    completionEventId?: string;
    audioConfiguration?: SessionAudioConfiguration;
    returnTo?: 'vault' | 'practice' | 'detail';
  };
  FirstPrimeComplete: {
    anchorId: string;
    sessionCount: number;
    threadStrength: number;
    durationSeconds: number;
    completionEventId?: string;
    audioConfiguration?: SessionAudioConfiguration;
    returnTo?: 'vault' | 'practice' | 'detail';
  };

  // Activation
  ActivationRitual: {
    anchorId: string;
    activationType: ActivationType;
    durationOverride?: number;
    audioConfiguration?: SessionAudioConfiguration;
    /** @deprecated Compatibility for location presets saved before Voice & Sound v2. */
    audioModeOverride?: 'silent' | 'ambient';
    returnTo?: 'vault' | 'practice' | 'detail' | 'reinforce';
    initialDuration?: 'quick' | 'deep';
  };

  // Phase 3: Burning Ritual
  ConfirmBurn: {
    anchorId: string;
    intention: string;
    sigilSvg: string;
    enhancedImageUrl?: string;
    returnTo?: 'vault' | 'practice' | 'detail';
    source?: PracticeEntrySource;
  };

  BurningRitual: {
    anchorId: string;
    intention: string;
    sigilSvg: string;
    enhancedImageUrl?: string;
    returnTo?: 'vault' | 'practice' | 'detail';
    source?: PracticeEntrySource;
  };

  // ═══════════════════════════════════════════════════
  // PROFILE & SETTINGS
  // ═══════════════════════════════════════════════════
  Settings: undefined;
  SessionDefaults: undefined;
  DailyPracticeGoal: undefined;
  ThreadStrength: undefined;
  RestDays: undefined;
  // DEFERRED: replaced by SessionDefaultsScreen — remove post-launch.
  DefaultCharge: undefined;
  // DEFERRED: replaced by SessionDefaultsScreen — remove post-launch.
  DefaultActivation: undefined;
  // DEFERRED: replaced by SessionDefaultsScreen — remove post-launch.
  PrimingDefaults: undefined;
  // DEFERRED: replaced by SessionDefaultsScreen — remove post-launch.
  DefaultFocusMode: undefined;

  // Appearance Settings
  ThemeSelection: undefined;
  AccentColor: undefined;
  VaultView: undefined;

  // Audio & Haptics Settings
  MantraVoice: undefined;
  VoiceStyle: undefined;
  HapticFeedback: undefined;

  // Data & Privacy Settings
  DataPrivacy: undefined;

  // Deferred merch flow. Kept typed while ENABLE_MERCH gates production access.
  ProductSelection: {
    anchorId: string;
    sigilSvg: string;
    intentionText: string;
  };
  ProductMockup: {
    anchorId: string;
    sigilSvg: string;
    intentionText: string;
    productType: 'print' | 'hoodie' | 'keychain' | 't-shirt' | 'phone-case';
  };
  Checkout: {
    anchorId: string;
    productType: 'print' | 'hoodie' | 'keychain' | 't-shirt' | 'phone-case';
    size: string;
    color: string;
  };
};

export type PracticeStackParamList = {
  PracticeHome: undefined;
  ThreadStrengthDetail: undefined;
  // DEFERRED: StabilizeRitual: { anchorId: string }; — restore post-launch
  Evolve: undefined;
  ChargeSetup: {
    anchorId: string;
    returnTo?: 'practice';
    autoStartOnSelection?: boolean;
    initialDuration?: 'quick' | 'deep';
    fromOnboarding?: boolean;
    source?: PracticeEntrySource;
  };
  BreathingAnimation: {
    source?: 'charge' | 'practice';
    anchorId?: string;
    mode?: string;
    duration?: number;
    returnTo?: 'practice';
  };
  Ritual: {
    anchorId: string;
    ritualType: 'focus' | 'ritual' | 'quick' | 'deep';
    durationSeconds?: number;
    mantraAudioEnabled?: boolean;
    audioConfiguration?: SessionAudioConfiguration;
    audioModeOverride?: 'silent' | 'ambient';
    returnTo?: 'practice';
    source?: PracticeEntrySource;
  };
  SealAnchor: { anchorId: string; returnTo?: 'practice' };
  ChargeComplete: {
    anchorId: string;
    durationSeconds?: number;
    completionEventId?: string;
    audioConfiguration?: SessionAudioConfiguration;
    returnTo?: 'practice';
  };
  FirstPrimeComplete: {
    anchorId: string;
    sessionCount: number;
    threadStrength: number;
    durationSeconds: number;
    completionEventId?: string;
    audioConfiguration?: SessionAudioConfiguration;
    returnTo?: 'practice';
  };
  ActivationRitual: {
    anchorId: string;
    activationType: ActivationType;
    durationOverride?: number;
    audioConfiguration?: SessionAudioConfiguration;
    audioModeOverride?: 'silent' | 'ambient';
    returnTo?: 'practice';
    initialDuration?: 'quick' | 'deep';
    source?: PracticeEntrySource;
  };
  ManualReinforcement:
    | {
      source: 'post_prime_trace';
      anchorId: string;
    }
    | {
      source: 'creation';
      intentionText: string;
      category: AnchorCategory;
      distilledLetters: string[];
      baseSigilSvg: string;
      structureVariant: SigilVariant;
      reinforcedSigilSvg?: string;
      reinforcementMetadata?: ReinforcementMetadata;
    };
  VisualizePreparation: { anchorId: string; source?: PracticeEntrySource };
  VisualizeSession: {
    anchorId: string;
    durationSeconds: 60 | 180 | 300;
    sceneText: string;
    guidanceVoice: 'female' | 'male' | 'none';
    backgroundAudio: 'ambient' | 'off';
  };
  VisualizeCompletion: {
    anchorId: string;
    sessionId: string;
    durationSeconds: 60 | 180 | 300;
    sceneText?: string;
  };
  ConfirmBurn: {
    anchorId: string;
    intention: string;
    sigilSvg: string;
    enhancedImageUrl?: string;
    returnTo?: 'practice';
    source?: PracticeEntrySource;
  };
  BurningRitual: {
    anchorId: string;
    intention: string;
    sigilSvg: string;
    enhancedImageUrl?: string;
    returnTo?: 'practice';
    source?: PracticeEntrySource;
  };
};

export type MainTabParamList = {
  Vault: undefined;
  Practice: undefined;
  Discover: undefined;
};

export type OnboardingStackParamList = {
  LogoBreath: undefined;
  Welcome: undefined;
  Reframe: undefined;
  HowItWorks: undefined;
  DailyLoop: undefined;
  SaveProgress: undefined;
  Login: AuthScreenParams | undefined;
  SignUp: AuthScreenParams | undefined;
};

export type AuthStackParamList = {
  Login: AuthScreenParams | undefined;
  SignUp: AuthScreenParams | undefined;
  Onboarding: undefined;
};

// ============================================================================
// Profile Types (Phase 1: Private Profile)
// ============================================================================

/**
 * User statistics for profile display
 */
export interface UserStats {
  totalAnchorsCreated: number;
  totalCharged: number; // Derived client-side from charged anchors count
  totalActivations: number;
  currentStreak: number;
  longestStreak: number;
}

/**
 * Privacy-safe anchor representation for profile display
 * Intention text is redacted as displayLabel to protect user privacy
 */
export interface RedactedAnchor {
  id: string;
  displayLabel: string; // Redacted label (e.g., "Career Anchor")
  category: AnchorCategory | null;
  isCharged: boolean;
  activationCount: number;
  enhancedImageUrl?: string;
  baseSigilSvg: string;
  createdAt: Date;
}

/**
 * Complete profile data structure combining user info, stats, and active anchors
 */
export interface ProfileData {
  user: User; // Existing User type
  stats: UserStats;
  activeAnchors: RedactedAnchor[];
}
