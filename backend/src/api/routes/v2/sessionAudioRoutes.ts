import { Router, type NextFunction, type Request, type Response } from 'express';
import { getSignedUrl } from '../../../services/StorageService';

/**
 * Long practice recordings are not bundled into the app. The client downloads them once and
 * keeps them on disk (see anchor/mobile/src/services/audio/remoteAudio.ts).
 *
 * The bucket has no working public domain, so this redirects to a short-lived presigned R2 URL,
 * the same way stored Anchor art is served. The audio is not user data and needs no account:
 * the redirect only ever points inside the `session-audio/` prefix, and names are content-hashed.
 */
const router = Router();

const FILE_PATTERN = /^[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*\.mp3$/;
const SIGNED_URL_SECONDS = 60 * 60;

router.get('/session-audio/:file', async (req: Request, res: Response, next: NextFunction) => {
  const file = req.params.file;
  if (!FILE_PATTERN.test(file)) {
    res.status(404).json({ success: false, error: 'Not found' });
    return;
  }
  try {
    const url = await getSignedUrl(`session-audio/${file}`, SIGNED_URL_SECONDS);
    // The redirect target expires, so only cache the redirect briefly.
    res.set('Cache-Control', 'private, max-age=300');
    res.redirect(302, url);
  } catch (error) {
    next(error);
  }
});

export default router;
