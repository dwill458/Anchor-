# Monitoring & Analytics Guide

## Overview

This document describes the monitoring and analytics infrastructure implemented in the Anchor app. The system is designed to be production-ready with support for industry-standard tools while providing meaningful console logging during development.

## Architecture

The monitoring system consists of three independent services:

1. **AnalyticsService** - User behavior and event tracking
2. **ErrorTrackingService** - Error reporting and debugging
3. **PerformanceMonitoring** - Performance measurement and optimization

Each service is:
- **Framework-ready**: Prepared for Mixpanel, Amplitude, Sentry, and Firebase Performance
- **Development-friendly**: Console logging when third-party services aren't configured
- **Type-safe**: Full TypeScript support with defined interfaces
- **Centralized**: Single source of truth for event names and tracking patterns

---

## Analytics Service

### Purpose
Track user behavior, feature usage, and conversion funnels to inform product decisions.

### Location
`src/services/AnalyticsService.ts`

### Supported Platforms
- **Mixpanel** (recommended)
- **Amplitude**
- **Firebase Analytics**
- **Custom analytics backend**

### Core Methods

#### `track(eventName, properties?)`
Track a discrete user action or event.

```typescript
import { AnalyticsService, AnalyticsEvents } from '@/services/AnalyticsService';

AnalyticsService.track(AnalyticsEvents.ANCHOR_CREATED, {
  category: 'health',
  creation_method: 'ai_assisted',
  has_mantra: true,
});
```

#### `identify(userId, properties?)`
Associate analytics with a specific user.

```typescript
AnalyticsService.identify(user.id, {
  email: user.email,
  display_name: user.displayName,
  is_premium: user.isPremium,
  signup_date: user.createdAt,
});
```

#### `reset()`
Clear user identity (call on logout).

```typescript
AnalyticsService.reset();
```

### Event Naming Convention

Events follow a **noun_verb** pattern in lowercase with underscores:

- ✅ `anchor_created`
- ✅ `charge_completed`
- ✅ `profile_viewed`
- ❌ `createAnchor`
- ❌ `AnchorCreated`

### Standard Event Properties

Include these properties when relevant:

- `source`: Where the action was initiated (e.g., 'vault', 'discover', 'onboarding')
- `anchor_id`: ID of the anchor being interacted with
- `category`: Anchor category (career, health, wealth, etc.)
- `user_id`: Current user ID (for server-side events)
- `screen`: Screen name where the event occurred
- `is_premium`: Whether the user has premium access

### Event Categories

Events are organized by domain:

#### Anchor Lifecycle
- `anchor_created`
- `anchor_viewed`
- `anchor_updated`
- `anchor_deleted`

#### Charging & Activation
- `charge_started`
- `charge_completed`
- `charge_skipped`
- `activation_started`
- `activation_completed`

#### Authentication & Onboarding
- `user_signed_up`
- `user_logged_in`
- `user_logged_out`
- `onboarding_started`
- `onboarding_completed`

#### Commerce
- `shop_viewed`
- `premium_purchase_initiated`
- `premium_purchase_completed`

See `AnalyticsEvents` object in the source file for the complete list.

### Implementation Pattern

```typescript
import { AnalyticsService, AnalyticsEvents } from '@/services/AnalyticsService';
import { ErrorTrackingService } from '@/services/ErrorTrackingService';

const handleAnchorPress = (anchor: Anchor): void => {
  // Track the event
  AnalyticsService.track(AnalyticsEvents.ANCHOR_VIEWED, {
    anchor_id: anchor.id,
    category: anchor.category,
    is_charged: anchor.isCharged,
    source: 'vault',
  });

  // Add breadcrumb for debugging
  ErrorTrackingService.addBreadcrumb('Anchor pressed', 'navigation', {
    anchor_id: anchor.id,
  });

  // Perform navigation
  navigation.navigate('AnchorDetail', { anchorId: anchor.id });
};
```

---

## Error Tracking Service

### Purpose
Capture and report errors, exceptions, and bugs for debugging and reliability monitoring.

### Location
`src/services/ErrorTrackingService.ts`

### Supported Platforms
- **Sentry** (recommended)
- **Bugsnag**
- **LogRocket**
- **Custom error reporting backend**

### Core Methods

#### `captureException(error, context?)`
Report an error with optional context.

```typescript
import { ErrorTrackingService } from '@/services/ErrorTrackingService';

try {
  await fetchAnchors();
} catch (error) {
  ErrorTrackingService.captureException(error as Error, {
    screen: 'VaultScreen',
    action: 'fetch_anchors',
    user_id: user.id,
  });

  toast.error('Failed to load anchors');
}
```

#### `addBreadcrumb(message, category?, data?)`
Add a breadcrumb to track user actions leading up to an error.

```typescript
ErrorTrackingService.addBreadcrumb('Anchor created', 'user_action', {
  anchor_id: newAnchor.id,
  category: newAnchor.category,
});
```

#### `setUser(user)`
Associate errors with a specific user.

```typescript
ErrorTrackingService.setUser({
  id: user.id,
  email: user.email,
  username: user.displayName,
});
```

#### `addTag(key, value)`
Add tags for filtering and grouping errors.

```typescript
ErrorTrackingService.addTag('screen', 'VaultScreen');
ErrorTrackingService.addTag('user_type', user.isPremium ? 'premium' : 'free');
```

### Error Context Best Practices

Always provide context when capturing exceptions:

```typescript
ErrorTrackingService.captureException(error as Error, {
  screen: 'AnchorDetailScreen',      // Where it happened
  action: 'charge_anchor',            // What was being done
  anchor_id: anchor.id,               // Relevant entity
  user_id: user.id,                   // Who experienced it
  network_status: networkStatus,      // Environmental factors
});
```

### Breadcrumb Categories

Use consistent categories for breadcrumbs:

- `navigation`: Screen transitions
- `user_action`: Button presses, form submissions
- `network`: API calls, data fetching
- `state_change`: Store updates, app state changes
- `ui`: UI interactions, gestures

---

## Performance Monitoring

### Purpose
Measure and optimize app performance, including screen load times and async operations.

### Location
`src/services/PerformanceMonitoring.ts`

### Supported Platforms
- **Firebase Performance Monitoring** (recommended)
- **New Relic**
- **Datadog**
- **Custom performance backend**

### Core Methods

#### `startTrace(traceName, metadata?)`
Start a performance trace.

```typescript
import { PerformanceMonitoring } from '@/services/PerformanceMonitoring';

const trace = PerformanceMonitoring.startTrace('fetch_anchors', {
  user_id: user.id,
  screen: 'VaultScreen',
});

try {
  const result = await fetchAnchors();
  trace.putMetric('anchor_count', result.length);
} finally {
  trace.stop();
}
```

#### `trace.putMetric(name, value)`
Add a custom metric to a trace.

```typescript
trace.putMetric('anchor_count', anchors.length);
trace.putMetric('api_response_size', response.data.length);
```

#### `trace.putAttribute(key, value)`
Add custom attributes to a trace.

```typescript
trace.putAttribute('user_type', user.isPremium ? 'premium' : 'free');
trace.putAttribute('network_type', 'wifi');
```

#### `trace.stop()`
End the trace and record the duration.

```typescript
trace.stop();
```

### Common Trace Patterns

#### API Calls
```typescript
const trace = PerformanceMonitoring.startTrace('api_fetch_anchors');
try {
  const anchors = await api.getAnchors();
  trace.putMetric('result_count', anchors.length);
  return anchors;
} finally {
  trace.stop();
}
```

#### Screen Loading
```typescript
useEffect(() => {
  const trace = PerformanceMonitoring.startTrace('screen_vault_load');

  fetchData()
    .then(data => {
      trace.putMetric('data_count', data.length);
    })
    .finally(() => {
      trace.stop();
    });
}, []);
```

#### Complex Operations
```typescript
const trace = PerformanceMonitoring.startTrace('anchor_creation_flow');
trace.putAttribute('creation_method', 'ai_assisted');

// Step 1
await analyzeIntention();
trace.putMetric('analysis_tokens', tokens.length);

// Step 2
await generateSigil();
trace.putMetric('sigil_variations', variations.length);

// Step 3
await saveAnchor();
trace.stop();
```

---

## Integration Guide

### 1. Install Dependencies

Choose your monitoring platform(s):

```bash
# Analytics
npm install @mixpanel/mixpanel-react-native
# or
npm install @amplitude/analytics-react-native

# Error Tracking
npm install @sentry/react-native
# or
npm install @bugsnag/react-native

# Performance
npm install @react-native-firebase/perf
```

### 2. Configure Services

#### Mixpanel Integration

```typescript
// src/services/AnalyticsService.ts
import { Mixpanel } from '@mixpanel/mixpanel-react-native';

class Analytics {
  private mixpanel: Mixpanel | null = null;
  private enabled: boolean = false;

  async initialize(token: string): Promise<void> {
    this.mixpanel = await Mixpanel.init(token);
    this.enabled = true;
  }

  track(eventName: string, properties?: Record<string, any>): void {
    if (!this.enabled || !this.mixpanel) {
      console.log('[Analytics]', eventName, properties);
      return;
    }

    this.mixpanel.track(eventName, properties);
  }

  identify(userId: string, properties?: UserProperties): void {
    if (!this.enabled || !this.mixpanel) return;

    this.mixpanel.identify(userId);
    if (properties) {
      this.mixpanel.getPeople().set(properties);
    }
  }
}
```

#### Sentry Integration

```typescript
// src/services/ErrorTrackingService.ts
import * as Sentry from '@sentry/react-native';

class ErrorTracking {
  private enabled: boolean = false;

  initialize(dsn: string, environment: string): void {
    Sentry.init({
      dsn,
      environment,
      tracesSampleRate: 1.0,
      enableAutoSessionTracking: true,
    });

    this.enabled = true;
  }

  captureException(error: Error, context?: ErrorContext): void {
    if (!this.enabled) {
      console.error('[ErrorTracking]', error, context);
      return;
    }

    if (context) {
      Sentry.setContext('error_context', context);
    }
    Sentry.captureException(error);
  }

  addBreadcrumb(message: string, category?: string, data?: Record<string, any>): void {
    if (!this.enabled) return;

    Sentry.addBreadcrumb({
      message,
      category: category || 'default',
      data,
      level: 'info',
    });
  }
}
```

#### Firebase Performance Integration

```typescript
// src/services/PerformanceMonitoring.ts
import perf from '@react-native-firebase/perf';

class Performance {
  private enabled: boolean = false;

  async initialize(): Promise<void> {
    this.enabled = await perf().isPerformanceCollectionEnabled();
  }

  startTrace(traceName: string, metadata?: Record<string, any>): PerformanceTrace {
    if (!this.enabled) {
      return new PerformanceTrace(traceName, false, this);
    }

    const trace = perf().newTrace(traceName);
    trace.start();

    if (metadata) {
      Object.entries(metadata).forEach(([key, value]) => {
        trace.putAttribute(key, String(value));
      });
    }

    return new PerformanceTrace(traceName, true, this, trace);
  }
}
```

### 3. Initialize in App.tsx

```typescript
// App.tsx
import { AnalyticsService } from '@/services/AnalyticsService';
import { ErrorTrackingService } from '@/services/ErrorTrackingService';
import { PerformanceMonitoring } from '@/services/PerformanceMonitoring';

export default function App() {
  useEffect(() => {
    // Initialize monitoring services
    const initMonitoring = async () => {
      // Analytics
      if (MIXPANEL_TOKEN) {
        await AnalyticsService.initialize(MIXPANEL_TOKEN);
      }

      // Error Tracking
      if (SENTRY_DSN) {
        ErrorTrackingService.initialize(SENTRY_DSN, __DEV__ ? 'development' : 'production');
      }

      // Performance
      await PerformanceMonitoring.initialize();
    };

    initMonitoring();
  }, []);

  return (
    <ErrorBoundary>
      <ToastProvider>
        {/* ... rest of app */}
      </ToastProvider>
    </ErrorBoundary>
  );
}
```

---

## Best Practices

### Analytics

1. **Track user intent, not just actions**
   - ✅ `checkout_abandoned` (why: cart was full but purchase didn't complete)
   - ❌ `back_button_pressed` (what: just a navigation action)

2. **Use consistent property names**
   - Use `snake_case` for property names
   - Use the same property name across events (e.g., always `anchor_id`, never `anchorId` or `id`)

3. **Don't over-track**
   - Track meaningful user actions, not every UI interaction
   - Avoid tracking in tight loops or frequently-called functions

4. **Validate events in development**
   - Check console logs to ensure events fire correctly
   - Verify property values are accurate

### Error Tracking

1. **Add breadcrumbs before errors occur**
   - Add breadcrumbs for key user actions
   - Include navigation breadcrumbs
   - Log network requests

2. **Provide rich context**
   - Always include screen name
   - Add user ID when available
   - Include relevant entity IDs (anchor_id, etc.)

3. **Don't track expected errors**
   - Don't report validation errors
   - Don't report user-cancelled actions
   - Only report unexpected exceptions

4. **Sanitize sensitive data**
   - Don't include passwords or tokens
   - Redact PII when necessary

### Performance Monitoring

1. **Trace critical paths**
   - Screen load times
   - API calls
   - Complex computations
   - User-initiated actions

2. **Add meaningful metrics**
   - Result counts
   - Data sizes
   - User attributes

3. **Keep traces short**
   - Traces should measure discrete operations
   - Don't leave traces running for extended periods

4. **Stop traces in finally blocks**
   - Always stop traces, even if errors occur
   - Use try/finally to ensure cleanup

---

## Testing

### Testing with Console Output

During development, all services log to console when third-party services aren't configured:

```typescript
// Console output examples:
[Analytics] anchor_created { category: 'health', creation_method: 'ai_assisted' }
[ErrorTracking] Anchor not found { screen: 'AnchorDetailScreen', anchor_id: '123' }
[Performance] fetch_anchors started
[Performance] fetch_anchors completed in 1250ms
```

### Verifying Integration

1. **Check initialization**
   ```typescript
   console.log('Analytics enabled:', AnalyticsService.enabled);
   console.log('Error tracking enabled:', ErrorTrackingService.enabled);
   console.log('Performance enabled:', PerformanceMonitoring.enabled);
   ```

2. **Test events**
   - Perform key user actions
   - Check Mixpanel/Amplitude dashboard for events
   - Verify event properties are correct

3. **Test error reporting**
   - Trigger a test error
   - Check Sentry dashboard for the error
   - Verify breadcrumbs are present

4. **Test performance traces**
   - Navigate through key screens
   - Check Firebase Performance dashboard
   - Verify trace durations are reasonable

---

## Privacy & Compliance

### Data Collection

This monitoring system collects:
- User interactions and navigation patterns
- Error messages and stack traces
- Performance metrics
- User identifiers (when authenticated)

### GDPR Compliance

1. **Inform users**: Update privacy policy to mention analytics
2. **Provide opt-out**: Allow users to disable analytics in settings
3. **Data retention**: Configure retention policies in Mixpanel/Sentry
4. **User deletion**: Implement user data deletion on account closure

### Implementing Opt-Out

```typescript
// src/stores/settingsStore.ts
interface SettingsState {
  analyticsEnabled: boolean;
  toggleAnalytics: (enabled: boolean) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  analyticsEnabled: true,
  toggleAnalytics: (enabled) => {
    set({ analyticsEnabled: enabled });
    if (!enabled) {
      AnalyticsService.reset();
    }
  },
}));

// src/services/AnalyticsService.ts
track(eventName: string, properties?: Record<string, any>): void {
  const { analyticsEnabled } = useSettingsStore.getState();
  if (!analyticsEnabled) return;

  // ... rest of tracking logic
}
```

---

## Monitoring Dashboard

### Key Metrics to Track

1. **User Engagement**
   - Daily/Monthly Active Users (DAU/MAU)
   - Session duration
   - Feature adoption rates

2. **Anchor Usage**
   - Anchors created per user
   - Charge completion rate
   - Activation frequency
   - Burn rate

3. **Conversion Funnels**
   - Onboarding completion
   - First anchor creation
   - Premium conversion

4. **Technical Health**
   - Crash-free rate
   - API error rate
   - Screen load times
   - Network request latency

5. **Business Metrics**
   - Premium subscription rate
   - Retention (D1, D7, D30)
   - Churn rate

---

## Troubleshooting

### Events Not Appearing

1. Check service initialization
2. Verify API keys/tokens
3. Check network connectivity
4. Review console logs for errors
5. Verify event names match constants

### High Error Volume

1. Check for network issues
2. Review recent code changes
3. Check for null/undefined errors
4. Verify API endpoint health

### Slow Performance

1. Review performance traces
2. Check for blocking operations
3. Optimize heavy computations
4. Review network request sizes
5. Consider pagination/lazy loading

---

## Resources

### Documentation
- [Mixpanel React Native](https://docs.mixpanel.com/docs/tracking/react-native)
- [Sentry React Native](https://docs.sentry.io/platforms/react-native/)
- [Firebase Performance](https://rnfirebase.io/perf/usage)

### Analytics Events Reference
See `src/services/AnalyticsService.ts` for the complete list of `AnalyticsEvents` constants.

### Support
For questions about monitoring setup, contact the engineering team or refer to the platform-specific documentation.
