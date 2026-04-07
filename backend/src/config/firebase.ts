import * as admin from 'firebase-admin';
import { logger } from '../utils/logger';

let initialized = false;

export function getFirebaseAdmin(): admin.app.App {
  if (!initialized) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

    // Log which vars are missing to ops logs (never surfaces to clients).
    // Throw a generic error so callers (e.g. auth middleware) return a
    // safe 500 response without leaking configuration details.
    if (!projectId || !privateKey || !clientEmail) {
      const missing = [
        !projectId && 'FIREBASE_PROJECT_ID',
        !privateKey && 'FIREBASE_PRIVATE_KEY',
        !clientEmail && 'FIREBASE_CLIENT_EMAIL',
      ]
        .filter(Boolean)
        .join(', ');
      logger.error(`Firebase Admin SDK configuration incomplete — missing: ${missing}`);
      throw new Error('Authentication service is not configured');
    }

    try {
      admin.initializeApp({
        credential: admin.credential.cert({ projectId, privateKey, clientEmail }),
      });
    } catch (initError) {
      logger.error(
        'Firebase Admin SDK failed to initialize',
        initError instanceof Error ? initError : new Error(String(initError))
      );
      throw new Error('Authentication service failed to initialize');
    }

    initialized = true;
    logger.info('Firebase Admin SDK initialized');
  }

  return admin.app();
}
