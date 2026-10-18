describe('speechRecognition without the native module', () => {
  it('loads without throwing and reports no module, so the microphone can hide', () => {
    jest.isolateModules(() => {
      jest.doMock('expo-speech-recognition', () => { throw new Error("Cannot find native module 'ExpoSpeechRecognition'"); });
      const mod = require('../speechRecognition');
      expect(mod.speechModule).toBeNull();
      expect(() => mod.useSpeechEvent('start', () => {})).not.toThrow();
    });
  });

  it('exposes the module when the build includes it', () => {
    jest.isolateModules(() => {
      const fake = { isRecognitionAvailable: jest.fn() };
      jest.doMock('expo-speech-recognition', () => ({ ExpoSpeechRecognitionModule: fake, useSpeechRecognitionEvent: jest.fn() }));
      expect(require('../speechRecognition').speechModule).toBe(fake);
    });
  });
});
