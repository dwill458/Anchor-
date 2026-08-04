import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { AppError } from '../api/middleware/errorHandler';
import { prisma } from '../lib/prisma';
import { courseEventService } from './CourseEventService';
import type { CreateReflectionRequest, UpdateReflectionRequest } from '../types/chart';

type ReflectionInput = CreateReflectionRequest;
type StructuredContent = { whatHelped?: string; whatLearned?: string };

function cleanText(value: string | undefined, max = 1000): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
}

function cleanStructured(value: StructuredContent | undefined): StructuredContent | undefined {
  if (!value) return undefined;
  const whatHelped = cleanText(value.whatHelped);
  const whatLearned = cleanText(value.whatLearned);
  if (!whatHelped && !whatLearned) return undefined;
  const total = (whatHelped?.length ?? 0) + (whatLearned?.length ?? 0);
  if (total > 2000) throw new AppError('Reflection is too long', 422, 'REFLECTION_INVALID');
  return {
    ...(whatHelped ? { whatHelped } : {}),
    ...(whatLearned ? { whatLearned } : {}),
  };
}

function assertContent(
  input: ReflectionInput
): { body: string | undefined; structuredContent: StructuredContent | undefined } | null {
  const body = cleanText(input.body);
  const structuredContent = cleanStructured(input.structuredContent);
  if (input.promptType === 'WAYPOINT_COMPLETION') {
    if (body || !structuredContent)
      throw new AppError(
        'Waypoint completion reflections require structured content',
        422,
        'REFLECTION_INVALID'
      );
  } else if (!body || structuredContent) {
    throw new AppError('Reflection must contain exactly one body', 422, 'REFLECTION_INVALID');
  }
  if (!body && !structuredContent) return null;
  return { body, structuredContent };
}

function assertPromptAndMoodRules(input: ReflectionInput): void {
  if (input.promptType === 'WAYPOINT_COMPLETION' && input.source !== 'WAYPOINT_COMPLETION') {
    throw new AppError(
      'Waypoint completion prompts require a waypoint completion source',
      422,
      'REFLECTION_INVALID'
    );
  }
  if (input.moodBefore !== undefined && input.source !== 'POST_PRACTICE') {
    throw new AppError(
      'moodBefore is only valid for post-practice reflections',
      422,
      'REFLECTION_INVALID'
    );
  }
  if (
    input.moodAfter !== undefined &&
    !['POST_PRACTICE', 'WAYPOINT_COMPLETION', 'COURSE_COMPLETION'].includes(input.source)
  ) {
    throw new AppError(
      'moodAfter is not valid for this reflection source',
      422,
      'REFLECTION_INVALID'
    );
  }
}

function reflectionResponse(
  reflection: Prisma.ReflectionGetPayload<Prisma.ReflectionDefaultArgs>
): Record<string, unknown> {
  return {
    id: reflection.id,
    userId: reflection.userId,
    source: reflection.source,
    promptType: reflection.promptType,
    promptVersion: reflection.promptVersion,
    body: reflection.body,
    structuredContent: reflection.structuredContent,
    moodBefore: reflection.moodBefore,
    moodAfter: reflection.moodAfter,
    practiceSessionId: reflection.practiceSessionId,
    anchorId: reflection.anchorId,
    courseId: reflection.courseId,
    waypointId: reflection.waypointId,
    aiConsentGrantedAt: reflection.aiConsentGrantedAt,
    createdAt: reflection.createdAt,
    updatedAt: reflection.updatedAt,
    deletedAt: reflection.deletedAt,
    idempotencyKey: reflection.idempotencyKey,
    schemaVersion: reflection.schemaVersion,
  };
}

export class ReflectionService {
  async create(userId: string, input: ReflectionInput): Promise<Record<string, unknown> | null> {
    assertPromptAndMoodRules(input);
    const content = assertContent(input);
    if (!content) return null;
    const replay = await this.replayExisting(userId, input, content);
    if (replay) return replay;

    const relationship = await this.validateRelationships(userId, input);
    try {
      return reflectionResponse(await this.insert(userId, input, content, relationship));
    } catch (error) {
      // A concurrent retry of the same queued reflection won the unique index.
      // That is the idempotent outcome, not a failure, so resolve to its row.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        (error.meta?.target as string[] | undefined)?.includes('idempotency_key')
      ) {
        const raced = await this.replayExisting(userId, input, content);
        if (raced) return raced;
      }
      throw error;
    }
  }

  private async insert(
    userId: string,
    input: ReflectionInput,
    content: { body: string | undefined; structuredContent: StructuredContent | undefined },
    relationship: {
      practiceSessionId: string | null;
      anchorId: string | null;
      courseId: string | null;
      waypointId: string | null;
    }
  ) {
    return prisma.$transaction(async tx => {
      const reflection = await tx.reflection.create({
        data: {
          id: randomUUID(),
          userId,
          source: input.source,
          promptType: input.promptType,
          promptVersion: input.promptVersion,
          body: content.body ?? null,
          // DbNull writes a SQL NULL. JsonNull would write the JSON scalar
          // `null`, which is not NULL to `structured_content IS NULL`, so
          // `reflections_exactly_one_content_check` rejects the row.
          structuredContent: content.structuredContent
            ? (content.structuredContent as Prisma.InputJsonValue)
            : Prisma.DbNull,
          moodBefore: input.moodBefore ?? null,
          moodAfter: input.moodAfter ?? null,
          practiceSessionId: relationship.practiceSessionId,
          anchorId: relationship.anchorId,
          courseId: relationship.courseId,
          waypointId: relationship.waypointId,
          aiConsentGrantedAt: null,
          idempotencyKey: input.idempotencyKey,
          schemaVersion: 1,
        },
      });
      if (relationship.courseId) {
        await courseEventService.append(tx, {
          userId,
          courseId: relationship.courseId,
          waypointId: relationship.waypointId,
          eventType: 'REFLECTION_ADDED',
          sourceEntityType: 'Reflection',
          sourceEntityId: reflection.id,
          snapshot: { reflectionPromptType: input.promptType },
          idempotencyKey: `chart:reflection:${input.idempotencyKey}`,
        });
      }
      return reflection;
    });
  }

  /**
   * Resolves a replay of an already stored idempotency key, or null when the
   * key is genuinely new. Called before the insert and again if a concurrent
   * retry wins the unique index, so simultaneous retries of one queued
   * reflection resolve to the same row instead of failing.
   */
  private async replayExisting(
    userId: string,
    input: ReflectionInput,
    content: { body: string | undefined; structuredContent: StructuredContent | undefined }
  ): Promise<Record<string, unknown> | null> {
    const existing = await prisma.reflection.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (!existing) return null;
    if (existing.userId !== userId) {
      throw new AppError(
        'Reflection idempotency key has already been used',
        409,
        'IDEMPOTENCY_CONFLICT'
      );
    }
    // Tombstones are authoritative. Never resurrect destroyed text on a
    // delayed replay of the original request.
    if (existing.deletedAt) return reflectionResponse(existing);
    if (!this.matches(existing, userId, input, content)) {
      throw new AppError(
        'Reflection idempotency key has already been used',
        409,
        'IDEMPOTENCY_CONFLICT'
      );
    }
    return reflectionResponse(existing);
  }

  async update(
    userId: string,
    reflectionId: string,
    input: UpdateReflectionRequest
  ): Promise<Record<string, unknown>> {
    const existing = await prisma.reflection.findFirst({ where: { id: reflectionId, userId } });
    if (!existing || existing.deletedAt)
      throw new AppError('Reflection not found', 404, 'REFLECTION_NOT_FOUND');
    const body = input.body !== undefined ? cleanText(input.body) : (existing.body ?? undefined);
    const structuredContent =
      input.structuredContent !== undefined
        ? cleanStructured(input.structuredContent)
        : ((existing.structuredContent as StructuredContent | null | undefined) ?? undefined);
    if (
      input.moodAfter !== undefined &&
      !['POST_PRACTICE', 'WAYPOINT_COMPLETION', 'COURSE_COMPLETION'].includes(existing.source)
    ) {
      throw new AppError(
        'moodAfter is not valid for this reflection source',
        422,
        'REFLECTION_INVALID'
      );
    }
    if (existing.promptType === 'WAYPOINT_COMPLETION') {
      if (body || !structuredContent)
        throw new AppError(
          'Waypoint completion reflections require structured content',
          422,
          'REFLECTION_INVALID'
        );
    } else if (!body || structuredContent) {
      throw new AppError('Reflection must contain exactly one body', 422, 'REFLECTION_INVALID');
    }
    const updated = await prisma.reflection.update({
      where: { id: existing.id },
      data: {
        ...(input.body !== undefined ? { body: body ?? null } : {}),
        ...(input.structuredContent !== undefined
          ? {
              structuredContent: structuredContent
                ? (structuredContent as Prisma.InputJsonValue)
                : Prisma.DbNull,
            }
          : {}),
        ...(input.moodAfter !== undefined ? { moodAfter: input.moodAfter ?? null } : {}),
        ...(input.aiConsentGranted !== undefined
          ? { aiConsentGrantedAt: input.aiConsentGranted ? new Date() : null }
          : {}),
      },
    });
    return reflectionResponse(updated);
  }

  async delete(userId: string, reflectionId: string): Promise<void> {
    const existing = await prisma.reflection.findFirst({
      where: { id: reflectionId, userId, deletedAt: null },
      select: { promptType: true },
    });
    if (!existing) throw new AppError('Reflection not found', 404, 'REFLECTION_NOT_FOUND');
    // `reflections_exactly_one_content_check` and `reflections_prompt_content_check`
    // require exactly one content column to stay populated and to match the
    // prompt type, so a tombstone empties the content in place. Nulling both
    // columns is rejected by the schema and would fail the delete outright.
    const erased =
      existing.promptType === 'WAYPOINT_COMPLETION'
        ? { body: null, structuredContent: {} as Prisma.InputJsonValue }
        : { body: '', structuredContent: Prisma.DbNull };
    const result = await prisma.reflection.updateMany({
      where: { id: reflectionId, userId, deletedAt: null },
      data: { deletedAt: new Date(), ...erased },
    });
    if (result.count === 0) throw new AppError('Reflection not found', 404, 'REFLECTION_NOT_FOUND');
  }

  private async validateRelationships(
    userId: string,
    input: ReflectionInput
  ): Promise<{
    practiceSessionId: string | null;
    anchorId: string | null;
    courseId: string | null;
    waypointId: string | null;
  }> {
    if (input.anchorId) {
      const anchor = await prisma.anchor.findFirst({
        where: { id: input.anchorId, userId },
        select: { id: true },
      });
      if (!anchor)
        throw new AppError('Reflection relationship is invalid', 422, 'REFLECTION_INVALID');
    }
    if (input.source === 'POST_PRACTICE') {
      if (!input.practiceSessionId || input.courseId || input.waypointId) {
        throw new AppError(
          'Post-practice reflections require a practice session',
          422,
          'REFLECTION_INVALID'
        );
      }
      const session = await prisma.practiceSession.findUnique({
        where: { id: input.practiceSessionId },
      });
      if (!session || session.userId !== userId)
        throw new AppError('Reflection relationship is invalid', 422, 'REFLECTION_INVALID');
      return {
        practiceSessionId: session.id,
        anchorId: input.anchorId ?? session.anchorId,
        courseId: session.courseId ?? null,
        waypointId: session.waypointId ?? null,
      };
    }
    if (input.source === 'MANUAL_COURSE') {
      if (!input.courseId || input.practiceSessionId || input.waypointId)
        throw new AppError(
          'Manual Course reflections require a Course only',
          422,
          'REFLECTION_INVALID'
        );
      await this.requireCourse(userId, input.courseId);
      return {
        practiceSessionId: null,
        anchorId: input.anchorId ?? null,
        courseId: input.courseId,
        waypointId: null,
      };
    }
    if (input.source === 'WAYPOINT_COMPLETION') {
      if (!input.courseId || !input.waypointId || input.practiceSessionId)
        throw new AppError(
          'Waypoint reflections require a Course and Waypoint',
          422,
          'REFLECTION_INVALID'
        );
      await this.requireWaypoint(userId, input.courseId, input.waypointId);
      return {
        practiceSessionId: null,
        anchorId: input.anchorId ?? null,
        courseId: input.courseId,
        waypointId: input.waypointId,
      };
    }
    if (input.source === 'COURSE_COMPLETION') {
      if (!input.courseId || input.waypointId || input.practiceSessionId)
        throw new AppError(
          'Course completion reflections require a Course only',
          422,
          'REFLECTION_INVALID'
        );
      await this.requireCourse(userId, input.courseId);
      return {
        practiceSessionId: null,
        anchorId: input.anchorId ?? null,
        courseId: input.courseId,
        waypointId: null,
      };
    }
    if (input.source === 'ANCHOR_RELEASE') {
      if (!input.anchorId || input.courseId || input.waypointId || input.practiceSessionId) {
        throw new AppError(
          'Anchor release reflections require an Anchor only',
          422,
          'REFLECTION_INVALID'
        );
      }
      return {
        practiceSessionId: null,
        anchorId: input.anchorId,
        courseId: null,
        waypointId: null,
      };
    }
    throw new AppError('Reflection relationship is invalid', 422, 'REFLECTION_INVALID');
  }

  private async requireCourse(userId: string, courseId: string): Promise<void> {
    const course = await prisma.course.findFirst({
      where: { id: courseId, userId, deletedAt: null },
      select: { id: true },
    });
    if (!course)
      throw new AppError('Reflection relationship is invalid', 422, 'REFLECTION_INVALID');
  }

  private async requireWaypoint(
    userId: string,
    courseId: string,
    waypointId: string
  ): Promise<void> {
    const waypoint = await prisma.waypoint.findFirst({
      where: { id: waypointId, courseId, userId },
      select: { id: true },
    });
    if (!waypoint)
      throw new AppError('Reflection relationship is invalid', 422, 'REFLECTION_INVALID');
  }

  private matches(
    existing: Prisma.ReflectionGetPayload<Prisma.ReflectionDefaultArgs>,
    userId: string,
    input: ReflectionInput,
    content: { body: string | undefined; structuredContent: StructuredContent | undefined }
  ): boolean {
    return (
      existing.userId === userId &&
      existing.source === input.source &&
      existing.promptType === input.promptType &&
      existing.promptVersion === input.promptVersion &&
      existing.body === (content.body ?? null) &&
      JSON.stringify(existing.structuredContent) ===
        JSON.stringify(content.structuredContent ?? null) &&
      existing.moodBefore === (input.moodBefore ?? null) &&
      existing.moodAfter === (input.moodAfter ?? null)
    );
  }
}

export const reflectionService = new ReflectionService();
