import { scrubSentryEvent } from '../sentryPrivacy';

describe('Sentry Chart privacy boundary', () => {
  it('removes bodies, scrubs canaries across nested arrays, and strips private metadata', () => {
    const canaries = {
      destination: 'sentry-destination-canary',
      waypoint: 'sentry-waypoint-canary',
      description: 'sentry-description-canary',
      intention: 'sentry-intention-canary',
      reflection: 'sentry-reflection-canary',
      whatHelped: 'sentry-what-helped-canary',
      whatLearned: 'sentry-what-learned-canary',
      plannerInput: 'sentry-planner-input-canary',
      plannerOutput: 'sentry-planner-output-canary',
      scene: 'sentry-scene-canary',
      navigation: 'sentry-navigation-canary',
    };
    const event: any = {
      user: { id: 'account-1', email: 'private@example.com' },
      request: {
        data: { arbitrary: canaries.destination },
        headers: { authorization: 'Bearer private', cookie: 'private-cookie' },
        query_string: `email=private@example.com&token=private-token`,
      },
      extra: {
        destinationText: canaries.destination,
        waypointTitle: canaries.waypoint,
        WaypointDescription: canaries.description,
        anchorIntention: canaries.intention,
        reflectionBody: canaries.reflection,
        whatHelped: canaries.whatHelped,
        whatLearned: canaries.whatLearned,
        plannerInput: canaries.plannerInput,
        plannerOutput: canaries.plannerOutput,
        navigationContext: canaries.navigation,
        nested: [{ scene: canaries.scene }],
        safeCategory: 'network',
        subscriptionId: 'private-subscription',
        providerModel: 'private-model',
        rolloutBucket: 17,
      },
      message: `failed for ${canaries.intention}`,
      exception: { values: [{ value: `provider output ${canaries.plannerOutput}` }] },
    };
    event.extra.cycle = event.extra;

    const scrubbed = scrubSentryEvent(event);
    const seen = new WeakSet<object>();
    const serialized = JSON.stringify(scrubbed, (_key, value) => {
      if (value && typeof value === 'object') {
        if (seen.has(value)) return '[CYCLE]';
        seen.add(value);
      }
      return value;
    });

    expect(scrubbed.request.data).toBeUndefined();
    expect(scrubbed.user).toEqual({ id: 'account-1' });
    expect(scrubbed.request.headers).toEqual({});
    expect(scrubbed.request.query_string).toBe('email=[redacted-email]&token=[redacted]');
    for (const canary of Object.values(canaries)) {
      expect(serialized).not.toContain(canary);
    }
    expect(serialized).not.toContain('private-subscription');
    expect(serialized).not.toContain('private-model');
    expect(scrubbed.extra.safeCategory).toBe('network');
    expect(scrubbed.extra.nested[0].scene).toBe('[REDACTED]');
  });

  it('fails closed for a throwing diagnostic getter', () => {
    const extra: Record<string, unknown> = {};
    Object.defineProperty(extra, 'plannerOutput', {
      configurable: true,
      enumerable: true,
      get: () => {
        throw new Error('getter canary');
      },
    });

    expect(() => scrubSentryEvent({ extra })).not.toThrow();
    expect(extra.plannerOutput).toBe('[REDACTED]');
  });
});
