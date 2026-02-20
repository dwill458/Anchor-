import axios from 'axios';

const API_URL = 'http://localhost:8000/api/ai';

const styles = [
    'watercolor',
    'sacred_geometry',
    'ink_brush',
    'gold_leaf',
    'cosmic',
    'minimal_line',
    'obsidian_mono',
    'aurora_glow',
    'ember_trace',
    'echo_chamber',
    'monolith_ink',
    'celestial_grid',
];

const mockSigilSvg = '<svg width="100" height="100"><circle cx="50" cy="50" r="40" stroke="black" fill="none" /></svg>';

async function testStyles() {
    console.log('--- Testing AI Styles Validation ---');
    let successCount = 0;

    for (const style of styles) {
        try {
            console.log(`Testing style: ${style}...`);
            const response = await axios.post(`${API_URL}/enhance-controlnet`, {
                sigilSvg: mockSigilSvg,
                styleChoice: style,
                userId: 'test-user',
                anchorId: 'test-anchor',
                tier: 'draft'
            });

            if (response.status === 200) {
                console.log(`✅ ${style}: OK`);
                successCount++;
            } else {
                console.log(`❌ ${style}: Failed with status ${response.status}`);
            }
        } catch (error: any) {
            if (error.response && error.response.data && error.response.data.error) {
                console.log(`❌ ${style}: Error - ${error.response.data.error}`);
            } else {
                console.log(`❌ ${style}: Error - ${error.message}`);
            }
        }
    }

    console.log('------------------------------------');
    console.log(`Summary: ${successCount}/${styles.length} styles passed.`);
}

testStyles();
