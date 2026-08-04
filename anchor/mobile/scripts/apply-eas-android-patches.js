const fs = require('fs');
const path = require('path');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function writeIfChanged(filePath, next) {
  const prev = read(filePath);
  if (prev !== next) {
    fs.writeFileSync(filePath, next, 'utf8');
  }
}

// Package tarballs may use CRLF on Windows while patch-package writes LF.
// Match semantic snippets in a canonical form so the expected patched state
// is recognized regardless of line ending; only an actual patch rewrites it.
function canonicalize(content) {
  return content.replace(/\r\n/g, '\n');
}

function replaceExact(content, before, after, label) {
  const canonicalContent = canonicalize(content);
  const canonicalBefore = canonicalize(before);
  const canonicalAfter = canonicalize(after);
  if (canonicalContent.includes(canonicalAfter)) {
    return content;
  }
  if (!canonicalContent.includes(canonicalBefore)) {
    throw new Error(`Expected snippet not found for ${label}`);
  }
  return canonicalContent.replace(canonicalBefore, canonicalAfter);
}

function removeExact(content, snippet, label) {
  const canonicalContent = canonicalize(content);
  const canonicalSnippet = canonicalize(snippet);
  if (!canonicalContent.includes(canonicalSnippet)) {
    return content;
  }
  return canonicalContent.replace(canonicalSnippet, '');
}

function patchReactNative(root) {
  const statusBarPath = path.join(
    root,
    'node_modules',
    'react-native',
    'ReactAndroid',
    'src',
    'main',
    'java',
    'com',
    'facebook',
    'react',
    'modules',
    'statusbar',
    'StatusBarModule.kt'
  );

  let statusBar = read(statusBarPath);
  statusBar = removeExact(statusBar, "import android.animation.ArgbEvaluator\n", 'react-native status bar imports');
  statusBar = removeExact(statusBar, "import android.animation.ValueAnimator\n", 'react-native status bar imports');
  statusBar = removeExact(statusBar, "import android.view.WindowManager\n", 'react-native status bar imports');
  statusBar = removeExact(
    statusBar,
    "import com.facebook.react.views.view.getStatusBarColorCompat\n",
    'react-native status bar imports'
  );
  statusBar = removeExact(
    statusBar,
    "import com.facebook.react.views.view.setStatusBarColorCompat\n",
    'react-native status bar imports'
  );
  statusBar = replaceExact(
    statusBar,
    `  @Suppress("DEPRECATION")
  override fun getTypedExportedConstants(): Map<String, Any> {
    val currentActivity = reactApplicationContext.currentActivity
    val statusBarColor =
        currentActivity?.window?.statusBarColor?.let { color ->
          String.format("#%06X", 0xFFFFFF and color)
        } ?: "black"
    return mapOf(
        HEIGHT_KEY to PixelUtil.toDIPFromPixel(getStatusBarHeightPx(currentActivity).toFloat()),
        DEFAULT_BACKGROUND_COLOR_KEY to statusBarColor,
    )
  }
`,
    `  @Suppress("DEPRECATION")
  override fun getTypedExportedConstants(): Map<String, Any> {
    val currentActivity = reactApplicationContext.currentActivity
    return mapOf(
        HEIGHT_KEY to PixelUtil.toDIPFromPixel(getStatusBarHeightPx(currentActivity).toFloat()),
        DEFAULT_BACKGROUND_COLOR_KEY to "black",
    )
  }
`,
    'react-native status bar constants'
  );
  statusBar = replaceExact(
    statusBar,
    `  @Suppress("DEPRECATION")
  override fun setColor(colorDouble: Double, animated: Boolean) {
    val color = colorDouble.toInt()
    val activity = reactApplicationContext.getCurrentActivity()
    if (activity == null) {
      FLog.w(
          ReactConstants.TAG,
          "StatusBarModule: Ignored status bar change, current activity is null.")
      return
    }
    if (isEdgeToEdgeFeatureFlagOn) {
      FLog.w(
          ReactConstants.TAG,
          "StatusBarModule: Ignored status bar change, current activity is edge-to-edge.")
      return
    }
    UiThreadUtil.runOnUiThread(
        object : GuardedRunnable(reactApplicationContext) {
          override fun runGuarded() {
            val window = activity.window ?: return
            window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS)
            if (animated) {
              val curColor = window.statusBarColor
              val colorAnimation = ValueAnimator.ofObject(ArgbEvaluator(), curColor, color)
              colorAnimation.addUpdateListener { animator ->
                activity.window?.statusBarColor = (animator.animatedValue as Int)
              }
              colorAnimation.setDuration(300).startDelay = 0
              colorAnimation.start()
            } else {
              window.statusBarColor = color
            }
          }
        })
  }
`,
    `  override fun setColor(colorDouble: Double, animated: Boolean) {
    val activity = reactApplicationContext.getCurrentActivity()
    if (activity == null) {
      FLog.w(
          ReactConstants.TAG,
          "StatusBarModule: Ignored status bar change, current activity is null.")
      return
    }
    if (isEdgeToEdgeFeatureFlagOn) {
      FLog.w(
          ReactConstants.TAG,
          "StatusBarModule: Ignored status bar change, current activity is edge-to-edge.")
      return
    }
    FLog.w(
        ReactConstants.TAG,
        "StatusBarModule: Ignored status bar color change because Android edge-to-edge should not set system bar colors directly.")
  }
`,
    'react-native status bar color setter'
  );
  writeIfChanged(statusBarPath, statusBar);

  const windowUtilPath = path.join(
    root,
    'node_modules',
    'react-native',
    'ReactAndroid',
    'src',
    'main',
    'java',
    'com',
    'facebook',
    'react',
    'views',
    'view',
    'WindowUtil.kt'
  );

  let windowUtil = read(windowUtilPath);
  windowUtil = removeExact(windowUtil, "import android.graphics.Color\n", 'react-native window util import');
  windowUtil = removeExact(
    windowUtil,
    `// The light scrim color used in the platform API 29+
// https://cs.android.com/android/platform/superproject/+/master:frameworks/base/core/java/com/android/internal/policy/DecorView.java;drc=6ef0f022c333385dba2c294e35b8de544455bf19;l=142
internal val LightNavigationBarColor = Color.argb(0xe6, 0xFF, 0xFF, 0xFF)

// The dark scrim color used in the platform.
// https://cs.android.com/android/platform/superproject/+/master:frameworks/base/core/res/res/color/system_bar_background_semi_transparent.xml
// https://cs.android.com/android/platform/superproject/+/master:frameworks/base/core/res/remote_color_resources_res/values/colors.xml;l=67
internal val DarkNavigationBarColor = Color.argb(0x80, 0x1b, 0x1b, 0x1b)
`,
    'react-native window util scrim colors'
  );
  windowUtil = removeExact(
    windowUtil,
    `private val IntPrimitiveType = Int::class.javaPrimitiveType ?: Integer.TYPE

internal fun Window.getStatusBarColorCompat(): Int? {
  if (Build.VERSION.SDK_INT >= 35) {
    return null
  }

  return runCatching {
        javaClass.getMethod("getStatusBarColor").invoke(this) as Int
      }
      .getOrNull()
}

internal fun Window.setStatusBarColorCompat(color: Int) {
  if (Build.VERSION.SDK_INT >= 35) {
    return
  }

  runCatching { javaClass.getMethod("setStatusBarColor", IntPrimitiveType).invoke(this, color) }
}

internal fun Window.setNavigationBarColorCompat(color: Int) {
  if (Build.VERSION.SDK_INT >= 35) {
    return
  }

  runCatching { javaClass.getMethod("setNavigationBarColor", IntPrimitiveType).invoke(this, color) }
}

`,
    'react-native window util compat helpers'
  );
  windowUtil = removeExact(
    windowUtil,
    `  statusBarColor = Color.TRANSPARENT
  navigationBarColor =
      when {
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q -> Color.TRANSPARENT
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !isDarkMode -> LightNavigationBarColor
        else -> DarkNavigationBarColor
      }

`,
    'react-native window util color assignment'
  );
  writeIfChanged(windowUtilPath, windowUtil);
}

function patchExpoDevLauncher(root) {
  const buildGradlePath = path.join(root, 'node_modules', 'expo-dev-launcher', 'android', 'build.gradle');
  let buildGradle = read(buildGradlePath);
  buildGradle = replaceExact(
    buildGradle,
    `  implementation "androidx.navigation:navigation-compose:2.9.0"
  implementation "com.google.android.gms:play-services-code-scanner:16.1.0"
  implementation "com.google.mlkit:barcode-scanning:17.3.0"
`,
    `  implementation "androidx.navigation:navigation-compose:2.9.0"
  debugImplementation "com.google.android.gms:play-services-code-scanner:16.1.0"
  debugImplementation "com.google.mlkit:barcode-scanning:17.3.0"
  debugOptimizedImplementation "com.google.android.gms:play-services-code-scanner:16.1.0"
  debugOptimizedImplementation "com.google.mlkit:barcode-scanning:17.3.0"
`,
    'expo-dev-launcher debug-only scanner deps'
  );
  writeIfChanged(buildGradlePath, buildGradle);

  const mainManifestPath = path.join(
    root,
    'node_modules',
    'expo-dev-launcher',
    'android',
    'src',
    'main',
    'AndroidManifest.xml'
  );
  let mainManifest = read(mainManifestPath);
  mainManifest = replaceExact(
    mainManifest,
    `<manifest xmlns:android="http://schemas.android.com/apk/res/android">
  <application>
    <meta-data
      android:name="com.google.mlkit.vision.DEPENDENCIES"
      android:value="barcode_ui"/>
  </application>
</manifest>
`,
    `<manifest xmlns:android="http://schemas.android.com/apk/res/android" />
`,
    'expo-dev-launcher main manifest'
  );
  writeIfChanged(mainManifestPath, mainManifest);

  const debugManifestPath = path.join(
    root,
    'node_modules',
    'expo-dev-launcher',
    'android',
    'src',
    'debug',
    'AndroidManifest.xml'
  );
  let debugManifest = read(debugManifestPath);
  debugManifest = replaceExact(
    debugManifest,
    `<manifest xmlns:android="http://schemas.android.com/apk/res/android">

  <application>
`,
    `<manifest xmlns:android="http://schemas.android.com/apk/res/android">

  <application>
    <meta-data
      android:name="com.google.mlkit.vision.DEPENDENCIES"
      android:value="barcode_ui" />
`,
    'expo-dev-launcher debug metadata'
  );
  debugManifest = removeExact(
    debugManifest,
    `      android:screenOrientation="portrait"
`,
    'expo-dev-launcher debug portrait lock'
  );
  writeIfChanged(debugManifestPath, debugManifest);
}

function main() {
  const root = path.resolve(__dirname, '..');
  patchReactNative(root);
  patchExpoDevLauncher(root);
  console.log('Applied Android dependency patches for EAS builds.');
}

// Keep the postinstall behavior, while making the exact replacement contract
// independently testable. `patch-package` may have already applied the same
// transformation; replaceExact treats that expected end state as success.
if (require.main === module) {
  main();
}

module.exports = { main, patchExpoDevLauncher, patchReactNative, removeExact, replaceExact };
