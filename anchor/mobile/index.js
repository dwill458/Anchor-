import { registerRootComponent } from 'expo';
import { registerWidgetTaskHandler } from 'react-native-android-widget';
import App from './App';
import { widgetTaskHandler } from './src/widgets/widget-task-handler';
import { WIDGETS_ENABLED } from './src/config';

registerRootComponent(App);
if (WIDGETS_ENABLED) {
  registerWidgetTaskHandler(widgetTaskHandler);
}
