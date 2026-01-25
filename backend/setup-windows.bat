@echo off
REM ============================================================================
REM Anchor App - Google Cloud Setup for Windows (Simple Version)
REM ============================================================================
REM This is a simpler alternative to setup-windows.ps1
REM For best results, use the PowerShell version instead
REM ============================================================================

echo.
echo ========================================
echo Anchor App - Google Cloud Setup
echo ========================================
echo.

REM Check if gcloud is installed
where gcloud >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [!] Google Cloud CLI not found
    echo.
    echo Please download and install from:
    echo https://dl.google.com/dl/cloudsdk/channels/rapid/GoogleCloudSDKInstaller.exe
    echo.
    echo After installation, close this window and run this script again.
    pause
    exit /b 1
)

echo [OK] Google Cloud CLI found
gcloud --version
echo.

REM Authenticate
echo Step 1: Authenticating with Google Cloud...
echo This will open your browser. Please sign in and allow access.
echo.
pause
gcloud auth login
echo.

REM Set project
echo Step 2: Setting project...
gcloud config set project anchor-ai-production
echo.

REM Application Default Credentials
echo Step 3: Setting up Application Default Credentials...
echo This will open your browser again.
echo.
pause
gcloud auth application-default login --project=anchor-ai-production
echo.

REM Enable API
echo Step 4: Enabling Vertex AI API...
gcloud services enable aiplatform.googleapis.com
echo.

REM Configure .env
echo Step 5: Configuring .env file...
if not exist .env (
    copy .env.example .env
    echo Created .env from .env.example
)

REM Update values in .env (basic replacement)
powershell -Command "(Get-Content .env) -replace 'GOOGLE_CLOUD_PROJECT_ID=\".*\"', 'GOOGLE_CLOUD_PROJECT_ID=\"anchor-ai-production\"' | Set-Content .env"
powershell -Command "(Get-Content .env) -replace 'GOOGLE_CLOUD_CREDENTIALS_JSON=\".*\"', 'GOOGLE_CLOUD_CREDENTIALS_JSON=\"\"' | Set-Content .env"

echo [OK] .env configured
echo.

echo ========================================
echo Setup Complete!
echo ========================================
echo.
echo Next steps:
echo   1. npm install
echo   2. npx ts-node src/scripts/testVertexAI.ts
echo   3. npm run dev
echo.
pause
