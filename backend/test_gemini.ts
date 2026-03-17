
import dotenv from 'dotenv';
import { GeminiImageService } from './src/services/GeminiImageService';

dotenv.config();

async function test() {
  const service = new GeminiImageService();
  console.log('Is Available:', service.isAvailable());
  
  if (!service.isAvailable()) {
    console.error('Gemini API Key missing');
    process.exit(1);
  }

  const svg = `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" stroke="white" fill="none"/></svg>`;
  
  try {
    console.log('Testing generateVariationWithNanoBanana...');
    const result = await service.enhanceSigil({
        baseSigilSvg: svg,
        intentionText: 'Test peace and calm',
        styleApproach: 'watercolor',
        numberOfVariations: 1,
        tier: 'draft'
    });
    console.log('Success! Generated variations:', result.images.length);
    console.log('Model used:', result.model);
  } catch (error) {
    console.error('Test failed:', error);
  }
}

test();
