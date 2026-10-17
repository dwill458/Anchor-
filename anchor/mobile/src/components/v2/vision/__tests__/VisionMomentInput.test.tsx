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

  it('renders the authorship title and exactly three guidance prompts in create mode', () => {
    const { getByText, getByLabelText, queryByLabelText } = render(<VisionMomentInput {...defaultProps} />);
    expect(getByText('Create Your First Scene')).toBeTruthy();
    expect(getByText('Add a reference photo for a more personal result.')).toBeTruthy();
    expect(getByText('CREATE YOUR VISION')).toBeTruthy();
    expect(getByLabelText('Where are you?')).toBeTruthy();
    expect(getByLabelText('What are you doing?')).toBeTruthy();
    expect(getByLabelText('How does it feel?')).toBeTruthy();
    expect(queryByLabelText('What can you see?')).toBeNull();
    expect(queryByLabelText("What's different?")).toBeNull();
  });

  it('shows the intention, word coaching with the counter, and the optional reference', () => {
    const { getByText, getByTestId, getByLabelText } = render(<VisionMomentInput {...defaultProps} />);
    expect(getByText('I build what matters.')).toBeTruthy();
    const text = 'I open my laptop and see ten thousand active users for my app today.';
    fireEvent.changeText(getByTestId('vision-prompt-input'), text);
    expect(getByTestId('vision-detail-hint').props.children).toBe('14 words · Add a little more detail for stronger images');
    expect(getByText(`${text.length} / 2000`)).toBeTruthy();
    expect(getByText('Optional · Add photos of yourself for more personal images.')).toBeTruthy();
    expect(getByLabelText('Make it look like you reference photo')).toBeTruthy();
    expect(getByText('You’ll choose what belongs in your Vision.')).toBeTruthy();
  });

  it('renders hero title for add mode', () => {
    const { getAllByText } = render(<VisionMomentInput {...defaultProps} mode="add" />);
    expect(getAllByText('What else do you see in this future?')[0]).toBeTruthy();
  });

  it('asks a question when a chip is tapped and never writes into the description', () => {
    const { getByTestId, getByLabelText, queryByTestId } = render(<VisionMomentInput {...defaultProps} />);
    const input = getByTestId('vision-prompt-input');
    expect(queryByTestId('vision-cue')).toBeNull();
    fireEvent.press(getByLabelText('Where are you?'));
    expect(input.props.value).toBe('');
    expect(getByTestId('vision-cue')).toBeTruthy();
    fireEvent.press(getByLabelText('How does it feel?'));
    expect(getByTestId('vision-prompt-input').props.value).toBe('');
  });

  it('never focuses the field or opens the keyboard when a chip is tapped', () => {
    const stateFocus = jest.spyOn(TextInput.State, 'focusTextInput');
    const { getByTestId, getByLabelText, UNSAFE_getByType } = render(<VisionMomentInput {...defaultProps} />);
    const instance = UNSAFE_getByType(TextInput).instance as { focus: () => void };
    const instanceFocus = jest.spyOn(instance, 'focus');
    for (const label of ['Where are you?', 'What are you doing?', 'How does it feel?']) {
      fireEvent.press(getByLabelText(label));
      expect(getByTestId('vision-cue')).toBeTruthy();
    }
    expect(instanceFocus).not.toHaveBeenCalled();
    expect(stateFocus).not.toHaveBeenCalled();
    stateFocus.mockRestore();
  });

  it('leaves existing text untouched when a chip is tapped', () => {
    const { getByTestId, getByLabelText } = render(<VisionMomentInput {...defaultProps} />);
    fireEvent.changeText(getByTestId('vision-prompt-input'), 'I am standing in my studio.');
    for (const label of ['Where are you?', 'What are you doing?', 'How does it feel?']) fireEvent.press(getByLabelText(label));
    expect(getByTestId('vision-prompt-input').props.value).toBe('I am standing in my studio.');
  });

  it('shows guidance about the actual Anchor, not unrelated stock copy', () => {
    const { getByTestId, getByLabelText } = render(<VisionMomentInput {...defaultProps} anchorIntention="I am the owner of dope ass regal" anchorCategory="desire" />);
    expect(getByTestId('vision-prompt-input').props.placeholder).toBe('Describe the moment you want to see...');
    fireEvent.press(getByLabelText('Use suggested description'));
    expect(getByTestId('vision-prompt-input').props.value).toMatch(/owner of dope ass regal/i);
    expect(getByTestId('vision-prompt-input').props.value).not.toMatch(/Tuesday|kitchen with coffee/);
    fireEvent.press(getByLabelText('Where are you?'));
    expect(getByTestId('vision-cue').props.children).toBeTruthy();
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
    expect(onAddPhotos).toHaveBeenCalled();
  });
});
