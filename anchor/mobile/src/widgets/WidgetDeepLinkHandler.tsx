/**
 * WidgetDeepLinkHandler — routes the widget CTA deep link
 * (anchor://practice) to the Practice tab.
 *
 * The main tabs are a custom pager (SwipeableTabContainer), not a React
 * Navigation tab navigator, so URL routing can't go through a NavigationContainer
 * `linking` config — tab switches happen via TabNavigationContext instead.
 * This null-rendering component therefore mounts inside MainTabNavigator's
 * TabNavigationProvider and listens for the widget URL:
 *  - warm start: `url` events
 *  - cold start: Linking.getInitialURL(), consumed once per app launch
 *
 * When the user is still in onboarding, MainTabNavigator (and this handler)
 * isn't mounted — the deep link simply opens the app, which is the intended
 * fallback.
 */

import { useEffect, useRef } from 'react';
import { Linking } from 'react-native';
import { useTabNavigation } from '@/contexts/TabNavigationContext';

let initialUrlConsumed = false;

export function isWidgetPracticeDeepLink(url: string | null | undefined): boolean {
  if (!url) {
    return false;
  }
  // anchor://practice — tolerate a trailing slash and host/path parsing differences
  return /^anchor:\/\/+practice\/?$/i.test(url.trim());
}

export function WidgetDeepLinkHandler(): null {
  const { navigateToPractice } = useTabNavigation();
  const navigateToPracticeRef = useRef(navigateToPractice);
  navigateToPracticeRef.current = navigateToPractice;

  useEffect(() => {
    if (!initialUrlConsumed) {
      initialUrlConsumed = true;
      void Linking.getInitialURL().then((url) => {
        if (isWidgetPracticeDeepLink(url)) {
          navigateToPracticeRef.current();
        }
      });
    }

    const subscription = Linking.addEventListener('url', ({ url }) => {
      if (isWidgetPracticeDeepLink(url)) {
        navigateToPracticeRef.current();
      }
    });
    return () => subscription.remove();
  }, []);

  return null;
}

/** Test-only: allows re-consuming the initial URL between tests. */
export function __resetWidgetDeepLinkForTests(): void {
  initialUrlConsumed = false;
}
