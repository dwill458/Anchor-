import { isBackendAnchorId } from '../BackendAnchorService';

jest.mock('@/services/ApiClient', () => ({
  apiClient: {
    post: jest.fn(),
  },
}));

jest.mock('@/stores/anchorStore', () => ({
  useAnchorStore: {
    getState: jest.fn(),
  },
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
  },
}));

describe('isBackendAnchorId', () => {
  it('only treats UUIDs as backend anchor ids', () => {
    expect(isBackendAnchorId('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    expect(isBackendAnchorId('anchor-local-123')).toBe(false);
    expect(isBackendAnchorId('pending-first-anchor-123')).toBe(false);
    expect(isBackendAnchorId('temp-123')).toBe(false);
    expect(isBackendAnchorId('legacy-local-id')).toBe(false);
    expect(isBackendAnchorId('')).toBe(false);
    expect(isBackendAnchorId(undefined)).toBe(false);
  });
});
