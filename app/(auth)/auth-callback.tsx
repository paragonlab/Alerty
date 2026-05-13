import { useEffect } from "react";
import { View, ActivityIndicator, Text, Platform } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { supabase } from "../../lib/supabase";
import { useAlertyStore } from "../../lib/alerty/store";
import { darkHighVisibility, lightTheme } from "../../lib/theme";

export default function AuthCallback() {
  const { themeMode } = useAlertyStore();
  const theme = themeMode === "darkHighVisibility" ? darkHighVisibility : lightTheme;
  const router = useRouter();
  const { code } = useLocalSearchParams<{ code: string }>();

  useEffect(() => {
    // En web el browser navega aquí con ?code=xxx — lo intercambiamos manualmente.
    // En nativo el código ya fue intercambiado en login.tsx vía WebBrowser.
    if (Platform.OS !== "web" || !code || !supabase) return;

    supabase.auth.exchangeCodeForSession(code).then(({ data }) => {
      if (data?.session) router.replace("/(tabs)");
    });
  }, [code]);

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: theme.colors.background }}>
      <ActivityIndicator size="large" color={theme.colors.accent} />
      <Text style={{ marginTop: 16, fontFamily: "SpaceGrotesk_500Medium", color: theme.colors.text }}>
        Completando inicio de sesión...
      </Text>
    </View>
  );
}
