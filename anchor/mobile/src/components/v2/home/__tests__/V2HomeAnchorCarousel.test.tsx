import React from 'react';
import { act, render, fireEvent, screen } from '@testing-library/react-native';

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
  carouselSpacing,
  HERO_ANCHOR_SIZE,
  NEIGHBOUR_ANCHOR_SIZE,
  carouselWindow,
  clampStep,
  COMMIT_DELAY_MS,
  dataIndex,
  nearestVirtualIndex,
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
    practicedToday: false,
  }));
};

beforeEach(() => {
  artworkRenders.length = 0;
});

/** The carousel commits once it has rested for COMMIT_DELAY_MS. */
const settle = () => act(() => { jest.advanceTimersByTime(COMMIT_DELAY_MS); });

/**
 * The Anchor is a physical object under the thumb. Anything less than 1:1 for
 * the first part of the drag reads as dropped frames rather than as weight,
 * which is what the previous flat 0.42 multiplier did.
 */
describe('finger tracking', () => {
  const spacing = 250;
  it('follows the finger exactly for a full slot, symmetrically', () => {
    expect(trackFinger(0, spacing)).toBe(0);
    expect(trackFinger(120, spacing)).toBe(120);
    expect(trackFinger(-250, spacing)).toBe(-250);
  });

  it('resists past one slot and clamps an unbounded drag', () => {
    expect(trackFinger(350, spacing)).toBeCloseTo(275, 5);
    expect(trackFinger(-350, spacing)).toBeCloseTo(-275, 5);
    expect(trackFinger(5000, spacing)).toBeCloseTo(312.5, 5);
  });

  it('leaves roughly a quarter of a neighbour on screen at every width', () => {
    for (const w of [360, 393, 412]) {
      const size = (154 + 14) * 0.72;
      const visible = w / 2 + size / 2 - carouselSpacing(w, 154) + w / 2 - w / 2;
      expect(visible / size).toBeCloseTo(0.14, 5);
    }
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
    // Five mounted: the off-screen outer pair present as neighbours, and the centre renders last.
    expect(renderHero.mock.calls.map(([summary, index, slot]) => [summary.anchor.id, index, slot]))
      .toEqual([['a3', 3, -1], ['a3', 3, 1], ['a0', 0, -1], ['a2', 2, 1], ['a1', 1, 0]]);
  });

  it('renders exactly five Anchors however long the list is', () => {
    render(<V2HomeAnchorCarousel anchors={summaries(12, 4)} selectedIndex={4} onSelect={jest.fn()} />);
    expect(artworkRenders).toHaveLength(5);
    expect(artworkRenders.filter((size) => size === String(HERO_ANCHOR_SIZE))).toHaveLength(5);
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

describe('continuous track', () => {
  it('maps any virtual index, negative or wrapped, onto the list', () => {
    expect(dataIndex(0, 5)).toBe(0);
    expect(dataIndex(7, 5)).toBe(2);
    expect(dataIndex(-1, 5)).toBe(4);
    expect(dataIndex(-6, 5)).toBe(4);
    expect(dataIndex(-10, 5)).toBe(0);
    expect(dataIndex(3, 1)).toBe(0);
  });

  it('never lets one release travel past the in-flight target by more than one', () => {
    expect(clampStep(13, 12)).toBe(13);
    expect(clampStep(15, 12)).toBe(13);
    expect(clampStep(9, 12)).toBe(11);
    expect(clampStep(12, 12)).toBe(12);
  });

  it('relocates an outside selection to its nearest copy on the track', () => {
    expect(nearestVirtualIndex(12, 0, 5)).toBe(10);
    expect(nearestVirtualIndex(12, 4, 5)).toBe(14);
    expect(nearestVirtualIndex(12, 2, 5)).toBe(12);
    expect(nearestVirtualIndex(-3, 1, 5)).toBe(-4);
  });
});

describe('committing a switch', () => {
  beforeEach(() => { jest.useFakeTimers(); });
  afterEach(() => { jest.useRealTimers(); });

  it('keeps the incoming artwork mounted when it becomes current', () => {
    const mounts: string[] = [];
    function Hero({ id }: { id: string }) {
      React.useEffect(() => { mounts.push(id); }, [id]);
      return <React.Fragment>{id}</React.Fragment>;
    }
    const renderHero = (summary: V2HomeAnchorSummary) => <Hero id={summary.anchor.id} />;
    render(<V2HomeAnchorCarousel anchors={summaries(3, 0)} selectedIndex={0} onSelect={jest.fn()}
      renderHero={renderHero} reduceMotion />);
    // With three Anchors in a five-wide window, a1 is mounted as the next neighbour and the outer copy.
    const before = mounts.filter(id => id === 'a1').length;
    fireEvent.press(screen.getByTestId('v2-home-carousel-next'));
    settle();
    expect(mounts.filter(id => id === 'a1')).toHaveLength(before);
  });

  it('commits once from a neighbour tap', () => {
    const onSelect = jest.fn();
    render(
      <V2HomeAnchorCarousel anchors={summaries(3, 0)} selectedIndex={0} onSelect={onSelect} reduceMotion />,
    );
    fireEvent.press(screen.getByTestId('v2-home-carousel-next'));
    settle();
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('a1');
  });

  it('wraps backwards from the first Anchor', () => {
    const onSelect = jest.fn();
    render(
      <V2HomeAnchorCarousel anchors={summaries(3, 0)} selectedIndex={0} onSelect={onSelect} reduceMotion />,
    );
    fireEvent.press(screen.getByTestId('v2-home-carousel-previous'));
    settle();
    expect(onSelect).toHaveBeenCalledWith('a2');
  });

  it('commits only once the carousel rests, after the delay', () => {
    const onSelect = jest.fn();
    render(<V2HomeAnchorCarousel anchors={summaries(3, 0)} selectedIndex={0} onSelect={onSelect} reduceMotion />);
    fireEvent.press(screen.getByTestId('v2-home-carousel-next'));
    act(() => { jest.advanceTimersByTime(COMMIT_DELAY_MS - 1); });
    expect(onSelect).not.toHaveBeenCalled();
    act(() => { jest.advanceTimersByTime(1); });
    expect(onSelect).toHaveBeenCalledWith('a1');
  });

  it('chains rapid taps into one commit, three Anchors on', () => {
    const onSelect = jest.fn();
    const onMotionChange = jest.fn();
    render(<V2HomeAnchorCarousel anchors={summaries(5, 0)} selectedIndex={0} onSelect={onSelect}
      onMotionChange={onMotionChange} reduceMotion />);
    fireEvent.press(screen.getByTestId('v2-home-carousel-next'));
    fireEvent.press(screen.getByTestId('v2-home-carousel-next'));
    fireEvent.press(screen.getByTestId('v2-home-carousel-next'));
    expect(onSelect).not.toHaveBeenCalled();
    settle();
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('a3');
    expect(onMotionChange.mock.calls).toEqual([[true], [false]]);
  });

  it('does not commit a round trip back to the selected Anchor', () => {
    const onSelect = jest.fn();
    const onMotionChange = jest.fn();
    render(<V2HomeAnchorCarousel anchors={summaries(3, 0)} selectedIndex={0} onSelect={onSelect}
      onMotionChange={onMotionChange} reduceMotion />);
    fireEvent.press(screen.getByTestId('v2-home-carousel-next'));
    fireEvent.press(screen.getByTestId('v2-home-carousel-previous'));
    settle();
    expect(onSelect).not.toHaveBeenCalled();
    expect(onMotionChange.mock.calls).toEqual([[true], [false]]);
  });

  it('shows the other Anchor on both sides of a two-Anchor vault', () => {
    const renderHero = jest.fn((summary: V2HomeAnchorSummary, _index: number, _slot: number) => <React.Fragment>{summary.anchor.id}</React.Fragment>);
    render(<V2HomeAnchorCarousel anchors={summaries(2, 0)} selectedIndex={0} onSelect={jest.fn()} renderHero={renderHero} />);
    expect(renderHero.mock.calls.map(([summary, , slot]) => [summary.anchor.id, slot]))
      .toEqual([['a0', -1], ['a0', 1], ['a1', -1], ['a1', 1], ['a0', 0]]);
  });

  it('guards rapid duplicate taps during selection', () => {
    const onSelect = jest.fn();
    render(<V2HomeAnchorCarousel anchors={summaries(3, 0)} selectedIndex={0} onSelect={onSelect} reduceMotion />);
    fireEvent.press(screen.getByTestId('v2-home-carousel-next'));
    settle();
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});
