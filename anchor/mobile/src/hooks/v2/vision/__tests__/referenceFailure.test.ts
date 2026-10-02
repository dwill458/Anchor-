import { ApiClientError } from '@/services/ApiClient';
import { referenceFailureMessage, referenceMimeType } from '../useVisionAppearanceReference';

jest.mock('@/services/ApiClient', () => ({
  apiClient: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
  ApiClientError: class ApiClientError extends Error {
    code?: string;
    status?: number;
    constructor(message: string, code?: string, status?: number) { super(message); this.code = code; this.status = status; }
  },
}));

describe('reference photo failures say what went wrong', () => {
  it('only blames the photo when the server judged the photo unsuitable', () => {
    expect(referenceFailureMessage(new ApiClientError('Choose a clear, close photo of one person.', 'UNSUITABLE_VISION_REFERENCE', 400)))
      .toBe('Choose a clear, close photo of one person.');
  });
  it('reports a payload that was too large (what a 1 MB body limit used to cause for every real photo)', () => {
    expect(referenceFailureMessage(new ApiClientError('too large', undefined, 413))).toMatch(/too large/i);
  });
  it('reports a format problem, a rate limit, and an expired session distinctly', () => {
    expect(referenceFailureMessage(new ApiClientError('bad', 'INVALID_VISION_REFERENCE', 400))).toMatch(/format/i);
    expect(referenceFailureMessage(new ApiClientError('slow down', undefined, 429))).toMatch(/Too many/);
    expect(referenceFailureMessage(new ApiClientError('no', undefined, 401))).toMatch(/Sign in/);
  });
  it('treats anything else as a connection problem, not a bad photo', () => {
    expect(referenceFailureMessage(new Error('Network request failed'))).toMatch(/connection/i);
  });
  it('trusts the type the picker reports over the file extension', () => {
    expect(referenceMimeType('file:///cache/pick-123', 'image/png')).toBe('image/png');
    expect(referenceMimeType('content://media/external/images/9', 'image/webp')).toBe('image/webp');
    expect(referenceMimeType('file:///cache/photo.PNG?x=1')).toBe('image/png');
    expect(referenceMimeType('file:///cache/photo', 'image/heic')).toBe('image/jpeg');
  });
});
