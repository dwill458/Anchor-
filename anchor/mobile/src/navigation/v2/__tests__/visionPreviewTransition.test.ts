import { visionPreviewScreenOptions } from '../visionPreviewTransition';
import { V2_REDUCED_MOTION_TRANSITION_MS } from '../transitions';

describe('Vision preview navigation', () => {
  it('uses a native dissolve in the requested duration range with an opaque destination', () => {
    const options = visionPreviewScreenOptions(false);
    expect(options.animation).toBe('fade');
    expect(options.animationDuration).toBeGreaterThanOrEqual(450);
    expect(options.animationDuration).toBeLessThanOrEqual(650);
    expect(options.contentStyle).toEqual(expect.objectContaining({ backgroundColor: expect.any(String) }));
  });
  it('shortens the dissolve for reduced motion without spatial travel', () => {
    expect(visionPreviewScreenOptions(true)).toEqual(expect.objectContaining({
      animation: 'fade', animationDuration: V2_REDUCED_MOTION_TRANSITION_MS,
    }));
  });
});
