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
    const { getByLabelText } = render(<LoadingSpinner />);
    expect(getByLabelText('Loading')).toBeTruthy();
  });

  it('should render with custom message', () => {
    const { getByText, getByLabelText } = render(
      <LoadingSpinner message="Loading anchors..." />
    );

    expect(getByText('Loading anchors...')).toBeTruthy();
    expect(getByLabelText('Loading anchors...')).toBeTruthy();
  });

  it('should have proper accessibility label with message', () => {
    const { getByLabelText } = render(
      <LoadingSpinner message="Loading data" />
    );

    const progressbar = getByLabelText('Loading data');
    expect(progressbar.props.accessibilityLabel).toBe('Loading data');
  });

  it('should have default accessibility label without message', () => {
    const { getByLabelText } = render(<LoadingSpinner />);
    const progressbar = getByLabelText('Loading');
    expect(progressbar.props.accessibilityLabel).toBe('Loading');
  });

  it('should have accessibility live region', () => {
    const { getByLabelText } = render(<LoadingSpinner />);
    const progressbar = getByLabelText('Loading');
    expect(progressbar.props.accessibilityLiveRegion).toBe('polite');
  });

  it('should render small size correctly', () => {
    const { getByLabelText } = render(<LoadingSpinner size="small" />);
    expect(getByLabelText('Loading')).toBeTruthy();
  });

  it('should render medium size correctly', () => {
    const { getByLabelText } = render(<LoadingSpinner size="medium" />);
    expect(getByLabelText('Loading')).toBeTruthy();
  });

  it('should render large size correctly', () => {
    const { getByLabelText } = render(<LoadingSpinner size="large" />);
    expect(getByLabelText('Loading')).toBeTruthy();
  });

  it('should accept custom color', () => {
    const { getByLabelText } = render(<LoadingSpinner color="#FF0000" />);
    expect(getByLabelText('Loading')).toBeTruthy();
  });
});

describe('LoadingOverlay Component', () => {
  it('should render LoadingOverlay', () => {
    const { getByLabelText } = render(<LoadingOverlay />);
    expect(getByLabelText('Loading')).toBeTruthy();
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
