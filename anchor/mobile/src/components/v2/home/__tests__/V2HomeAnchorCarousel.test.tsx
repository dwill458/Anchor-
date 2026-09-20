import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';

const artworkRenders: string[] = [];
jest.mock('@/components/v2', () => {
  const actual = jest.requireActual('@/components/v2');
  const R = require('react');
  return {
    ...actual,
    CircularAnchorRenderer: (props: { size: number; category?: string | null }) => {
      artworkRenders.push(`${props.size}`);
      return R.createElement('View', { testID: 'carousel-artwork' });
    },
  };
});

import {
  V2HomeAnchorCarousel,
  resolveSwipeCommit,
  trackFinger,
  HERO_ANCHOR_SIZE,
  NEIGHBOUR_ANCHOR_SIZE,
} from '../V2HomeAnchorCarousel';
import { makeAnchor } from '@/adapters/v2/home/__tests__/fixtures';
import { toThreadPresentation } from '@/adapters/v2/home';

const summaries = (count: number, selected: number) => {
  const anchors = Array.from({ length: count }, (_, i) =>
    makeAnchor({ id: `a${i}`, intentionText: `Intention ${i}` }),
  );
  return anchors.map((anchor, i) => ({
    anchor,
    thread: toThreadPresentation(anchor),
    isSelected: i === selected,
  }));
};

beforeEach(() => {
  artworkRenders.length = 0;
});

/**
 * The Anchor is a physical object under the thumb. Anything less than 1:1 for
 * the first part of the drag reads as dropped frames rather than as weight,
 * which is what the previous flat 0.42 multiplier did.
 */
describe('finger tracking', () => {
  it('follows the finger exactly up to the point where a swipe commits', () => {
    expect(trackFinger(0)).toBe(0);
    expect(trackFinger(20)).toBe(20);
    expect(trackFinger(-20)).toBe(-20);
    expect(trackFinger(56)).toBe(56);
    expect(trackFinger(-56)).toBe(-56);
  });

  it('resists only past the decision point, symmetrically', () => {
    // 56 + (156 - 56) * 0.34
    expect(trackFinger(156)).toBeCloseTo(90, 5);
    expect(trackFinger(-156)).toBeCloseTo(-90, 5);
  });

  it('clamps an unbounded drag instead of letting the Anchor leave the page', () => {
    const limit = trackFinger(240);
    expect(trackFinger(400)).toBeCloseTo(limit, 5);
    expect(limit).toBeLessThan(HERO_ANCHOR_SIZE);
  });
});

describe('swipe commit decision', () => {
  it('commits a slow deliberate swipe on distance alone', () => {
    expect(resolveSwipeCommit(-60, 0)).toBe(1);
    expect(resolveSwipeCommit(60, 0)).toBe(-1);
  });

  it('commits a flick well before it has travelled the full distance', () => {
    expect(resolveSwipeCommit(-20, -900)).toBe(1);
    expect(resolveSwipeCommit(20, 900)).toBe(-1);
  });

  it('never commits a fast twitch that barely moved', () => {
    expect(resolveSwipeCommit(6, 4000)).toBeNull();
    expect(resolveSwipeCommit(-6, -4000)).toBeNull();
  });

  it('snaps back when the drag is short and unthrown', () => {
    expect(resolveSwipeCommit(-20, 0)).toBeNull();
  });

  it('respects a thumb that reverses before release', () => {
    // Dragged left, then thrown back to the right: it is headed nowhere.
    expect(resolveSwipeCommit(-30, 500)).toBeNull();
  });
});

describe('mounted work', () => {
  it('renders exactly three Anchors however long the list is', () => {
    render(<V2HomeAnchorCarousel anchors={summaries(12, 4)} selectedIndex={4} onSelect={jest.fn()} />);
    expect(artworkRenders).toHaveLength(3);
    expect(artworkRenders.filter((size) => size === String(HERO_ANCHOR_SIZE))).toHaveLength(1);
    expect(artworkRenders.filter((size) => size === String(NEIGHBOUR_ANCHOR_SIZE))).toHaveLength(2);
  });

  it('renders one Anchor and no neighbours when there is nothing to switch to', () => {
    render(<V2HomeAnchorCarousel anchors={summaries(1, 0)} selectedIndex={0} onSelect={jest.fn()} />);
    expect(artworkRenders).toHaveLength(1);
    expect(screen.queryByTestId('v2-home-carousel-next')).toBeNull();
  });
});

describe('committing a switch', () => {
  it('commits once from a neighbour tap', () => {
    const onSelect = jest.fn();
    render(
      <V2HomeAnchorCarousel anchors={summaries(3, 0)} selectedIndex={0} onSelect={onSelect} reduceMotion />,
    );
    fireEvent.press(screen.getByTestId('v2-home-carousel-next'));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('a1');
  });

  it('wraps backwards from the first Anchor', () => {
    const onSelect = jest.fn();
    render(
      <V2HomeAnchorCarousel anchors={summaries(3, 0)} selectedIndex={0} onSelect={onSelect} reduceMotion />,
    );
    fireEvent.press(screen.getByTestId('v2-home-carousel-previous'));
    expect(onSelect).toHaveBeenCalledWith('a2');
  });
});
