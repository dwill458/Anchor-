import fs from 'fs';
import path from 'path';

describe('Reflection privacy boundary', () => {
  const root = path.resolve(__dirname, '..', '..', '..');
  const sources = [
    path.join(root, 'components/reflection/ReflectionComposer.tsx'),
    path.join(root, 'services/ReflectionService.ts'),
    path.join(root, 'stores/reflectionDraftStore.ts'),
  ].map((file) => fs.readFileSync(file, 'utf8'));

  it('does not route reflection content through logs, analytics, breadcrumbs, or notification APIs', () => {
    const source = sources.join('\n');
    expect(source).not.toMatch(/AnalyticsService|track\(|addBreadcrumb|captureException|notification/i);
    expect(source).not.toMatch(/console\.(log|warn|error)/);
  });

  it('keeps private persistence behind the encrypted storage adapter', () => {
    expect(sources.join('\n')).toContain('encryptedPersistStorage');
    expect(sources.join('\n')).not.toContain('AsyncStorage');
  });
});
