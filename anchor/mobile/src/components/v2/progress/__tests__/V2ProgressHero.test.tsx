import React from 'react';
import { render } from '@testing-library/react-native';
import { V2ProgressHero } from '../V2ProgressHero';
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

  it('renders saved Anchor artwork inside the Thread Strength ring', () => {
    const model = toV2ProgressModel(styledAnchor, [], [], { now })!;
    const { getByTestId } = render(<V2ProgressHero model={model} anchor={styledAnchor} now={now} />);
    expect(getByTestId('v2-progress-hero-ring')).toBeTruthy();
    expect(getByTestId('v2-progress-hero-artwork')).toBeTruthy();
  });

  it('renders base SVG artwork inside the ring when enhanced image is absent', () => {
    const svgOnlyAnchor = {
      ...anchor,
      baseSigilSvg: '<svg viewBox="0 0 100 100"><path d="M10 10L90 90"/></svg>',
      enhancedImageUrl: undefined,
    } as unknown as Anchor;
    const model = toV2ProgressModel(svgOnlyAnchor, [], [], { now })!;
    const { getByTestId } = render(<V2ProgressHero model={model} anchor={svgOnlyAnchor} now={now} />);
    expect(getByTestId('v2-progress-hero-ring')).toBeTruthy();
    expect(getByTestId('v2-progress-hero-artwork')).toBeTruthy();
  });

  it('renders Thread Strength number and THREAD STRENGTH label beneath the ring', () => {
    const model = toV2ProgressModel(styledAnchor, [], [], { now })!;
    const { getByText } = render(<V2ProgressHero model={model} anchor={styledAnchor} now={now} />);
    expect(getByText('25')).toBeTruthy();
    expect(getByText('THREAD STRENGTH')).toBeTruthy();
  });

  it('renders contextual strength headline and support message', () => {
    const model = toV2ProgressModel(styledAnchor, [], [], { now })!;
    const { getByText } = render(<V2ProgressHero model={model} anchor={styledAnchor} now={now} />);
    expect(getByText('Soft, but still here.')).toBeTruthy();
  });

  it('renders Thread stage progression with correct current stage', () => {
    const model = toV2ProgressModel(styledAnchor, [], [], { now })!;
    const { getByText, getAllByText, getByTestId } = render(<V2ProgressHero model={model} anchor={styledAnchor} now={now} />);
    expect(getByText('THREAD STAGE')).toBeTruthy();
    expect(getAllByText('Building').length).toBe(2); // In stage title and pip label
    // Pip 1 (Forming) reached, Pip 2 (Building) current
    expect(getByTestId('v2-progress-hero-pip-1')).toBeTruthy();
    expect(getByTestId('v2-progress-hero-pip-2')).toBeTruthy();
  });

  it('displays dash for unmeasured anchor with empty pips', () => {
    const unmeasuredAnchor = {
      ...anchor,
      threadStrength: undefined,
    } as unknown as Anchor;
    const model = toV2ProgressModel(unmeasuredAnchor, [], [], { now })!;
    const { getByText } = render(<V2ProgressHero model={model} anchor={unmeasuredAnchor} now={now} />);
    expect(getByText('—')).toBeTruthy();
    expect(getByText('THREAD STRENGTH')).toBeTruthy();
    expect(getByText('Your thread is waiting.')).toBeTruthy();
  });
});
