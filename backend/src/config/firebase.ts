import * as admin from 'firebase-admin';
import { logger } from '../utils/logger';

let initialized = false;

export function getFirebaseAdmin(): admin.app.App {
  if (!initialized) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

    if (!projectId || !privateKey || !clientEmail) {
      throw new Error(
        'Firebase Admin SDK requires FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, and FIREBASE_CLIENT_EMAIL'
      );
    }

    admin.initializeApp({
      credential: admin.credential.cert({ projectId, privateKey, clientEmail }),
    });

    initialized = true;
    logger.info('Firebase Admin SDK initialized');
  }

  return admin.app();
}
