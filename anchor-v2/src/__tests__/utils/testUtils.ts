/**
 * Anchor App - Test Utilities
 *
 * Helpers and factories for testing
 */

import type { Anchor, User, AnchorCategory, SubscriptionStatus } from '@/types';

/**
 * Create a mock user for testing
 */
export const createMockUser = (overrides?: Partial<User>): User => ({
  id: 'test-user-123',
  email: 'test@example.com',
  displayName: 'Test User',
  subscriptionStatus: 'free' as SubscriptionStatus,
  totalAnchorsCreated: 5,
  totalActivations: 20,
  currentStreak: 3,
  longestStreak: 7,
  createdAt: new Date('2024-01-01'),
  ...overrides,
});

/**
 * Create a mock anchor for testing
 */
export const createMockAnchor = (overrides?: Partial<Anchor>): Anchor => ({
  id: 'anchor-123',
  userId: 'test-user-123',
  intentionText: 'Build my career in tech',
  category: 'career' as AnchorCategory,
  distilledLetters: ['B', 'L', 'D', 'M', 'Y', 'C', 'R', 'R', 'N', 'T', 'C', 'H'],
  baseSigilSvg: '<svg></svg>',
  sigilVariant: 'balanced',
  isCharged: false,
  isActivated: false,
  activationCount: 0,
  lastActivatedAt: null,
  createdAt: new Date('2024-01-15'),
  ...overrides,
});

/**
 * Create multiple mock anchors
 */
export const createMockAnchors = (count: number): Anchor[] => {
  return Array.from({ length: count }, (_, i) =>
    createMockAnchor({
      id: `anchor-${i}`,
      intentionText: `Test intention ${i}`,
    })
  );
};

/**
 * Wait for async updates
 */
export const waitFor = (ms: number = 0): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Flush all pending promises
 */
export const flushPromises = (): Promise<void> => {
  return new Promise((resolve) => setImmediate(resolve));
};

/**
 * Mock API response
 */
export const mockApiResponse = <T>(data: T, delay: number = 0): Promise<T> => {
  return new Promise((resolve) => {
    setTimeout(() => resolve(data), delay);
  });
};

/**
 * Mock API error
 */
export const mockApiError = (message: string, delay: number = 0): Promise<never> => {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(message)), delay);
  });
};
