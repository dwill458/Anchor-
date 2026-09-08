import type { AxiosRequestConfig, AxiosResponse } from 'axios';
import { apiClient, ApiClientError } from './ApiClient';
import type {
  ChartResponseEnvelope,
  CourseDetail,
  CourseStatus,
  CourseSummary,
  CreateCourseRequest,
  EditWaypointRequest,
  LinkAnchorRequest,
  ReorderWaypointsRequest,
  AddWaypointRequest,
  CourseLogEntry,
} from '@/types/chart';

export type ChartApiResult<T> = {
  data: T;
  migrationRequired?: boolean;
  pagination?: { nextCursor: string | null; hasMore: boolean };
};

function encodePath(value: string): string {
  return encodeURIComponent(value);
}

/** Typed client for the Workstream A Course endpoints. */
export class ChartApiClient {
  private readonly requestConfig = (signal?: AbortSignal): AxiosRequestConfig =>
    signal ? { signal } : {};

  private async unwrap<T>(
    operation: () => Promise<AxiosResponse<ChartResponseEnvelope<T>>>,
  ): Promise<ChartApiResult<T>> {
    const response = await operation();
    const envelope = response.data;
    if (!envelope.success) {
      throw new ApiClientError(
        envelope.error?.message ?? 'Chart request failed',
        envelope.error?.code,
        response.status,
        envelope.error?.details,
      );
    }
    if (!Object.prototype.hasOwnProperty.call(envelope, 'data')) {
      throw new ApiClientError('Chart response did not include data', 'INVALID_RESPONSE', response.status);
    }
    return {
      data: envelope.data as T,
      migrationRequired: envelope.migrationRequired,
      pagination: envelope.pagination,
    };
  }

  initialize(signal?: AbortSignal): Promise<ChartApiResult<{ chartSchemaVersion: number }>> {
    return this.unwrap(() => apiClient.post('/api/courses/initialize', undefined, this.requestConfig(signal)));
  }

  listCourses(
    status?: CourseStatus,
    signal?: AbortSignal,
  ): Promise<ChartApiResult<CourseSummary[]>> {
    return this.unwrap(() =>
      apiClient.get('/api/courses', {
        ...this.requestConfig(signal),
        params: status ? { status } : undefined,
      }),
    );
  }

  getCourse(courseId: string, signal?: AbortSignal): Promise<ChartApiResult<CourseDetail>> {
    return this.unwrap(() => apiClient.get(`/api/courses/${encodePath(courseId)}`, this.requestConfig(signal)));
  }

  createCourse(
    request: CreateCourseRequest,
    signal?: AbortSignal,
  ): Promise<ChartApiResult<CourseDetail>> {
    return this.unwrap(() => apiClient.post('/api/courses', request, this.requestConfig(signal)));
  }

  updateCourse(
    courseId: string,
    request: { expectedCourseVersion: number; destinationText?: string; status?: 'ACTIVE' },
    signal?: AbortSignal,
  ): Promise<ChartApiResult<CourseDetail>> {
    return this.unwrap(() =>
      apiClient.patch(`/api/courses/${encodePath(courseId)}`, request, this.requestConfig(signal)),
    );
  }

  publishCourse(
    courseId: string,
    expectedCourseVersion: number,
    signal?: AbortSignal,
  ): Promise<ChartApiResult<CourseDetail>> {
    return this.updateCourse(courseId, { expectedCourseVersion, status: 'ACTIVE' }, signal);
  }

  archiveCourse(
    courseId: string,
    expectedCourseVersion: number,
    signal?: AbortSignal,
  ): Promise<ChartApiResult<CourseDetail>> {
    return this.unwrap(() =>
      apiClient.post(
        `/api/courses/${encodePath(courseId)}/archive`,
        { expectedCourseVersion },
        this.requestConfig(signal),
      ),
    );
  }

  restoreCourse(
    courseId: string,
    expectedCourseVersion: number,
    signal?: AbortSignal,
  ): Promise<ChartApiResult<CourseDetail>> {
    return this.unwrap(() =>
      apiClient.post(
        `/api/courses/${encodePath(courseId)}/restore`,
        { expectedCourseVersion },
        this.requestConfig(signal),
      ),
    );
  }

  softDeleteCourse(
    courseId: string,
    expectedCourseVersion: number,
    signal?: AbortSignal,
  ): Promise<ChartApiResult<{ deleted: true }>> {
    return this.unwrap(() =>
      apiClient.delete(`/api/courses/${encodePath(courseId)}`, {
        ...this.requestConfig(signal),
        data: { expectedCourseVersion },
      }),
    );
  }

  addWaypoint(
    courseId: string,
    request: AddWaypointRequest,
    signal?: AbortSignal,
  ): Promise<ChartApiResult<CourseDetail>> {
    return this.unwrap(() =>
      apiClient.post(`/api/courses/${encodePath(courseId)}/waypoints`, request, this.requestConfig(signal)),
    );
  }

  editWaypoint(
    courseId: string,
    waypointId: string,
    request: EditWaypointRequest,
    signal?: AbortSignal,
  ): Promise<ChartApiResult<CourseDetail>> {
    return this.unwrap(() =>
      apiClient.patch(
        `/api/courses/${encodePath(courseId)}/waypoints/${encodePath(waypointId)}`,
        request,
        this.requestConfig(signal),
      ),
    );
  }

  reorderWaypoints(
    courseId: string,
    request: ReorderWaypointsRequest,
    signal?: AbortSignal,
  ): Promise<ChartApiResult<CourseDetail>> {
    return this.unwrap(() =>
      apiClient.post(`/api/courses/${encodePath(courseId)}/waypoints/reorder`, request, this.requestConfig(signal)),
    );
  }

  linkAnchor(
    courseId: string,
    request: LinkAnchorRequest,
    signal?: AbortSignal,
  ): Promise<ChartApiResult<CourseDetail>> {
    return this.unwrap(() =>
      apiClient.post(`/api/courses/${encodePath(courseId)}/anchor-links`, request, this.requestConfig(signal)),
    );
  }

  replaceAnchor(
    courseId: string,
    request: LinkAnchorRequest & { replaceLinkId: string },
    signal?: AbortSignal,
  ): Promise<ChartApiResult<CourseDetail>> {
    return this.linkAnchor(courseId, request, signal);
  }

  unlinkAnchor(
    courseId: string,
    linkId: string,
    expectedCourseVersion: number,
    signal?: AbortSignal,
  ): Promise<ChartApiResult<CourseDetail>> {
    return this.unwrap(() =>
      apiClient.delete(
        `/api/courses/${encodePath(courseId)}/anchor-links/${encodePath(linkId)}`,
        {
          ...this.requestConfig(signal),
          data: { expectedCourseVersion },
        },
      ),
    );
  }

  getCourseLog(
    courseId: string,
    options: { cursor?: string; limit?: number } = {},
    signal?: AbortSignal,
  ): Promise<ChartApiResult<CourseLogEntry[]>> {
    return this.unwrap(() =>
      apiClient.get(`/api/courses/${encodePath(courseId)}/log`, {
        ...this.requestConfig(signal),
        params: { limit: options.limit ?? 25, ...(options.cursor ? { cursor: options.cursor } : {}) },
      }),
    );
  }
}

export const chartApiClient = new ChartApiClient();

export function isChartAbortError(error: unknown): boolean {
  return error instanceof Error && (error.name === 'CanceledError' || error.name === 'AbortError');
}

export function getChartErrorCode(error: unknown): string | undefined {
  return error instanceof ApiClientError ? error.code : undefined;
}

export function getConflictCourse(error: unknown): CourseDetail | null {
  if (!(error instanceof ApiClientError) || error.code !== 'COURSE_VERSION_CONFLICT') return null;
  const course = error.details?.course;
  return course && typeof course === 'object' ? (course as CourseDetail) : null;
}
