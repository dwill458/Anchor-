import dotenv from 'dotenv';
import { logger } from '../utils/logger';

// Load environment variables
dotenv.config();

export interface EnvConfig {
  // Server
  PORT: number;
  NODE_ENV: 'development' | 'production' | 'test';

  // Database
  DATABASE_URL: string;

  // Security
  ALLOWED_ORIGINS?: string; // Comma-separated list of allowed origins
  COMPED_ACCESS_EMAILS?: string; // Comma/space-separated list of comped account emails
  ENABLE_MERCH: boolean;
  ENABLE_VISUALIZE: boolean;
  ENABLE_CHART: boolean;
  ENABLE_CHART_WRITE: boolean;
  ENABLE_CHART_AI_PLANNER: boolean;
  ENABLE_CHART_REFLECTIONS: boolean;
  ENABLE_CHART_NOTIFICATIONS: boolean;
  ENABLE_CHART_EXISTING_USER_INTRO: boolean;
  /** Account rollout percentage for Chart. Defaults to zero so Chart remains dark. */
  CHART_ROLLOUT_PERCENT: number;
  /** Emergency server-side Chart kill switch. */
  CHART_KILL_SWITCH: boolean;
  EXPOSE_ERROR_STACK: boolean;

  // Auth (Optional - for future Firebase Admin integration)
  FIREBASE_PROJECT_ID?: string;
  FIREBASE_PRIVATE_KEY?: string;
  FIREBASE_CLIENT_EMAIL?: string;

  // AI Services
  REPLICATE_API_TOKEN?: string; // Optional - mock mode available

  // Storage (Cloudflare R2)
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_R2_ACCESS_KEY_ID?: string;
  CLOUDFLARE_R2_SECRET_ACCESS_KEY?: string;
  CLOUDFLARE_R2_BUCKET_NAME?: string;
  CLOUDFLARE_R2_PUBLIC_DOMAIN?: string;

  // TTS (Optional)
  GOOGLE_CLOUD_PROJECT_ID?: string;
  GOOGLE_CLOUD_PRIVATE_KEY?: string;
  GOOGLE_CLOUD_CLIENT_EMAIL?: string;
  GOOGLE_API_KEY?: string;

  // JWT
  JWT_SECRET?: string;
  JWT_EXPIRES_IN?: string;

  // Monitoring
  SENTRY_DSN?: string;
  SENTRY_TRACES_SAMPLE_RATE: number;
  POSTHOG_API_KEY?: string;
  POSTHOG_HOST: string;
}

class EnvValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EnvValidationError';
  }
}

/**
 * Resolves the Google Generative Language API key from either supported name.
 *
 * GOOGLE_API_KEY is canonical. GEMINI_API_KEY is accepted as an alias because
 * production was provisioned under that name, which left the Visualize scene
 * provider reading an unset variable. Consumers must read the normalized
 * `env.GOOGLE_API_KEY` rather than either raw variable.
 *
 * Never log or return this value to a client.
 */
export function resolveGoogleApiKey(source: NodeJS.ProcessEnv = process.env): string | undefined {
  const canonical = source.GOOGLE_API_KEY?.trim();
  if (canonical) return canonical;
  return source.GEMINI_API_KEY?.trim() || undefined;
}

function validateString(
  key: string,
  value: unknown,
  required: boolean = false
): string | undefined {
  if (value === undefined || value === null || value === '') {
    if (required) {
      throw new EnvValidationError(`Required environment variable ${key} is missing or empty`);
    }
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new EnvValidationError(`Environment variable ${key} must be a string`);
  }

  return value;
}

function validateNumber(key: string, value: unknown, defaultValue: number): number {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  const parsed = parseInt(value as string, 10);
  if (isNaN(parsed)) {
    throw new EnvValidationError(`Environment variable ${key} must be a number`);
  }

  return parsed;
}

function validatePercentage(key: string, value: unknown, defaultValue: number): number {
  if (value === undefined || value === null || value === '') return defaultValue;
  if (typeof value !== 'string' || !/^\d+$/.test(value.trim())) {
    throw new EnvValidationError(`Environment variable ${key} must be an integer from 0 to 100`);
  }
  const parsed = Number(value.trim());
  if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > 100) {
    throw new EnvValidationError(`Environment variable ${key} must be an integer from 0 to 100`);
  }
  return parsed;
}

function validateEnum<T extends string>(
  key: string,
  value: unknown,
  validValues: T[],
  defaultValue: T
): T {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  if (!validValues.includes(value as T)) {
    throw new EnvValidationError(
      `Environment variable ${key} must be one of: ${validValues.join(', ')}`
    );
  }

  return value as T;
}

function validateBoolean(key: string, value: unknown, defaultValue: boolean): boolean {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  if (value === 'true' || value === true) {
    return true;
  }

  if (value === 'false' || value === false) {
    return false;
  }

  throw new EnvValidationError(`Environment variable ${key} must be true or false`);
}

export function validateEnv(): EnvConfig {
  try {
    const config: EnvConfig = {
      // Server (required)
      PORT: validateNumber('PORT', process.env.PORT, 3000),
      NODE_ENV: validateEnum(
        'NODE_ENV',
        process.env.NODE_ENV,
        ['development', 'production', 'test'],
        'development'
      ),

      // Database (required)
      DATABASE_URL: validateString('DATABASE_URL', process.env.DATABASE_URL, true)!,

      // Auth (optional - for future use)
      FIREBASE_PROJECT_ID: validateString('FIREBASE_PROJECT_ID', process.env.FIREBASE_PROJECT_ID),
      FIREBASE_PRIVATE_KEY: validateString(
        'FIREBASE_PRIVATE_KEY',
        process.env.FIREBASE_PRIVATE_KEY
      ),
      FIREBASE_CLIENT_EMAIL: validateString(
        'FIREBASE_CLIENT_EMAIL',
        process.env.FIREBASE_CLIENT_EMAIL
      ),

      // AI Services (optional - mock mode available)
      REPLICATE_API_TOKEN: validateString('REPLICATE_API_TOKEN', process.env.REPLICATE_API_TOKEN),

      // Storage (optional - mock mode available)
      CLOUDFLARE_ACCOUNT_ID: validateString(
        'CLOUDFLARE_ACCOUNT_ID',
        process.env.CLOUDFLARE_ACCOUNT_ID
      ),
      CLOUDFLARE_R2_ACCESS_KEY_ID: validateString(
        'CLOUDFLARE_R2_ACCESS_KEY_ID',
        process.env.CLOUDFLARE_R2_ACCESS_KEY_ID
      ),
      CLOUDFLARE_R2_SECRET_ACCESS_KEY: validateString(
        'CLOUDFLARE_R2_SECRET_ACCESS_KEY',
        process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY
      ),
      CLOUDFLARE_R2_BUCKET_NAME: validateString(
        'CLOUDFLARE_R2_BUCKET_NAME',
        process.env.CLOUDFLARE_R2_BUCKET_NAME
      ),
      CLOUDFLARE_R2_PUBLIC_DOMAIN: validateString(
        'CLOUDFLARE_R2_PUBLIC_DOMAIN',
        process.env.CLOUDFLARE_R2_PUBLIC_DOMAIN
      ),

      // TTS (optional)
      GOOGLE_CLOUD_PROJECT_ID: validateString(
        'GOOGLE_CLOUD_PROJECT_ID',
        process.env.GOOGLE_CLOUD_PROJECT_ID
      ),
      GOOGLE_CLOUD_PRIVATE_KEY: validateString(
        'GOOGLE_CLOUD_PRIVATE_KEY',
        process.env.GOOGLE_CLOUD_PRIVATE_KEY
      ),
      GOOGLE_CLOUD_CLIENT_EMAIL: validateString(
        'GOOGLE_CLOUD_CLIENT_EMAIL',
        process.env.GOOGLE_CLOUD_CLIENT_EMAIL
      ),
      // Normalized: accepts GOOGLE_API_KEY (canonical) or GEMINI_API_KEY (alias).
      GOOGLE_API_KEY: resolveGoogleApiKey(),

      // JWT (required in production)
      JWT_SECRET: validateString(
        'JWT_SECRET',
        process.env.JWT_SECRET,
        process.env.NODE_ENV === 'production'
      ),
      JWT_EXPIRES_IN: validateString('JWT_EXPIRES_IN', process.env.JWT_EXPIRES_IN) || '7d',

      // Security — never default to wildcard; require explicit config in production.
      ALLOWED_ORIGINS: validateString('ALLOWED_ORIGINS', process.env.ALLOWED_ORIGINS),
      COMPED_ACCESS_EMAILS: validateString(
        'COMPED_ACCESS_EMAILS',
        process.env.COMPED_ACCESS_EMAILS
      ),
      ENABLE_MERCH: validateBoolean('ENABLE_MERCH', process.env.ENABLE_MERCH, false),
      ENABLE_VISUALIZE: validateBoolean('ENABLE_VISUALIZE', process.env.ENABLE_VISUALIZE, false),
      // Chart is deliberately default-off until Workstream G enables it.
      ENABLE_CHART: validateBoolean('ENABLE_CHART', process.env.ENABLE_CHART, false),
      ENABLE_CHART_WRITE: validateBoolean(
        'ENABLE_CHART_WRITE',
        process.env.ENABLE_CHART_WRITE,
        false
      ),
      ENABLE_CHART_AI_PLANNER: validateBoolean(
        'ENABLE_CHART_AI_PLANNER',
        process.env.ENABLE_CHART_AI_PLANNER,
        false
      ),
      ENABLE_CHART_REFLECTIONS: validateBoolean(
        'ENABLE_CHART_REFLECTIONS',
        process.env.ENABLE_CHART_REFLECTIONS,
        false
      ),
      ENABLE_CHART_NOTIFICATIONS: validateBoolean(
        'ENABLE_CHART_NOTIFICATIONS',
        process.env.ENABLE_CHART_NOTIFICATIONS,
        false
      ),
      ENABLE_CHART_EXISTING_USER_INTRO: validateBoolean(
        'ENABLE_CHART_EXISTING_USER_INTRO',
        process.env.ENABLE_CHART_EXISTING_USER_INTRO,
        false
      ),
      CHART_ROLLOUT_PERCENT: validatePercentage(
        'CHART_ROLLOUT_PERCENT',
        process.env.CHART_ROLLOUT_PERCENT,
        0
      ),
      CHART_KILL_SWITCH: validateBoolean('CHART_KILL_SWITCH', process.env.CHART_KILL_SWITCH, false),
      EXPOSE_ERROR_STACK: validateBoolean(
        'EXPOSE_ERROR_STACK',
        process.env.EXPOSE_ERROR_STACK,
        false
      ),

      // Monitoring
      SENTRY_DSN: validateString('SENTRY_DSN', process.env.SENTRY_DSN),
      SENTRY_TRACES_SAMPLE_RATE: Math.max(
        0,
        Math.min(
          1,
          validateNumber('SENTRY_TRACES_SAMPLE_RATE', process.env.SENTRY_TRACES_SAMPLE_RATE, 0.1)
        )
      ),
      POSTHOG_API_KEY: validateString('POSTHOG_API_KEY', process.env.POSTHOG_API_KEY),
      POSTHOG_HOST:
        validateString('POSTHOG_HOST', process.env.POSTHOG_HOST) ?? 'https://us.i.posthog.com',
    };

    // In production, critical variables must be present.
    if (config.NODE_ENV === 'production') {
      const productionRequired: Array<keyof EnvConfig> = [
        'FIREBASE_PROJECT_ID',
        'FIREBASE_PRIVATE_KEY',
        'FIREBASE_CLIENT_EMAIL',
        'ALLOWED_ORIGINS',
        'CLOUDFLARE_ACCOUNT_ID',
        'CLOUDFLARE_R2_ACCESS_KEY_ID',
        'CLOUDFLARE_R2_SECRET_ACCESS_KEY',
        'CLOUDFLARE_R2_BUCKET_NAME',
        'CLOUDFLARE_R2_PUBLIC_DOMAIN',
      ];
      for (const key of productionRequired) {
        if (!config[key]) {
          throw new EnvValidationError(`${key} is required in production`);
        }
      }
    }

    // Warn about missing optional but recommended variables
    if (!config.REPLICATE_API_TOKEN) {
      logger.warn('REPLICATE_API_TOKEN not configured - AI enhancement will run in mock mode');
    }

    if (
      config.NODE_ENV !== 'production' &&
      (!config.CLOUDFLARE_ACCOUNT_ID ||
        !config.CLOUDFLARE_R2_ACCESS_KEY_ID ||
        !config.CLOUDFLARE_R2_SECRET_ACCESS_KEY ||
        !config.CLOUDFLARE_R2_BUCKET_NAME ||
        !config.CLOUDFLARE_R2_PUBLIC_DOMAIN)
    ) {
      logger.warn('Cloudflare R2 credentials not configured - storage will run in mock mode');
    }

    if (!config.GOOGLE_CLOUD_PROJECT_ID) {
      logger.info('Google Cloud TTS not configured - audio generation disabled');
    }

    if (!config.JWT_SECRET && config.NODE_ENV !== 'production') {
      logger.warn('JWT_SECRET not configured - using default (NOT SECURE FOR PRODUCTION)');
    }

    logger.info('Environment variables validated successfully');
    return config;
  } catch (error) {
    if (error instanceof EnvValidationError) {
      logger.error('Environment validation failed', error);
      throw error;
    }
    throw error;
  }
}

// Export validated config singleton
export const env = validateEnv();
