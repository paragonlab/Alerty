import { Stack, useRootNavigationState, useRouter, useSegments } from "expo-router";
import { useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { useFonts, SpaceGrotesk_400Regular, SpaceGrotesk_500Medium, SpaceGrotesk_700Bold } from "@expo-google-fonts/space-grotesk";
import { trackEvent } from "../lib/analytics";
import { ThemeProvider, useTheme } from "../lib/theme";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import { useAlertyStore } from "../lib/alerty/store";

function RootLayoutInner() {
  const router = useRouter();
  const segments = useSegments();
  const rootNavigationState = useRootNavigationState();
  const theme = useTheme();
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
      setHasSession(Boolean(data.session));
      setIsReady(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (_event === "SIGNED_IN") {
        void trackEvent({ event_type: "auth_signed_in" });
      }
      if (_event === "SIGNED_OUT") {
        void trackEvent({ event_type: "auth_signed_out" });
      }
      setHasSession(Boolean(session));
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [router]);

  useEffect(() => {
    if (!isReady || !rootNavigationState?.key) return;
    const currentGroup = segments[0];
    const isInAuth = currentGroup === "(auth)";
    const isInTabs = currentGroup === "(tabs)";

    if (!hasSession && !isInAuth) {
      router.replace("/(auth)/login");
    }

    if (hasSession && !isInTabs) {
      router.replace("/(tabs)");
    }
  }, [hasSession, isReady, rootNavigationState?.key, router, segments]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <>
      <StatusBar style={theme.mode === "dark" ? "light" : "dark"} />
      <Stack
        initialRouteName="(tabs)"
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.background },
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
          name="alert/[id]"
          options={{
            headerShown: false,
          }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const themePreference = useAlertyStore((state) => state.themePreference);
  return (
    <ThemeProvider preference={themePreference}>
      <RootLayoutInner />
    </ThemeProvider>
  );
}
