import React from 'react';
import { render } from '@testing-library/react-native';
import { V2ProgressHero, heroArtworkSize, heroStats } from '../V2ProgressHero';
import { toV2ProgressModel } from '@/adapters/v2/progress/progressAdapter';
import type { Anchor } from '@/types';

const anchor = {
  id: 'anchor-1',
  userId: 'user-1',
  intentionText: 'Launch with care',
  category: 'creativity',
  threadStrength: 65,
  createdAt: new Date('2026-08-01T10:00:00.000Z'),
  updatedAt: new Date('2026-08-15T12:00:00.000Z'),
} as unknown as Anchor;

const now = new Date('2026-08-20T12:00:00.000Z');
const FULL_STRENGTH_AT = '2026-08-07T08:00:00.000Z';

describe('V2ProgressHero Full Strength fact', () => {
  it('states the real date Full Strength was first reached, as a fact about the past', () => {
    const model = toV2ProgressModel(anchor, [], [], { celebrations: { fullStrengthAt: FULL_STRENGTH_AT }, now })!;
    const { getByTestId } = render(<V2ProgressHero model={model} now={now} />);
    const day = new Date(FULL_STRENGTH_AT).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    expect(getByTestId('v2-progress-hero-full-strength').props.children).toBe(`Full Strength reached · First achieved ${day}`);
  });

  it('shows no Full Strength line when this device has no record', () => {
    const model = toV2ProgressModel(anchor, [], [], { now })!;
    const { queryByTestId, queryByText } = render(<V2ProgressHero model={model} now={now} />);
    expect(queryByTestId('v2-progress-hero-full-strength')).toBeNull();
    expect(queryByText(/Full Strength/)).toBeNull();
  });
});

describe('V2ProgressHero Header Redesign', () => {
  const styledAnchor = {
    ...anchor,
    category: 'relationships',
    intentionText: 'I love my wife',
    threadStrength: 25,
    baseSigilSvg: '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40"/></svg>',
    enhancedImageUrl: 'https://example.com/relationships-art.png',
  } as unknown as Anchor;

  it('renders category dot and uppercase category name', () => {
    const model = toV2ProgressModel(styledAnchor, [], [], { now })!;
    const { getByText } = render(<V2ProgressHero model={model} anchor={styledAnchor} now={now} />);
    expect(getByText('RELATIONSHIPS')).toBeTruthy();
  });

  it('renders intention title', () => {
    const model = toV2ProgressModel(styledAnchor, [], [], { now })!;
    const { getByText } = render(<V2ProgressHero model={model} anchor={styledAnchor} now={now} />);
    expect(getByText('I love my wife')).toBeTruthy();
  });

  it('renders the real Anchor artwork large, with no extra strength ring or stage pips', () => {
    const model = toV2ProgressModel(styledAnchor, [], [], { now })!;
    const { getByTestId, queryByTestId, queryByText } = render(<V2ProgressHero model={model} anchor={styledAnchor} now={now} />);
    expect(getByTestId('v2-progress-hero-artwork')).toBeTruthy();
    expect(queryByTestId('v2-progress-hero-ring')).toBeNull();
    expect(queryByTestId('v2-progress-hero-pip-1')).toBeNull();
    expect(queryByText('THREAD STAGE')).toBeNull();
  });

  it('sizes the artwork 230-260dp on a typical phone and eases down on short screens', () => {
    expect(heroArtworkSize(390, 844)).toBe(250);
    expect(heroArtworkSize(430, 932)).toBe(256);
    expect(heroArtworkSize(360, 640)).toBe(192);
    expect(heroArtworkSize(320, 480)).toBe(190);
  });

  it('renders base SVG artwork when enhanced image is absent', () => {
    const svgOnlyAnchor = {
      ...anchor,
      baseSigilSvg: '<svg viewBox="0 0 100 100"><path d="M10 10L90 90"/></svg>',
      enhancedImageUrl: undefined,
    } as unknown as Anchor;
    const model = toV2ProgressModel(svgOnlyAnchor, [], [], { now })!;
    const { getByTestId } = render(<V2ProgressHero model={model} anchor={svgOnlyAnchor} now={now} />);
    expect(getByTestId('v2-progress-hero-artwork')).toBeTruthy();
  });

  it('renders Thread Strength number, label and level beneath the Anchor', () => {
    const model = toV2ProgressModel(styledAnchor, [], [], { now })!;
    const { getByText } = render(<V2ProgressHero model={model} anchor={styledAnchor} now={now} />);
    expect(getByText('25')).toBeTruthy();
    expect(getByText('THREAD STRENGTH')).toBeTruthy();
    expect(getByText('BUILDING')).toBeTruthy();
  });

  it('with no practices uses the existing contextual message', () => {
    const model = toV2ProgressModel(styledAnchor, [], [], { now })!;
    const { getByText } = render(<V2ProgressHero model={model} anchor={styledAnchor} now={now} />);
    expect(getByText('Soft, but still here.')).toBeTruthy();
  });

  it('shows no strength number, level or invented message for an unmeasured Anchor', () => {
    const unmeasuredAnchor = { ...anchor, threadStrength: undefined } as unknown as Anchor;
    const model = toV2ProgressModel(unmeasuredAnchor, [], [], { now })!;
    const { getByText, queryByTestId, queryByText } = render(<V2ProgressHero model={model} anchor={unmeasuredAnchor} now={now} />);
    expect(queryByTestId('v2-progress-hero-strength')).toBeNull();
    expect(queryByTestId('v2-progress-hero-level')).toBeNull();
    expect(queryByText('THREAD STRENGTH')).toBeNull();
    expect(getByText('Your thread is waiting.')).toBeTruthy();
  });

  it('shows an honest zero for a measured Anchor at strength 0', () => {
    const zero = { ...anchor, threadStrength: 0 } as unknown as Anchor;
    const model = toV2ProgressModel(zero, [], [], { now })!;
    const { getByTestId } = render(<V2ProgressHero model={model} anchor={zero} now={now} />);
    expect(getByTestId('v2-progress-hero-strength').props.children).toBe(0);
  });
});

describe('heroStats', () => {
  const sessions = [
    { id: 's1', anchorId: 'anchor-1', completedAt: '2026-08-01T12:00:00.000Z', completedDurationSeconds: 600, localDateKey: '2026-08-01' },
    { id: 's2', anchorId: 'anchor-1', completedAt: '2026-08-01T18:00:00.000Z', completedDurationSeconds: 300, localDateKey: '2026-08-01' },
    { id: 's3', anchorId: 'anchor-1', completedAt: '2026-08-03T12:00:00.000Z', completedDurationSeconds: 3600, localDateKey: '2026-08-03' },
  ] as any[];

  it('reads days, focus time and practices from persisted sessions when no Chart waypoint is reached', () => {
    const model = toV2ProgressModel(anchor, [], sessions, { now })!;
    expect(heroStats(model)).toEqual([
      { key: 'days', value: '2', label: 'Days invested' },
      { key: 'time', value: '1h 15m', label: 'Total focus time' },
      { key: 'practices', value: '3', label: 'Practices completed' },
    ]);
  });

  it('never shows 0 waypoints; it shows waypoints only once one is reached', () => {
    const model = toV2ProgressModel(anchor, [], sessions, { now })!;
    expect(heroStats({ ...model, lifetime: { ...model.lifetime!, waypointsReached: 2 } })[2]).toEqual({
      key: 'waypoints',
      value: '2',
      label: 'Waypoints reached',
    });
    expect(heroStats(model).some((s) => s.key === 'waypoints')).toBe(false);
  });

  it('uses the returned-times message once practices exist', () => {
    const model = toV2ProgressModel(anchor, [], sessions, { now })!;
    const { getByTestId } = render(<V2ProgressHero model={model} now={now} />);
    expect(getByTestId('v2-progress-hero-message').props.children).toBe("You've returned to this intention 3 times.");
  });
});
