package com.anchorintentions.app

import android.os.Build
import android.view.Display
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * Asks the window for the panel's highest refresh rate at its current resolution (e.g. 120 Hz),
 * so animation-heavy moments are not capped at 60. Panels without a faster mode are unaffected.
 */
class DisplayModeModule(
  private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "AnchorDisplayMode"

  @ReactMethod
  fun requestHighRefreshRate() {
    val activity = reactContext.currentActivity ?: return
    activity.runOnUiThread {
      val window = activity.window ?: return@runOnUiThread
      @Suppress("DEPRECATION")
      val display: Display = (
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) activity.display
        else activity.windowManager.defaultDisplay
      ) ?: return@runOnUiThread
      val current = display.mode
      val best = display.supportedModes
        .filter { it.physicalWidth == current.physicalWidth && it.physicalHeight == current.physicalHeight }
        .maxByOrNull { it.refreshRate } ?: return@runOnUiThread
      val attributes = window.attributes
      attributes.preferredDisplayModeId = best.modeId
      window.attributes = attributes
    }
  }

  @ReactMethod
  fun restoreDefault() {
    val activity = reactContext.currentActivity ?: return
    activity.runOnUiThread {
      val window = activity.window ?: return@runOnUiThread
      val attributes = window.attributes
      attributes.preferredDisplayModeId = 0
      window.attributes = attributes
    }
  }
}
