# IMPLEMENTATION PLAN: Gemini 3 Pro Image (Nano Banana) Integration

## Priority: TOP PRIORITY
**Status**: Not Yet Implemented  
**Reason**: Current solutions (Imagen, Replicate) are not providing the required quality/structural preservation

---

## Problem Statement
The current image generation solutions are not meeting requirements:
- **Imagen 3**: Uses `generateImages` API but lacks advanced structural preservation
- **Replicate ControlNet**: Slow, external dependency, inconsistent results
- **Need**: Gemini 3 Pro Image (Nano Banana) for superior quality, speed, and structural control

---

## Key Difference: Nano Banana Uses Different API

### Current Implementation (Imagen)
```typescript
// Uses generateImages API
const response = await client.models.generateImages({
  model: 'imagen-3.0-generate-001',
  prompt: 'text prompt',
  config: { numberOfImages: 1 }
});
```

### Required for Nano Banana
```typescript
// Uses generateContent API with image output
const response = await client.models.generateContent({
  model: 'gemini-3-pro-image-preview',
  contents: [
    {
      role: 'user',
      parts: [
        { text: 'Generate an image: watercolor sigil...' },
        { 
          inlineData: {
            mimeType: 'image/png',
            data: base64Image // Reference image for structural preservation
          }
        }
      ]
    }
  ],
  config: {
    // Image generation config
    responseModalities: ['IMAGE'],
    imageConfig: {
      aspectRatio: '1:1',
      numberOfImages: 1
    }
  }
});
```

---

## Implementation Steps

### Step 1: Research Nano Banana API Structure
**File**: `backend/src/scripts/testNanoBananaAPI.ts`

**Action**: Create a test script to understand the exact API structure

```typescript
import { GoogleGenAI } from '@google/genai';

async function testNanoBanana() {
  const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  
  // Test 1: Simple text-to-image
  const response1 = await client.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents: 'Generate a simple geometric circle',
    config: {
      responseModalities: ['IMAGE']
    }
  });
  
  console.log('Response structure:', JSON.stringify(response1, null, 2));
  
  // Test 2: With reference image
  const testImage = Buffer.from('...').toString('base64');
  const response2 = await client.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents: [
      {
        role: 'user',
        parts: [
          { text: 'Transform this image into watercolor style' },
          { inlineData: { mimeType: 'image/png', data: testImage } }
        ]
      }
    ],
    config: {
      responseModalities: ['IMAGE']
    }
  });
  
  console.log('With reference:', JSON.stringify(response2, null, 2));
}
```

**Expected Output**: 
- Understand response structure
- Confirm how to extract generated images
- Verify reference image handling

---

### Step 2: Update GeminiImageService for Nano Banana
**File**: `backend/src/services/GeminiImageService.ts`

**Changes Required**:

1. **Add new method for Nano Banana**:
```typescript
private async generateVariationWithNanoBanana(
  baseImageBuffer: Buffer,
  prompt: string,
  variationIndex: number,
  modelConfig: ModelConfig
): Promise<ImageVariation> {
  const base64Image = baseImageBuffer.toString('base64');
  
  const response = await this.client.models.generateContent({
    model: modelConfig.modelId, // 'gemini-3-pro-image-preview'
    contents: [
      {
        role: 'user',
        parts: [
          { 
            text: `${prompt}\n\nPreserve the exact geometric structure and lines of the reference image.` 
          },
          { 
            inlineData: {
              mimeType: 'image/png',
              data: base64Image
            }
          }
        ]
      }
    ],
    config: {
      responseModalities: ['IMAGE'],
      imageConfig: {
        aspectRatio: '1:1',
        numberOfImages: 1
      },
      // Optional: Add thinking mode for better reasoning
      thinkingConfig: {
        includeThoughts: false,
        thinkingLevel: 'MEDIUM'
      }
    }
  });
  
  // Extract image from response
  // TODO: Determine exact path after Step 1
  const imageData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  
  if (!imageData) {
    throw new GeminiError(
      GeminiErrorType.INVALID_IMAGE,
      'No image data in Nano Banana response'
    );
  }
  
  return {
    base64: imageData,
    seed: Math.floor(Math.random() * 1000000),
    variationIndex: variationIndex + 1
  };
}
```

2. **Update model configs**:
```typescript
const MODEL_CONFIGS: Record<QualityTier, ModelConfig> = {
  draft: {
    modelId: 'gemini-3-pro-image-preview',
    displayName: 'Gemini 3 Pro Image (Nano Banana - Draft)',
    costPerImage: 0.02,
    estimatedTimeSeconds: 4,
    useNanoBananaAPI: true // Flag to use generateContent instead of generateImages
  },
  premium: {
    modelId: 'gemini-3-pro-image-preview',
    displayName: 'Gemini 3 Pro Image (Nano Banana - Premium)',
    costPerImage: 0.04,
    estimatedTimeSeconds: 5,
    useNanoBananaAPI: true
  }
};
```

3. **Update generateVariation to route correctly**:
```typescript
private async generateVariation(...): Promise<ImageVariation> {
  if (modelConfig.useNanoBananaAPI) {
    return this.generateVariationWithNanoBanana(
      baseImageBuffer,
      prompt,
      variationIndex,
      modelConfig,
      retryCount
    );
  } else {
    // Existing Imagen logic
    return this.generateVariationWithImagen(...);
  }
}
```

---

### Step 3: Handle Multiple Reference Images (Advanced)
**Optional Enhancement**: Nano Banana supports up to 14 reference images

```typescript
// For even better structural preservation
contents: [
  {
    role: 'user',
    parts: [
      { text: prompt },
      // Original sigil
      { inlineData: { mimeType: 'image/png', data: sigilImage } },
      // Optional: Edge map for extra control
      { inlineData: { mimeType: 'image/png', data: edgeMapImage } }
    ]
  }
]
```

---

### Step 4: Update Error Handling
**File**: `backend/src/services/GeminiImageService.ts`

Add specific error handling for Nano Banana:
```typescript
private parseNanoBananaError(error: any): GeminiError {
  const message = error?.message || '';
  
  if (message.includes('billing')) {
    return new GeminiError(
      GeminiErrorType.INVALID_API_KEY,
      'Billing not enabled for Gemini 3 Pro Image. Enable billing in Google Cloud Console.',
      false
    );
  }
  
  if (message.includes('quota')) {
    return new GeminiError(
      GeminiErrorType.RATE_LIMIT,
      'Quota exceeded for Gemini 3 Pro Image',
      true,
      60000
    );
  }
  
  // ... other error cases
}
```

---

### Step 5: Testing & Validation

1. **Unit Test**: Test Nano Banana API directly
   ```bash
   npx ts-node src/scripts/testNanoBananaAPI.ts
   ```

2. **Integration Test**: Test through GeminiImageService
   ```bash
   npx ts-node src/scripts/testGeminiDirect.ts
   ```

3. **End-to-End Test**: Test through API endpoint
   ```bash
   curl -X POST http://localhost:8000/api/ai/enhance-controlnet \
     -H "Content-Type: application/json" \
     -d '{"sigilSvg": "...", "styleChoice": "watercolor", "tier": "draft"}'
   ```

4. **Mobile App Test**: Generate sigil from mobile app

---

## Expected Benefits of Nano Banana

1. **Speed**: 3-5 seconds (vs 8-10 for Imagen, 30-60 for Replicate)
2. **Quality**: Native 4K support, better text rendering
3. **Structural Preservation**: Advanced reasoning with "thinking mode"
4. **Consistency**: Better character/object consistency across variations
5. **Cost**: Similar to Imagen (~$0.02-0.04 per image)

---

## Potential Blockers

1. **Billing**: Gemini 3 billing started Jan 5, 2026 - ensure API key has billing enabled
2. **API Access**: Verify API key has access to `gemini-3-pro-image-preview` model
3. **Response Format**: May need to adjust based on actual API response structure
4. **SDK Types**: TypeScript types may not be fully updated for Nano Banana

---

## Rollback Plan

If Nano Banana doesn't work:
1. Keep current Imagen 3 implementation as fallback
2. System will automatically fall back to Replicate if both fail
3. No breaking changes to existing functionality

---

## Timeline Estimate

- **Step 1 (Research)**: 30 minutes
- **Step 2 (Implementation)**: 1-2 hours
- **Step 3 (Advanced features)**: 1 hour (optional)
- **Step 4 (Error handling)**: 30 minutes
- **Step 5 (Testing)**: 1 hour

**Total**: 3-5 hours for full implementation

---

## Next Immediate Action

Run Step 1 to understand the exact API structure:
```bash
cd backend
npx ts-node src/scripts/testNanoBananaAPI.ts
```

This will reveal the exact response format and confirm the API works with your key.
