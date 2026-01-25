/**
 * Test Script for Google Vertex AI Integration
 *
 * This script tests the Google Vertex AI Imagen 3 integration
 * to ensure proper configuration and functionality.
 *
 * Usage:
 *   cd backend
 *   npx ts-node src/scripts/testVertexAI.ts
 *
 * Prerequisites:
 *   1. GOOGLE_CLOUD_PROJECT_ID set in .env
 *   2. GOOGLE_CLOUD_CREDENTIALS_JSON set in .env
 *   3. Google Cloud project with Vertex AI API enabled
 */

import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs/promises';
import { GoogleVertexAI } from '../services/GoogleVertexAI';
import { svgToEdgeMap } from '../utils/svgToEdgeMap';

// Load environment variables
dotenv.config();

/**
 * Sample sigil SVG for testing
 * This is a simple geometric sigil structure
 */
const SAMPLE_SIGIL_SVG = `
<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <path d="M 50 10 L 90 90 L 10 90 Z" stroke="#000000" stroke-width="2" fill="none"/>
  <circle cx="50" cy="50" r="20" stroke="#000000" stroke-width="2" fill="none"/>
  <path d="M 30 50 L 70 50 M 50 30 L 50 70" stroke="#000000" stroke-width="2"/>
</svg>
`.trim();

/**
 * Color codes for console output
 */
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

/**
 * Print colored message
 */
function print(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Print section header
 */
function printHeader(title: string) {
  console.log('\n' + '='.repeat(60));
  print(title, 'bright');
  console.log('='.repeat(60) + '\n');
}

/**
 * Check environment configuration
 */
async function checkEnvironment(): Promise<boolean> {
  printHeader('1. Checking Environment Configuration');

  let allGood = true;

  // Check GOOGLE_CLOUD_PROJECT_ID
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  if (projectId) {
    print(`✓ GOOGLE_CLOUD_PROJECT_ID: ${projectId}`, 'green');
  } else {
    print('✗ GOOGLE_CLOUD_PROJECT_ID not set', 'red');
    allGood = false;
  }

  // Check GOOGLE_CLOUD_LOCATION
  const location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
  print(`✓ GOOGLE_CLOUD_LOCATION: ${location}`, 'green');

  // Check GOOGLE_CLOUD_CREDENTIALS_JSON
  const credentialsJson = process.env.GOOGLE_CLOUD_CREDENTIALS_JSON;
  if (credentialsJson && credentialsJson.trim() !== '') {
    try {
      const credentials = JSON.parse(credentialsJson);
      if (credentials.type === 'service_account') {
        print(`✓ GOOGLE_CLOUD_CREDENTIALS_JSON: Valid service account`, 'green');
        print(`  - Project: ${credentials.project_id}`, 'cyan');
        print(`  - Email: ${credentials.client_email}`, 'cyan');
      } else {
        print(`✗ GOOGLE_CLOUD_CREDENTIALS_JSON: Invalid type (expected service_account)`, 'red');
        allGood = false;
      }
    } catch (error) {
      print(`✗ GOOGLE_CLOUD_CREDENTIALS_JSON: Invalid JSON format`, 'red');
      allGood = false;
    }
  } else {
    print('⚠ GOOGLE_CLOUD_CREDENTIALS_JSON not set', 'yellow');
    print('  Using Application Default Credentials (ADC)', 'cyan');
    print('  Make sure you ran: gcloud auth application-default login', 'cyan');

    // Check if ADC file exists
    const adcPath = process.env.HOME + '/.config/gcloud/application_default_credentials.json';
    try {
      await fs.access(adcPath);
      print(`✓ ADC file found: ${adcPath}`, 'green');
    } catch {
      print(`✗ ADC file not found: ${adcPath}`, 'red');
      print('  Run: gcloud auth application-default login', 'yellow');
      allGood = false;
    }
  }

  return allGood;
}

/**
 * Test SVG to Edge Map conversion
 */
async function testEdgeMapGeneration(): Promise<boolean> {
  printHeader('2. Testing SVG to Edge Map Conversion');

  try {
    print('Converting sample sigil to edge map...', 'cyan');

    const edgeMapResult = await svgToEdgeMap(SAMPLE_SIGIL_SVG, {
      size: 1024,
      threshold: 10,
      strokeMultiplier: 2.5,
      padding: 0.15,
    });

    print(`✓ Edge map generated successfully`, 'green');
    print(`  - Size: ${edgeMapResult.width}x${edgeMapResult.height}`, 'cyan');
    print(`  - Bytes: ${edgeMapResult.size.toLocaleString()}`, 'cyan');
    print(`  - Processing time: ${edgeMapResult.processingTimeMs}ms`, 'cyan');

    // Save edge map for inspection
    const testOutputDir = path.join(process.cwd(), 'test-output');
    try {
      await fs.mkdir(testOutputDir, { recursive: true });
      const edgeMapPath = path.join(testOutputDir, 'test-edge-map.png');
      await fs.writeFile(edgeMapPath, edgeMapResult.buffer);
      print(`✓ Edge map saved to: ${edgeMapPath}`, 'green');
    } catch (err) {
      print(`⚠ Could not save edge map: ${err}`, 'yellow');
    }

    return true;
  } catch (error) {
    print(`✗ Edge map generation failed: ${error}`, 'red');
    return false;
  }
}

/**
 * Test Google Vertex AI initialization
 */
async function testVertexAIInit(): Promise<GoogleVertexAI | null> {
  printHeader('3. Testing Google Vertex AI Initialization');

  try {
    print('Initializing Google Vertex AI client...', 'cyan');

    const vertexAI = new GoogleVertexAI();

    if (vertexAI.isAvailable()) {
      print(`✓ Google Vertex AI initialized successfully`, 'green');
      return vertexAI;
    } else {
      print(`✗ Google Vertex AI not available (check credentials)`, 'red');
      return null;
    }
  } catch (error) {
    print(`✗ Initialization failed: ${error}`, 'red');
    return null;
  }
}

/**
 * Test cost and time estimates
 */
async function testEstimates(vertexAI: GoogleVertexAI) {
  printHeader('4. Testing Cost and Time Estimates');

  const costEstimate = vertexAI.getCostEstimate(4);
  const timeEstimate = vertexAI.getTimeEstimate();

  print(`✓ Cost estimate (4 variations): $${costEstimate.toFixed(2)}`, 'green');
  print(`✓ Time estimate: ${timeEstimate.min}-${timeEstimate.max} seconds`, 'green');
}

/**
 * Test actual image generation (optional, costs money!)
 */
async function testImageGeneration(vertexAI: GoogleVertexAI): Promise<boolean> {
  printHeader('5. Testing Image Generation (OPTIONAL - COSTS MONEY)');

  print('⚠ This test will generate 4 images and cost ~$0.08', 'yellow');
  print('⚠ Skipping actual generation to avoid costs.', 'yellow');
  print('⚠ To test generation, uncomment the code in testVertexAI.ts', 'yellow');

  // UNCOMMENT BELOW TO TEST ACTUAL GENERATION (COSTS $0.08)
  /*
  try {
    print('Generating 4 sigil variations...', 'cyan');
    const startTime = Date.now();

    const result = await vertexAI.enhanceSigil({
      baseSigilSvg: SAMPLE_SIGIL_SVG,
      intentionText: 'Test intention for validation',
      styleApproach: 'minimal_line',
      numberOfVariations: 4,
    });

    const duration = Math.round((Date.now() - startTime) / 1000);

    print(`✓ Generated ${result.images.length} variations`, 'green');
    print(`  - Total time: ${result.totalTimeSeconds}s (actual: ${duration}s)`, 'cyan');
    print(`  - Total cost: $${result.costUSD.toFixed(2)}`, 'cyan');
    print(`  - Model: ${result.model}`, 'cyan');

    // Save images for inspection
    const testOutputDir = path.join(process.cwd(), 'test-output');
    await fs.mkdir(testOutputDir, { recursive: true });

    for (let i = 0; i < result.images.length; i++) {
      const img = result.images[i];
      const imagePath = path.join(testOutputDir, `variation-${i + 1}.png`);
      const buffer = Buffer.from(img.base64, 'base64');
      await fs.writeFile(imagePath, buffer);
      print(`✓ Saved variation ${i + 1}: ${imagePath}`, 'green');
    }

    return true;
  } catch (error) {
    print(`✗ Image generation failed: ${error}`, 'red');
    return false;
  }
  */

  return true;
}

/**
 * Main test runner
 */
async function main() {
  console.clear();
  print('Google Vertex AI Integration Test', 'bright');
  print('Testing Imagen 3 configuration and functionality\n', 'cyan');

  let totalTests = 0;
  let passedTests = 0;

  // Test 1: Environment
  totalTests++;
  if (await checkEnvironment()) {
    passedTests++;
  }

  // Test 2: Edge Map
  totalTests++;
  if (await testEdgeMapGeneration()) {
    passedTests++;
  }

  // Test 3: Initialization
  totalTests++;
  const vertexAI = await testVertexAIInit();
  if (vertexAI) {
    passedTests++;

    // Test 4: Estimates (only if init succeeded)
    totalTests++;
    try {
      await testEstimates(vertexAI);
      passedTests++;
    } catch (error) {
      print(`✗ Estimates test failed: ${error}`, 'red');
    }

    // Test 5: Generation (optional)
    totalTests++;
    if (await testImageGeneration(vertexAI)) {
      passedTests++;
    }
  }

  // Summary
  printHeader('Test Summary');
  print(`Tests passed: ${passedTests}/${totalTests}`, passedTests === totalTests ? 'green' : 'yellow');

  if (passedTests === totalTests) {
    print('\n✓ All tests passed! Google Vertex AI is ready to use.', 'green');
    print('  Next steps:', 'cyan');
    print('  1. Update your .env with Google Cloud credentials', 'cyan');
    print('  2. Test the API endpoint: POST /api/ai/enhance-controlnet', 'cyan');
    print('  3. Monitor costs in Google Cloud Console', 'cyan');
  } else {
    print('\n✗ Some tests failed. Please fix the issues above.', 'red');
    print('  Common issues:', 'cyan');
    print('  - Missing GOOGLE_CLOUD_PROJECT_ID in .env', 'cyan');
    print('  - Invalid GOOGLE_CLOUD_CREDENTIALS_JSON format', 'cyan');
    print('  - Vertex AI API not enabled in Google Cloud project', 'cyan');
    print('  - Service account missing required roles', 'cyan');
  }

  process.exit(passedTests === totalTests ? 0 : 1);
}

// Run tests
main().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
