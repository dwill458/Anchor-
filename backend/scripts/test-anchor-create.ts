import axios from 'axios';

async function testCreateAnchor() {
  try {
    const response = await axios.post(
      'http://127.0.0.1:8000/api/anchors',
      {
        intentionText: 'I am focused and present',
        category: 'personal_growth',
        distilledLetters: ['I', 'A', 'M', 'F', 'O', 'C', 'S', 'D'],
        baseSigilSvg: '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40"/></svg>',
        structureVariant: 'balanced',
      },
      {
        headers: {
          Authorization: 'Bearer mock-jwt-token',
          'Content-Type': 'application/json',
        },
      }
    );
    console.log('SUCCESS - Anchor created:', JSON.stringify(response.data, null, 2));
  } catch (err: any) {
    console.error('ERROR:', err.response?.data || err.message);
  }
}

testCreateAnchor();
