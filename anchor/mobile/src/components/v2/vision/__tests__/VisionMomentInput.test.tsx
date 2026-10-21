import { TextInput } from 'react-native';

import { fireEvent, render } from '@testing-library/react-native';
import { VisionMomentInput } from '../VisionMomentInput';

const mockUseAppearance = jest.fn();
jest.mock('@/hooks/v2/vision', () => ({
  useVisionAppearanceReference: () => mockUseAppearance(),
}));

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  launchImageLibraryAsync: jest.fn(async () => ({ canceled: true, assets: null })),
}));

describe('VisionMomentInput', () => {
  const defaultProps = {
    mode: 'create' as const,
    anchorId: 'anchor-test',
    anchorIntention: 'I build what matters.',
    anchorCategory: 'career',
    onBack: jest.fn(),
    onSubmit: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAppearance.mockReturnValue({
      profilePhoto: null,
      enabledByPreference: false,
      reference: null,
      loading: false,
      saving: false,
      upload: jest.fn(),
      remove: jest.fn(),
      setProfilePreference: jest.fn(),
    });
  });

  it('renders the approved create heading and one four-chip spark group', () => {
    const { getByText, getByLabelText, queryByLabelText } = render(<VisionMomentInput {...defaultProps} startPhotoEnabled />);
    expect(getByText('Imagine Your First Scene')).toBeTruthy();
    expect(getByText('Bring a moment from your future to life.')).toBeTruthy();
    expect(getByText('CREATE YOUR VISION')).toBeTruthy();
    for (const suggestion of ['The day it happens', 'Who is with me', 'An ordinary morning after', 'A quiet moment of it']) {
      expect(getByLabelText(suggestion)).toBeTruthy();
    }
    expect(queryByLabelText('Where are you?')).toBeNull();
    expect(queryByLabelText('What should change?')).toBeNull();
  });

  it('shows the intention and word coaching with the counter, and no appearance reference card', () => {
    const { getByText, getByTestId, queryByLabelText, queryByText } = render(<VisionMomentInput {...defaultProps} />);
    expect(getByText('I build what matters.')).toBeTruthy();
    const text = 'I open my laptop and see ten thousand active users for my app today.';
    fireEvent.changeText(getByTestId('vision-prompt-input'), text);
    expect(getByTestId('vision-detail-hint').props.children).toBe('14 words · Add a little more detail for stronger images');
    expect(getByText(`${text.length} / 2000`)).toBeTruthy();
    expect(queryByText('Optional · Add photos of yourself for more personal images.')).toBeNull();
    expect(queryByLabelText('Make it look like you reference photo')).toBeNull();
    expect(getByText('You’ll choose what belongs in your Vision.')).toBeTruthy();
  });

  it('renders the approved add-scene heading and subtitle', () => {
    const { getByText } = render(<VisionMomentInput {...defaultProps} mode="add" />);
    expect(getByText('What Else Do You See?')).toBeTruthy();
    expect(getByText('Imagine another moment from your future.')).toBeTruthy();
  });

  it('fills the description from a spark chip without submitting or focusing the field', () => {
    const onSubmit = jest.fn();
    const { getByTestId, getByLabelText, queryByTestId } = render(<VisionMomentInput {...defaultProps} onSubmit={onSubmit} />);
    const input = getByTestId('vision-prompt-input');
    expect(queryByTestId('vision-cue')).toBeNull();
    const stateFocus = jest.spyOn(TextInput.State, 'focusTextInput');
    fireEvent.press(getByLabelText('The day it happens'));
    expect(input.props.value).toBe('The day it happens');
    expect(onSubmit).not.toHaveBeenCalled();
    expect(stateFocus).not.toHaveBeenCalled();
    stateFocus.mockRestore();
  });

  it('collapses the chips for written text and expands them only on request', () => {
    const text = 'I open the doors to my own quiet studio.';
    const { getByTestId, getByLabelText, queryByLabelText } = render(<VisionMomentInput {...defaultProps} />);
    fireEvent.changeText(getByTestId('vision-prompt-input'), text);
    expect(getByLabelText('Need a spark? Show suggestions')).toBeTruthy();
    expect(queryByLabelText('The day it happens')).toBeNull();
    fireEvent.press(getByTestId('vision-moment-input-suggestions-toggle'));
    expect(getByLabelText('An ordinary morning after')).toBeTruthy();
  });

  it('keeps typing local and calls the description callback at submit', () => {
    const onChangeDescription = jest.fn();
    const onSubmit = jest.fn();
    const { getByTestId } = render(<VisionMomentInput {...defaultProps} onChangeDescription={onChangeDescription} onSubmit={onSubmit} />);
    const input = getByTestId('vision-prompt-input');
    const text = 'Working from a sunny studio overlooking the ocean with coffee.';
    fireEvent.changeText(input, text);
    expect(input.props.value).toBe(text);
    expect(onChangeDescription).not.toHaveBeenCalled();
    fireEvent.press(getByTestId('vision-generate'));
    expect(onChangeDescription).toHaveBeenCalledWith(text);
    expect(onSubmit).toHaveBeenCalledWith(text, null);
  });

  it('submits controlled structured references as the optional fourth argument', () => {
    const references = [{ id: 'place-1', uri: 'file:///place.jpg', mimeType: 'image/jpeg', role: 'place' as const }];
    const onSubmit = jest.fn();
    const { getByTestId } = render(
      <VisionMomentInput {...defaultProps} startPhotoEnabled references={references} onChangeReferences={jest.fn()} onSubmit={onSubmit} />,
    );
    const text = 'A small table outside in the morning light.';
    fireEvent.changeText(getByTestId('vision-prompt-input'), text);
    fireEvent.press(getByTestId('vision-generate'));

    expect(onSubmit).toHaveBeenCalledWith(text, null, null, references);
  });

  it('shows the mini gallery and hides suggestions while typing with the keyboard open', () => {
    const { getByTestId, getByText, getByLabelText, queryByLabelText } = render(
      <VisionMomentInput {...defaultProps} startPhotoEnabled />,
    );
    fireEvent(getByTestId('vision-prompt-input'), 'focus');

    expect(getByText('0 references attached')).toBeTruthy();
    expect(getByLabelText('Add reference photo')).toBeTruthy();
    expect(queryByLabelText('The day it happens')).toBeNull();
  });

  it('explains a blocked submit instead of failing silently', () => {
    const { getByTestId, getByText } = render(<VisionMomentInput {...defaultProps} />);
    fireEvent.changeText(getByTestId('vision-prompt-input'), 'short');
    fireEvent.press(getByTestId('vision-generate'));
    expect(getByText('Describe your moment in at least 12 characters, or add a reference photo.')).toBeTruthy();
  });

  it('disables submit button when description is under min characters', () => {
    const { getByTestId } = render(<VisionMomentInput {...defaultProps} />);
    const input = getByTestId('vision-prompt-input');
    const button = getByTestId('vision-generate');
    fireEvent.changeText(input, 'short');
    expect(button.props.accessibilityState).toEqual(expect.objectContaining({ disabled: true }));
  });

  it('enables submit button and calls onSubmit when valid description is provided', () => {
    const onSubmit = jest.fn();
    const { getByTestId } = render(
      <VisionMomentInput {...defaultProps} onSubmit={onSubmit} />,
    );
    const input = getByTestId('vision-prompt-input');
    const button = getByTestId('vision-generate');
    const validText = 'Working from a sunny studio overlooking the ocean with coffee.';
    fireEvent.changeText(input, validText);
    expect(button.props.accessibilityState).toEqual(expect.objectContaining({ disabled: false }));

    fireEvent.press(button);
    expect(onSubmit).toHaveBeenCalledWith(validText, null);
  });

  it('passes active reference id on submit when appearance is configured', () => {
    mockUseAppearance.mockReturnValue({
      profilePhoto: 'https://example.com/avatar.jpg',
      enabledByPreference: true,
      reference: { id: 'ref-123', previewUrl: 'https://example.com/avatar.jpg', source: 'PROFILE' },
      loading: false,
      saving: false,
      upload: jest.fn(),
      remove: jest.fn(),
      setProfilePreference: jest.fn(),
    });

    const onSubmit = jest.fn();
    const { getByTestId } = render(
      <VisionMomentInput {...defaultProps} onSubmit={onSubmit} />,
    );
    const input = getByTestId('vision-prompt-input');
    fireEvent.changeText(input, 'A clear studio desk with working prototypes.');
    fireEvent.press(getByTestId('vision-generate'));
    expect(onSubmit).toHaveBeenCalledWith('A clear studio desk with working prototypes.', 'ref-123');
  });

  it('renders "Use my own photos instead" when onAddPhotos is supplied', () => {
    const onAddPhotos = jest.fn();
    const { getByTestId } = render(
      <VisionMomentInput {...defaultProps} onAddPhotos={onAddPhotos} />,
    );
    const input = getByTestId('vision-prompt-input');
    fireEvent.changeText(input, 'Valid description for my future vision.');
    const addPhotosBtn = getByTestId('vision-add-photos');
    expect(addPhotosBtn).toBeTruthy();
    fireEvent.press(addPhotosBtn);
    expect(onAddPhotos).toHaveBeenLastCalledWith('library');
    fireEvent.press(getByTestId('vision-add-camera'));
    expect(onAddPhotos).toHaveBeenLastCalledWith('camera');
  });
});
