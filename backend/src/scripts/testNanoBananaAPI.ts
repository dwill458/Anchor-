/**
 * Test script for Gemini 3 Pro Image (Nano Banana) API
 * 
 * This script tests the generateContent API with image generation
 * to understand the exact response structure.
 */

import { GoogleGenAI } from '@google/genai';
import * as fs from 'fs';
import * as path from 'path';

async function testNanoBananaAPI() {
    console.log('🍌 Testing Gemini 3 Pro Image (Nano Banana) API\n');

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

    if (!apiKey) {
        console.error('❌ No API key found. Set GEMINI_API_KEY or GOOGLE_API_KEY in .env');
        process.exit(1);
    }

    console.log('✅ API Key found:', apiKey.substring(0, 10) + '...\n');

    const client = new GoogleGenAI({ apiKey });

    // Test 1: Simple text-to-image
    console.log('📝 Test 1: Simple text-to-image generation');
    console.log('   Prompt: "A simple geometric circle with clean lines"\n');

    try {
        const response1 = await client.models.generateContent({
            model: 'gemini-3-pro-image-preview',
            contents: 'Generate a simple geometric circle with clean lines',
            config: {
                // @ts-ignore - May not be in types yet
                responseModalities: ['IMAGE']
            }
        });

        console.log('✅ Test 1 SUCCESS!');
        console.log('   Response structure:');
        console.log(JSON.stringify(response1, null, 2));
        console.log('\n');

        // Try to extract image
        const imageData = extractImageFromResponse(response1);
        if (imageData) {
            console.log('✅ Image data found! Length:', imageData.length);
            saveImage(imageData, 'test1_simple.png');
        } else {
            console.log('⚠️  Could not find image data in response');
        }

    } catch (error: any) {
        console.error('❌ Test 1 FAILED');
        console.error('   Error:', error.message);
        console.error('   Full error:', error);
        return;
    }

    console.log('\n' + '='.repeat(60) + '\n');

    // Test 2: With reference image
    console.log('📝 Test 2: Image generation with reference image');
    console.log('   Creating a simple test image...\n');

    // Create a simple test image (100x100 white square with black border)
    const testImageSvg = `<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" fill="white"/>
    <circle cx="50" cy="50" r="40" stroke="black" stroke-width="2" fill="none"/>
  </svg>`;

    // Convert SVG to PNG (simplified - in real code use sharp)
    const testImageBase64 = Buffer.from(testImageSvg).toString('base64');

    try {
        const response2 = await client.models.generateContent({
            model: 'gemini-3-pro-image-preview',
            contents: [
                {
                    role: 'user',
                    parts: [
                        {
                            text: 'Transform this geometric design into a beautiful watercolor painting. Preserve the exact circular structure.'
                        },
                        {
                            // @ts-ignore
                            inlineData: {
                                mimeType: 'image/svg+xml',
                                data: testImageBase64
                            }
                        }
                    ]
                }
            ],
            config: {
                // @ts-ignore
                responseModalities: ['IMAGE'],
                // @ts-ignore
                imageConfig: {
                    aspectRatio: '1:1',
                    numberOfImages: 1
                }
            }
        });

        console.log('✅ Test 2 SUCCESS!');
        console.log('   Response structure:');
        console.log(JSON.stringify(response2, null, 2));
        console.log('\n');

        const imageData = extractImageFromResponse(response2);
        if (imageData) {
            console.log('✅ Image data found! Length:', imageData.length);
            saveImage(imageData, 'test2_with_reference.png');
        } else {
            console.log('⚠️  Could not find image data in response');
        }

    } catch (error: any) {
        console.error('❌ Test 2 FAILED');
        console.error('   Error:', error.message);
        console.error('   Full error:', error);
    }

    console.log('\n' + '='.repeat(60) + '\n');
    console.log('🎉 Testing complete!');
    console.log('\nNext steps:');
    console.log('1. Review the response structure above');
    console.log('2. Update GeminiImageService.ts with correct image extraction logic');
    console.log('3. Test with actual sigil images');
}

function extractImageFromResponse(response: any): string | null {
    // Try different possible paths
    const paths = [
        () => response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data,
        () => response.candidates?.[0]?.content?.parts?.[0]?.image?.data,
        () => response.generatedImages?.[0]?.image?.imageBytes,
        () => response.image?.data,
        () => response.data,
    ];

    for (const pathFn of paths) {
        try {
            const data = pathFn();
            if (data && typeof data === 'string') {
                return data;
            }
        } catch (e) {
            // Continue to next path
        }
    }

    return null;
}

function saveImage(base64Data: string, filename: string) {
    try {
        const buffer = Buffer.from(base64Data, 'base64');
        const filepath = path.join(__dirname, '../../uploads', filename);
        fs.writeFileSync(filepath, buffer);
        console.log(`   💾 Saved to: ${filepath}`);
    } catch (error: any) {
        console.error(`   ❌ Failed to save image: ${error.message}`);
    }
}

// Run the test
testNanoBananaAPI().catch(console.error);
