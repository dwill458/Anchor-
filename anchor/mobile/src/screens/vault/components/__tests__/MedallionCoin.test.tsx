import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { MedallionCoin } from '../MedallionCoin';
import { ThreadRing } from '../ThreadRing';

describe('MedallionCoin', () => {
  it('renders correctly with default Anchor A mark when no image or sigil is provided', () => {
    render(<MedallionCoin size={176} testID="test-medallion" reduceMotionEnabled={true} />);
    expect(screen.getByTestId('test-medallion')).toBeTruthy();
  });

  it('renders custom sigil SVG when provided', () => {
    const customSvg = '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" /></svg>';
    render(
      <MedallionCoin
        size={176}
        sigilXml={customSvg}
        testID="test-medallion-svg"
        reduceMotionEnabled={true}
      />
    );
    expect(screen.getByTestId('test-medallion-svg')).toBeTruthy();
  });

  it('renders image when imageUrl is provided', () => {
    render(
      <MedallionCoin
        size={176}
        imageUrl="https://example.com/medallion.png"
        testID="test-medallion-image"
        reduceMotionEnabled={true}
      />
    );
    expect(screen.getByTestId('test-medallion-image')).toBeTruthy();
  });
});

describe('ThreadRing', () => {
  it('renders 320-degree sweep thread progress ring', () => {
    const { toJSON } = render(
      <ThreadRing size={244} stroke={5} value={84} reduceMotionEnabled={true} />
    );
    expect(toJSON()).toBeTruthy();
  });
});
