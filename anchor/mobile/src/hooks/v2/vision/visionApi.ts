/** The V2 backend wraps successful responses as { success, data }. */
export function visionApiData<T>(response: { data: unknown }): T {
  const body = response.data;
  if (body && typeof body === 'object' && 'success' in body && 'data' in body) {
    return (body as { data: T }).data;
  }
  return body as T;
}
