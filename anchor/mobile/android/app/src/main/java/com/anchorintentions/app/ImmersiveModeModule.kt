package com.anchorintentions.app

import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/** Hides Android system chrome while the active visualization is in progress. */
class ImmersiveModeModule(
  private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "AnchorImmersiveMode"

  @ReactMethod
  fun enter() {
    val activity = reactContext.currentActivity ?: return
    activity.runOnUiThread {
      val window = activity.window ?: return@runOnUiThread
      WindowCompat.setDecorFitsSystemWindows(window, false)
      val controller = WindowInsetsControllerCompat(window, window.decorView)
      controller.hide(WindowInsetsCompat.Type.systemBars())
      controller.systemBarsBehavior =
        WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
    }
  }

  @ReactMethod
  fun exit() {
    val activity = reactContext.currentActivity ?: return
    activity.runOnUiThread {
      val window = activity.window ?: return@runOnUiThread
      val controller = WindowInsetsControllerCompat(window, window.decorView)
      controller.show(WindowInsetsCompat.Type.systemBars())
    }
  }
}
