/**
 * Full integration test for anchor creation flow
 * Tests: enhance-controlnet (AI generation) + POST /api/anchors (save)
 */
import axios from 'axios';

const BASE = 'http://127.0.0.1:8000';

const TEST_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300">
  <circle cx="150" cy="150" r="100" stroke="gold" stroke-width="2" fill="none"/>
  <line x1="150" y1="50" x2="150" y2="250" stroke="gold" stroke-width="2"/>
  <line x1="50" y1="150" x2="250" y2="150" stroke="gold" stroke-width="2"/>
</svg>`;

async function testFullFlow() {
  console.log('\n=== ANCHOR CREATION FULL FLOW TEST ===\n');

  // STEP 1: Test AI generation (no auth needed)
  console.log('📡 Step 1: Testing AI generation (enhance-controlnet)...');
  try {
    const aiRes = await axios.post(`${BASE}/api/ai/enhance-controlnet`, {
      sigilSvg: TEST_SVG,
      styleChoice: 'watercolor',
      userId: 'mock-uid-123',
      anchorId: 'temp-test-123',
      intentionText: 'I am focused and present',
      tier: 'draft',
      generationAttempt: 1,
    }, { timeout: 120000 });

    const { variations } = aiRes.data;
    console.log(`✅ AI generation SUCCESS - got ${variations?.length ?? 0} variations`);
    if (variations?.[0]) {
      const v = variations[0];
      const url = typeof v === 'string' ? v : v.imageUrl;
      console.log(`   First variation type: ${typeof v}`);
      console.log(`   URL/data starts with: ${String(url).substring(0, 50)}...`);
    }
  } catch (err: any) {
    console.error('❌ AI generation FAILED:', err.response?.data || err.message);
    console.log('\n⚠️  Stopping - AI generation must work before saving anchors\n');
    return;
  }

  // STEP 2: Test anchor save (needs auth)
  console.log('\n📡 Step 2: Testing anchor save (POST /api/anchors)...');
  try {
    const saveRes = await axios.post(`${BASE}/api/anchors`, {
      intentionText: 'I am focused and present',
      category: 'personal_growth',
      distilledLetters: ['I', 'A', 'M', 'F', 'O', 'C'],
      baseSigilSvg: TEST_SVG,
      structureVariant: 'balanced',
    }, {
      headers: { Authorization: 'Bearer mock-jwt-token' },
      timeout: 10000,
    });

    console.log(`✅ Anchor SAVED - id: ${saveRes.data.data?.id}`);
  } catch (err: any) {
    console.error('❌ Anchor save FAILED:', err.response?.data || err.message);
  }

  console.log('\n=== TEST COMPLETE ===\n');
}

testFullFlow();
