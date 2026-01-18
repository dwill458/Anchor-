/**
 * Anchor App - LoadingSpinner Component Tests
 *
 * Unit tests for LoadingSpinner component
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { LoadingSpinner, LoadingOverlay } from '../LoadingSpinner';

describe('LoadingSpinner Component', () => {
  it('should render without crashing', () => {
    const { getByRole } = render(<LoadingSpinner />);
    expect(getByRole('progressbar')).toBeTruthy();
  });

  it('should render with custom message', () => {
    const { getByText, getByRole } = render(
      <LoadingSpinner message="Loading anchors..." />
    );

    expect(getByText('Loading anchors...')).toBeTruthy();
    expect(getByRole('progressbar')).toBeTruthy();
  });

  it('should have proper accessibility label with message', () => {
    const { getByRole } = render(
      <LoadingSpinner message="Loading data" />
    );

    const progressbar = getByRole('progressbar');
    expect(progressbar.props.accessibilityLabel).toBe('Loading data');
  });

  it('should have default accessibility label without message', () => {
    const { getByRole } = render(<LoadingSpinner />);
    const progressbar = getByRole('progressbar');
    expect(progressbar.props.accessibilityLabel).toBe('Loading');
  });

  it('should have accessibility live region', () => {
    const { getByRole } = render(<LoadingSpinner />);
    const progressbar = getByRole('progressbar');
    expect(progressbar.props.accessibilityLiveRegion).toBe('polite');
  });

  it('should render small size correctly', () => {
    const { getByRole } = render(<LoadingSpinner size="small" />);
    expect(getByRole('progressbar')).toBeTruthy();
  });

  it('should render medium size correctly', () => {
    const { getByRole } = render(<LoadingSpinner size="medium" />);
    expect(getByRole('progressbar')).toBeTruthy();
  });

  it('should render large size correctly', () => {
    const { getByRole } = render(<LoadingSpinner size="large" />);
    expect(getByRole('progressbar')).toBeTruthy();
  });

  it('should accept custom color', () => {
    const { getByRole } = render(<LoadingSpinner color="#FF0000" />);
    expect(getByRole('progressbar')).toBeTruthy();
  });
});

describe('LoadingOverlay Component', () => {
  it('should render LoadingOverlay', () => {
    const { getByRole } = render(<LoadingOverlay />);
    expect(getByRole('progressbar')).toBeTruthy();
  });

  it('should render with message', () => {
    const { getByText } = render(
      <LoadingOverlay message="Creating anchor..." />
    );
    expect(getByText('Creating anchor...')).toBeTruthy();
  });

  it('should render with all LoadingSpinner props', () => {
    const { getByText } = render(
      <LoadingOverlay size="large" message="Loading..." color="#FF0000" />
    );
    expect(getByText('Loading...')).toBeTruthy();
  });
});
