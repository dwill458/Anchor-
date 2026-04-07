
const genai = require('@google/genai');
console.log(Object.keys(genai));
console.log('---');
try {
    const { GoogleGenerativeAI } = require('@google/genai');
    console.log('GoogleGenerativeAI:', !!GoogleGenerativeAI);
} catch (e) { console.log(e.message); }
