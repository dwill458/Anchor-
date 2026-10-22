import sharp from 'sharp';
import { expandPhotoToVision, planPhotoExpansion, PhotoExpandError, VISION_EXPAND_PROMPT, type ExpandProvider } from '../visionPhotoExpand';

const solid = (width: number, height: number, color: string) =>
  sharp({ create: { width, height, channels: 3, background: color } }).png().toBuffer();

const pixel = async (buffer: Buffer, x: number, y: number) => {
  const { data, info } = await sharp(buffer).raw().toBuffer({ resolveWithObject: true });
  const i = (y * info.width + x) * info.channels;
  return [data[i], data[i + 1], data[i + 2]];
};

describe('planPhotoExpansion', () => {
  it('pads a square photo vertically and a tall one sideways, centred', () => {
    expect(planPhotoExpansion(1000, 1000)).toEqual({ canvas: { width: 1000, height: 1778 }, offset: { x: 0, y: 389 } });
    const tall = planPhotoExpansion(500, 1600)!;
    expect(tall.canvas.height).toBe(1600);
    expect(tall.canvas.width).toBe(900);
  });
  it('declines photos that already fit, or would be mostly invented, or are invalid', () => {
    expect(planPhotoExpansion(1080, 1920)).toBeNull();
    expect(planPhotoExpansion(4000, 1000)).toBeNull();
    expect(planPhotoExpansion(0, 10)).toBeNull();
  });
});

describe('expandPhotoToVision', () => {
  it('asks the provider to fill only a gray canvas that holds the untouched photo', async () => {
    const original = await solid(400, 400, '#ff0000');
    const calls: Array<{ prompt: string; canvas: Buffer }> = [];
    const provider: ExpandProvider = {
      extendVisionPhoto: async (prompt, canvas) => { calls.push({ prompt, canvas: canvas.buffer }); return solid(450, 800, '#0000ff'); },
    };
    await expandPhotoToVision(original, provider);
    expect(calls).toHaveLength(1);
    expect(calls[0].prompt).toBe(VISION_EXPAND_PROMPT);
    expect(calls[0].prompt).toMatch(/Paint ONLY the flat gray areas/);
    const meta = await sharp(calls[0].canvas).metadata();
    expect(meta.width! / meta.height!).toBeCloseTo(9 / 16, 2);
    expect(await pixel(calls[0].canvas, 200, 10)).toEqual([128, 128, 128]);
    expect(await pixel(calls[0].canvas, 200, 400)).toEqual([255, 0, 0]);
  });

  it('keeps the original photo in the result and takes only the surroundings from the model', async () => {
    const original = await solid(400, 400, '#ff0000');
    const provider: ExpandProvider = { extendVisionPhoto: async () => solid(450, 800, '#0000ff') };
    const { image, width, height } = await expandPhotoToVision(original, provider);
    expect(width / height).toBeCloseTo(9 / 16, 2);
    const meta = await sharp(image).metadata();
    expect(meta.format).toBe('jpeg');
    const [r, , b] = await pixel(image, Math.floor(width / 2), Math.floor(height / 2));
    expect(r).toBeGreaterThan(240); expect(b).toBeLessThan(20);
    const [r2, , b2] = await pixel(image, Math.floor(width / 2), 5);
    expect(b2).toBeGreaterThan(240); expect(r2).toBeLessThan(20);
  });

  it('refuses photos that fit or are too wide, and never calls the provider for them', async () => {
    const provider: ExpandProvider = { extendVisionPhoto: jest.fn() };
    await expect(expandPhotoToVision(await solid(540, 960, '#00ff00'), provider)).rejects.toMatchObject({ code: 'NOT_NEEDED' });
    await expect(expandPhotoToVision(await solid(2000, 400, '#00ff00'), provider)).rejects.toMatchObject({ code: 'TOO_WIDE' });
    await expect(expandPhotoToVision(Buffer.from('not an image'), provider)).rejects.toBeInstanceOf(PhotoExpandError);
    expect(provider.extendVisionPhoto).not.toHaveBeenCalled();
  });

  it('propagates provider failures so the route can report them (nothing is stored either way)', async () => {
    const provider: ExpandProvider = { extendVisionPhoto: async () => { throw new Error('provider down'); } };
    await expect(expandPhotoToVision(await solid(400, 400, '#ff0000'), provider)).rejects.toThrow('provider down');
  });
});
