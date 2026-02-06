/**
 * Anchor App - Service Errors
 *
 * Shared error types for service-layer failures.
 */

export type ServiceErrorCode =
  | 'notifications/permission-request-failed'
  | 'notifications/permission-denied'
  | 'notifications/schedule-failed'
  | 'notifications/cancel-failed'
  | 'notifications/invalid-time'
  | 'notifications/handler-failed'
  | 'biometric/unavailable'
  | 'biometric/hardware-check-failed'
  | 'biometric/enrollment-check-failed'
  | 'biometric/supported-types-failed'
  | 'biometric/auth-failed'
  | 'storage/set-failed'
  | 'storage/get-failed'
  | 'storage/remove-failed'
  | 'storage/clear-failed'
  | 'storage/keys-failed'
  | 'storage/multi-get-failed'
  | 'storage/multi-set-failed'
  | 'sync/anchors-failed'
  | 'sync/profile-failed'
  | 'sync/conflict-failed'
  | 'sync/last-sync-failed';

export class ServiceError extends Error {
  readonly code: ServiceErrorCode;
  readonly cause?: unknown;

  constructor(code: ServiceErrorCode, message: string, cause?: unknown) {
    super(message);
    this.code = code;
    this.cause = cause;
    this.name = 'ServiceError';
    Object.setPrototypeOf(this, ServiceError.prototype);
  }
}
