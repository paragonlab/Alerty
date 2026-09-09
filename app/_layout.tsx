import { Stack, usePathname, useRootNavigationState, useRouter, useSegments } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as Linking from "expo-linking";
import { useFonts, SpaceGrotesk_400Regular, SpaceGrotesk_500Medium, SpaceGrotesk_700Bold } from "@expo-google-fonts/space-grotesk";
import { trackEvent } from "../lib/analytics";
import { darkHighVisibility, lightTheme } from "../lib/theme";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import { useAlertyStore } from "../lib/alerty/store";
import { consumeAuthNext, setAuthNext } from "../lib/alerty/session";
import { authCodeFromUrl, exchangeAuthCodeOnce } from "../lib/alerty/oauth";
import { isDemoEnabled } from "../lib/alerty/mock";
import { SOS_RADIUS_KM } from "../lib/alerty/constants";
import { calculateDistance } from "../lib/alerty/utils";
import {
  syncPushRegistration,
  addNotificationTapListener,
  getInitialNotificationAlertId,
} from "../lib/notifications";
import { identifyUser as identifyRevenueCatUser } from "../lib/revenuecat";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";

const AUTH_ONLY_ROUTES = new Set(["report", "premium", "business", "circulo"]);

export default function RootLayout() {
  const { loadAlertsFromSupabase, startRealtime, themeMode, loadUserProfile, loadSponsoredZones, loadCommunityPosts, startDemo, resetGuest } = useAlertyStore();
  const currentTheme = themeMode === "darkHighVisibility" ? darkHighVisibility : lightTheme;
  const router = useRouter();
  const segments = useSegments();
  const pathname = usePathname();
  const rootNavigationState = useRootNavigationState();
  const [isReady, setIsReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  useFonts({
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_700Bold,
  });

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setHasSession(false);
      setIsReady(true);
      return;
    }

    let mounted = true;
    supabase.auth.getSession()
      .then(({ data }) => {
        if (!mounted) return;
        if (data.session) loadUserProfile();
        setHasSession(Boolean(data.session));
        setIsReady(true);
      })
      .catch((err) => {
        if (!mounted) return;
        console.warn("getSession failed", err);
        setIsReady(true);
      });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (_event === "SIGNED_IN") {
        void trackEvent({ event_type: "auth_signed_in" });
        loadUserProfile();
      }
      if (_event === "SIGNED_OUT") {
        void trackEvent({ event_type: "auth_signed_out" });
        resetGuest();
      }
      setHasSession(Boolean(session));
    });

    const handleDeepLink = async (event: { url: string }) => {
      const code = authCodeFromUrl(event.url);
      if (!code) return;
      const { data, error } = await exchangeAuthCodeOnce(code);
      if (data?.session) setHasSession(true);
      if (error) console.error("OAuth exchange error:", error.message);
    };

    const subscription = Linking.addEventListener("url", handleDeepLink);

    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink({ url });
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
      subscription.remove();
    };
  }, []);

  const { alerts, currentUser } = useAlertyStore();
  const lastSOSRef = useRef<string | null>(null);

  useEffect(() => {
    const latest = alerts[0];
    if (latest?.category === "sos" && latest.id !== lastSOSRef.current) {
      if (latest.user?.id && latest.user.id === currentUser.id) {
        lastSOSRef.current = latest.id;
        return;
      }
      const age = (Date.now() - new Date(latest.createdAt).getTime()) / 1000;
      if (age < 30) {
        lastSOSRef.current = latest.id;
        void (async () => {
          try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status === "granted") {
              const current = await Location.getCurrentPositionAsync({});
              const dist = calculateDistance(
                current.coords.latitude,
                current.coords.longitude,
                latest.lat,
                latest.lng
              );

              if (dist <= SOS_RADIUS_KM) {
                void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                Alert.alert(
                  "EMERGENCIA SOS CERCANA",
                  `Se ha reportado una emergencia crítica a ${dist < 1 ? `${Math.round(dist * 1000)} m` : `${dist.toFixed(1)} km`} de tu ubicación.`,
                  [
                    { text: "Ver en mapa", onPress: () => router.push("/(tabs)") },
                    { text: "Entendido", style: "cancel" }
                  ]
                );
              }
            }
          } catch (e) {
            console.warn("SOS check location failed", e);
          }
        })();
      }
    }
  }, [alerts, currentUser.id, router]);

  useEffect(() => {
    if (isDemoEnabled) {
      startDemo();
      return;
    }
    if (!isSupabaseConfigured) return;
    void loadAlertsFromSupabase();
    void loadSponsoredZones();
    void loadCommunityPosts({ refreshNews: true });
  }, []);

  useEffect(() => {
    if (!isReady || isDemoEnabled || !isSupabaseConfigured) return;
    const unsubscribeRealtime = startRealtime();
    if (hasSession) {
      void syncPushRegistration();
      void supabase?.auth.getUser().then(({ data }) => {
        if (data.user?.id) void identifyRevenueCatUser(data.user.id);
      });
    }
    return () => {
      if (unsubscribeRealtime) unsubscribeRealtime();
    };
  }, [hasSession, isReady]);

  const handledColdStart = useRef(false);
  useEffect(() => {
    return addNotificationTapListener((alertId) => {
      router.push(`/alert/${alertId}` as any);
    });
  }, [router]);

  useEffect(() => {
    if (!rootNavigationState?.key || handledColdStart.current) return;
    handledColdStart.current = true;
    void getInitialNotificationAlertId().then((alertId) => {
      if (alertId) router.push(`/alert/${alertId}` as any);
    });
  }, [rootNavigationState?.key]);

  useEffect(() => {
    if (!isReady || !rootNavigationState?.key) return;
    const currentGroup = segments[0];
    const isInAuth = currentGroup === "(auth)";
    const authOnlyPath =
      pathname === "/report" ||
      pathname.startsWith("/premium") ||
      pathname.startsWith("/business") ||
      pathname.startsWith("/circulo");

    if (!hasSession && (AUTH_ONLY_ROUTES.has(String(currentGroup)) || authOnlyPath)) {
      const next = pathname.startsWith("/premium")
        ? "/premium"
        : pathname.startsWith("/business")
          ? "/business"
          : pathname.startsWith("/circulo")
            ? "/circulo"
            : "/report";
      setAuthNext(next);
      router.replace("/(auth)/login");
      return;
    }

    if (hasSession && isInAuth) {
      router.replace((consumeAuthNext() ?? "/(tabs)") as any);
    }
  }, [hasSession, isReady, pathname, rootNavigationState?.key, router, segments]);

  return (
    <SafeAreaProvider>
      <StatusBar style={themeMode === "darkHighVisibility" ? "light" : "dark"} />
      <Stack
        initialRouteName="(tabs)"
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: currentTheme.colors.background },
        }}
      >
        <Stack.Screen
          name="report"
          options={{
            presentation: "modal",
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="premium"
          options={{
            presentation: "modal",
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="alert/[id]"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="business"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="circulo"
          options={{
            presentation: "modal",
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="privacy"
          options={{
            headerShown: false,
          }}
        />
      </Stack>
    </SafeAreaProvider>
  );
}
