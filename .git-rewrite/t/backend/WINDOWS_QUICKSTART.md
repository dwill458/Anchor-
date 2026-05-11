# Windows Quick Start Guide

Get Google Vertex AI running on Windows in 5 minutes!

## Option 1: Automated Setup (Recommended)

### Step 1: Download the setup script

The script is already in your repository at:
```
backend/setup-windows.ps1
```

### Step 2: Run the script

**Open PowerShell as Administrator:**
- Press `Win + X`
- Click "Windows PowerShell (Admin)" or "Terminal (Admin)"

**Navigate to the backend folder:**
```powershell
cd C:\path\to\your\Anchor-\backend
```

**Run the setup script:**
```powershell
.\setup-windows.ps1
```

The script will:
1. ✅ Install Google Cloud CLI (if needed)
2. ✅ Authenticate with Google Cloud
3. ✅ Set up your project
4. ✅ Configure Application Default Credentials
5. ✅ Enable Vertex AI API
6. ✅ Update your `.env` file
7. ✅ Test the configuration

**That's it!** Everything will be configured automatically.

---

## Option 2: Simple Batch File

If PowerShell doesn't work, use the batch file:

```cmd
cd C:\path\to\your\Anchor-\backend
setup-windows.bat
```

This does the same thing but with simpler output.

---

## Option 3: Manual Setup

If you prefer to do it manually, follow these steps:

### 1. Download Google Cloud CLI

Download installer:
👉 https://dl.google.com/dl/cloudsdk/channels/rapid/GoogleCloudSDKInstaller.exe

Run it and follow the wizard.

### 2. Open a new terminal and run these commands

```cmd
# Login
gcloud auth login

# Set project
gcloud config set project anchor-ai-production

# Setup ADC
gcloud auth application-default login --project=anchor-ai-production

# Enable API
gcloud services enable aiplatform.googleapis.com
```

### 3. Configure .env

Copy `.env.example` to `.env` and set:

```env
GOOGLE_CLOUD_PROJECT_ID="anchor-ai-production"
GOOGLE_CLOUD_LOCATION="us-central1"
GOOGLE_CLOUD_CREDENTIALS_JSON=""
```

---

## Test Your Setup

```cmd
cd backend
npm install
npx ts-node src/scripts/testVertexAI.ts
```

Expected output:
```
✓ GOOGLE_CLOUD_PROJECT_ID: anchor-ai-production
✓ Using Application Default Credentials (ADC)
✓ ADC file found
✓ All tests passed!
```

---

## Start the Backend

```cmd
npm run dev
```

You should see:
```
[GoogleVertexAI] Using Application Default Credentials (ADC)
[GoogleVertexAI] Client initialized successfully
Server running on port 3000
```

---

## Troubleshooting

### "Execution of scripts is disabled"

PowerShell might block the script. Run this first:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

Then try again:
```powershell
.\setup-windows.ps1
```

### "gcloud is not recognized"

Close and reopen your terminal after installation. The PATH should update automatically.

### "Permission denied" when using the API

Your Google account needs the "Vertex AI User" role. Ask your project admin to grant it:

```cmd
gcloud projects add-iam-policy-binding anchor-ai-production ^
  --member="user:YOUR_EMAIL@gmail.com" ^
  --role="roles/aiplatform.user"
```

### ADC file not found

Run this again:
```cmd
gcloud auth application-default login
```

The file should be created at:
```
C:\Users\YourUsername\AppData\Roaming\gcloud\application_default_credentials.json
```

---

## Next Steps

Once everything is running:

1. **Test the API** - Create an anchor in the mobile app
2. **Monitor costs** - View usage at https://console.cloud.google.com/vertex-ai
3. **Check logs** - Backend will show which provider it's using (Google vs Replicate)

---

## Need Help?

- **Full documentation**: `backend/README.md`
- **Local dev guide**: `backend/SETUP_LOCAL.md`
- **Common issues**: See troubleshooting section above

---

## What Each Script Does

**setup-windows.ps1** (PowerShell - most features):
- Auto-installs gcloud if missing
- Colorful output
- Error handling
- Creates .env automatically
- Runs test script

**setup-windows.bat** (Batch - simpler):
- Assumes gcloud is installed
- Basic output
- Manual steps if errors occur

Choose whichever you're more comfortable with!
