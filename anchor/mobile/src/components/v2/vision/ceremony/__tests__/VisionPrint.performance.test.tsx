import { act, fireEvent, render } from '@testing-library/react-native';
import { Image } from 'react-native';
import { VisionPrint } from '../VisionPrint';
import { CEREMONY } from '../VisionDevelop';

let mockTier = 'low';
jest.mock('@/hooks/usePerformanceTier', () => ({...jest.requireActual('@/hooks/usePerformanceTier'),usePerformanceTier: () => mockTier }));
jest.mock('@/services/CreationSounds', () => ({ playCreationSound: jest.fn() }));

describe('Vision Develop performance fallback', () => {
  beforeEach(() => { jest.useFakeTimers(); mockTier='low'; jest.spyOn(Image,'prefetch').mockResolvedValue(true); });
  afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); jest.restoreAllMocks(); });
  it.each(['low','high'])('uses the approved %s device image layers', tier => {
    mockTier=tier;
    const view=render(<VisionPrint uri="https://example.com/actual.jpg" developing active revealed showCaption={false} caption="" pinned={false} testID="develop"/>);
    const blurred=view.UNSAFE_getAllByType(Image).filter(image=>image.props.blurRadius);
    expect(blurred).toHaveLength(tier==='low'?0:1);
    expect(view.getByTestId('develop-sharp').props.source).toEqual({uri:'https://example.com/actual.jpg'});
  });
  it('keeps decode readiness and the same completion contract when blur becomes a fade', async()=>{
    const completed=jest.fn();
    const view=render(<VisionPrint uri="https://example.com/actual.jpg" developing active revealed showCaption={false} caption="" pinned={false} onDeveloped={completed} testID="develop"/>);
    await act(async()=>{await Promise.resolve();jest.advanceTimersByTime(0);});
    await act(async()=>{jest.advanceTimersByTime(0);});
    expect(completed).not.toHaveBeenCalled();
    fireEvent(view.getByTestId('develop-sharp'),'load');
    await act(async()=>{jest.advanceTimersByTime(CEREMONY.revealBlurMs);});
    expect(completed).toHaveBeenCalledTimes(1);
    expect(completed).toHaveBeenCalledWith('https://example.com/actual.jpg');
  });
});
