import { act, fireEvent, render } from '@testing-library/react-native';
import { Image } from 'react-native';
import { VisionPrint } from '../VisionPrint';

jest.mock('@/hooks/v2', () => ({ useV2ReduceMotion: () => false }));
jest.mock('@/services/CreationSounds', () => ({ playCreationSound: jest.fn() }));
jest.mock('@/utils/haptics', () => ({ safeHaptics: { impact: jest.fn() } }));

const props = { uri: 'https://cdn.test/real.jpg', developing: true, revealed: true, showCaption: false, caption: '', pinned: false };
async function advance(ms: number) { await act(async () => { jest.advanceTimersByTime(ms); }); }

describe('Vision print asset and lifecycle continuity', () => {
  beforeEach(() => { jest.useFakeTimers(); jest.spyOn(Image, 'prefetch').mockResolvedValue(true); });
  afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); jest.restoreAllMocks(); });

  it('waits for the image load even after prefetch times out', async () => {
    (Image.prefetch as jest.Mock).mockReturnValue(new Promise(() => undefined));
    const developed = jest.fn();
    const view = render(<VisionPrint {...props} onDeveloped={developed} />);
    await advance(3000); await advance(4000);
    expect(developed).not.toHaveBeenCalled();
    fireEvent(view.getByTestId('vision-print-sharp'), 'load'); await advance(3400);
    expect(developed).toHaveBeenCalledWith(props.uri);
  });

  it('finishes developing after returning from background halfway through reveal', async () => {
    const developed = jest.fn();
    const view = render(<VisionPrint {...props} onDeveloped={developed} />);
    fireEvent(view.getByTestId('vision-print-sharp'), 'load'); await advance(0); await advance(1); await advance(1000);
    view.rerender(<VisionPrint {...props} active={false} onDeveloped={developed} />); await advance(5000);
    expect(developed).not.toHaveBeenCalled();
    view.rerender(<VisionPrint {...props} active onDeveloped={developed} />); await advance(0); await advance(1); await advance(3400);
    expect(developed).toHaveBeenCalledTimes(1);
  });

  it('a new URI must load independently and completes once across Keep changes', async () => {
    const developed = jest.fn();
    const view = render(<VisionPrint {...props} onDeveloped={developed} />);
    fireEvent(view.getByTestId('vision-print-sharp'), 'load'); await advance(0); await advance(1); await advance(3400);
    view.rerender(<VisionPrint {...props} uri="https://cdn.test/new.jpg" onDeveloped={developed} />);
    await advance(0); await advance(5000); expect(developed).toHaveBeenCalledTimes(1);
    fireEvent(view.getByTestId('vision-print-sharp'), 'load'); await advance(3400);
    view.rerender(<VisionPrint {...props} uri="https://cdn.test/new.jpg" showCaption onDeveloped={developed} />);
    await advance(5000); expect(developed).toHaveBeenCalledTimes(2);
  });
});
