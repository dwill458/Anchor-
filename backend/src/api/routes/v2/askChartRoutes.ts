import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthRequest, authMiddleware } from '../../middleware/auth';
import { AppError } from '../../middleware/errorHandler';
import { prisma } from '../../../lib/prisma';
import { requireChartEnabled, requireChartWriteEnabled } from '../../../config/chartFlags';
import { getAuthenticatedUserId } from './authHelper';
import { askChartService } from '../../../services/chart/ask/AskChartService';
import { askChartStore } from '../../../services/chart/ask/askChartStore';
import { ASK_SKILLS, COACH_STYLES } from '../../../services/chart/ask/chartAgent';
import { MEMORY_KEYS } from '../../../services/chart/ask/askChartSchema';
import {
  ASK_PHOTO_MIME_TYPES,
  MAX_ASK_PHOTO_BASE64_LENGTH,
  purgeExpiredAskPhotos,
  storeAskPhoto,
} from '../../../services/chart/ask/askChartPhotos';
import {
  globalAiCeilingLimiter,
  chartAskLimiter,
  chartAskConcurrencyGuard,
} from '../../middleware/aiRateLimit';

/**
 * Ask Chart API. Conversations belong to an Anchor (and its current Chart); proposals are applied to a Chart by
 * the server from what it stored, never from content the client sends back.
 *
 *   POST   /anchors/:anchorId/chart/ask                      one turn (JSON, or SSE with Accept: text/event-stream)
 *   POST   /anchors/:anchorId/chart/ask/photo                upload one photo for a message (deleted after 24 h)
 *   GET    /anchors/:anchorId/chart/ask                      restore the conversation
 *   DELETE /anchors/:anchorId/chart/ask                      clear the conversation
 *   GET    /anchors/:anchorId/chart/ask/profile              coaching style + remembered preferences
 *   PUT    /anchors/:anchorId/chart/ask/memory/:key          correct a remembered preference
 *   DELETE /anchors/:anchorId/chart/ask/memory[/:key]        forget one / all preferences for this Anchor
 *   PUT    /chart-coach/style                                coaching style
 *   POST   /charts/:courseId/ask/:messageId/approve          apply an approved ADD_MOVES proposal
 *   POST   /charts/:courseId/ask/:messageId/dismiss          dismiss a proposal
 *   POST   /charts/:courseId/ask/:messageId/route-applied    record that a REVISE_ROUTE proposal was applied
 */
const router = Router();
router.use(authMiddleware);

const IdempotencyKey = z.string().trim().min(8).max(200);

const TurnSchema = z
  .object({
    idempotencyKey: IdempotencyKey,
    text: z.string().max(1000).default(''),
    attachments: z.array(z.string().uuid()).max(3).default([]),
    skill: z.enum(ASK_SKILLS).default('FREE'),
    targetMoveId: z.string().min(1).max(200).nullish(),
    conversationId: z.string().min(1).max(200).nullish(),
    opening: z.boolean().default(false),
  })
  .strict();

function validate<T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    const message = result.error.errors
      .map(error => `${error.path.join('.')}: ${error.message}`)
      .join(', ');
    throw new AppError(`Validation error: ${message}`, 400, 'VALIDATION_ERROR');
  }
  return result.data;
}

type Handler = (req: AuthRequest, res: Response) => Promise<void>;
const handle =
  (fn: Handler) =>
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      await fn(req, res);
    } catch (error) {
      next(error);
    }
  };

async function readUser(req: AuthRequest): Promise<string> {
  requireChartEnabled();
  return getAuthenticatedUserId(req);
}

async function writeUser(req: AuthRequest): Promise<string> {
  requireChartWriteEnabled();
  return getAuthenticatedUserId(req);
}

async function activeCourseId(userId: string, anchorId: string): Promise<string | null> {
  const course = await prisma.course.findFirst({
    where: { userId, anchorId, status: 'ACTIVE', deletedAt: null },
    orderBy: { plottedAt: 'desc' },
    select: { id: true },
  });
  return course?.id ?? null;
}

function errorBody(error: unknown): {
  code: string;
  message: string;
  status: number;
  retryable: boolean;
} {
  if (error instanceof AppError) {
    return {
      code: error.code,
      message: error.message,
      status: error.statusCode,
      retryable:
        error.statusCode >= 500 ||
        error.statusCode === 429 ||
        error.code === 'ASK_TURN_IN_PROGRESS',
    };
  }
  return {
    code: 'ASK_FAILED',
    message: 'Ask Chart could not answer right now',
    status: 500,
    retryable: true,
  };
}

const wantsStream = (req: AuthRequest) =>
  String(req.headers.accept ?? '').includes('text/event-stream');

router.post(
  '/anchors/:anchorId/chart/ask',
  globalAiCeilingLimiter,
  chartAskLimiter,
  chartAskConcurrencyGuard,
  handle(async (req, res) => {
    const userId = await writeUser(req);
    const body = validate(TurnSchema, req.body);
    const input = {
      anchorId: req.params.anchorId,
      idempotencyKey: body.idempotencyKey,
      text: body.text,
      attachments: body.attachments,
      skill: body.skill,
      targetMoveId: body.targetMoveId ?? null,
      conversationId: body.conversationId ?? null,
      opening: body.opening,
    };

    if (!wantsStream(req)) {
      res.json({ success: true, data: await askChartService.turn(userId, input) });
      return;
    }

    // Server-sent events: `delta` carries the whole reply so far (the client replaces, so a restarted attempt
    // simply overwrites it), `stage` a real extra processing step, then exactly one `done` or `error`.
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
    const send = (event: string, data: unknown) => {
      if (!res.writableEnded) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    let latest = '';
    let timer: ReturnType<typeof setTimeout> | null = null;
    const flush = () => {
      timer = null;
      if (latest) send('delta', { text: latest });
    };
    try {
      const result = await askChartService.turn(userId, input, {
        // Batched to ~20 updates a second so a fast model cannot flood a phone.
        onReply: text => {
          latest = text;
          if (!timer) timer = setTimeout(flush, 50);
        },
        onStage: stage => send('stage', { stage }),
      });
      if (timer) clearTimeout(timer);
      send('done', result);
    } catch (error) {
      if (timer) clearTimeout(timer);
      send('error', errorBody(error));
    } finally {
      res.end();
    }
  })
);

const PhotoSchema = z
  .object({
    base64Image: z.string().min(1).max(MAX_ASK_PHOTO_BASE64_LENGTH),
    mimeType: z.enum(ASK_PHOTO_MIME_TYPES).default('image/jpeg'),
  })
  .strict();

router.post(
  '/anchors/:anchorId/chart/ask/photo',
  chartAskLimiter,
  handle(async (req, res) => {
    const userId = await writeUser(req);
    const body = validate(PhotoSchema, req.body);
    await askChartStore.assertOwnsAnchor(userId, req.params.anchorId);
    const stored = await storeAskPhoto(
      userId,
      req.params.anchorId,
      body.base64Image,
      body.mimeType
    );
    // Housekeeping on the way through: this person's photos past their lifetime go now, without waiting for the job.
    void purgeExpiredAskPhotos({ userId }).catch(() => undefined);
    res.status(201).json({
      success: true,
      data: { assetId: stored.assetId, width: stored.width, height: stored.height },
    });
  })
);

router.get(
  '/anchors/:anchorId/chart/ask',
  handle(async (req, res) => {
    const userId = await readUser(req);
    await askChartStore.assertOwnsAnchor(userId, req.params.anchorId);
    const courseId = await activeCourseId(userId, req.params.anchorId);
    const conversation = await askChartStore.getConversation(userId, req.params.anchorId, courseId);
    res.json({
      success: true,
      data: { ...conversation, mode: courseId ? 'ONGOING' : 'CREATE', courseId },
    });
  })
);

router.delete(
  '/anchors/:anchorId/chart/ask',
  handle(async (req, res) => {
    const userId = await writeUser(req);
    await askChartStore.assertOwnsAnchor(userId, req.params.anchorId);
    const courseId = await activeCourseId(userId, req.params.anchorId);
    res.json({
      success: true,
      data: {
        cleared: await askChartStore.clearConversation(userId, req.params.anchorId, courseId),
      },
    });
  })
);

router.get(
  '/anchors/:anchorId/chart/ask/profile',
  handle(async (req, res) => {
    const userId = await readUser(req);
    await askChartStore.assertOwnsAnchor(userId, req.params.anchorId);
    res.json({ success: true, data: await askChartStore.getProfile(userId, req.params.anchorId) });
  })
);

const MemoryKeySchema = z.enum(MEMORY_KEYS);

router.put(
  '/anchors/:anchorId/chart/ask/memory/:key',
  handle(async (req, res) => {
    const userId = await writeUser(req);
    const key = validate(MemoryKeySchema, req.params.key);
    const body = validate(
      z.object({ value: z.string().trim().min(1).max(200) }).strict(),
      req.body
    );
    res.json({
      success: true,
      data: await askChartStore.upsertMemory(
        userId,
        req.params.anchorId,
        key,
        body.value,
        'USER_EDITED'
      ),
    });
  })
);

router.delete(
  '/anchors/:anchorId/chart/ask/memory/:key',
  handle(async (req, res) => {
    const userId = await writeUser(req);
    await askChartStore.deleteMemory(
      userId,
      req.params.anchorId,
      validate(MemoryKeySchema, req.params.key)
    );
    res.json({ success: true, data: { deleted: true } });
  })
);

router.delete(
  '/anchors/:anchorId/chart/ask/memory',
  handle(async (req, res) => {
    const userId = await writeUser(req);
    res.json({
      success: true,
      data: { deleted: await askChartStore.deleteAllMemories(userId, req.params.anchorId) },
    });
  })
);

router.put(
  '/chart-coach/style',
  handle(async (req, res) => {
    const userId = await writeUser(req);
    const body = validate(z.object({ style: z.enum(COACH_STYLES) }).strict(), req.body);
    res.json({ success: true, data: { style: await askChartStore.setStyle(userId, body.style) } });
  })
);

router.post(
  '/charts/:courseId/ask/:messageId/approve',
  handle(async (req, res) => {
    const userId = await writeUser(req);
    const result = await askChartService.approveMoves(
      userId,
      req.params.courseId,
      req.params.messageId
    );
    res.json({ success: true, data: result });
  })
);

router.post(
  '/charts/:courseId/ask/:batchId/undo',
  handle(async (req, res) => {
    const userId = await writeUser(req);
    res.json({
      success: true,
      data: await askChartService.undoProposal(userId, req.params.courseId, req.params.batchId),
    });
  })
);

router.post(
  '/charts/:courseId/ask/:messageId/dismiss',
  handle(async (req, res) => {
    const userId = await writeUser(req);
    await askChartService.dismiss(userId, req.params.courseId, req.params.messageId);
    res.json({ success: true, data: { dismissed: true } });
  })
);

router.post(
  '/charts/:courseId/ask/:messageId/route-applied',
  handle(async (req, res) => {
    const userId = await writeUser(req);
    await askChartService.confirmRouteApplied(userId, req.params.courseId, req.params.messageId);
    res.json({ success: true, data: { applied: true } });
  })
);

export default router;
