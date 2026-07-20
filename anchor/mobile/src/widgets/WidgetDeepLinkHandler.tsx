/**
 * WidgetDeepLinkHandler — routes widget deep links into the correct app flow:
 * anchor://practice opens the Practice tab, while anchor://prime?anchorId=…
 * opens the prime picker for that anchor.
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

import { useEffect, useRef } from "react";
import { Linking } from "react-native";
import { useTabNavigation } from "@/contexts/TabNavigationContext";
import { useAnchorStore } from "@/stores/anchorStore";
import { ENABLE_VISUALIZE } from "@/config";

let initialUrlConsumed = false;

export function isWidgetPracticeDeepLink(
  url: string | null | undefined,
): boolean {
  if (!url) {
    return false;
  }
  // anchor://practice — tolerate a trailing slash and host/path parsing differences
  return /^anchor:\/\/+practice\/?$/i.test(url.trim());
}

export function getWidgetPrimeAnchorId(
  url: string | null | undefined,
): string | null {
  if (!url) return null;
  const match = url.trim().match(/^anchor:\/\/+prime\/?\?anchorId=([^&]+)$/i);
  if (!match) return null;

  try {
    const anchorId = decodeURIComponent(match[1]);
    return anchorId.length > 0 ? anchorId : null;
  } catch {
    return null;
  }
}

export function getVisualizeAnchorId(
  url: string | null | undefined,
): string | null {
  if (!url) return null;
  const match = url
    .trim()
    .match(/^anchor:\/\/+visualize\/?\?anchorId=([^&]+)$/i);
  if (!match) return null;
  try {
    const anchorId = decodeURIComponent(match[1]);
    return anchorId.length > 0 ? anchorId : null;
  } catch {
    return null;
  }
}

export function WidgetDeepLinkHandler(): null {
  const { navigateToPractice, navigateToVault } = useTabNavigation();
  const navigateToPracticeRef = useRef(navigateToPractice);
  navigateToPracticeRef.current = navigateToPractice;
  const navigateToVaultRef = useRef(navigateToVault);
  navigateToVaultRef.current = navigateToVault;

  const handleUrl = (url: string | null | undefined) => {
    const visualizeAnchorId = getVisualizeAnchorId(url);
    if (visualizeAnchorId) {
      if (!ENABLE_VISUALIZE) {
        navigateToPracticeRef.current();
        return;
      }
      const anchor = useAnchorStore.getState().getAnchorById(visualizeAnchorId);
      if (anchor && !anchor.isReleased && !anchor.archivedAt) {
        useAnchorStore.getState().setCurrentAnchor(anchor.id);
        navigateToVaultRef.current("VisualizePreparation", {
          anchorId: anchor.id,
          source: "deep_link",
        });
        return;
      }
      navigateToPracticeRef.current();
      return;
    }
    const anchorId = getWidgetPrimeAnchorId(url);
    if (anchorId) {
      const anchor = useAnchorStore.getState().getAnchorById(anchorId);
      if (anchor) {
        useAnchorStore.getState().setCurrentAnchor(anchor.id);
        navigateToVaultRef.current("ChargeSetup", {
          anchorId: anchor.id,
          returnTo: "practice",
        });
        return;
      }
    }

    if (isWidgetPracticeDeepLink(url)) {
      navigateToPracticeRef.current();
    }
  };

  useEffect(() => {
    if (!initialUrlConsumed) {
      initialUrlConsumed = true;
      void Linking.getInitialURL().then((url) => {
        handleUrl(url);
      });
    }

    const subscription = Linking.addEventListener("url", ({ url }) => {
      handleUrl(url);
    });
    return () => subscription.remove();
  }, []);

  return null;
}

/** Test-only: allows re-consuming the initial URL between tests. */
export function __resetWidgetDeepLinkForTests(): void {
  initialUrlConsumed = false;
}
