
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

  it('renders hero title and guidance chips in create mode', () => {
    const { getByText, getByLabelText } = render(<VisionMomentInput {...defaultProps} />);
    expect(getByText('Describe your Vision')).toBeTruthy();
    expect(getByLabelText('Where are you?')).toBeTruthy();
    expect(getByLabelText('What are you doing?')).toBeTruthy();
    expect(getByLabelText('What can you see?')).toBeTruthy();
    expect(getByLabelText("What's different?")).toBeTruthy();
  });

  it('renders hero title for add mode', () => {
    const { getByText } = render(<VisionMomentInput {...defaultProps} mode="add" />);
    expect(getByText('Describe your image')).toBeTruthy();
  });

  it('appends guidance cue to text input when chip is tapped', () => {
    const { getByTestId, getByLabelText } = render(<VisionMomentInput {...defaultProps} />);
    const chip = getByLabelText('Where are you?');
    fireEvent.press(chip);
    const input = getByTestId('vision-prompt-input');
    expect(input.props.value).toContain('Where are you?');
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
