/**
 * Anchor App - TypeScript Type Definitions
 *
 * Core domain types and interfaces used throughout the application.
 */

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
  userId: string;
  intentionText: string;
  category: AnchorCategory;
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
  chargedAt?: Date;
  activationCount: number;
  lastActivatedAt?: Date;

  // ───────────────────────────────────────────────────
  // TIMESTAMPS
  // ───────────────────────────────────────────────────
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Available anchor categories
 */
export type AnchorCategory =
  | 'career'
  | 'health'
  | 'wealth'
  | 'relationships'
  | 'personal_growth'
  | 'custom';

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
  subscriptionStatus: SubscriptionStatus;
  totalAnchorsCreated: number;
  totalActivations: number;
  currentStreak: number;
  longestStreak: number;
  createdAt: Date;
}

/**
 * User subscription status
 */
export type SubscriptionStatus = 'free' | 'pro' | 'pro_annual';

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
}

/**
 * AI style options (ControlNet-based style transfer)
 * Updated to reflect validated styles from spike phase
 */
export type AIStyle =
  | 'watercolor'
  | 'sacred_geometry'
  | 'ink_brush'
  | 'gold_leaf'
  | 'cosmic'
  | 'minimal_line';

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
  AnchorDetail: { anchorId: string };
  CreateAnchor: undefined;

  // ═══════════════════════════════════════════════════
  // CREATION FLOW (New Canonical Order)
  // ═══════════════════════════════════════════════════

  /** Step 1: User inputs intention */
  IntentionInput: undefined;

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
  ManualReinforcement: {
    intentionText: string;
    category: AnchorCategory;
    distilledLetters: string[];
    baseSigilSvg: string;
    structureVariant: SigilVariant;
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
    variations: string[];
    reinforcementMetadata?: ReinforcementMetadata;
  };

  /** Step 8: Mantra Creation */
  MantraCreation: {
    intentionText: string;
    category: AnchorCategory;
    distilledLetters: string[];
    baseSigilSvg: string;
    reinforcedSigilSvg?: string;
    structureVariant: SigilVariant;
    finalImageUrl?: string;
    reinforcementMetadata?: ReinforcementMetadata;
    enhancementMetadata?: EnhancementMetadata;
  };

  // ═══════════════════════════════════════════════════
  // LEGACY ROUTES (Deprecated - kept for backward compatibility during transition)
  // ═══════════════════════════════════════════════════
  /** @deprecated Use StructureForge instead */
  SigilSelection: {
    intentionText: string;
    category: AnchorCategory;
    distilledLetters: string[];
  };

  /** @deprecated Use ManualReinforcement instead */
  ManualForge: {
    intentionText: string;
    category: AnchorCategory;
    distilledLetters: string[];
    sigilSvg?: string;
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
  // CHARGING & ACTIVATION (Unchanged)
  // ═══════════════════════════════════════════════════

  // Charging and Activation
  ChargeChoice: { anchorId: string };
  ChargingRitual: { anchorId: string; chargeType: ChargeType };

  // Phase 2.6: Emotional Priming
  EmotionalPriming: {
    anchorId: string;
    intention: string;
    chargeType: 'quick' | 'deep';
  };

  QuickCharge: { anchorId: string; chargeType: ChargeType };
  DeepCharge: { anchorId: string; chargeType: ChargeType };
  ActivationRitual: { anchorId: string; activationType: ActivationType };

  // Phase 3: Burning Ritual
  ConfirmBurn: {
    anchorId: string;
    intention: string;
    sigilSvg: string;
  };

  BurningRitual: {
    anchorId: string;
    intention: string;
    sigilSvg: string;
  };
};

export type MainTabParamList = {
  Vault: undefined;
  Discover: undefined;
  Shop: undefined;
  Profile: undefined;
};
