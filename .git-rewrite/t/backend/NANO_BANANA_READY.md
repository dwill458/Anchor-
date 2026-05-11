# ✅ NANO BANANA (Gemini 3 Pro Image) - READY TO IMPLEMENT

## Status: API TESTED & WORKING ✅

The Nano Banana API test was successful! Images were generated and saved to `uploads/test*.png`.

---

## What We Learned from Testing

### ✅ API Works
- Model ID: `gemini-3-pro-image-preview`
- API Method: `generateContent` (NOT `generateImages`)
- Response includes image data
- Images are successfully generated

### API Structure Confirmed
```typescript
const response = await client.models.generateContent({
  model: 'gemini-3-pro-image-preview',
  contents: 'prompt text' or [{ role: 'user', parts: [...] }],
  config: {
    responseModalities: ['IMAGE'],
    imageConfig: {
      aspectRatio: '1:1'
    }
  }
});
```

---

## NEXT STEPS TO IMPLEMENT

### 1. Update GeminiImageService.ts

Add this method:

```typescript
private async generateVariationWithNanoBanana(
  baseImageBuffer: Buffer,
  prompt: string,
  variationIndex: number,
  modelConfig: ModelConfig,
  retryCount: number = 0
): Promise<ImageVariation> {
  const maxRetries = 3;
  
  try {
    logger.info(`[GeminiImageService] Generating with Nano Banana ${variationIndex + 1}`);
    
    const base64Image = baseImageBuffer.toString('base64');
    
    const response = await this.client.models.generateContent({
      model: modelConfig.modelId,
      contents: [
        {
          role: 'user',
          parts: [
            { 
              text: `${prompt}\\n\\nIMPORTANT: Preserve the exact geometric structure and lines of the reference image.` 
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
          aspectRatio: '1:1'
        }
      }
    });
    
    // Extract image from response
    const imageData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    
    if (!imageData) {
      throw new GeminiError(
        GeminiErrorType.INVALID_IMAGE,
        'No image data in Nano Banana response',
        true
      );
    }
    
    return {
      base64: imageData,
      seed: Math.floor(Math.random() * 1000000),
      variationIndex: variationIndex + 1
    };
    
  } catch (error: any) {
    const geminiError = this.parseError(error);
    
    if (geminiError.retryable && retryCount < maxRetries) {
      const waitTime = geminiError.retryAfterMs || Math.pow(2, retryCount) * 1000;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      return this.generateVariationWithNanoBanana(
        baseImageBuffer,
        prompt,
        variationIndex,
        modelConfig,
        retryCount + 1
      );
    }
    
    logger.error(`[GeminiImageService] Nano Banana failed: ${geminiError.message}`);
    throw geminiError;
  }
}
```

### 2. Update Model Configs

```typescript
const MODEL_CONFIGS: Record<QualityTier, ModelConfig> = {
  draft: {
    modelId: 'gemini-3-pro-image-preview',
    displayName: 'Gemini 3 Pro Image (Nano Banana - Draft)',
    costPerImage: 0.02,
    estimatedTimeSeconds: 4,
    useNanoBanana: true // NEW FLAG
  },
  premium: {
    modelId: 'gemini-3-pro-image-preview',
    displayName: 'Gemini 3 Pro Image (Nano Banana - Premium)',
    costPerImage: 0.04,
    estimatedTimeSeconds: 5,
    useNanoBanana: true // NEW FLAG
  }
};
```

### 3. Update generateVariation Router

```typescript
private async generateVariation(...): Promise<ImageVariation> {
  if (modelConfig.useNanoBanana) {
    return this.generateVariationWithNanoBanana(
      baseImageBuffer,
      prompt,
      variationIndex,
      modelConfig,
      retryCount
    );
  }
  
  // Existing Imagen logic for fallback
  // ...
}
```

### 4. Update ModelConfig Interface

```typescript
interface ModelConfig {
  modelId: string;
  displayName: string;
  costPerImage: number;
  estimatedTimeSeconds: number;
  useNanoBanana?: boolean; // NEW FIELD
}
```

---

## Expected Results

Once implemented:
- ✅ **Speed**: 3-5 seconds per image
- ✅ **Quality**: Native 4K, superior to Imagen
- ✅ **Structural Preservation**: Reference image guides generation
- ✅ **No Black Images**: Confirmed working from test
- ✅ **Cost**: ~$0.02-0.04 per image

---

## Implementation Time

**Estimated**: 30-60 minutes

**Steps**:
1. Add `generateVariationWithNanoBanana` method (15 min)
2. Update model configs (5 min)
3. Add routing logic (10 min)
4. Test with actual sigils (15 min)
5. Debug any issues (15 min)

---

## Files to Modify

1. `backend/src/services/GeminiImageService.ts` - Main implementation
2. Test with mobile app
3. Commit and push

---

## Ready to Proceed?

The API is confirmed working. We just need to integrate it into the existing `GeminiImageService.ts` file.

**Command to start**:
```bash
# Open the file
code backend/src/services/GeminiImageService.ts

# Follow the steps above to add Nano Banana support
```
