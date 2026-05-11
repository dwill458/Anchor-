# Anchor Backend API

Backend server for the Anchor app - A React Native mobile application that generates AI-enhanced sigils from user intentions.

## Features

- 🎨 **AI-Enhanced Sigil Generation** - Google Vertex AI (Imagen 3) with Replicate fallback
- 🔒 **User Authentication** - JWT-based auth with secure token handling
- ☁️ **Cloud Storage** - Cloudflare R2 for image and audio storage
- 🗣️ **Text-to-Speech** - Google Cloud TTS for mantra audio generation
- 📊 **Structure Validation** - IoU-based scoring for sigil geometry preservation

## Tech Stack

- **Runtime**: Node.js 20+
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: PostgreSQL + Prisma ORM
- **Cache**: Redis
- **AI**: Google Vertex AI (Imagen 3), Replicate (fallback)
- **Storage**: Cloudflare R2 (S3-compatible)
- **Image Processing**: Sharp

---

## Getting Started

### Prerequisites

- Node.js 20+ installed
- PostgreSQL database
- Redis server
- Google Cloud account (for Vertex AI)
- Replicate account (for fallback)
- Cloudflare account (for R2 storage)

### Installation

1. **Clone and install dependencies**

```bash
cd backend
npm install
```

2. **Configure environment variables**

```bash
cp .env.example .env
# Edit .env with your credentials (see sections below)
```

3. **Set up database**

```bash
npm run prisma:migrate
npm run prisma:generate
```

4. **Run development server**

```bash
npm run dev
```

Server will start on `http://localhost:3000`

---

## Google Cloud Vertex AI Setup

### Why Google Vertex AI?

The app uses **Google Cloud Vertex AI (Imagen 3)** as the primary AI provider for:

- ✅ **Better reliability** - 99.9% uptime vs. Replicate's rate limiting issues
- ✅ **Faster generation** - 4 variations in ~30s (parallel) vs. ~60s (sequential)
- ✅ **Lower cost** - $0.08/anchor vs. $0.18/anchor
- ✅ **Production-grade** - Enterprise SLA and support

### Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project:
   - **Project name**: `anchor-ai-production`
   - **Project ID**: Note this ID (e.g., `anchor-ai-production-123456`)
3. Enable billing for the project

### Step 2: Enable Vertex AI API

Run these commands in Google Cloud Shell or locally with `gcloud` CLI:

```bash
# Enable Vertex AI API
gcloud services enable aiplatform.googleapis.com

# Enable Storage API (required for Vertex AI)
gcloud services enable storage-component.googleapis.com
```

Or enable via Console:
- Navigate to **APIs & Services** → **Library**
- Search for "Vertex AI API" → Click **Enable**

### Step 3: Create Service Account

1. Go to **IAM & Admin** → **Service Accounts**
2. Click **Create Service Account**
3. Fill in details:
   - **Name**: `anchor-vertex-ai`
   - **Description**: `Service account for Anchor app Vertex AI integration`
4. Click **Create and Continue**
5. Grant roles:
   - **Vertex AI User** (`roles/aiplatform.user`)
   - **Storage Object Creator** (`roles/storage.objectCreator`) - if using GCS
6. Click **Continue** → **Done**

### Step 4: Generate JSON Key

1. Find your new service account in the list
2. Click the **⋮** menu → **Manage keys**
3. Click **Add Key** → **Create new key**
4. Select **JSON** format
5. Click **Create** - JSON file will download

### Step 5: Configure Backend

Add to your `.env` file:

```bash
# Google Cloud Vertex AI
GOOGLE_CLOUD_PROJECT_ID="anchor-ai-production-123456"
GOOGLE_CLOUD_LOCATION="us-central1"

# Paste the ENTIRE content of your JSON key file as a single-line string
# Use single quotes and escape any quotes inside
GOOGLE_CLOUD_CREDENTIALS_JSON='{"type":"service_account","project_id":"anchor-ai-production-123456","private_key_id":"abc123...","private_key":"-----BEGIN PRIVATE KEY-----\n...","client_email":"anchor-vertex-ai@anchor-ai-production-123456.iam.gserviceaccount.com","client_id":"123456789","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"https://www.googleapis.com/robot/v1/metadata/x509/..."}'
```

**Important**: The `GOOGLE_CLOUD_CREDENTIALS_JSON` value must be:
- The entire JSON file content
- On a single line (no newlines except in the private key)
- Wrapped in single quotes `'...'`

### Step 6: Test Your Setup

Run the test script to validate configuration:

```bash
cd backend
npx ts-node src/scripts/testVertexAI.ts
```

Expected output:
```
✓ GOOGLE_CLOUD_PROJECT_ID: anchor-ai-production-123456
✓ GOOGLE_CLOUD_CREDENTIALS_JSON: Valid service account
✓ Edge map generated successfully
✓ Google Vertex AI initialized successfully
✓ Cost estimate (4 variations): $0.08
✓ Time estimate: 25-35 seconds

✓ All tests passed! Google Vertex AI is ready to use.
```

---

## Cost Estimation & Monitoring

### Pricing

| Service | Cost per Anchor | Notes |
|---------|----------------|-------|
| **Imagen 3 (Google)** | $0.08 | 4 images × $0.02 each |
| **Replicate (fallback)** | $0.04 | 2 images × $0.02 each |

**Monthly estimates** (based on 1000 anchors created):
- Google Vertex AI: ~$80/month
- Replicate fallback: ~$40/month (if Google unavailable)

### Monitor Usage

View real-time usage in Google Cloud Console:

1. Go to [Vertex AI Dashboard](https://console.cloud.google.com/vertex-ai)
2. Navigate to **Predictions** → **Online predictions**
3. View request counts and latency metrics

View billing:

1. Go to [Billing](https://console.cloud.google.com/billing)
2. Select your project
3. View **Cost breakdown** by service
4. Set up budget alerts (recommended: $100/month threshold)

### Rate Limits

- **Vertex AI**: 60 requests/minute (default)
- **Replicate**: 6 requests/minute (free tier)

To increase Vertex AI quota:
1. Go to **IAM & Admin** → **Quotas**
2. Search for "Vertex AI"
3. Request quota increase if needed

---

## Fallback Architecture

The system implements a **graceful fallback** from Google Vertex AI to Replicate:

```mermaid
graph TD
    A[POST /api/ai/enhance-controlnet] --> B{Google Vertex AI Available?}
    B -->|Yes| C[Try Google Imagen 3]
    B -->|No| F[Use Replicate ControlNet]
    C --> D{Success?}
    D -->|Yes| E[Return 4 variations ~30s]
    D -->|No| F
    F --> G[Return 2 variations ~60s]
```

**When fallback triggers**:
- Google Cloud credentials not configured
- Vertex AI API disabled
- Network errors to Google Cloud
- Quota exceeded
- Authentication failures

**Fallback behavior**:
- Automatically switches to Replicate (no user impact)
- Logs fallback reason for debugging
- Response indicates which provider was used

---

## API Endpoints

### AI Enhancement

**POST** `/api/ai/enhance-controlnet`

Generate AI-enhanced sigil variations with structure preservation.

**Request:**
```json
{
  "sigilSvg": "<svg>...</svg>",
  "styleChoice": "watercolor",
  "userId": "user123",
  "anchorId": "anchor456",
  "provider": "auto"  // optional: 'google' | 'replicate' | 'auto'
}
```

**Response:**
```json
{
  "success": true,
  "variations": [
    {
      "imageUrl": "https://pub-xxx.r2.dev/anchor-1.png",
      "structureMatchScore": 0.92,
      "structurePreserved": true,
      "seed": 1000
    }
  ],
  "provider": "google",
  "generationTime": 28,
  "model": "imagegeneration@006",
  "styleApplied": "watercolor"
}
```

**Available Styles:**
- `watercolor` - Soft translucent washes, flowing colors
- `sacred_geometry` - Golden metallic sheen, precise lines
- `ink_brush` - Traditional sumi-e aesthetic
- `gold_leaf` - Illuminated manuscript style
- `cosmic` - Ethereal celestial energy
- `minimal_line` - Clean contemporary design

---

## Environment Variables Reference

See `.env.example` for complete template.

**Required:**
```bash
# Database
DATABASE_URL="postgresql://..."
REDIS_URL="redis://..."

# AI (Primary)
GOOGLE_CLOUD_PROJECT_ID="your-project-id"
GOOGLE_CLOUD_CREDENTIALS_JSON='{"type":"service_account",...}'

# AI (Fallback)
REPLICATE_API_TOKEN="r8_your_token"

# Storage
R2_ACCESS_KEY_ID="your-key"
R2_SECRET_ACCESS_KEY="your-secret"
R2_BUCKET_NAME="anchor-assets"
```

**Optional:**
```bash
# AI Provider Override
AI_PROVIDER="auto"  # 'google' | 'replicate' | 'auto'

# Google TTS (for mantra audio)
GOOGLE_TTS_API_KEY="your-key"

# Monitoring
SENTRY_DSN="https://..."
```

---

## Development

### Run Tests

```bash
# All tests
npm test

# Watch mode
npm run test:watch

# Test Vertex AI specifically
npx ts-node src/scripts/testVertexAI.ts
```

### Type Checking

```bash
npm run type-check
```

### Linting

```bash
npm run lint
npm run format
```

### Database Migrations

```bash
# Create migration
npm run prisma:migrate

# View database in GUI
npm run prisma:studio
```

---

## Troubleshooting

### "Google Vertex AI not configured"

**Symptoms**: API falls back to Replicate every time

**Solutions**:
1. Check `.env` has `GOOGLE_CLOUD_PROJECT_ID` and `GOOGLE_CLOUD_CREDENTIALS_JSON`
2. Verify JSON is valid (use `echo $GOOGLE_CLOUD_CREDENTIALS_JSON | jq` to test)
3. Run test script: `npx ts-node src/scripts/testVertexAI.ts`
4. Check service account has "Vertex AI User" role

### "Vertex AI API not enabled"

**Symptoms**: Error 403 when generating images

**Solutions**:
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Enable Vertex AI API for your project
3. Wait 1-2 minutes for propagation
4. Retry

### "Quota exceeded"

**Symptoms**: Error 429 from Vertex AI

**Solutions**:
1. Check [Quotas page](https://console.cloud.google.com/iam-admin/quotas)
2. Search for "Vertex AI predictions"
3. Request quota increase
4. Temporary: Set `AI_PROVIDER=replicate` in `.env`

### Images generating too slowly

**Expected times**:
- **Google Vertex AI**: 25-35 seconds (4 variations in parallel)
- **Replicate**: 40-60 seconds (2 variations sequential)

**If slower**:
1. Check Google Cloud region (use `us-central1` for lowest latency)
2. Monitor network latency to Google Cloud
3. Verify not falling back to Replicate (check API response `provider` field)

---

## Production Deployment

### Checklist

- [ ] Set `NODE_ENV=production` in `.env`
- [ ] Use strong `JWT_SECRET` (32+ random characters)
- [ ] Enable Google Cloud budget alerts
- [ ] Set up error monitoring (Sentry)
- [ ] Configure CORS for your domain
- [ ] Use HTTPS for all endpoints
- [ ] Set up database backups
- [ ] Monitor Redis memory usage
- [ ] Set up log aggregation (Datadog, LogDNA, etc.)
- [ ] Load test with expected traffic

### Recommended Infrastructure

- **Server**: 2 vCPU, 4GB RAM (handles ~100 concurrent requests)
- **Database**: PostgreSQL 14+ with 20GB storage
- **Redis**: 1GB memory
- **Regions**: Deploy in same region as Google Cloud (e.g., `us-central1`)

---

## License

UNLICENSED - Proprietary software

---

## Support

For questions or issues:
- Check troubleshooting section above
- Run test script: `npx ts-node src/scripts/testVertexAI.ts`
- Review logs in `backend/logs/`
- Contact: [your-email@example.com]
