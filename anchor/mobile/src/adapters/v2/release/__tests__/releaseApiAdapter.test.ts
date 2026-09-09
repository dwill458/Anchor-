import { createV2ReleaseApiAdapter, V2_RELEASE_ENDPOINT } from '../releaseApiAdapter';
import { ApiClientError } from '@/services/ApiClient';

describe('createV2ReleaseApiAdapter', () => {
  const anchorId = 'anchor-1';
  const request = { anchorId, idempotencyKey: 'release-anchor-1-123-abcd', reason: 'evolve' };

  it('targets the non-destructive V2 release endpoint and never the legacy /burn route', async () => {
    const post = jest.fn().mockResolvedValue({
      data: { success: true, data: { lifecycleState: 'released', releasedAt: '2026-09-08T00:00:00Z' } },
    });
    const adapter = createV2ReleaseApiAdapter({ post });

    const result = await adapter.submitRelease(request);

    expect(post).toHaveBeenCalledTimes(1);
    const [url, body] = post.mock.calls[0];
    expect(url).toBe(V2_RELEASE_ENDPOINT(anchorId));
    expect(url).toBe('/api/v2/anchors/anchor-1/release');
    expect(url).not.toMatch(/burn/);
    expect(body).toEqual({ idempotencyKey: request.idempotencyKey, reason: 'evolve' });
    expect(result).toEqual({
      status: 'released',
      anchorId,
      releasedAt: '2026-09-08T00:00:00Z',
      lifecycleState: 'released',
    });
  });

  it('forwards the caller-supplied idempotency key unchanged', async () => {
    const post = jest.fn().mockResolvedValue({ data: { data: {} } });
    const adapter = createV2ReleaseApiAdapter({ post });

    await adapter.submitRelease({ anchorId, idempotencyKey: 'stable-key-xyz' });
    await adapter.submitRelease({ anchorId, idempotencyKey: 'stable-key-xyz' });

    expect(post.mock.calls[0][1].idempotencyKey).toBe('stable-key-xyz');
    expect(post.mock.calls[1][1].idempotencyKey).toBe('stable-key-xyz');
  });

  it('treats an "already released" conflict as an idempotent success', async () => {
    const post = jest
      .fn()
      .mockRejectedValue(new ApiClientError('Already released', 'ANCHOR_ALREADY_RELEASED', 409));
    const adapter = createV2ReleaseApiAdapter({ post });

    const result = await adapter.submitRelease(request);

    expect(result.status).toBe('released');
    expect(result.lifecycleState).toBe('released');
  });

  it('classifies an offline network error as retryable pending (never a destructive failure)', async () => {
    const post = jest.fn().mockRejectedValue(new Error('Network error. Please check your connection.'));
    const adapter = createV2ReleaseApiAdapter({ post });

    const result = await adapter.submitRelease(request);

    expect(result.status).toBe('pending');
    expect(result.retryable).toBe(true);
  });

  it('classifies a 5xx as retryable pending', async () => {
    const post = jest.fn().mockRejectedValue(new ApiClientError('boom', 'INTERNAL', 503));
    const adapter = createV2ReleaseApiAdapter({ post });

    const result = await adapter.submitRelease(request);

    expect(result.status).toBe('pending');
    expect(result.retryable).toBe(true);
  });

  it('classifies a definitive 4xx as a non-retryable failure', async () => {
    const post = jest.fn().mockRejectedValue(new ApiClientError('Not allowed', 'FORBIDDEN', 403));
    const adapter = createV2ReleaseApiAdapter({ post });

    const result = await adapter.submitRelease(request);

    expect(result.status).toBe('failed');
    expect(result.retryable).toBe(false);
  });
});
