/**
 * Server-owned configuration for the AI Course Planner.
 *
 * Phase 0 amendment F1 makes the backend authoritative for planner entitlement
 * and quota, and requires missing or malformed quota configuration to fail
 * closed. Both the provider settings and the caps live here so planning
 * business logic never carries provider literals or entitlement numbers, and so
 * changing a model or a cap does not touch `CoursePlannerService`.
 *
 * This mirrors the existing provider-configuration pattern in
 * `VisualizationSceneService` (env-overridable constant, key resolved through
 * the normalized `env.GOOGLE_API_KEY`, presence-only status snapshot).
 */

import { env } from './env';

// ── Planner identity ─────────────────────────────────────────────────────────

export const PLANNER_VERSION = '1';
export const PLANNER_PROPOSAL_TTL_MS = 30 * 60 * 1000;
export const PLANNER_DETERMINISTIC_MODEL_VERSION = 'deterministic-v1';

// ── Provider configuration ───────────────────────────────────────────────────

/** Unchanged from Workstream F; only its location moved out of business logic. */
export const PLANNER_DEFAULT_MODEL = 'gemini-2.0-flash';
export const PLANNER_DEFAULT_TIMEOUT_MS = 8_000;
export const PLANNER_DEFAULT_MAX_ATTEMPTS = 2;
export const PLANNER_DEFAULT_TEMPERATURE = 0.2;

export function resolvePlannerModel(): string {
  return process.env.CHART_PLANNER_MODEL?.trim() || PLANNER_DEFAULT_MODEL;
}

/**
 * `env.GOOGLE_API_KEY` is already normalized across GOOGLE_API_KEY and
 * GEMINI_API_KEY. Planner code must not read either raw variable, and the key
 * is never returned to a client.
 */
export function resolvePlannerApiKey(): string | undefined {
  return env.GOOGLE_API_KEY?.trim() || undefined;
}

function positiveNumber(raw: string | undefined, fallback: number): number {
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function resolvePlannerTimeoutMs(): number {
  return positiveNumber(process.env.CHART_PLANNER_TIMEOUT_MS, PLANNER_DEFAULT_TIMEOUT_MS);
}

export function resolvePlannerMaxAttempts(): number {
  return positiveNumber(process.env.CHART_PLANNER_MAX_ATTEMPTS, PLANNER_DEFAULT_MAX_ATTEMPTS);
}

export function resolvePlannerTemperature(): number {
  const parsed = Number(process.env.CHART_PLANNER_TEMPERATURE);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 2
    ? parsed
    : PLANNER_DEFAULT_TEMPERATURE;
}

// ── Entitlement and quota configuration ──────────────────────────────────────

export type PlannerEntitlementState = 'pro' | 'trial' | 'expired' | 'free';

/** Frozen V1 caps from Phase 0 amendment F1. */
export const PLANNER_FROZEN_TRIAL_LIFETIME_CAP = 3;
export const PLANNER_FROZEN_PRO_DAILY_CAP = 10;
export const PLANNER_FROZEN_FREE_CAP = 0;
export const PLANNER_FROZEN_EXPIRED_CAP = 0;

export interface PlannerQuotaConfig {
  /** Proposals a trial account may persist across the entire trial. */
  trialLifetimeCap: number;
  /** Proposals a Pro account may persist per rolling UTC day. */
  proDailyCap: number;
  freeCap: number;
  expiredCap: number;
}

function optionalCap(name: string, fallback: number): number | null {
  const raw = process.env[name];
  if (raw === undefined || raw === null || raw.trim() === '') return fallback;
  // A present-but-unparseable override is malformed configuration, not a
  // reason to silently fall back to the default.
  if (!/^\d+$/.test(raw.trim())) return null;
  const parsed = Number(raw.trim());
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

function isValidConfig(config: PlannerQuotaConfig): boolean {
  const caps = [config.trialLifetimeCap, config.proDailyCap, config.freeCap, config.expiredCap];
  if (!caps.every(cap => Number.isSafeInteger(cap) && cap >= 0)) return false;
  // Unentitled states carry no allowance under F1; a non-zero value here would
  // mean the configuration no longer expresses the frozen policy.
  return config.freeCap === 0 && config.expiredCap === 0;
}

/**
 * Returns null when planner quota configuration is missing, malformed, or
 * otherwise unavailable. Callers must treat null as a hard denial: no provider
 * call, no persistence. Null is never "unlimited".
 */
export function resolvePlannerQuotaConfig(): PlannerQuotaConfig | null {
  try {
    const trialLifetimeCap = optionalCap(
      'CHART_PLANNER_TRIAL_LIFETIME_CAP',
      PLANNER_FROZEN_TRIAL_LIFETIME_CAP
    );
    const proDailyCap = optionalCap('CHART_PLANNER_PRO_DAILY_CAP', PLANNER_FROZEN_PRO_DAILY_CAP);
    const freeCap = optionalCap('CHART_PLANNER_FREE_CAP', PLANNER_FROZEN_FREE_CAP);
    const expiredCap = optionalCap('CHART_PLANNER_EXPIRED_CAP', PLANNER_FROZEN_EXPIRED_CAP);

    if (
      trialLifetimeCap === null ||
      proDailyCap === null ||
      freeCap === null ||
      expiredCap === null
    ) {
      return null;
    }

    const config: PlannerQuotaConfig = {
      trialLifetimeCap,
      proDailyCap,
      freeCap,
      expiredCap,
    };
    return isValidConfig(config) ? config : null;
  } catch {
    // An unreadable configuration source fails closed like a malformed one.
    return null;
  }
}

export function capForEntitlement(
  config: PlannerQuotaConfig,
  entitlement: PlannerEntitlementState
): number {
  switch (entitlement) {
    case 'pro':
      return config.proDailyCap;
    case 'trial':
      return config.trialLifetimeCap;
    case 'expired':
      return config.expiredCap;
    case 'free':
      return config.freeCap;
  }
}

/**
 * Read-only snapshot of planner configuration. Reports presence, never values
 * that could identify a credential — safe to log and to assert on in tests.
 */
export function getPlannerConfigStatus(): {
  providerKeyConfigured: boolean;
  model: string;
  modelExplicitlyConfigured: boolean;
  timeoutMs: number;
  maxAttempts: number;
  quotaConfigured: boolean;
} {
  return {
    providerKeyConfigured: Boolean(resolvePlannerApiKey()),
    model: resolvePlannerModel(),
    modelExplicitlyConfigured: Boolean(process.env.CHART_PLANNER_MODEL?.trim()),
    timeoutMs: resolvePlannerTimeoutMs(),
    maxAttempts: resolvePlannerMaxAttempts(),
    quotaConfigured: resolvePlannerQuotaConfig() !== null,
  };
}
