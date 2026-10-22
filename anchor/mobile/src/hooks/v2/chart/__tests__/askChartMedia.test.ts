const mockManipulate = jest.fn();
jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: (...args: unknown[]) => mockManipulate(...args),
  SaveFormat: { JPEG: 'jpeg' },
}));
const mockSize = jest.fn();
jest.mock('@/hooks/v2/vision/visionPhotoFitProcessing', () => ({ readPhotoSize: (...args: unknown[]) => mockSize(...args) }));

import {
  WAVEFORM_BARS, askDictationDisclosure, composeDictated, createTranscript, formatElapsed, levelFromVolume, pushLevel, resolveDictationEnd,
} from '../askChartDictation';
import {
  ASK_PHOTO_EDGE, MAX_ASK_ATTACHMENTS, attachmentsReducer, prepareAskPhoto, summarizeAttachments, type AskAttachment,
} from '../askChartPhoto';

describe('createTranscript', () => {
  it('keeps final segments and shows the latest interim one after them', () => {
    const t = createTranscript();
    t.push('the rust', false);
    expect(t.text()).toBe('the rust');
    t.push('the rust is on the rear quarter', false);
    expect(t.text()).toBe('the rust is on the rear quarter');
    t.push('the rust is on the rear quarter panel', true);
    t.push('and the hood', false);
    expect(t.text()).toBe('the rust is on the rear quarter panel and the hood');
    t.push('and the hood too', true);
    expect(t.text()).toBe('the rust is on the rear quarter panel and the hood too');
  });

  it('normalises whitespace, ignores empty finals and resets', () => {
    const t = createTranscript();
    t.push('  a   b ', true);
    t.push('', true);
    expect(t.text()).toBe('a b');
    t.reset();
    expect(t.text()).toBe('');
  });
});

describe('levels', () => {
  it('maps the recogniser range to 0..1, hiding inaudible input and keeping quiet speech visible', () => {
    expect(levelFromVolume(-2)).toBe(0);
    expect(levelFromVolume(0)).toBe(0);
    expect(levelFromVolume(10)).toBe(1);
    expect(levelFromVolume(25)).toBe(1);
    expect(levelFromVolume(2)).toBeGreaterThan(0.2);
    expect(levelFromVolume(undefined)).toBe(0);
    expect(levelFromVolume(Number.NaN)).toBe(0);
  });

  it('keeps a fixed-length history with the newest on the right', () => {
    let levels: number[] = Array(WAVEFORM_BARS).fill(0);
    levels = pushLevel(levels, 0.5);
    levels = pushLevel(levels, 0.9);
    expect(levels).toHaveLength(WAVEFORM_BARS);
    expect(levels.slice(-2)).toEqual([0.5, 0.9]);
    expect(pushLevel([], 0.3)).toHaveLength(WAVEFORM_BARS);
  });

  it('formats the recording time', () => {
    expect(formatElapsed(0)).toBe('0:00');
    expect(formatElapsed(4200)).toBe('0:04');
    expect(formatElapsed(65_000)).toBe('1:05');
    expect(formatElapsed(-5)).toBe('0:00');
  });
});

describe('dictation outcome', () => {
  it('only a cancel discards; any heard words survive a finish or an interruption', () => {
    expect(resolveDictationEnd('cancel', 'hello')).toBe('discarded');
    expect(resolveDictationEnd('finish', 'hello')).toBe('delivered');
    expect(resolveDictationEnd('interrupted', 'hello')).toBe('delivered');
    expect(resolveDictationEnd(null, 'hello')).toBe('delivered');
    expect(resolveDictationEnd('finish', '   ')).toBe('empty');
  });

  it('adds spoken words after what was typed, within the limit', () => {
    expect(composeDictated('Typed already', 'and spoken', 100)).toBe('Typed already and spoken');
    expect(composeDictated('', 'only spoken', 100)).toBe('only spoken');
    expect(composeDictated('abc', 'defghij', 6)).toBe('abc de');
  });

  it('is honest about where audio can go', () => {
    expect(askDictationDisclosure(true).body).toMatch(/on this device/);
    expect(askDictationDisclosure(false).body).toMatch(/Apple or Google/);
    expect(askDictationDisclosure(false).body).toMatch(/does not keep the audio/);
  });
});

describe('prepareAskPhoto', () => {
  beforeEach(() => {
    mockManipulate.mockReset().mockResolvedValue({ uri: 'file:///cache/out.jpg', base64: 'QUJD' });
    mockSize.mockReset();
  });

  it('shrinks a large landscape or portrait photo to the long-edge cap and returns JPEG base64', async () => {
    mockSize.mockResolvedValueOnce({ width: 4000, height: 3000 });
    const landscape = await prepareAskPhoto('file:///a.jpg');
    expect(mockManipulate.mock.calls[0][1]).toEqual([{ resize: { width: ASK_PHOTO_EDGE } }]);
    expect(landscape).toEqual({ base64Image: 'data:image/jpeg;base64,QUJD', mimeType: 'image/jpeg', uri: 'file:///cache/out.jpg' });
    mockSize.mockResolvedValueOnce({ width: 3000, height: 4000 });
    await prepareAskPhoto('file:///b.jpg');
    expect(mockManipulate.mock.calls[1][1]).toEqual([{ resize: { height: ASK_PHOTO_EDGE } }]);
    expect(mockManipulate.mock.calls[0][2]).toMatchObject({ format: 'jpeg', base64: true });
  });

  it('never enlarges a small photo, and still works when its size cannot be read', async () => {
    mockSize.mockResolvedValueOnce({ width: 800, height: 600 });
    await prepareAskPhoto('file:///small.jpg');
    expect(mockManipulate.mock.calls[0][1]).toEqual([]);
    mockSize.mockResolvedValueOnce(null);
    await prepareAskPhoto('file:///unknown.jpg');
    expect(mockManipulate.mock.calls[1][1]).toEqual([]);
  });

  it('fails clearly when the photo cannot be prepared', async () => {
    mockSize.mockResolvedValue(null);
    mockManipulate.mockResolvedValueOnce({ uri: 'x', base64: undefined });
    await expect(prepareAskPhoto('file:///bad.jpg')).rejects.toThrow('could not be prepared');
  });
});

describe('attachments state', () => {
  const photo = (id: string, over: Partial<AskAttachment> = {}): AskAttachment => ({ id, uri: `file:///${id}.jpg`, status: 'preparing', progress: 0, ...over });

  it('adds up to the limit and no more', () => {
    let state: AskAttachment[] = [];
    for (let i = 0; i < MAX_ASK_ATTACHMENTS + 2; i += 1) state = attachmentsReducer(state, { type: 'add', attachment: photo(`p${i}`) });
    expect(state).toHaveLength(MAX_ASK_ATTACHMENTS);
  });

  it('moves a photo through preparing, uploading with progress, and ready with its asset id', () => {
    let state = attachmentsReducer([], { type: 'add', attachment: photo('a') });
    state = attachmentsReducer(state, { type: 'status', id: 'a', status: 'uploading', progress: 0.4 });
    expect(state[0]).toMatchObject({ status: 'uploading', progress: 0.4 });
    state = attachmentsReducer(state, { type: 'status', id: 'a', status: 'ready', assetId: 'asset-1' });
    expect(state[0]).toMatchObject({ status: 'ready', progress: 1, assetId: 'asset-1', error: undefined });
  });

  it('keeps a failed photo, with its reason, so it can be retried or removed', () => {
    let state = attachmentsReducer([], { type: 'add', attachment: photo('a', { status: 'uploading', progress: 0.7 }) });
    state = attachmentsReducer(state, { type: 'status', id: 'a', status: 'failed', error: 'No connection' });
    expect(state[0]).toMatchObject({ status: 'failed', progress: 0, error: 'No connection', uri: 'file:///a.jpg' });
    state = attachmentsReducer(state, { type: 'status', id: 'a', status: 'preparing', progress: 0 });
    expect(state[0].error).toBeUndefined();
    expect(attachmentsReducer(state, { type: 'remove', id: 'a' })).toEqual([]);
    expect(attachmentsReducer(state, { type: 'clear' })).toEqual([]);
  });

  it('only lets a message go when nothing is pending or failed, and sends only uploaded photo ids', () => {
    const items = [photo('a', { status: 'ready', assetId: 'asset-a' }), photo('b', { status: 'uploading' })];
    expect(summarizeAttachments(items)).toMatchObject({ pending: true, failed: false, readyIds: ['asset-a'], canAdd: true });
    expect(summarizeAttachments([photo('a', { status: 'failed' })])).toMatchObject({ pending: false, failed: true, readyIds: [] });
    expect(summarizeAttachments([photo('a', { status: 'ready', assetId: 'x' }), photo('b', { status: 'ready', assetId: 'y' }), photo('c', { status: 'ready', assetId: 'z' })]).canAdd).toBe(false);
    expect(summarizeAttachments([])).toMatchObject({ pending: false, failed: false, readyIds: [], canAdd: true });
  });
});
