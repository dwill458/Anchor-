import React from 'react';
import { render } from '@testing-library/react-native';

jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  Reanimated.useReducedMotion = () => true;
  return Reanimated;
});

import { CoursePlotting } from '../CoursePlotting';

describe('CoursePlotting', () => {
  it('echoes the destination back while the plan is generated', () => {
    const screen = render(<CoursePlotting destination="Replace my income with Anchor" />);

    expect(screen.getByText('PLOTTING YOUR COURSE')).toBeTruthy();
    expect(screen.getByText('Replace my income with Anchor')).toBeTruthy();
    expect(screen.getByText('Reading your Anchors and reflections…')).toBeTruthy();
  });

  it('announces itself as a live region so the wait is not silent', () => {
    const screen = render(<CoursePlotting destination="Run a half marathon" />);

    const region = screen.getByLabelText('Plotting your course');
    expect(region.props.accessibilityLiveRegion).toBe('polite');
  });

  it('accepts a caller-supplied status line', () => {
    const screen = render(
      <CoursePlotting destination="Ship the beta" status="Almost there…" />,
    );

    expect(screen.getByText('Almost there…')).toBeTruthy();
  });

  it('renders the completed route artwork immediately when Reduce Motion is enabled', () => {
    const screen = render(<CoursePlotting destination="Build a steadier creative practice" />);

    expect(screen.UNSAFE_getAllByType('Path' as any)).toHaveLength(8);
    expect(screen.UNSAFE_getAllByType('Circle' as any)).toHaveLength(17);
  });
});
