package com.anchorintentions.app

import android.view.View
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
    reactContext.currentActivity?.runOnUiThread {
      it.window.decorView.systemUiVisibility =
        View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or
          View.SYSTEM_UI_FLAG_FULLSCREEN or
          View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
          View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or
          View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or
          View.SYSTEM_UI_FLAG_LAYOUT_STABLE
    }
  }

  @ReactMethod
  fun exit() {
    reactContext.currentActivity?.runOnUiThread {
      it.window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_LAYOUT_STABLE
    }
  }
}
