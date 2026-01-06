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
 */
export interface Anchor {
  id: string;
  userId: string;
  intentionText: string;
  category: AnchorCategory;
  distilledLetters: string[];
  baseSigilSvg: string;
  enhancedImageUrl?: string;
  mantraText?: string;
  mantraPronunciation?: string;
  mantraAudioUrl?: string;
  isCharged: boolean;
  chargedAt?: Date;
  activationCount: number;
  lastActivatedAt?: Date;
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
 * Enhancement method choice during creation
 */
export type EnhancementMethod = 'ai_decide' | 'traditional' | 'manual_forge';

/**
 * AI style options
 */
export type AIStyle =
  | 'grimoire'
  | 'minimal'
  | 'cosmic'
  | 'geometric'
  | 'organic'
  | 'celestial';

/**
 * Traditional sigil variation styles
 */
export type SigilVariationStyle = 'dense' | 'balanced' | 'minimal';

/**
 * Mantra generation style
 */
export type MantraStyle = 'syllabic' | 'rhythmic' | 'letter_by_letter';

// ============================================================================
// Navigation Types
// ============================================================================

/**
 * Navigation stack parameter lists
 */
export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  CreateAnchor: undefined;
  AnchorDetail: { anchorId: string };
  ChargingRitual: { anchorId: string; chargeType: ChargeType };
  ActivationRitual: { anchorId: string; activationType: ActivationType };
};

export type MainTabParamList = {
  Vault: undefined;
  Discover: undefined;
  Shop: undefined;
  Profile: undefined;
};
