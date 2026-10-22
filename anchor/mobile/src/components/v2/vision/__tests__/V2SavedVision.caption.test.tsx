import { View } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { V2SavedVision } from '../V2SavedVision';
import type { V2VisionTile } from '@/adapters/v2/vision';

jest.mock('@/services/CreationSounds', () => ({ playCreationSound: jest.fn(() => ({ stop: jest.fn() })) }));

const tile = (i: number, caption?: string | null): V2VisionTile => ({
  sceneId: `sc-${i}`, imageUrl: `https://example.com/${i}.jpg`, sourceType: 'AI_GENERATED', sortOrder: i - 1, caption,
} as V2VisionTile);

function setup(tiles: V2VisionTile[]) {
  jest.spyOn(View.prototype, 'measureInWindow').mockImplementation(cb => {
    (cb as (x: number, y: number, width: number, height: number) => void)(0, 0, 300, 300);
  });
  return render(<V2SavedVision anchorIntention="I build what matters." description="A quiet studio full of finished work." tiles={tiles}
    onBack={jest.fn()} onVisualize={jest.fn()} onChart={jest.fn()} onUpdateDescription={jest.fn(async () => true)}
    onReorder={jest.fn(async () => true)} onRemove={jest.fn(async () => true)} onAddPhoto={jest.fn()} onAddGenerate={jest.fn()}
    onReplace={jest.fn(async () => {})} onRegenerate={jest.fn()} canGenerateMore onArchive={jest.fn(async () => true)} />);
}

describe('V2SavedVision captions', () => {
  afterEach(() => { jest.restoreAllMocks(); });
  it('shows a saved caption under its image in the edit list, and nothing for uncaptioned images', () => {
    const view = setup([tile(1, 'Finished work in my studio.'), tile(2, null)]);
    fireEvent.press(view.getByLabelText('Vision options'));
    fireEvent.press(view.getByLabelText('Manage images (2)'));
    expect(view.getByTestId('vision-edit-caption-sc-1').props.children).toBe('Finished work in my studio.');
    expect(view.getByTestId('vision-edit-caption-sc-1').props.numberOfLines).toBe(1);
    expect(view.queryByTestId('vision-edit-caption-sc-2')).toBeNull();
  });
  it('shows the caption under a focused photo', () => {
    const view = setup([tile(1, 'Finished work in my studio.'), tile(2)]);
    expect(view.queryByTestId('vision-board-focused-caption')).toBeNull();
    fireEvent(view.getByLabelText('Vision image 1 of 2'), 'accessibilityAction', { nativeEvent: { actionName: 'activate' } });
    expect(view.getByTestId('vision-board-focused-caption').props.children).toBe('Finished work in my studio.');
  });
});
