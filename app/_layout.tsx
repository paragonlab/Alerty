import { Stack, useRootNavigationState, useRouter, useSegments } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert } from "react-native";
import { StatusBar } from "expo-status-bar";
import * as Linking from "expo-linking";
import { useFonts, SpaceGrotesk_400Regular, SpaceGrotesk_500Medium, SpaceGrotesk_700Bold } from "@expo-google-fonts/space-grotesk";
import { trackEvent } from "../lib/analytics";
import { theme } from "../lib/theme";
import { darkHighVisibility, lightTheme } from "../lib/theme";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import { useAlertyStore } from "../lib/alerty/store";
import { calculateDistance } from "../lib/alerty/utils";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";

export default function RootLayout() {
  const { loadAlertsFromSupabase, startRealtime, themeMode, loadUserProfile } = useAlertyStore();
  const currentTheme = themeMode === "darkHighVisibility" ? darkHighVisibility : lightTheme;
  const router = useRouter();
  const segments = useSegments();
  const rootNavigationState = useRootNavigationState();
  const [isReady, setIsReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [fontsLoaded] = useFonts({
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_700Bold,
  });

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setHasSession(true);
      setIsReady(true);
      return;
    }

    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (data.session) loadUserProfile();
      setHasSession(Boolean(data.session));
      setIsReady(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (_event === "SIGNED_IN") {
        void trackEvent({ event_type: "auth_signed_in" });
        loadUserProfile();
      }
      if (_event === "SIGNED_OUT") {
        void trackEvent({ event_type: "auth_signed_out" });
      }
      setHasSession(Boolean(session));
    });

    // Listener para deep links de OAuth (cuando el browser redirige de vuelta)
    const handleDeepLink = async (event: { url: string }) => {
      if (!supabase) return;
      const url = event.url;
      console.log("🔗 Deep Link recibido:", url);
      
      // Extraemos el code de la URL
      const codeMatch = url.match(/code=([^&]+)/);
      const accessMatch = url.match(/access_token=([^&]+)/);
      const refreshMatch = url.match(/refresh_token=([^&]+)/);

      if (codeMatch) {
        const code = codeMatch[1];
        console.log("🎟️ Intercambiando código por sesión...");
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (data?.session) {
          console.log("✅ Sesión obtenida con éxito:", data.session.user.email);
          setHasSession(true);
        }
        if (error) {
          console.error("❌ Error en intercambio OAuth:", error.message);
        }
      } else if (accessMatch && refreshMatch) {
        console.log("🎟️ Restaurando sesión con tokens...");
        const { data, error } = await supabase.auth.setSession({
          access_token: accessMatch[1],
          refresh_token: refreshMatch[1],
        });
        if (data?.session) {
          console.log("✅ Sesión obtenida con éxito:", data.session.user.email);
          setHasSession(true);
        }
        if (error) {
          console.error("❌ Error seteando sesión:", error.message);
        }
      } else {
        console.log("ℹ️ El link no contiene un código de sesión (code=) ni access_token");
      }
    };

    const subscription = Linking.addEventListener("url", handleDeepLink);

    // Verificar si la app fue abierta desde un deep link de OAuth
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink({ url });
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
      subscription.remove();
    };
  }, [router]);

  const { alerts } = useAlertyStore();
  const lastSOSRef = useRef<string | null>(null);

  useEffect(() => {
    const latest = alerts[0];
    if (latest?.category === "sos" && latest.id !== lastSOSRef.current) {
      const age = (Date.now() - new Date(latest.createdAt).getTime()) / 1000;
      if (age < 30) { // Only if it's very recent (less than 30s)
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

              if (dist <= 5) { // Within 5km
                void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                Alert.alert(
                  "🚨 EMERGENCIA SOS CERCANA",
                  `Se ha reportado una emergencia crítica a ${dist.toFixed(1)}km de tu ubicación.`,
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
  }, [alerts]);

  useEffect(() => {
    if (hasSession) {
      void loadAlertsFromSupabase();
      const unsubscribeRealtime = startRealtime();
      return () => {
        if (unsubscribeRealtime) unsubscribeRealtime();
      };
    }
  }, [hasSession]);

  useEffect(() => {
    if (!isReady || !rootNavigationState?.key) return;
    const currentGroup = segments[0];
    const isInAuth = currentGroup === "(auth)";

    if (!hasSession && !isInAuth) {
      router.replace("/(auth)/login");
    }

    if (hasSession && isInAuth) {
      router.replace("/(tabs)");
    }
  }, [hasSession, isReady, rootNavigationState?.key, router, segments]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <>
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
      </Stack>
    </>
  );
}
