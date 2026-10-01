
import { Image } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { VisionCandidateSelection } from '../VisionCandidateSelection';
import type { VisionGenerationCandidate } from '@/hooks/v2/vision';

describe('VisionCandidateSelection', () => {
  const candidates: VisionGenerationCandidate[] = [
    {
      id: 'candidate-0',
      assetId: 'asset-0',
      role: 'Perspective 1',
      prompt: 'A wide view of the workspace.',
      sortOrder: 0,
      imageUrl: 'https://cdn.example.com/p1.jpg',
    },
    {
      id: 'candidate-1',
      assetId: 'asset-1',
      role: 'Perspective 2',
      prompt: 'A close-up view of hands sketching.',
      sortOrder: 1,
      imageUrl: 'https://cdn.example.com/p2.jpg',
    },
  ];

  const defaultProps = {
    anchorIntention: 'I build what matters.',
    anchorCategory: 'career',
    candidates,
    onBack: jest.fn(),
    onConfirm: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders headlines and both candidate perspective cards', () => {
    const { getByText, getByTestId } = render(<VisionCandidateSelection {...defaultProps} />);
    expect(getByText('Pick the image that feels right.')).toBeTruthy();
    expect(getByTestId('scene-candidate-candidate-0')).toBeTruthy();
    expect(getByTestId('scene-candidate-candidate-1')).toBeTruthy();
  });

  it('disables "Add to Vision →" until a card is selected', () => {
    const { getByText, getByTestId } = render(<VisionCandidateSelection {...defaultProps} />);
    const confirmBtn = getByTestId('vision-candidate-selection-confirm-button');
    expect(confirmBtn.props.accessibilityState).toEqual(expect.objectContaining({ disabled: true }));

    fireEvent.press(getByTestId('scene-candidate-candidate-0'));
    expect(confirmBtn.props.accessibilityState).toEqual(expect.objectContaining({ disabled: false }));
  });

  it('confirms the selected perspective when button is pressed', () => {
    const onConfirm = jest.fn();
    const { getByTestId } = render(
      <VisionCandidateSelection {...defaultProps} onConfirm={onConfirm} />,
    );
    fireEvent.press(getByTestId('scene-candidate-candidate-1'));
    fireEvent.press(getByTestId('vision-candidate-selection-confirm-button'));
    expect(onConfirm).toHaveBeenCalledWith(candidates[1]);
  });

  it('removes a failed preview from selection and blocks confirmation', () => {
    const onConfirm = jest.fn();
    const view = render(<VisionCandidateSelection {...defaultProps} onConfirm={onConfirm} />);
    fireEvent.press(view.getByTestId('scene-candidate-candidate-0'));
    fireEvent(view.UNSAFE_getAllByType(Image)[0], 'error');
    expect(view.getByText('Image preview unavailable')).toBeTruthy();
    fireEvent.press(view.getByTestId('vision-candidate-selection-confirm-button'));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('calls onRegenerate when Regenerate button is tapped', () => {
    const onRegenerate = jest.fn();
    const { getByText } = render(
      <VisionCandidateSelection {...defaultProps} onRegenerate={onRegenerate} />,
    );
    const regenBtn = getByText('Generate More');
    expect(regenBtn).toBeTruthy();
    fireEvent.press(regenBtn);
    expect(onRegenerate).toHaveBeenCalled();
  });
});
