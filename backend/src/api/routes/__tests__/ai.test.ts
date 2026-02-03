import express from 'express';
import request from 'supertest';
import aiRoutes from '../ai';

import {
  enhanceSigilWithAI,
  enhanceSigilWithControlNet,
  getCostEstimate,
  estimateControlNetGenerationTime,
} from '../../../services/AIEnhancer';
import { uploadImageFromUrl } from '../../../services/StorageService';
import {
  generateAllMantraAudio,
  isTTSAvailable,
  getAvailableVoicePresets,
} from '../../../services/TTSService';
import { generateMantra, getRecommendedMantraStyle } from '../../../services/MantraGenerator';

jest.mock('../../../services/AIEnhancer', () => ({
  enhanceSigilWithAI: jest.fn(),
  enhanceSigilWithControlNet: jest.fn(),
  getCostEstimate: jest.fn(),
  estimateControlNetGenerationTime: jest.fn(),
}));
jest.mock('../../../services/StorageService', () => ({
  uploadImageFromUrl: jest.fn(),
}));
jest.mock('../../../services/TTSService', () => ({
  generateAllMantraAudio: jest.fn(),
  isTTSAvailable: jest.fn(),
  getAvailableVoicePresets: jest.fn(),
}));
jest.mock('../../../services/MantraGenerator', () => ({
  generateMantra: jest.fn(),
  getRecommendedMantraStyle: jest.fn(),
}));
jest.mock('../../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const app = express();
app.use(express.json());
app.use('/api/ai', aiRoutes);

describe('AI routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects enhance-controlnet when required fields are missing', async () => {
    const response = await request(app)
      .post('/api/ai/enhance-controlnet')
      .send({ styleChoice: 'watercolor' });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Missing required fields');
  });

  it('rejects invalid style choices', async () => {
    const response = await request(app)
      .post('/api/ai/enhance-controlnet')
      .send({
        sigilSvg: '<svg/>',
        styleChoice: 'invalid',
        userId: 'user-1',
        anchorId: 'anchor-1',
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Invalid styleChoice');
  });

  it('enhances sigil and uploads variations', async () => {
    (enhanceSigilWithAI as jest.Mock).mockResolvedValue({
      variations: [
        {
          imageUrl: 'https://temp.example.com/1.png',
          structureMatch: {
            combinedScore: 0.9,
            iouScore: 0.92,
            edgeOverlapScore: 0.88,
            structurePreserved: true,
            classification: 'Structure Preserved',
          },
          seed: 123,
          wasComposited: false,
        },
        {
          imageUrl: 'https://temp.example.com/2.png',
          structureMatch: {
            combinedScore: 0.8,
            iouScore: 0.85,
            edgeOverlapScore: 0.75,
            structurePreserved: true,
            classification: 'Structure Preserved',
          },
          seed: 456,
          wasComposited: false,
        },
      ],
      variationUrls: ['https://temp.example.com/1.png', 'https://temp.example.com/2.png'],
      prompt: 'prompt',
      negativePrompt: 'negative',
      model: 'gemini-3-pro-image-preview',
      controlMethod: 'lineart',
      styleApplied: 'watercolor',
      generationTime: 12,
      structureThreshold: 0.85,
      passingCount: 2,
      bestVariationIndex: 0,
    });
    (uploadImageFromUrl as jest.Mock)
      .mockResolvedValueOnce('https://cdn.example.com/1.png')
      .mockResolvedValueOnce('https://cdn.example.com/2.png');

    const response = await request(app)
      .post('/api/ai/enhance-controlnet')
      .send({
        sigilSvg: '<svg/>',
        styleChoice: 'watercolor',
        userId: 'user-1',
        anchorId: 'anchor-1',
        provider: 'auto',
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.variations).toHaveLength(2);
    expect(response.body.provider).toBe('gemini');
    expect(uploadImageFromUrl).toHaveBeenCalledTimes(2);
  });

  it('routes replicate provider to ControlNet path', async () => {
    (enhanceSigilWithControlNet as jest.Mock).mockResolvedValue({
      variations: [
        {
          imageUrl: 'https://temp.example.com/1.png',
          structureMatch: {
            combinedScore: 0.9,
            iouScore: 0.92,
            edgeOverlapScore: 0.88,
            structurePreserved: true,
            classification: 'Structure Preserved',
          },
          seed: 123,
          wasComposited: false,
        },
      ],
      variationUrls: ['https://temp.example.com/1.png'],
      prompt: 'prompt',
      negativePrompt: 'negative',
      model: 'controlnet-canny',
      controlMethod: 'canny',
      styleApplied: 'minimal_line',
      generationTime: 10,
      structureThreshold: 0.85,
      passingCount: 1,
      bestVariationIndex: 0,
    });
    (uploadImageFromUrl as jest.Mock).mockResolvedValue('https://cdn.example.com/1.png');

    const response = await request(app)
      .post('/api/ai/enhance-controlnet')
      .send({
        sigilSvg: '<svg/>',
        styleChoice: 'minimal_line',
        userId: 'user-1',
        anchorId: 'anchor-1',
        provider: 'replicate',
      });

    expect(response.status).toBe(200);
    expect(enhanceSigilWithControlNet).toHaveBeenCalled();
    expect(response.body.provider).toBe('replicate');
  });

  it('validates mantra request', async () => {
    const response = await request(app)
      .post('/api/ai/mantra')
      .send({ distilledLetters: 'not-array' });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('distilledLetters array is required');
  });

  it('generates mantras and recommendations', async () => {
    (generateMantra as jest.Mock).mockReturnValue({
      syllabic: 'CL-OS',
      rhythmic: 'CLO / S',
      letterByLetter: 'SEE ELL OH ESS',
      phonetic: 'klo-suh',
    });
    (getRecommendedMantraStyle as jest.Mock).mockReturnValue('phonetic');

    const response = await request(app)
      .post('/api/ai/mantra')
      .send({ distilledLetters: ['C', 'L', 'O', 'S'] });

    expect(response.status).toBe(200);
    expect(response.body.mantra.syllabic).toBe('CL-OS');
    expect(response.body.recommended).toBe('phonetic');
  });

  it('returns 400 when audio payload is missing', async () => {
    const response = await request(app)
      .post('/api/ai/mantra/audio')
      .send({ userId: 'user-1' });

    expect(response.status).toBe(400);
  });

  it('returns 503 when TTS is unavailable', async () => {
    (isTTSAvailable as jest.Mock).mockReturnValue(false);

    const response = await request(app)
      .post('/api/ai/mantra/audio')
      .send({
        mantras: { syllabic: 'OM', rhythmic: 'OM', phonetic: 'om' },
        userId: 'user-1',
        anchorId: 'anchor-1',
      });

    expect(response.status).toBe(503);
    expect(response.body.error).toContain('Text-to-Speech service not configured');
  });

  it('generates mantra audio when TTS is available', async () => {
    (isTTSAvailable as jest.Mock).mockReturnValue(true);
    (generateAllMantraAudio as jest.Mock).mockResolvedValue({
      syllabic: 'https://audio.example.com/1.mp3',
      rhythmic: 'https://audio.example.com/2.mp3',
      phonetic: 'https://audio.example.com/3.mp3',
    });

    const response = await request(app)
      .post('/api/ai/mantra/audio')
      .send({
        mantras: { syllabic: 'OM', rhythmic: 'OM', phonetic: 'om' },
        userId: 'user-1',
        anchorId: 'anchor-1',
      });

    expect(response.status).toBe(200);
    expect(response.body.audioUrls.syllabic).toContain('audio.example.com');
  });

  it('returns available voices and availability status', async () => {
    (getAvailableVoicePresets as jest.Mock).mockReturnValue([
      { id: 'neutral_calm', name: 'Calm Neutral', description: 'desc' },
    ]);
    (isTTSAvailable as jest.Mock).mockReturnValue(true);

    const response = await request(app).get('/api/ai/voices');

    expect(response.status).toBe(200);
    expect(response.body.voices).toHaveLength(1);
    expect(response.body.available).toBe(true);
  });

  it('returns estimate data', async () => {
    (estimateControlNetGenerationTime as jest.Mock).mockReturnValue({ min: 10, max: 20 });
    (getCostEstimate as jest.Mock).mockReturnValue(0.1);

    const response = await request(app).get('/api/ai/estimate');

    expect(response.status).toBe(200);
    expect(response.body.timeEstimate).toEqual({ min: 10, max: 20 });
    expect(response.body.costEstimate).toBe(0.1);
  });

  it('reports unhealthy services when credentials are missing', async () => {
    delete process.env.REPLICATE_API_TOKEN;
    delete process.env.CLOUDFLARE_ACCOUNT_ID;
    delete process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
    delete process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
    (isTTSAvailable as jest.Mock).mockReturnValue(false);

    const response = await request(app).get('/api/ai/health');

    expect(response.status).toBe(503);
    expect(response.body.success).toBe(false);
    expect(response.body.services.replicate).toBe('missing_token');
  });

  it('reports healthy services when credentials are present', async () => {
    process.env.REPLICATE_API_TOKEN = 'token';
    process.env.CLOUDFLARE_ACCOUNT_ID = 'acct';
    process.env.CLOUDFLARE_R2_ACCESS_KEY_ID = 'key';
    process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY = 'secret';
    (isTTSAvailable as jest.Mock).mockReturnValue(true);

    const response = await request(app).get('/api/ai/health');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.services.storage).toBe('configured');
  });
});
