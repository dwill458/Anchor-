/**
 * Anchor App - Logger Utility
 *
 * Simple logger with levels for better debugging and production monitoring.
 * Replace with Winston/Pino in production if needed.
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

interface LogConfig {
  level: LogLevel;
  enableColors: boolean;
  enableTimestamps: boolean;
}

class Logger {
  private config: LogConfig;

  constructor(config?: Partial<LogConfig>) {
    this.config = {
      level: config?.level ?? (process.env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG),
      enableColors: config?.enableColors ?? true,
      enableTimestamps: config?.enableTimestamps ?? true,
    };
  }

  private getTimestamp(): string {
    return new Date().toISOString();
  }

  /**
   * Redacts sensitive information from metadata objects
   */
  private redact(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj;

    const SENSITIVE_KEYS = [
      'password',
      'token',
      'secret',
      'authorization',
      'key',
      'email',
      'distilledLetters',
      'intentionText',
    ];

    if (Array.isArray(obj)) {
      return obj.map((item) => this.redact(item));
    }

    const redacted: any = {};
    for (const key in obj) {
      if (SENSITIVE_KEYS.includes(key.toLowerCase())) {
        redacted[key] = '[REDACTED]';
      } else if (typeof obj[key] === 'object') {
        redacted[key] = this.redact(obj[key]);
      } else {
        redacted[key] = obj[key];
      }
    }
    return redacted;
  }

  private formatMessage(level: string, message: string, meta?: unknown): string {
    const timestamp = this.config.enableTimestamps ? `[${this.getTimestamp()}]` : '';
    const redactedMeta = meta ? this.redact(meta) : null;
    const metaStr = redactedMeta ? ` ${JSON.stringify(redactedMeta)}` : '';
    return `${timestamp} [${level}] ${message}${metaStr}`;
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.config.level;
  }

  debug(message: string, meta?: unknown): void {
    if (!this.shouldLog(LogLevel.DEBUG)) return;
    console.log(this.formatMessage('DEBUG', message, meta));
  }

  info(message: string, meta?: unknown): void {
    if (!this.shouldLog(LogLevel.INFO)) return;
    console.info(this.formatMessage('INFO', message, meta));
  }

  warn(message: string, meta?: unknown): void {
    if (!this.shouldLog(LogLevel.WARN)) return;
    console.warn(this.formatMessage('WARN', message, meta));
  }

  error(message: string, error?: Error | unknown, meta?: unknown): void {
    if (!this.shouldLog(LogLevel.ERROR)) return;
    const errorMeta = error instanceof Error
      ? { message: error.message, stack: error.stack, ...(meta as object) }
      : { error, ...(meta as object) };
    console.error(this.formatMessage('ERROR', message, errorMeta));
  }

  // Convenience method for API request logging
  request(method: string, path: string, meta?: unknown): void {
    this.info(`${method} ${path}`, meta);
  }
}

// Export singleton instance
export const logger = new Logger();

// Export class for testing/custom instances
export { Logger };
