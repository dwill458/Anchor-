import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import type { V2HomeAnchorSummary } from '@/adapters/v2/home';
import type { AnchorCategory } from '@/types';
import { makeAnchor } from '@/adapters/v2/home/__tests__/fixtures';
import { toThreadPresentation } from '@/adapters/v2/home/threadAdapter';

let latestPanGesture: any = null;

jest.mock('react-native-reanimated', () => {
  const React = require('react');
  const { View } = require('react-native');

  return {
    __esModule: true,
    default: { View },
    cancelAnimation: jest.fn(),
    useSharedValue: (value: number) => {
      const ref = React.useRef(null) as { current: { value: number } | null };
      if (!ref.current) {
        ref.current = { value };
      }
      return ref.current;
    },
    useAnimatedStyle: (factory: () => unknown) => factory(),
    withSpring: (
      toValue: number,
      _config?: unknown,
      callback?: (finished: boolean) => void
    ) => {
      callback?.(true);
      return toValue;
    },
    withTiming: (
      toValue: number,
      _config?: unknown,
      callback?: (finished: boolean) => void
    ) => {
      callback?.(true);
      return toValue;
    },
    runOnJS: (fn: (...args: any[]) => any) => fn,
    useReducedMotion: () => false,
  };
});

jest.mock('react-native-gesture-handler', () => {
  const React = require('react');

  const createPanGesture = () => {
    const gesture: any = {
      enabled: jest.fn(() => gesture),
      activeOffsetX: jest.fn(() => gesture),
      failOffsetY: jest.fn(() => gesture),
      onStart: jest.fn((cb: () => void) => {
        gesture.start = cb;
        return gesture;
      }),
      onUpdate: jest.fn((cb: (event: any) => void) => {
        gesture.update = cb;
        return gesture;
      }),
      onEnd: jest.fn((cb: (event: any) => void) => {
        gesture.end = cb;
        return gesture;
      }),
      onFinalize: jest.fn((cb: () => void) => {
        gesture.finalize = cb;
        return gesture;
      }),
    };
    latestPanGesture = gesture;
    return gesture;
  };

  return {
    Gesture: { Pan: createPanGesture },
    GestureDetector: ({ children }: { children: React.ReactNode }) => children,
  };
});

const mockHapticSelection = jest.fn();
jest.mock('@/hooks/v2/haptics', () => ({
  v2Haptics: {
    selection: () => mockHapticSelection(),
    confirmation: jest.fn(),
    completion: jest.fn(),
    warning: jest.fn(),
    destructiveCommit: jest.fn(),
  },
}));

import { V2AnchorHeroCarousel } from '../V2AnchorHeroCarousel';

const makeSummary = (id: string, text: string, category: AnchorCategory = 'career', strength = 80): V2HomeAnchorSummary => {
  const anchor = makeAnchor({ id, intentionText: text, category, threadStrength: strength });
  return {
    anchor,
    thread: toThreadPresentation(anchor),
    isSelected: false,
  };
};

describe('V2AnchorHeroCarousel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    latestPanGesture = null;
  });

  describe('Single Anchor (Requirement A, 14, 21)', () => {
    it('renders single anchor without swipe pagination ("1 of 1" omitted)', () => {
      const anchors = [makeSummary('a1', 'Single Purpose', 'career', 85)];
      const onSelect = jest.fn();
      const onOpenAll = jest.fn();
      const onDetails = jest.fn();
      const onProgress = jest.fn();

      render(
        <V2AnchorHeroCarousel
          anchors={anchors}
          selectedAnchorId="a1"
          onSelectAnchor={onSelect}
          onOpenDetails={onDetails}
          onOpenProgress={onProgress}
          onOpenAllAnchors={onOpenAll}
        />
      );

      expect(screen.getByText('Single Purpose')).toBeTruthy();
      expect(screen.getByText('Career')).toBeTruthy();
      expect(screen.queryByText(/1 OF 1/i)).toBeNull();
      expect(screen.getByTestId('v2-home-all-anchors')).toBeTruthy();

      // Navigation intents work
      fireEvent.press(screen.getByTestId('v2-home-all-anchors'));
      expect(onOpenAll).toHaveBeenCalledTimes(1);

      fireEvent.press(screen.getByTestId('v2-home-hero'));
      expect(onDetails).toHaveBeenCalledWith('a1');

      fireEvent.press(screen.getByTestId('v2-home-thread-strength'));
      expect(onProgress).toHaveBeenCalledWith('a1');
    });

    it('returns null when anchor array is empty', () => {
      const { toJSON } = render(
        <V2AnchorHeroCarousel
          anchors={[]}
          selectedAnchorId={null}
          onSelectAnchor={jest.fn()}
          onOpenDetails={jest.fn()}
          onOpenProgress={jest.fn()}
          onOpenAllAnchors={jest.fn()}
        />
      );
      expect(toJSON()).toBeNull();
    });
  });

  describe('Multiple Anchors (Requirement B, C, D, 14)', () => {
    const multiAnchors = [
      makeSummary('a1', 'First Intention', 'career', 70),
      makeSummary('a2', 'Second Intention', 'health', 85),
      makeSummary('a3', 'Third Intention', 'abundance', 90),
    ];

    it('renders the position indicator ("1 OF 3") and category for current anchor', () => {
      render(
        <V2AnchorHeroCarousel
          anchors={multiAnchors}
          selectedAnchorId="a1"
          onSelectAnchor={jest.fn()}
          onOpenDetails={jest.fn()}
          onOpenProgress={jest.fn()}
          onOpenAllAnchors={jest.fn()}
        />
      );

      expect(screen.getByText('Career · 1 OF 3')).toBeTruthy();
      expect(screen.getByText('First Intention')).toBeTruthy();
    });

    it('navigates to next anchor via accessible button and commits activeAnchorId', () => {
      const onSelect = jest.fn();
      render(
        <V2AnchorHeroCarousel
          anchors={multiAnchors}
          selectedAnchorId="a1"
          onSelectAnchor={onSelect}
          onOpenDetails={jest.fn()}
          onOpenProgress={jest.fn()}
          onOpenAllAnchors={jest.fn()}
        />
      );

      fireEvent.press(screen.getByLabelText('Next Anchor'));
      expect(onSelect).toHaveBeenCalledWith('a2');
      expect(mockHapticSelection).toHaveBeenCalledTimes(1);
    });

    it('navigates to previous anchor via accessible button and commits activeAnchorId', () => {
      const onSelect = jest.fn();
      render(
        <V2AnchorHeroCarousel
          anchors={multiAnchors}
          selectedAnchorId="a2"
          onSelectAnchor={onSelect}
          onOpenDetails={jest.fn()}
          onOpenProgress={jest.fn()}
          onOpenAllAnchors={jest.fn()}
        />
      );

      fireEvent.press(screen.getByLabelText('Previous Anchor'));
      expect(onSelect).toHaveBeenCalledWith('a1');
      expect(mockHapticSelection).toHaveBeenCalledTimes(1);
    });

    it('keeps both neighbors available at the ends and wraps selection', () => {
      const onSelect = jest.fn();
      const { rerender } = render(
        <V2AnchorHeroCarousel
          anchors={multiAnchors}
          selectedAnchorId="a1"
          onSelectAnchor={onSelect}
          onOpenDetails={jest.fn()}
          onOpenProgress={jest.fn()}
          onOpenAllAnchors={jest.fn()}
        />
      );

      expect(screen.getByTestId('v2-home-previous-anchor')).toBeTruthy();
      expect(screen.getByLabelText('Previous Anchor').props.accessibilityState.disabled).toBe(false);
      expect(screen.getByLabelText('Next Anchor').props.accessibilityState.disabled).toBe(false);
      fireEvent.press(screen.getByLabelText('Previous Anchor'));
      expect(onSelect).toHaveBeenCalledWith('a3');

      rerender(
        <V2AnchorHeroCarousel
          anchors={multiAnchors}
          selectedAnchorId="a3"
          onSelectAnchor={onSelect}
          onOpenDetails={jest.fn()}
          onOpenProgress={jest.fn()}
          onOpenAllAnchors={jest.fn()}
        />
      );

      expect(screen.getByLabelText('Previous Anchor').props.accessibilityState.disabled).toBe(false);
      expect(screen.getByLabelText('Next Anchor').props.accessibilityState.disabled).toBe(false);
      fireEvent.press(screen.getByLabelText('Next Anchor'));
      expect(onSelect).toHaveBeenCalledWith('a1');
    });

    it('supports accessibilityAction increment and decrement', () => {
      const onSelect = jest.fn();
      render(
        <V2AnchorHeroCarousel
          anchors={multiAnchors}
          selectedAnchorId="a1"
          onSelectAnchor={onSelect}
          onOpenDetails={jest.fn()}
          onOpenProgress={jest.fn()}
          onOpenAllAnchors={jest.fn()}
        />
      );

      fireEvent(screen.getByTestId('v2-home-carousel'), 'accessibilityAction', {
        nativeEvent: { actionName: 'increment' },
      });
      expect(onSelect).toHaveBeenCalledWith('a2');
    });
  });

  describe('Gesture & Swipe Behavior (Requirement 5, 16, 17, 18, 19)', () => {
    const multiAnchors = [
      makeSummary('a1', 'First Intention', 'career', 70),
      makeSummary('a2', 'Second Intention', 'health', 85),
    ];

    it('snaps next on horizontal swipe past distance threshold and fires haptic', () => {
      const onSelect = jest.fn();
      render(
        <V2AnchorHeroCarousel
          anchors={multiAnchors}
          selectedAnchorId="a1"
          onSelectAnchor={onSelect}
          onOpenDetails={jest.fn()}
          onOpenProgress={jest.fn()}
          onOpenAllAnchors={jest.fn()}
        />
      );

      expect(latestPanGesture).toBeTruthy();

      // Simulate dragging left (swipe next) — distance must exceed 22% of container width
      latestPanGesture.start();
      latestPanGesture.update({ translationX: -200 });
      latestPanGesture.end({ translationX: -200, velocityX: -300 });

      expect(onSelect).toHaveBeenCalledWith('a2');
      expect(mockHapticSelection).toHaveBeenCalledTimes(1);
    });

    it('snaps previous on horizontal swipe past distance threshold and fires haptic', () => {
      const onSelect = jest.fn();
      render(
        <V2AnchorHeroCarousel
          anchors={multiAnchors}
          selectedAnchorId="a2"
          onSelectAnchor={onSelect}
          onOpenDetails={jest.fn()}
          onOpenProgress={jest.fn()}
          onOpenAllAnchors={jest.fn()}
        />
      );

      latestPanGesture.start();
      latestPanGesture.update({ translationX: 200 });
      latestPanGesture.end({ translationX: 200, velocityX: 300 });

      expect(onSelect).toHaveBeenCalledWith('a1');
      expect(mockHapticSelection).toHaveBeenCalledTimes(1);
    });

    it('springs back when gesture is below threshold without firing haptic or changing anchor', () => {
      const onSelect = jest.fn();
      render(
        <V2AnchorHeroCarousel
          anchors={multiAnchors}
          selectedAnchorId="a1"
          onSelectAnchor={onSelect}
          onOpenDetails={jest.fn()}
          onOpenProgress={jest.fn()}
          onOpenAllAnchors={jest.fn()}
        />
      );

      // Minor drag (only 10px, below threshold)
      latestPanGesture.start();
      latestPanGesture.update({ translationX: -10 });
      latestPanGesture.end({ translationX: -10, velocityX: 0 });

      expect(onSelect).not.toHaveBeenCalled();
      expect(mockHapticSelection).not.toHaveBeenCalled();
    });

    it('supports fast flick with high velocity', () => {
      const onSelect = jest.fn();
      render(
        <V2AnchorHeroCarousel
          anchors={multiAnchors}
          selectedAnchorId="a1"
          onSelectAnchor={onSelect}
          onOpenDetails={jest.fn()}
          onOpenProgress={jest.fn()}
          onOpenAllAnchors={jest.fn()}
        />
      );

      // Fast swipe with high velocity even if distance was short
      latestPanGesture.start();
      latestPanGesture.update({ translationX: -30 });
      latestPanGesture.end({ translationX: -30, velocityX: -600 });

      expect(onSelect).toHaveBeenCalledWith('a2');
      expect(mockHapticSelection).toHaveBeenCalledTimes(1);
    });

    it('wraps a rapid swipe from the last Anchor to the first', () => {
      const onSelect = jest.fn();
      render(
        <V2AnchorHeroCarousel
          anchors={multiAnchors}
          selectedAnchorId="a2"
          onSelectAnchor={onSelect}
          onOpenDetails={jest.fn()}
          onOpenProgress={jest.fn()}
          onOpenAllAnchors={jest.fn()}
        />
      );

      latestPanGesture.start();
      latestPanGesture.update({ translationX: -200 });
      latestPanGesture.end({ translationX: -200, velocityX: -800 });

      expect(onSelect).toHaveBeenCalledWith('a1');
      expect(mockHapticSelection).toHaveBeenCalledTimes(1);
    });
  });

  describe('Reduced Motion (Requirement 24, O)', () => {
    it('switches anchor cleanly when reduceMotion is enabled', () => {
      const onSelect = jest.fn();
      const anchors = [
        makeSummary('a1', 'First Intention', 'career', 70),
        makeSummary('a2', 'Second Intention', 'health', 85),
      ];

      render(
        <V2AnchorHeroCarousel
          anchors={anchors}
          selectedAnchorId="a1"
          reduceMotion={true}
          onSelectAnchor={onSelect}
          onOpenDetails={jest.fn()}
          onOpenProgress={jest.fn()}
          onOpenAllAnchors={jest.fn()}
        />
      );

      latestPanGesture.start();
      latestPanGesture.update({ translationX: -200 });
      latestPanGesture.end({ translationX: -200, velocityX: -300 });

      expect(onSelect).toHaveBeenCalledWith('a2');
      expect(mockHapticSelection).toHaveBeenCalledTimes(1);
    });
  });
});
