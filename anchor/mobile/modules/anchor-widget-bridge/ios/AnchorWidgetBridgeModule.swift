import ExpoModulesCore
import WidgetKit

/**
 * Writes the WidgetSnapshot JSON (produced by src/widgets/widgetDataBridge.ts)
 * into the App Group UserDefaults shared with the AnchorWidget extension,
 * then reloads all WidgetKit timelines so placed widgets refresh immediately.
 *
 * The App Group id and snapshot key must stay in sync with:
 *  - src/widgets/widgetTypes.ts (WIDGET_APP_GROUP / WIDGET_IOS_SNAPSHOT_KEY)
 *  - targets/widget/widgets.swift (the extension's Provider)
 */
public class AnchorWidgetBridgeModule: Module {
  private static let appGroup = "group.com.anchorintentions.app.widget"
  private static let snapshotKey = "widgetSnapshot"

  public func definition() -> ModuleDefinition {
    Name("AnchorWidgetBridge")

    Function("setWidgetSnapshot") { (json: String) -> Bool in
      guard let defaults = UserDefaults(suiteName: Self.appGroup) else {
        return false
      }
      defaults.set(json, forKey: Self.snapshotKey)
      WidgetCenter.shared.reloadAllTimelines()
      return true
    }
  }
}
