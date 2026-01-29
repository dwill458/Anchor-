import axios from 'axios';

async function testGeminiEndpoint() {
    const url = 'http://localhost:8000/api/ai/enhance-controlnet';
    const body = {
        sigilSvg: '<svg width="100" height="100" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" stroke="black" fill="none"/></svg>',
        styleChoice: 'watercolor',
        userId: 'test-user',
        anchorId: 'test-anchor',
        intentionText: 'Peace and calm',
        tier: 'draft',
        provider: 'auto' // Let it auto-select (should use Gemini)
    };

    try {
        console.log('🚀 Testing Gemini/Imagen 4 integration...\n');
        console.log('Sending request to', url);
        const startTime = Date.now();

        const response = await axios.post(url, body);
        const duration = Math.round((Date.now() - startTime) / 1000);

        console.log('\n✅ SUCCESS!');
        console.log('Status:', response.status);
        console.log('Duration:', duration, 'seconds');
        console.log('\nResponse details:');
        console.log('  Provider:', response.data.provider);
        console.log('  Model:', response.data.model);
        console.log('  Style:', response.data.styleApplied);
        console.log('  Variations:', response.data.variations?.length || 0);
        console.log('  Generation time:', response.data.generationTime, 'seconds');

        if (response.data.provider === 'gemini') {
            console.log('\n🎉 GEMINI/IMAGEN 4 IS WORKING!');
        } else {
            console.log('\n⚠️  Using fallback provider:', response.data.provider);
        }

    } catch (err: any) {
        if (err.response) {
            console.error('❌ Error Status:', err.response.status);
            console.error('Error Data:', JSON.stringify(err.response.data, null, 2));
        } else {
            console.error('❌ Error:', err.message);
        }
    }
}

testGeminiEndpoint();
