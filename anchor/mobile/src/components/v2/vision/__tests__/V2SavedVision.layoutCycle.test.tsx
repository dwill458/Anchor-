import { View } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { V2SavedVision } from '../V2SavedVision';
import type { V2VisionTile, VisionBoardLayout } from '@/adapters/v2/vision';

jest.mock('@/services/CreationSounds', () => ({ playCreationSound: jest.fn(() => ({ stop: jest.fn() })) }));

const tile = (i: number): V2VisionTile => ({
  sceneId: `sc-${i}`, imageUrl: `https://example.com/${i}.jpg`, sourceType: 'AI_GENERATED', sortOrder: i - 1,
} as V2VisionTile);

function setup(onUpdateBoardLayout: (layout: VisionBoardLayout) => Promise<boolean>, boardLayout: VisionBoardLayout = 'CLASSIC') {
  jest.spyOn(View.prototype, 'measureInWindow').mockImplementation(cb => {
    (cb as (x: number, y: number, width: number, height: number) => void)(0, 0, 300, 300);
  });
  return render(<V2SavedVision anchorIntention="I build what matters." description="A quiet studio full of finished work." tiles={[tile(1), tile(2)]}
    onBack={jest.fn()} onVisualize={jest.fn()} onChart={jest.fn()} onUpdateDescription={jest.fn(async () => true)}
    onReorder={jest.fn(async () => true)} onRemove={jest.fn(async () => true)} onAddPhoto={jest.fn()} onAddGenerate={jest.fn()}
    onReplace={jest.fn(async () => {})} onRegenerate={jest.fn()} canGenerateMore onArchive={jest.fn(async () => true)}
    boardLayout={boardLayout} onUpdateBoardLayout={onUpdateBoardLayout} />);
}

describe('V2SavedVision layout button', () => {
  beforeEach(() => { jest.useFakeTimers(); });
  afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

  it('steps to the next layout in place and saves once the taps stop', async () => {
    const save = jest.fn(async () => true);
    const view = setup(save);
    fireEvent.press(view.getByTestId('vision-layout-open'));
    expect(view.queryByTestId('vision-layout-sheet')).toBeNull();
    expect(view.getByTestId('vision-layout-name')).toBeTruthy(); expect(view.getByText('Editorial')).toBeTruthy();
    expect(view.getByTestId('vision-layout-open').props.accessibilityLabel).toBe('Board layout: Editorial');
    fireEvent.press(view.getByTestId('vision-layout-open'));
    expect(view.getByTestId('vision-layout-name')).toBeTruthy(); expect(view.getByText('Scrapbook')).toBeTruthy();
    expect(save).not.toHaveBeenCalled();
    await act(async () => { jest.advanceTimersByTime(700); });
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith('SCRAPBOOK');
  });

  it('wraps back to the saved layout without saving', async () => {
    const save = jest.fn(async () => true);
    const view = setup(save, 'SCRAPBOOK');
    fireEvent.press(view.getByTestId('vision-layout-open'));
    expect(view.getByTestId('vision-layout-name')).toBeTruthy(); expect(view.getByText('Classic')).toBeTruthy();
    fireEvent.press(view.getByTestId('vision-layout-open'));
    fireEvent.press(view.getByTestId('vision-layout-open'));
    expect(view.getByTestId('vision-layout-name')).toBeTruthy(); expect(view.getByText('Scrapbook')).toBeTruthy();
    await act(async () => { jest.advanceTimersByTime(700); });
    expect(save).not.toHaveBeenCalled();
  });

  it('keeps the landed layout when the screen closes before the save fires', () => {
    const save = jest.fn(async () => true);
    const view = setup(save);
    fireEvent.press(view.getByTestId('vision-layout-open'));
    view.unmount();
    expect(save).toHaveBeenCalledWith('EDITORIAL');
  });
});
