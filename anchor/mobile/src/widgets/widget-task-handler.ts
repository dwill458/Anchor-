import type { WidgetTaskHandler } from 'react-native-android-widget';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { renderAnchorWidgetByName } from './android/renderAnchorWidget';
import {
  createEmptyWidgetSnapshot,
  WIDGET_SNAPSHOT_STORAGE_KEY,
  type WidgetSnapshot,
} from './widgetTypes';

/**
 * Reads the last snapshot written by the widget data bridge. Runs in the
 * headless widget JS context, so it must not touch the Zustand stores.
 */
async function readWidgetSnapshot(): Promise<WidgetSnapshot> {
  try {
    const json = await AsyncStorage.getItem(WIDGET_SNAPSHOT_STORAGE_KEY);
    if (json) {
      return JSON.parse(json) as WidgetSnapshot;
    }
  } catch {
    // Corrupt/missing snapshot — fall through to the empty state.
  }
  return createEmptyWidgetSnapshot();
}

export const widgetTaskHandler: WidgetTaskHandler = async (props) => {
  switch (props.widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED': {
      const snapshot = await readWidgetSnapshot();
      props.renderWidget(
        renderAnchorWidgetByName(props.widgetInfo.widgetName, snapshot, {
          width: props.widgetInfo.width,
          height: props.widgetInfo.height,
        })
      );
      break;
    }
    case 'WIDGET_DELETED':
    case 'WIDGET_CLICK':
      // Clicks use the native OPEN_APP / OPEN_URI actions — no JS handling needed.
      break;
  }
};
