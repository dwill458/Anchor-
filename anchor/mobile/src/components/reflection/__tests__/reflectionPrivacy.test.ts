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
    expect(source).not.toMatch(/addBreadcrumb|captureException|notification/i);
    expect(source).not.toMatch(/console\.(log|warn|error)/);

    // Reflection lifecycle analytics are allowed only through the typed safe
    // boundary. Content fields must never become event properties.
    const analyticsCalls = source.match(/trackChartEventOnce\([\s\S]*?\);/g) ?? [];
    expect(analyticsCalls.length).toBeGreaterThan(0);
    for (const call of analyticsCalls) {
      expect(call).not.toMatch(/\b(body|structuredContent|whatHelped|whatLearned|moodBefore|moodAfter)\s*:/i);
    }
  });

  it('keeps private persistence behind the encrypted storage adapter', () => {
    expect(sources.join('\n')).toContain('encryptedPersistStorage');
    expect(sources.join('\n')).not.toContain('AsyncStorage');
  });
});
