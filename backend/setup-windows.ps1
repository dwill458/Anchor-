# ============================================================================
# Anchor App - Google Cloud Setup for Windows
# ============================================================================
# This script automates the Google Cloud CLI setup for local development
#
# USAGE:
#   1. Open PowerShell as Administrator
#   2. Navigate to this directory: cd C:\path\to\Anchor-\backend
#   3. Run: .\setup-windows.ps1
#
# Prerequisites: None - script will install everything
# ============================================================================

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Anchor App - Google Cloud Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "WARNING: Not running as Administrator" -ForegroundColor Yellow
    Write-Host "Some steps may require administrator privileges" -ForegroundColor Yellow
    Write-Host ""
}

# Step 1: Check if gcloud is already installed
Write-Host "Step 1: Checking for Google Cloud CLI..." -ForegroundColor Yellow
$gcloudPath = Get-Command gcloud -ErrorAction SilentlyContinue

if ($gcloudPath) {
    Write-Host "[OK] Google Cloud CLI is already installed" -ForegroundColor Green
    gcloud --version
} else {
    Write-Host "[!] Google Cloud CLI not found - installing..." -ForegroundColor Yellow

    # Download installer
    $installerUrl = "https://dl.google.com/dl/cloudsdk/channels/rapid/GoogleCloudSDKInstaller.exe"
    $installerPath = "$env:TEMP\GoogleCloudSDKInstaller.exe"

    Write-Host "Downloading installer..." -ForegroundColor Cyan
    try {
        Invoke-WebRequest -Uri $installerUrl -OutFile $installerPath
        Write-Host "[OK] Installer downloaded" -ForegroundColor Green

        Write-Host ""
        Write-Host "Starting installer..." -ForegroundColor Cyan
        Write-Host "Please follow the installation wizard:" -ForegroundColor Yellow
        Write-Host "  - Check 'Install bundled Python'" -ForegroundColor Yellow
        Write-Host "  - You can uncheck 'Run gcloud init' (we'll do it manually)" -ForegroundColor Yellow
        Write-Host ""

        Start-Process -FilePath $installerPath -Wait

        Write-Host "[OK] Installation complete!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Please close and reopen PowerShell, then run this script again." -ForegroundColor Yellow
        Write-Host ""
        exit
    } catch {
        Write-Host "[ERROR] Failed to download installer: $_" -ForegroundColor Red
        Write-Host "Please download manually from: https://cloud.google.com/sdk/docs/install" -ForegroundColor Yellow
        exit 1
    }
}

Write-Host ""

# Step 2: Authenticate with Google Cloud
Write-Host "Step 2: Authenticating with Google Cloud..." -ForegroundColor Yellow
Write-Host ""
Write-Host "This will open your browser for authentication." -ForegroundColor Cyan
Write-Host "Please sign in and grant permissions." -ForegroundColor Cyan
Write-Host ""
Read-Host "Press Enter to continue"

gcloud auth login

Write-Host "[OK] Authentication complete" -ForegroundColor Green
Write-Host ""

# Step 3: Set project
Write-Host "Step 3: Setting Google Cloud project..." -ForegroundColor Yellow
$projectId = "anchor-ai-production"

gcloud config set project $projectId

Write-Host "[OK] Project set to: $projectId" -ForegroundColor Green
Write-Host ""

# Step 4: Application Default Credentials
Write-Host "Step 4: Setting up Application Default Credentials..." -ForegroundColor Yellow
Write-Host ""
Write-Host "This will open your browser again for ADC authentication." -ForegroundColor Cyan
Write-Host "This is required for the backend to authenticate with Google Cloud." -ForegroundColor Cyan
Write-Host ""
Read-Host "Press Enter to continue"

gcloud auth application-default login --project=$projectId

Write-Host "[OK] ADC configured successfully" -ForegroundColor Green
Write-Host ""

# Step 5: Enable Vertex AI API
Write-Host "Step 5: Enabling Vertex AI API..." -ForegroundColor Yellow

try {
    gcloud services enable aiplatform.googleapis.com
    Write-Host "[OK] Vertex AI API enabled" -ForegroundColor Green
} catch {
    Write-Host "[WARNING] Could not enable API - may need billing enabled" -ForegroundColor Yellow
    Write-Host "You can enable it manually: https://console.cloud.google.com/apis/library/aiplatform.googleapis.com" -ForegroundColor Yellow
}

Write-Host ""

# Step 6: Configure backend .env
Write-Host "Step 6: Configuring backend environment..." -ForegroundColor Yellow

$envPath = Join-Path $PSScriptRoot ".env"
$envExamplePath = Join-Path $PSScriptRoot ".env.example"

# Create .env from .env.example if it doesn't exist
if (-not (Test-Path $envPath)) {
    if (Test-Path $envExamplePath) {
        Write-Host "Creating .env from .env.example..." -ForegroundColor Cyan
        Copy-Item $envExamplePath $envPath
    } else {
        Write-Host "[ERROR] .env.example not found!" -ForegroundColor Red
        exit 1
    }
}

# Update .env with Google Cloud settings
$envContent = Get-Content $envPath
$envContent = $envContent -replace 'GOOGLE_CLOUD_PROJECT_ID=".*"', "GOOGLE_CLOUD_PROJECT_ID=`"$projectId`""
$envContent = $envContent -replace 'GOOGLE_CLOUD_LOCATION=".*"', 'GOOGLE_CLOUD_LOCATION="us-central1"'
$envContent = $envContent -replace 'GOOGLE_CLOUD_CREDENTIALS_JSON=".*"', 'GOOGLE_CLOUD_CREDENTIALS_JSON=""'
$envContent | Set-Content $envPath

Write-Host "[OK] .env configured" -ForegroundColor Green
Write-Host ""

# Step 7: Test the setup
Write-Host "Step 7: Testing configuration..." -ForegroundColor Yellow
Write-Host ""

# Check if Node.js is installed
$nodePath = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodePath) {
    Write-Host "[WARNING] Node.js not found - please install Node.js 20+" -ForegroundColor Yellow
    Write-Host "Download from: https://nodejs.org/" -ForegroundColor Yellow
} else {
    Write-Host "Running test script..." -ForegroundColor Cyan
    Write-Host ""

    try {
        npx ts-node src/scripts/testVertexAI.ts
    } catch {
        Write-Host "[WARNING] Test failed - you may need to run 'npm install' first" -ForegroundColor Yellow
    }
}

# Summary
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Setup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Install dependencies: npm install" -ForegroundColor White
Write-Host "  2. Run test script: npx ts-node src/scripts/testVertexAI.ts" -ForegroundColor White
Write-Host "  3. Start backend: npm run dev" -ForegroundColor White
Write-Host ""
Write-Host "Your .env file has been configured with:" -ForegroundColor Cyan
Write-Host "  - GOOGLE_CLOUD_PROJECT_ID=$projectId" -ForegroundColor White
Write-Host "  - GOOGLE_CLOUD_CREDENTIALS_JSON="""" (using ADC)" -ForegroundColor White
Write-Host ""
Write-Host "Documentation:" -ForegroundColor Cyan
Write-Host "  - Local setup: backend/SETUP_LOCAL.md" -ForegroundColor White
Write-Host "  - Full guide: backend/README.md" -ForegroundColor White
Write-Host ""
