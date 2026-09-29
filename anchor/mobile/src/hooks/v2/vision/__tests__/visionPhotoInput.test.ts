import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { pickVisionPhoto, uploadVisionPhoto } from '../visionPhotoInput';

jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));
jest.mock('expo-file-system/legacy', () => ({
  getInfoAsync: jest.fn(),
  readAsStringAsync: jest.fn(),
  EncodingType: { Base64: 'base64' },
}));

const picker = ImagePicker as jest.Mocked<typeof ImagePicker>;
const granted = { status: 'granted', canAskAgain: true } as never;

describe('pickVisionPhoto', () => {
  const originalOS = Platform.OS;
  beforeEach(() => {
    jest.clearAllMocks();
    Platform.OS = 'ios';
  });
  afterAll(() => { Platform.OS = originalOS; });

  it('takes a photo with the camera and marks it as such', async () => {
    picker.requestCameraPermissionsAsync.mockResolvedValue(granted);
    picker.launchCameraAsync.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///cam.jpg', mimeType: 'image/jpeg' }] } as never);
    const result = await pickVisionPhoto('camera');
    expect(result).toEqual({ status: 'picked', photo: { uri: 'file:///cam.jpg', mimeType: 'image/jpeg', sourceType: 'USER_CAMERA' } });
    expect(picker.launchImageLibraryAsync).not.toHaveBeenCalled();
  });

  it('chooses one library photo, one at a time', async () => {
    picker.requestMediaLibraryPermissionsAsync.mockResolvedValue(granted);
    picker.launchImageLibraryAsync.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///pic.png', mimeType: 'image/png' }] } as never);
    const result = await pickVisionPhoto('library');
    expect(result).toEqual({ status: 'picked', photo: { uri: 'file:///pic.png', mimeType: 'image/png', sourceType: 'USER_UPLOAD' } });
    expect(picker.launchImageLibraryAsync).toHaveBeenCalledWith(expect.not.objectContaining({ allowsMultipleSelection: true }));
  });

  it('explains a refused camera permission and says whether asking again can work', async () => {
    picker.requestCameraPermissionsAsync.mockResolvedValue({ status: 'denied', canAskAgain: false } as never);
    const result = await pickVisionPhoto('camera');
    expect(result).toEqual({ status: 'denied', canAskAgain: false, message: 'Allow camera access to take a photo for your Vision.' });
    expect(picker.launchCameraAsync).not.toHaveBeenCalled();
  });

  it('asks for no library permission on Android, whose system picker needs none', async () => {
    Platform.OS = 'android';
    picker.launchImageLibraryAsync.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///pic.jpg' }] } as never);
    const result = await pickVisionPhoto('library');
    expect(picker.requestMediaLibraryPermissionsAsync).not.toHaveBeenCalled();
    // A missing mime type is read from the file name.
    expect(result).toEqual(expect.objectContaining({ status: 'picked', photo: expect.objectContaining({ mimeType: 'image/jpeg' }) }));
  });

  it('treats backing out as nothing having happened', async () => {
    picker.requestCameraPermissionsAsync.mockResolvedValue(granted);
    picker.launchCameraAsync.mockResolvedValue({ canceled: true, assets: null } as never);
    expect(await pickVisionPhoto('camera')).toEqual({ status: 'cancelled' });
  });

  it('refuses formats the Vision cannot store, and survives a camera that is missing', async () => {
    picker.requestMediaLibraryPermissionsAsync.mockResolvedValue(granted);
    picker.launchImageLibraryAsync.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///pic.heic', mimeType: 'image/heic' }] } as never);
    expect(await pickVisionPhoto('library')).toEqual({ status: 'error', message: 'Choose a JPEG, PNG, WebP, or GIF image.' });
    picker.requestCameraPermissionsAsync.mockResolvedValue(granted);
    picker.launchCameraAsync.mockRejectedValue(new Error('no camera'));
    expect(await pickVisionPhoto('camera')).toEqual({ status: 'error', message: 'The camera is not available right now.' });
  });
});

describe('uploadVisionPhoto', () => {
  beforeEach(() => jest.clearAllMocks());

  it('uploads the confirmed photo once and returns its asset', async () => {
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });
    (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue('QUJD');
    const uploadAsset = jest.fn().mockResolvedValue({ ok: true, asset: { id: 'asset-9' } });
    const result = await uploadVisionPhoto({ uri: 'file:///cam.jpg', mimeType: 'image/jpeg' }, uploadAsset);
    expect(result).toEqual({ ok: true, assetId: 'asset-9' });
    expect(uploadAsset).toHaveBeenCalledTimes(1);
    expect(uploadAsset).toHaveBeenCalledWith({ base64Image: 'data:image/jpeg;base64,QUJD', mimeType: 'image/jpeg' });
  });

  it('reports a vanished file or a failed upload without throwing', async () => {
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValueOnce({ exists: false });
    const uploadAsset = jest.fn();
    expect(await uploadVisionPhoto({ uri: 'file:///gone.jpg', mimeType: 'image/jpeg' }, uploadAsset)).toEqual({
      ok: false, message: 'That photo is no longer available. Choose it again.',
    });
    expect(uploadAsset).not.toHaveBeenCalled();
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });
    (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue('QUJD');
    uploadAsset.mockResolvedValue({ ok: false, message: 'Too large' });
    expect(await uploadVisionPhoto({ uri: 'file:///big.jpg', mimeType: 'image/jpeg' }, uploadAsset)).toEqual({ ok: false, message: 'Too large' });
  });
});
