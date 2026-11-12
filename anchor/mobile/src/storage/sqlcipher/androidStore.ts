import * as Application from 'expo-application';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { Platform } from 'react-native';
import { isSqlCipherAndroidStoreEnabled } from './cohort';

export const sqlCipherAndroidStoreEnabled = Constants.expoConfig?.extra?.sqlCipherAndroidStore === true &&
  isSqlCipherAndroidStoreEnabled(Platform.OS, Application.applicationId, Updates.runtimeVersion, true);
