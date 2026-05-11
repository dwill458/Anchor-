# Local Development Setup for Google Vertex AI

Quick setup guide for testing Google Vertex AI locally without service account keys.

## Prerequisites

- Google Cloud CLI installed
- Access to Google Cloud project (anchor-ai-production)
- Vertex AI API enabled on your project

## Step 1: Install Google Cloud CLI (if not installed)

**macOS:**
```bash
brew install --cask google-cloud-sdk
```

**Linux:**
```bash
curl https://sdk.cloud.google.com | bash
exec -l $SHELL
```

**Windows:**
Download installer from: https://cloud.google.com/sdk/docs/install

## Step 2: Authenticate with Google Cloud

```bash
# Login to Google Cloud
gcloud auth login

# Set your project
gcloud config set project anchor-ai-production

# Authenticate for Application Default Credentials
gcloud auth application-default login --project=anchor-ai-production
```

When prompted, authorize in your browser.

## Step 3: Enable Vertex AI API

```bash
# Enable Vertex AI API
gcloud services enable aiplatform.googleapis.com

# Verify it's enabled
gcloud services list --enabled | grep aiplatform
```

Expected output:
```
aiplatform.googleapis.com     Vertex AI API
```

## Step 4: Configure Backend Environment

Update your `backend/.env`:

```bash
# Copy example if you haven't already
cp .env.example .env

# Edit .env and set:
GOOGLE_CLOUD_PROJECT_ID="anchor-ai-production"
GOOGLE_CLOUD_LOCATION="us-central1"
GOOGLE_CLOUD_CREDENTIALS_JSON=""  # Leave empty for local dev

# Keep your existing Replicate token for fallback
REPLICATE_API_TOKEN="r8_your_token_here"
```

## Step 5: Test Your Setup

```bash
cd backend

# Install dependencies (if not done)
npm install

# Run the test script
npx ts-node src/scripts/testVertexAI.ts
```

Expected output:
```
✓ GOOGLE_CLOUD_PROJECT_ID: anchor-ai-production
✓ GOOGLE_CLOUD_LOCATION: us-central1
✓ GOOGLE_CLOUD_CREDENTIALS_JSON: Using ADC (gcloud auth)
✓ Edge map generated successfully
✓ Google Vertex AI initialized successfully
✓ Cost estimate (4 variations): $0.08
✓ Time estimate: 25-35 seconds

✓ All tests passed! Google Vertex AI is ready to use.
```

## Step 6: Start Backend Server

```bash
npm run dev
```

Your backend will now use Google Vertex AI for image generation!

## Troubleshooting

### "User credentials are not supported"

**Solution:** Run the application-default login command:
```bash
gcloud auth application-default login --project=anchor-ai-production
```

### "Permission denied" or "Forbidden"

**Solution:** Make sure your Google account has the "Vertex AI User" role:
```bash
# Check your current permissions
gcloud projects get-iam-policy anchor-ai-production \
  --flatten="bindings[].members" \
  --filter="bindings.members:user:YOUR_EMAIL@gmail.com"
```

If you don't have the role, ask your project admin to grant it:
```bash
# Admin would run:
gcloud projects add-iam-policy-binding anchor-ai-production \
  --member="user:YOUR_EMAIL@gmail.com" \
  --role="roles/aiplatform.user"
```

### "Quota exceeded"

**Solution:** You've hit the free tier limits. Either:
1. Enable billing on the project
2. Fall back to Replicate by setting `AI_PROVIDER=replicate` in `.env`

### "API not enabled"

**Solution:** Enable Vertex AI API:
```bash
gcloud services enable aiplatform.googleapis.com
```

Wait 1-2 minutes for propagation.

## Verify Authentication

Check if ADC is working:

```bash
# This file should exist after gcloud auth application-default login
ls -la ~/.config/gcloud/application_default_credentials.json

# Test API access
gcloud ai models list --region=us-central1 --project=anchor-ai-production
```

## Production Deployment

For production, you'll need to:
1. Create a service account
2. Download the JSON key (may require org admin)
3. Set `GOOGLE_CLOUD_CREDENTIALS_JSON` in production environment
4. Use secrets manager (AWS Secrets Manager, Google Secret Manager, etc.)

See `backend/README.md` for full production setup.

## Quick Command Reference

```bash
# Re-authenticate if credentials expire
gcloud auth application-default login

# Switch projects
gcloud config set project anchor-ai-production

# Check current project
gcloud config get-value project

# Test Vertex AI access
gcloud ai models list --region=us-central1

# View quota
gcloud ai quotas list --region=us-central1
```

---

**Note:** ADC credentials expire after ~1 hour. If you get authentication errors, re-run:
```bash
gcloud auth application-default login
```
