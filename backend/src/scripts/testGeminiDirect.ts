import { GeminiImageService } from '../services/GeminiImageService';
import { logger } from '../utils/logger';

async function testGeminiDirect() {
    console.log('🔍 Testing Gemini 3 Pro Image Service Directly\n');

    const service = new GeminiImageService();

    console.log('✅ Service instantiated');
    console.log('   isAvailable():', service.isAvailable());

    if (!service.isAvailable()) {
        console.log('\n❌ Gemini is NOT available');
        console.log('   Check that GEMINI_API_KEY or GOOGLE_API_KEY is set in .env');
        return;
    }

    console.log('\n✅ Gemini IS available, testing image generation...\n');

    const testSvg = `<svg width="100" height="100" viewBox="0 0 100 100">
    <circle cx="50" cy="50" r="40" stroke="black" stroke-width="2" fill="none"/>
  </svg>`;

    try {
        const result = await service.enhanceSigil({
            baseSigilSvg: testSvg,
            intentionText: 'Test intention',
            styleApproach: 'watercolor',
            numberOfVariations: 1,
            tier: 'draft',
        });

        console.log('✅ SUCCESS!');
        console.log('   Model:', result.model);
        console.log('   Images generated:', result.images.length);
        console.log('   Time:', result.totalTimeSeconds, 'seconds');
        console.log('   Cost:', result.costUSD, 'USD');
        console.log('\n🎉 GEMINI 3 PRO IMAGE (NANO BANANA) IS WORKING!');

    } catch (error: any) {
        console.log('\n❌ GEMINI FAILED');
        console.log('   Error type:', error.type || 'Unknown');
        console.log('   Error message:', error.message);
        console.log('   Full error:', error);
    }
}

testGeminiDirect();
