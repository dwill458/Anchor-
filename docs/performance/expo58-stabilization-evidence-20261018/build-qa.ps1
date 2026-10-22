$ErrorActionPreference = 'Stop'
$qaMobile = 'E:\AnchorQA\expo58-stabilization-20261018\candidate\anchor\mobile'
$qaEvidence = $PSScriptRoot
$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
$env:ANDROID_HOME = 'C:\Users\dwill\AppData\Local\Android\Sdk'
$env:ANCHOR_EXPO58_QA = '1'
$env:EXPO_NO_DOTENV = '1'
$env:EXPO_PUBLIC_API_URL = 'https://expo58-synthetic.invalid'
$env:EXPO_PUBLIC_APP_ENV = 'development'
$env:EXPO_PUBLIC_ANCHOR_V2_ENABLED = 'true'
$env:EXPO_PUBLIC_ENABLE_LEGACY_SUPABASE_SYNC = 'false'
$env:EXPO_PUBLIC_ENABLE_MERCH = 'false'
$env:EXPO_PUBLIC_ENABLE_WIDGETS = 'false'
$env:EXPO_PUBLIC_ENABLE_GOOGLE_SIGN_IN = 'false'
$env:EXPO_PUBLIC_ENABLE_MOCK_AUTH = 'false'
$env:EXPO_PUBLIC_ENABLE_VISUALIZE = 'true'
$env:EXPO_PUBLIC_ENABLE_CHART = 'true'
$env:EXPO_PUBLIC_ANCHOR_STABILIZATION_DIAGNOSTICS = '1'
$env:EXPO_PUBLIC_ANCHOR_PERF_DIAGNOSTICS = '1'
$env:SENTRY_DISABLE_AUTO_UPLOAD = 'true'
$env:SENTRY_DISABLE_NATIVE_UPLOAD = 'true'
$env:GOOGLE_SERVICES_JSON = "$qaMobile\android\app\google-services.json"
# Nonfunctional synthetic Firebase registration, scoped to the isolated QA package.
'{"project_info":{"project_number":"123456789012","project_id":"anchor-expo58-synthetic","storage_bucket":"anchor-expo58-synthetic.invalid"},"client":[{"client_info":{"mobilesdk_app_id":"1:123456789012:android:0123456789abcdef012345","android_client_info":{"package_name":"com.anchorintentions.expo58qa20261016"}},"api_key":[{"current_key":"SYNTHETIC_QA_NOT_A_VALID_FIREBASE_API_KEY"}],"services":{"appinvite_service":{"other_platform_oauth_client":[]}}}],"configuration_version":"1"}' | Set-Content -LiteralPath $env:GOOGLE_SERVICES_JSON
Set-Location "$qaMobile\android"
& .\gradlew.bat :app:assembleRelease '-PreactNativeArchitectures=arm64-v8a,x86_64' '-Pexpo.sqlite.useSQLCipher=true' --max-workers=2 --console=plain *> "$qaEvidence\release-build.log"
$qaExit = $LASTEXITCODE
Set-Content "$qaEvidence\release-build.exit.txt" $qaExit
exit $qaExit
