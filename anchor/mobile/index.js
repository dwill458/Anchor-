import { registerRootComponent } from 'expo';
import { registerWidgetTaskHandler } from 'react-native-android-widget';
import App from './App';
import { widgetTaskHandler } from './src/widgets/widget-task-handler';

registerRootComponent(App);
registerWidgetTaskHandler(widgetTaskHandler);
