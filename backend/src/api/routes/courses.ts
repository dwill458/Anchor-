import { Router, Response, NextFunction } from 'express';
import { CourseAnchorRole, CourseStatus, ReflectionMood } from '@prisma/client';
import { z } from 'zod';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { prisma } from '../../lib/prisma';
import { courseService } from '../../services/CourseService';
import {
  requireChartEnabled,
  requireChartInitialized,
  requireChartWriteEnabled,
} from '../../config/chartFlags';
import { getChartCapabilities } from '../../services/ChartCapabilityService';

const router = Router();

const IdempotencyKey = z.string().trim().min(1).max(200);
const CourseVersion = z.number().int().min(1);
const CreateCourseSchema = z
  .object({
    idempotencyKey: IdempotencyKey,
    destinationText: z.string().trim().min(1).max(140),
    waypoints: z
      .array(
        z
          .object({
            title: z.string().trim().min(1).max(60),
            description: z.string().trim().max(400).optional(),
          })
          .strict()
      )
      .max(7)
      .optional(),
    fromProposalId: z.string().min(1).max(200).optional(),
  })
  .strict();
const UpdateCourseSchema = z
  .object({
    expectedCourseVersion: CourseVersion,
    destinationText: z.string().trim().min(1).max(140).optional(),
    status: z.literal('ACTIVE').optional(),
  })
  .strict();
const ExpectedVersionSchema = z.object({ expectedCourseVersion: CourseVersion }).strict();
const AddWaypointSchema = z
  .object({
    idempotencyKey: IdempotencyKey,
    expectedCourseVersion: CourseVersion,
    title: z.string().trim().min(1).max(60),
    description: z.string().trim().max(400).optional(),
    afterWaypointId: z.string().min(1).max(200).nullable().optional(),
  })
  .strict();
const EditWaypointSchema = z
  .object({
    expectedCourseVersion: CourseVersion,
    title: z.string().trim().min(1).max(60).optional(),
    description: z.string().trim().max(400).nullable().optional(),
  })
  .strict();
const ReorderSchema = z
  .object({
    expectedCourseVersion: CourseVersion,
    orderedWaypointIds: z.array(z.string().min(1).max(200)).max(7),
  })
  .strict();
const CompleteSchema = z
  .object({
    idempotencyKey: IdempotencyKey,
    expectedCourseVersion: CourseVersion,
    reflection: z
      .object({
        // No freeform `body`. The waypoint ceremony is exactly two structured
        // optional prompts (whatHelped / whatLearned), and the service stores
        // `body: null`. Accepting a body here would 200 while silently
        // discarding the user's text.
        structuredContent: z
          .object({
            whatHelped: z.string().max(1000).optional(),
            whatLearned: z.string().max(1000).optional(),
          })
          .strict()
          .optional(),
        moodAfter: z.nativeEnum(ReflectionMood).optional(),
        promptType: z.literal('WAYPOINT_COMPLETION'),
        promptVersion: z.number().int().min(1).max(100),
        idempotencyKey: IdempotencyKey,
      })
      .strict()
      .optional(),
    supportingPracticeSessionId: z.string().min(1).max(200).optional(),
  })
  .strict();
const SkipSchema = z
  .object({
    idempotencyKey: IdempotencyKey,
    expectedCourseVersion: CourseVersion,
    reason: z.string().max(200).optional(),
  })
  .strict();
const CancelSchema = z
  .object({ idempotencyKey: IdempotencyKey, expectedCourseVersion: CourseVersion })
  .strict();
const LinkSchema = z
  .object({
    idempotencyKey: IdempotencyKey,
    expectedCourseVersion: CourseVersion,
    anchorId: z.string().min(1).max(200),
    role: z.nativeEnum(CourseAnchorRole),
    waypointId: z.string().min(1).max(200).optional(),
    replaceLinkId: z.string().min(1).max(200).optional(),
    acknowledgedReuse: z.boolean().optional(),
  })
  .strict();
const ListQuerySchema = z.object({ status: z.nativeEnum(CourseStatus).optional() }).strict();
const LogQuerySchema = z
  .object({
    cursor: z.string().min(1).max(200).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict();

function validate<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    const message = result.error.errors
      .map(error => `${error.path.join('.')}: ${error.message}`)
      .join(', ');
    throw new AppError(`Validation error: ${message}`, 400, 'VALIDATION_ERROR');
  }
  return result.data;
}

async function resolveChartUser(req: AuthRequest): Promise<{
  id: string;
  chartSchemaVersion: number;
  isComped: boolean;
  subscriptionStatus: string;
  subscriptionId: string | null;
  trialStartedAt: Date | null;
}> {
  if (!req.user?.uid) throw new AppError('User not authenticated', 401, 'UNAUTHORIZED');
  const user = await prisma.user.findUnique({
    where: { authUid: req.user.uid },
    select: {
      id: true,
      chartSchemaVersion: true,
      isComped: true,
      subscriptionStatus: true,
      subscriptionId: true,
      trialStartedAt: true,
    },
  });
  if (!user) throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  return user;
}

async function requireWriteUser(req: AuthRequest): Promise<string> {
  requireChartWriteEnabled();
  const user = await resolveChartUser(req);
  requireChartInitialized(user.chartSchemaVersion);
  if (!(await getChartCapabilities(user)).canEditCourse) {
    throw new AppError('Chart is currently unavailable', 403, 'FEATURE_DISABLED');
  }
  return user.id;
}

async function requireReadUser(
  req: AuthRequest
): Promise<{ id: string; chartSchemaVersion: number }> {
  requireChartEnabled();
  const user = await resolveChartUser(req);
  if (user.chartSchemaVersion === 1 && !(await getChartCapabilities(user)).canViewChart) {
    throw new AppError('Chart is currently unavailable', 403, 'FEATURE_DISABLED');
  }
  return user;
}

router.use(authMiddleware);

router.post('/initialize', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    requireChartEnabled();
    const user = await resolveChartUser(req);
    res.json({ success: true, data: await courseService.initializeChartForUser(user.id) });
  } catch (error) {
    next(error);
  }
});

router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await requireReadUser(req);
    const query = validate(ListQuerySchema, req.query);
    if (user.chartSchemaVersion !== 1) {
      res.json({ success: true, data: [], migrationRequired: true });
      return;
    }
    res.json({ success: true, data: await courseService.listCourses(user.id, query.status) });
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = await requireWriteUser(req);
    const input = validate(CreateCourseSchema, req.body ?? {});
    res.status(201).json({ success: true, data: await courseService.createCourse(userId, input) });
  } catch (error) {
    next(error);
  }
});

router.get('/:courseId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await requireReadUser(req);
    if (user.chartSchemaVersion !== 1) {
      res.json({ success: true, data: null, migrationRequired: true });
      return;
    }
    res.json({ success: true, data: await courseService.getCourse(user.id, req.params.courseId) });
  } catch (error) {
    next(error);
  }
});

router.patch('/:courseId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = await requireWriteUser(req);
    res.json({
      success: true,
      data: await courseService.updateCourse(
        userId,
        req.params.courseId,
        validate(UpdateCourseSchema, req.body ?? {})
      ),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/:courseId/archive', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = await requireWriteUser(req);
    const input = validate(ExpectedVersionSchema, req.body ?? {});
    res.json({
      success: true,
      data: await courseService.archiveCourse(
        userId,
        req.params.courseId,
        input.expectedCourseVersion
      ),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/:courseId/restore', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = await requireWriteUser(req);
    const input = validate(ExpectedVersionSchema, req.body ?? {});
    res.json({
      success: true,
      data: await courseService.restoreCourse(
        userId,
        req.params.courseId,
        input.expectedCourseVersion
      ),
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/:courseId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = await requireWriteUser(req);
    const input = validate(ExpectedVersionSchema, req.body ?? {});
    await courseService.softDeleteCourse(userId, req.params.courseId, input.expectedCourseVersion);
    res.json({ success: true, data: { deleted: true } });
  } catch (error) {
    next(error);
  }
});

router.post('/:courseId/waypoints', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = await requireWriteUser(req);
    res.status(201).json({
      success: true,
      data: await courseService.addWaypoint(
        userId,
        req.params.courseId,
        validate(AddWaypointSchema, req.body ?? {})
      ),
    });
  } catch (error) {
    next(error);
  }
});

router.patch(
  '/:courseId/waypoints/:waypointId',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = await requireWriteUser(req);
      res.json({
        success: true,
        data: await courseService.editWaypoint(
          userId,
          req.params.courseId,
          req.params.waypointId,
          validate(EditWaypointSchema, req.body ?? {})
        ),
      });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/:courseId/waypoints/reorder',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = await requireWriteUser(req);
      res.json({
        success: true,
        data: await courseService.reorderWaypoints(
          userId,
          req.params.courseId,
          validate(ReorderSchema, req.body ?? {})
        ),
      });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/:courseId/waypoints/:waypointId/complete',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = await requireWriteUser(req);
      res.json({
        success: true,
        data: await courseService.completeWaypoint(
          userId,
          req.params.courseId,
          req.params.waypointId,
          validate(CompleteSchema, req.body ?? {})
        ),
      });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/:courseId/waypoints/:waypointId/skip',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = await requireWriteUser(req);
      res.json({
        success: true,
        data: await courseService.skipWaypoint(
          userId,
          req.params.courseId,
          req.params.waypointId,
          validate(SkipSchema, req.body ?? {})
        ),
      });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/:courseId/waypoints/:waypointId/cancel',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = await requireWriteUser(req);
      res.json({
        success: true,
        data: await courseService.cancelWaypoint(
          userId,
          req.params.courseId,
          req.params.waypointId,
          validate(CancelSchema, req.body ?? {})
        ),
      });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/:courseId/anchor-links',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = await requireWriteUser(req);
      res.status(201).json({
        success: true,
        data: await courseService.linkAnchor(
          userId,
          req.params.courseId,
          validate(LinkSchema, req.body ?? {})
        ),
      });
    } catch (error) {
      next(error);
    }
  }
);

router.delete(
  '/:courseId/anchor-links/:linkId',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = await requireWriteUser(req);
      const input = validate(ExpectedVersionSchema, req.body ?? {});
      res.json({
        success: true,
        data: await courseService.unlinkAnchor(
          userId,
          req.params.courseId,
          req.params.linkId,
          input.expectedCourseVersion
        ),
      });
    } catch (error) {
      next(error);
    }
  }
);

router.get('/:courseId/log', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await requireReadUser(req);
    if (user.chartSchemaVersion !== 1) {
      res.json({
        success: true,
        data: [],
        pagination: { nextCursor: null, hasMore: false },
        migrationRequired: true,
      });
      return;
    }
    const query = validate(LogQuerySchema, req.query);
    const result = await courseService.listLog(
      user.id,
      req.params.courseId,
      query.limit ?? 25,
      query.cursor
    );
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
});

export default router;
