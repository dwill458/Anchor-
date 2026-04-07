
/* eslint-disable */
const { GoogleAuth } = require('google-auth-library');
require('dotenv').config();

// ANSI colors for console output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m'
};

async function run() {
    const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
    const location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';

    console.log(`${colors.cyan}--- VERTEX AI DIAGNOSTIC START ---${colors.reset}`);
    console.log(`Target: Project=${projectId}, Location=${location}`);

    try {
        const auth = new GoogleAuth({
            scopes: ['https://www.googleapis.com/auth/cloud-platform']
        });
        const client = await auth.getClient();
        const token = await client.getAccessToken();
        const accessToken = token.token;
        console.log(`${colors.green}✓ Authentication successful (ADC)${colors.reset}`);

        // TEST 1: Imagen 2 (Standard - No blocked params)
        console.log('\n--- Test 1: Imagen 2 (imagegeneration@006) [SAFE PARAMS] ---');
        await callModel(accessToken, projectId, location, 'imagegeneration@006', {
            sampleCount: 1
            // NO personGeneration
        });

        // TEST 2: Imagen 2 (With Restricted Params)
        console.log('\n--- Test 2: Imagen 2 (imagegeneration@006) [RESTRICTED PARAMS] ---');
        await callModel(accessToken, projectId, location, 'imagegeneration@006', {
            sampleCount: 1,
            personGeneration: 'allow_adult' // This should fail 403
        });

        // TEST 3: Imagen 3
        console.log('\n--- Test 3: Imagen 3 (imagen-3.0-generate-001) [UPGRADE] ---');
        await callModel(accessToken, projectId, location, 'imagen-3.0-generate-001', {
            sampleCount: 1,
            aspectRatio: "1:1"
        });

    } catch (error) {
        console.error(`${colors.red}FATAL ERROR: ${error.message}${colors.reset}`);
    }
}

async function callModel(token, projectId, location, model, params) {
    const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:predict`;

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                instances: [{ prompt: "A golden anchor symbol, minimal line art" }],
                parameters: params
            })
        });

        if (res.ok) {
            console.log(`${colors.green}   ✅ SUCCESS: ${model} generated an image.${colors.reset}`);
            // Optionally inspect response to ensure it's not empty
            const data = await res.json();
            const predictions = data.predictions || [];
            console.log(`   Detailed: got ${predictions.length} prediction(s).`);
        } else {
            const txt = await res.text();
            let message = '';
            try {
                const json = JSON.parse(txt);
                message = `${json.error.code} - ${json.error.message}`;
            } catch {
                message = `${res.status} - ${txt.substring(0, 200)}...`;
            }

            console.log(`${colors.red}   ❌ FAILED: ${message}${colors.reset}`);

            // Specific advice based on error
            if (message.includes('403') || message.includes('allow_adult')) {
                console.log(`${colors.yellow}      -> DIAGNOSIS: Restricted parameter detected.${colors.reset}`);
            }
        }
    } catch (e) {
        console.log(`${colors.red}   ❌ EXCEPTION: ${e.message}${colors.reset}`);
    }
}

run();
