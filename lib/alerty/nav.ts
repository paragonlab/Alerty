import type { Router } from "expo-router";

export function safeBack(router: Router) {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace("/(tabs)");
}
