/** Expo SQLite returns an absolute native path; legacy FileSystem requires a URI. */
export function databaseFileUri(directory: string, name: string): string {
  if (!/^[A-Za-z0-9_-]+\.db(?:-(?:wal|shm))?$/.test(name)) throw new Error('Invalid database filename');
  const path = directory.replace(/\/+$/, '');
  if (path.startsWith('file://')) return `${path}/${name}`;
  if (path.startsWith('/')) return `file://${path}/${name}`;
  throw new Error('Unsupported native database directory requires recovery');
}
