import React, { useEffect } from 'react';
import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import * as Reanimated from 'react-native-reanimated';
import { ArrivalScope, Reveal } from '../Reveal';

jest.mock('@/hooks/v2/useV2ReduceMotion', () => ({ useV2ReduceMotion: () => false }));
jest.mock('react-native-reanimated', () => {
  const actual = jest.requireActual('react-native-reanimated');
  return { ...actual, __esModule: true, withDelay: jest.fn(actual.withDelay) };
});

const withDelay = Reanimated.withDelay as jest.Mock;

describe('Reveal', () => {
  beforeEach(() => withDelay.mockClear());

  it('renders its children', () => {
    render(<Reveal order={1}><Text>hello</Text></Reveal>);
    expect(screen.getByText('hello')).toBeTruthy();
  });

  it('renders its children and starts no animation when disabled', () => {
    render(<Reveal enabled={false} order={3}><Text>still</Text></Reveal>);
    expect(screen.getByText('still')).toBeTruthy();
    expect(withDelay).not.toHaveBeenCalled();
  });

  it('does not restart its entrance when re-rendered with the same props', () => {
    const view = render(<Reveal order={2}><Text>a</Text></Reveal>);
    expect(withDelay).toHaveBeenCalledTimes(1);
    view.rerender(<Reveal order={2}><Text>a</Text></Reveal>);
    expect(withDelay).toHaveBeenCalledTimes(1);
  });

  describe('ArrivalScope', () => {
    it('starts no entrance for Reveals inside a scope that is not arriving', () => {
      render(<ArrivalScope animate={false}><Reveal order={1}><Text>swapped</Text></Reveal></ArrivalScope>);
      expect(screen.getByText('swapped')).toBeTruthy();
      expect(withDelay).not.toHaveBeenCalled();
    });

    it('lets Reveals inside an arriving scope enter as usual', () => {
      render(<ArrivalScope animate><Reveal order={1}><Text>arriving</Text></Reveal></ArrivalScope>);
      expect(withDelay).toHaveBeenCalledTimes(1);
    });

    it('reads its decision once: a later animate=false neither remounts nor restarts the content', () => {
      const mounts = jest.fn();
      function Probe() {
        useEffect(() => {
          mounts();
        }, []);
        return <Text>probe</Text>;
      }
      const view = render(<ArrivalScope animate><Reveal order={1}><Probe /></Reveal></ArrivalScope>);
      view.rerender(<ArrivalScope animate={false}><Reveal order={1}><Probe /></Reveal></ArrivalScope>);
      expect(mounts).toHaveBeenCalledTimes(1);
      expect(withDelay).toHaveBeenCalledTimes(1);
    });
  });
});
