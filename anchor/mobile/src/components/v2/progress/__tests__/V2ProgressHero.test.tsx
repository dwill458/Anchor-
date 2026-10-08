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
