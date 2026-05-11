# Testing Guide

## Overview

This project uses **Jest** and **React Native Testing Library** for testing. We aim for **70% code coverage** for production readiness.

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run tests with verbose output
npm run test:verbose
```

## Test Structure

```
src/
├── __tests__/
│   ├── setup.ts           # Global test configuration
│   └── utils/
│       └── testUtils.ts   # Test helpers and factories
├── stores/
│   └── __tests__/
│       └── anchorStore.test.ts
├── components/
│   └── __tests__/
│       ├── Toast.test.tsx
│       ├── LoadingSpinner.test.tsx
│       └── ErrorBoundary.test.tsx
└── services/
    └── __tests__/
        └── ApiClient.test.ts
```

## Writing Tests

### Unit Tests for Stores

```typescript
import { renderHook, act } from '@testing-library/react-hooks';
import { useAnchorStore } from '../anchorStore';
import { createMockAnchor } from '../../__tests__/utils/testUtils';

describe('anchorStore', () => {
  it('should add an anchor', () => {
    const { result } = renderHook(() => useAnchorStore());
    const mockAnchor = createMockAnchor();

    act(() => {
      result.current.addAnchor(mockAnchor);
    });

    expect(result.current.anchors).toHaveLength(1);
  });
});
```

### Component Tests

```typescript
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Toast } from '../Toast';

describe('Toast Component', () => {
  it('should render with message', () => {
    const { getByText } = render(<Toast message="Test" />);
    expect(getByText('Test')).toBeTruthy();
  });

  it('should call onDismiss when pressed', () => {
    const onDismiss = jest.fn();
    const { getByRole } = render(
      <Toast message="Test" onDismiss={onDismiss} />
    );

    fireEvent.press(getByRole('button'));
    setTimeout(() => {
      expect(onDismiss).toHaveBeenCalled();
    }, 300);
  });
});
```

### Service Tests

```typescript
import { ApiClient } from '../ApiClient';
import { mockApiResponse, mockApiError } from '../../__tests__/utils/testUtils';

describe('ApiClient', () => {
  it('should make GET request', async () => {
    const data = await ApiClient.get('/anchors');
    expect(data).toBeDefined();
  });

  it('should handle errors', async () => {
    await expect(ApiClient.get('/invalid')).rejects.toThrow();
  });
});
```

## Test Utilities

### Mock Factories

```typescript
// Create a mock user
const user = createMockUser({ displayName: 'John Doe' });

// Create a mock anchor
const anchor = createMockAnchor({ intentionText: 'Test intention' });

// Create multiple anchors
const anchors = createMockAnchors(5);
```

### Async Utilities

```typescript
// Wait for async updates
await waitFor(100);

// Flush all pending promises
await flushPromises();

// Mock API response
const data = await mockApiResponse({ success: true }, 100);

// Mock API error
await mockApiError('Network error', 100);
```

## Coverage Goals

| Metric | Target |
|--------|--------|
| Statements | 70% |
| Branches | 60% |
| Functions | 70% |
| Lines | 70% |

## Best Practices

### 1. Test Behavior, Not Implementation

**❌ Bad:**
```typescript
expect(component.state.isLoading).toBe(true);
```

**✅ Good:**
```typescript
expect(getByRole('progressbar')).toBeTruthy();
```

### 2. Use Accessibility Queries

**❌ Bad:**
```typescript
const button = getByTestId('submit-button');
```

**✅ Good:**
```typescript
const button = getByRole('button', { name: 'Submit' });
```

### 3. Clean Up After Tests

```typescript
beforeEach(() => {
  // Reset state before each test
  const { result } = renderHook(() => useAnchorStore());
  act(() => {
    result.current.clearAnchors();
  });
});
```

### 4. Test Error States

```typescript
it('should handle network errors', async () => {
  const { getByText } = render(<VaultScreen />);

  // Trigger error
  await waitFor(() => {
    expect(getByText('Failed to load anchors')).toBeTruthy();
  });
});
```

### 5. Test Accessibility

```typescript
it('should have proper accessibility', () => {
  const { getByRole } = render(<CustomButton title="Submit" />);

  const button = getByRole('button');
  expect(button.props.accessibilityLabel).toBe('Submit');
  expect(button.props.accessibilityHint).toBeDefined();
});
```

## Mocked Modules

The following modules are automatically mocked in `setup.ts`:

- `@react-native-async-storage/async-storage`
- `expo-haptics`
- `expo-linear-gradient`
- `expo-blur`
- `@react-navigation/native`
- `react-native-svg`
- `lucide-react-native`

## Debugging Tests

### Run a single test file

```bash
npm test -- Toast.test.tsx
```

### Run tests matching a pattern

```bash
npm test -- --testNamePattern="should add an anchor"
```

### Debug with Node Inspector

```bash
node --inspect-brk node_modules/.bin/jest --runInBand
```

Then open `chrome://inspect` in Chrome.

## CI/CD Integration

```yaml
# .github/workflows/test.yml
- name: Run Tests
  run: npm test -- --coverage --ci

- name: Upload Coverage
  uses: codecov/codecov-action@v3
  with:
    files: ./coverage/lcov.info
```

## Resources

- [Jest Documentation](https://jestjs.io/)
- [React Native Testing Library](https://callstack.github.io/react-native-testing-library/)
- [Testing Library Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
