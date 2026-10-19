import { buildCatalog, classify, ownerScopedNames } from '../namespaceRegistry';

// Durable names the stores persist today. Every one must have an explicit rule.
const KNOWN_PERSISTED_NAMES = [
  'anchor-vault-storage',
  'anchor-session-storage',
  'anchor-visualization-scenes-v1',
  'anchor-first-anchor-flow-v1',
  'anchor-teaching-storage',
  'anchor-location-priming-storage',
  'anchor:v2:first-run',
  'anchor-profile-storage',
  'anchor-settings-storage',
  'anchor-creation-prefs-v1',
  'anchor-share-prefs-v1',
  '@anchor/v2/celebration-records',
  '@anchor/v2/home-glow-seen',
  '@anchor/v2/home-arrival-sound-played',
  'anchor.splash.firstOpenPlayed.v2',
  '@anchor_notification_state',
  '@anchor_notification_state_pending_sync',
  '@anchor_pending_smart_notification',
  'anchor-auth-storage',
  'anchor:cached_user',
  'anchor-subscription-override-storage',
  '@anchor_widget_snapshot',
  '@anchor_widget_last_sync',
];

describe('namespace registry', () => {
  it('classifies every known persisted name', () => {
    for (const name of KNOWN_PERSISTED_NAMES) expect({ name, rule: classify(name) }).toMatchObject({ rule: expect.any(Object) });
  });

  it('classifies owner-keyed practice, pending-queue, snapshot and recovery namespaces as included', () => {
    for (const name of [
      'anchor:practice-history:A',
      'anchor:practice-write-queue:A',
      'anchor:practice-next-action-queue:A',
      'anchor:anchor-snapshot:A',
      'anchor:session-snapshot:A',
      'anchor:profile-snapshot:A',
      'anchor:recovery-metadata:legacy',
    ]) {
      expect({ name, action: classify(name)?.action }).toEqual({ name, action: 'include' });
    }
  });

  it('expands owner-keyed legacy families for every known account, guest and legacy token', () => {
    const names = ownerScopedNames(['A']);
    expect(names).toEqual(expect.arrayContaining([
      'anchor:practice-write-queue:A',
      'anchor:practice-write-queue:guest',
      'anchor:recovery-metadata:legacy',
    ]));
    for (const name of names) expect(classify(name)).not.toBeNull();
  });

  it('never includes authentication secrets or identity caches', () => {
    expect(classify('anchor-auth-storage')?.action).toBe('exclude');
    expect(classify('anchor:cached_user')?.action).toBe('exclude');
  });

  it('expands owner-scoped scenes only from discovered account identifiers', () => {
    expect(ownerScopedNames(['A', 'B']).filter((n) => n.startsWith('anchor-visualization-scenes-v1::'))).toEqual([
      'anchor-visualization-scenes-v1::owner::recovery',
      'anchor-visualization-scenes-v1::owner::account:A',
      'anchor-visualization-scenes-v1::owner::account:B',
    ]);
  });

  it('reports unclassified enumerable keys as unresolved and keeps excluded items with reasons', () => {
    const catalog = buildCatalog({
      privateNamespaces: ['anchor-vault-storage'],
      plainKeys: ['anchor-profile-storage', 'anchor-auth-storage', 'mystery-key'],
      accountIds: ['A'],
    });
    expect(catalog.included.map((e) => e.name)).toEqual(expect.arrayContaining([
      'anchor-vault-storage',
      'anchor-profile-storage',
      'anchor-visualization-scenes-v1::owner::account:A',
    ]));
    expect(catalog.excluded.find((e) => e.name === 'anchor-auth-storage')?.reason).toMatch(/sign-in/);
    expect(catalog.unresolved).toEqual([{ name: 'mystery-key', store: 'plain', reason: expect.any(String) }]);
    expect(catalog.registryVersion).toBe(1);
  });
});
