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

  // JWT
  JWT_SECRET?: string;
  JWT_EXPIRES_IN?: string;
}

class EnvValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EnvValidationError';
  }
}

function validateString(key: string, value: unknown, required: boolean = false): string | undefined {
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
      FIREBASE_PRIVATE_KEY: validateString('FIREBASE_PRIVATE_KEY', process.env.FIREBASE_PRIVATE_KEY),
      FIREBASE_CLIENT_EMAIL: validateString('FIREBASE_CLIENT_EMAIL', process.env.FIREBASE_CLIENT_EMAIL),

      // AI Services (optional - mock mode available)
      REPLICATE_API_TOKEN: validateString('REPLICATE_API_TOKEN', process.env.REPLICATE_API_TOKEN),

      // Storage (optional - mock mode available)
      CLOUDFLARE_ACCOUNT_ID: validateString('CLOUDFLARE_ACCOUNT_ID', process.env.CLOUDFLARE_ACCOUNT_ID),
      CLOUDFLARE_R2_ACCESS_KEY_ID: validateString('CLOUDFLARE_R2_ACCESS_KEY_ID', process.env.CLOUDFLARE_R2_ACCESS_KEY_ID),
      CLOUDFLARE_R2_SECRET_ACCESS_KEY: validateString('CLOUDFLARE_R2_SECRET_ACCESS_KEY', process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY),
      CLOUDFLARE_R2_BUCKET_NAME: validateString('CLOUDFLARE_R2_BUCKET_NAME', process.env.CLOUDFLARE_R2_BUCKET_NAME),
      CLOUDFLARE_R2_PUBLIC_DOMAIN: validateString('CLOUDFLARE_R2_PUBLIC_DOMAIN', process.env.CLOUDFLARE_R2_PUBLIC_DOMAIN),

      // TTS (optional)
      GOOGLE_CLOUD_PROJECT_ID: validateString('GOOGLE_CLOUD_PROJECT_ID', process.env.GOOGLE_CLOUD_PROJECT_ID),
      GOOGLE_CLOUD_PRIVATE_KEY: validateString('GOOGLE_CLOUD_PRIVATE_KEY', process.env.GOOGLE_CLOUD_PRIVATE_KEY),
      GOOGLE_CLOUD_CLIENT_EMAIL: validateString('GOOGLE_CLOUD_CLIENT_EMAIL', process.env.GOOGLE_CLOUD_CLIENT_EMAIL),

      // JWT (optional - will use default)
      JWT_SECRET: validateString('JWT_SECRET', process.env.JWT_SECRET),
      JWT_EXPIRES_IN: validateString('JWT_EXPIRES_IN', process.env.JWT_EXPIRES_IN),
    };

    // Warn about missing optional but recommended variables
    if (!config.REPLICATE_API_TOKEN) {
      logger.warn('REPLICATE_API_TOKEN not configured - AI enhancement will run in mock mode');
    }

    if (!config.CLOUDFLARE_ACCOUNT_ID || !config.CLOUDFLARE_R2_ACCESS_KEY_ID) {
      logger.warn('Cloudflare R2 credentials not configured - storage will run in mock mode');
    }

    if (!config.GOOGLE_CLOUD_PROJECT_ID) {
      logger.info('Google Cloud TTS not configured - audio generation disabled');
    }

    if (!config.JWT_SECRET) {
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
