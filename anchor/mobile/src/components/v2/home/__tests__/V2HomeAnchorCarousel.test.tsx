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
  carouselWindow,
} from '../V2HomeAnchorCarousel';
import { makeAnchor } from '@/adapters/v2/home/__tests__/fixtures';
import { toThreadPresentation, type V2HomeAnchorSummary } from '@/adapters/v2/home';

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
  it('passes one intact Anchor model to each pre-rendered hero slot', () => {
    const renderHero = jest.fn((summary: V2HomeAnchorSummary, _index: number, _slot: number) => <React.Fragment>{summary.anchor.intentionText}</React.Fragment>);
    render(<V2HomeAnchorCarousel anchors={summaries(4, 1)} selectedIndex={1} onSelect={jest.fn()} renderHero={renderHero} />);
    expect(renderHero.mock.calls.map(([summary, index, slot]) => [summary.anchor.id, index, slot]))
      .toEqual([['a0', 0, -1], ['a2', 2, 1], ['a1', 1, 0]]);
  });

  it('renders exactly three Anchors however long the list is', () => {
    render(<V2HomeAnchorCarousel anchors={summaries(12, 4)} selectedIndex={4} onSelect={jest.fn()} />);
    expect(artworkRenders).toHaveLength(3);
    expect(artworkRenders.filter((size) => size === String(HERO_ANCHOR_SIZE))).toHaveLength(3);
  });

  it('keeps previous, current and next mounted in circular order', () => {
    expect(carouselWindow(5, 2)).toEqual([1, 2, 3]);
    expect(carouselWindow(5, 0)).toEqual([4, 0, 1]);
    expect(carouselWindow(5, 4)).toEqual([3, 4, 0]);
  });

  it('renders one Anchor and no neighbours when there is nothing to switch to', () => {
    render(<V2HomeAnchorCarousel anchors={summaries(1, 0)} selectedIndex={0} onSelect={jest.fn()} />);
    expect(artworkRenders).toHaveLength(1);
    expect(screen.queryByTestId('v2-home-carousel-next')).toBeNull();
  });
});

describe('committing a switch', () => {
  it('keeps the incoming artwork mounted when it becomes current', () => {
    const mounts: string[] = [];
    function Hero({ id }: { id: string }) {
      React.useEffect(() => { mounts.push(id); }, [id]);
      return <React.Fragment>{id}</React.Fragment>;
    }
    const renderHero = (summary: V2HomeAnchorSummary) => <Hero id={summary.anchor.id} />;
    render(<V2HomeAnchorCarousel anchors={summaries(3, 0)} selectedIndex={0} onSelect={jest.fn()}
      renderHero={renderHero} reduceMotion />);
    fireEvent.press(screen.getByTestId('v2-home-carousel-next'));
    expect(mounts.filter(id => id === 'a1')).toHaveLength(1);
  });

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

  it('guards rapid duplicate taps during selection', () => {
    const onSelect = jest.fn();
    render(<V2HomeAnchorCarousel anchors={summaries(3, 0)} selectedIndex={0} onSelect={onSelect} reduceMotion />);
    fireEvent.press(screen.getByTestId('v2-home-carousel-next'));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});
