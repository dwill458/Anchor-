import { Keyboard, StyleSheet, TextInput } from 'react-native';

import { act, fireEvent, render } from '@testing-library/react-native';
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
    const { getByText, getByLabelText, queryByLabelText, queryByText } = render(<VisionMomentInput {...defaultProps} startPhotoEnabled />);
    expect(getByText('When it\'s true, what do you see?')).toBeTruthy();
    expect(queryByText('Bring a moment from your future to life.')).toBeNull();
    expect(queryByText('CREATE YOUR VISION')).toBeNull();
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
    // The counter appears only past 1500 characters.
    expect(queryByText(`${text.length} / 2000`)).toBeNull();
    fireEvent.changeText(getByTestId('vision-prompt-input'), 'a'.repeat(1501));
    expect(getByText('1501 / 2000')).toBeTruthy();
    expect(queryByText('Optional · Add photos of yourself for more personal images.')).toBeNull();
    expect(queryByLabelText('Make it look like you reference photo')).toBeNull();
    expect(queryByText('You’ll choose what belongs in your Vision.')).toBeNull();
  });

  it('writes the guidance inside the field instead of a placeholder', () => {
    const { getByTestId } = render(<VisionMomentInput {...defaultProps} />);
    expect(getByTestId('vision-prompt-input').props.placeholder).toBe('');
    expect(getByTestId('vision-detail-hint').props.children).toBe('Where you are, what you\'re doing, how it feels. A little more detail makes a stronger picture.');
  });

  it('shows the saved Anchor artwork in the intention chip when available', () => {
    const art = { svg: '<svg />', category: 'career', expression: null };
    const { getByTestId, getByText } = render(<VisionMomentInput {...defaultProps} anchorArt={art} />);

    expect(getByTestId('vision-moment-input-anchor-art')).toBeTruthy();
    expect(getByText('I build what matters.')).toBeTruthy();
  });

  it('renders the approved add-scene heading and creation action without the oversized Anchor card', () => {
    const { getByText, getByTestId, queryByTestId, queryByText } = render(<VisionMomentInput {...defaultProps} mode="add" startPhotoEnabled />);
    expect(getByText('What else do you see?')).toBeTruthy();
    expect(queryByText('Imagine another moment from your future.')).toBeNull();
    expect(queryByText('Describe the moment you want to see')).toBeNull();
    expect(getByText('Create my scene')).toBeTruthy();
    expect(queryByText('Create New Version')).toBeNull();
    expect(queryByTestId('vision-moment-input-anchor')).toBeNull();
    expect(getByTestId('vision-moment-input-references')).toBeTruthy();
    expect(StyleSheet.flatten(getByText('What else do you see?').props.style)).toEqual(expect.objectContaining({ fontSize: 34, lineHeight: 37, textAlign: 'left' }));
    if (__DEV__) expect(getByTestId('dev-image-model-vision')).toBeTruthy();
  });

  it('has no footnote, even with add-scene references present', () => {
    const refs = [{ id: 'a', uri: 'file:///a.jpg', mimeType: 'image/jpeg', role: 'place' as const }];
    const { queryByText } = render(<VisionMomentInput {...defaultProps} mode="add" startPhotoEnabled references={refs} onChangeReferences={jest.fn()} />);
    expect(queryByText('Tap a photo to replace or remove it')).toBeNull();
    expect(queryByText('You’ll choose what belongs in your Vision.')).toBeNull();
  });

  it('uses a single compact header row for back and the development model control, with no kicker', () => {
    const { getByLabelText, getByTestId, queryByText } = render(<VisionMomentInput {...defaultProps} mode="add" startPhotoEnabled />);
    expect(getByLabelText('Go back')).toBeTruthy();
    expect(queryByText('ADD TO YOUR VISION')).toBeNull();
    if (__DEV__) expect(getByTestId('dev-image-model-vision')).toBeTruthy();
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

  it('keeps the spark row visible after text is written, with no toggle, and appends on a new line', () => {
    const text = 'I open the doors to my own quiet studio.';
    const { getByTestId, getByLabelText, queryByTestId, queryByText } = render(<VisionMomentInput {...defaultProps} />);
    fireEvent.changeText(getByTestId('vision-prompt-input'), text);
    expect(queryByText('Need a spark?')).toBeNull();
    expect(queryByTestId('vision-moment-input-suggestions-toggle')).toBeNull();
    fireEvent.press(getByLabelText('An ordinary morning after'));
    expect(getByTestId('vision-prompt-input').props.value).toBe(`${text}\nAn ordinary morning after`);
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

  it('shows the mini gallery while typing with the keyboard open and keeps the spark row', () => {
    const { getByTestId, getByText, getByLabelText } = render(
      <VisionMomentInput {...defaultProps} startPhotoEnabled />,
    );
    fireEvent(getByTestId('vision-prompt-input'), 'focus');

    expect(getByText('0 references attached')).toBeTruthy();
    expect(getByLabelText('Add reference photo')).toBeTruthy();
    expect(getByLabelText('The day it happens')).toBeTruthy();
  });

  it('expands the gallery and suggestions when Android hides the keyboard without blurring the field', () => {
    const listeners = new Map<string, (...args: never[]) => void>();
    const addListener = jest.spyOn(Keyboard, 'addListener').mockImplementation((event, listener) => {
      listeners.set(event, listener as (...args: never[]) => void);
      return { remove: jest.fn() };
    });
    const references = [{ id: 'place-1', uri: 'file:///place.jpg', mimeType: 'image/jpeg', role: 'place' as const }];
    const view = render(
      <VisionMomentInput {...defaultProps} startPhotoEnabled references={references} onChangeReferences={jest.fn()} />,
    );
    const input = view.getByTestId('vision-prompt-input');

    fireEvent(input, 'focus');
    expect(view.getByText('1 reference attached')).toBeTruthy();
    expect(view.queryByText('Photos to work from')).toBeNull();

    act(() => listeners.get('keyboardDidHide')?.());
    expect(view.getByText('Photos to work from')).toBeTruthy();
    expect(view.getByLabelText('The day it happens')).toBeTruthy();
    expect(view.queryByText('1 reference attached')).toBeNull();

    act(() => listeners.get('keyboardDidShow')?.());
    expect(view.getByText('1 reference attached')).toBeTruthy();
    expect(view.queryByText('Photos to work from')).toBeNull();

    view.unmount();
    addListener.mockRestore();
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

  it('opens the own-photo sheet from one link under the CTA when onAddPhotos is supplied', () => {
    jest.useFakeTimers();
    const onAddPhotos = jest.fn();
    const { getByTestId, getByText, queryByText } = render(
      <VisionMomentInput {...defaultProps} onAddPhotos={onAddPhotos} />,
    );
    expect(queryByText('Use my own photos')).toBeNull();
    fireEvent.press(getByText('Use a photo I already have'));
    fireEvent.press(getByTestId('vision-add-photos'));
    act(() => { jest.advanceTimersByTime(400); });
    expect(onAddPhotos).toHaveBeenLastCalledWith('library');
    fireEvent.press(getByTestId('vision-own-photo-link'));
    fireEvent.press(getByTestId('vision-add-camera'));
    act(() => { jest.advanceTimersByTime(400); });
    expect(onAddPhotos).toHaveBeenLastCalledWith('camera');
    jest.useRealTimers();
  });
});
