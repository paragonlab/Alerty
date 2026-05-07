import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Linking from "expo-linking";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { trackEvent } from "../../lib/analytics";
import { lightTheme as theme } from "../../lib/theme";
import { isSupabaseConfigured, supabase } from "../../lib/supabase";

type Provider = "apple" | "google";

export default function LoginScreen() {
  const [loadingProvider, setLoadingProvider] = useState<Provider | null>(null);

  const handleSocialLogin = async (provider: Provider) => {
    if (!isSupabaseConfigured || !supabase) {
      Alert.alert(
        "Supabase no configurado",
        "Configura EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY para habilitar OAuth.",
      );
      return;
    }

    try {
      setLoadingProvider(provider);
      void trackEvent({ event_type: "auth_oauth_started", metadata: { provider } });
      const redirectTo = Linking.createURL("/");

      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
          skipBrowserRedirect: false,
        },
      });

      if (error) {
        void trackEvent({
          event_type: "auth_oauth_failed",
          metadata: { provider, message: error.message },
        });
        Alert.alert("Error al iniciar sesión", error.message);
      }
    } catch {
      void trackEvent({ event_type: "auth_oauth_failed", metadata: { provider } });
      Alert.alert("Error al iniciar sesión", "No fue posible conectarse. Intenta de nuevo.");
    } finally {
      setLoadingProvider(null);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        colors={["#F6F2EA", "#EFE4D2", "#F6F2EA"]}
        style={styles.gradient}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={styles.brandRow}>
              <View style={styles.brandIcon}>
                <Ionicons name="alert-circle" size={28} color={theme.colors.accent} />
              </View>
              <Text style={styles.brand}>Alerty</Text>
            </View>
            <Text style={styles.headline}>Seguridad comunitaria{"\n"}en tiempo real.</Text>
            <Text style={styles.subheadline}>
              Reporta, verifica y comparte alertas críticas en Culiacán para movernos mejor y salvar vidas.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Entra con tu cuenta</Text>
            <Text style={styles.cardSubtitle}>
              Los reportes verificados ganan más visibilidad en el mapa.
            </Text>

            <Pressable
              style={({ pressed }) => [styles.appleButton, pressed && styles.buttonPressed]}
              onPress={() => handleSocialLogin("apple")}
              disabled={Boolean(loadingProvider)}
            >
              {loadingProvider === "apple" ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="logo-apple" size={18} color="#FFFFFF" />
                  <Text style={styles.appleButtonText}>Continuar con Apple</Text>
                </>
              )}
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.googleButton, pressed && styles.buttonPressed]}
              onPress={() => handleSocialLogin("google")}
              disabled={Boolean(loadingProvider)}
            >
              {loadingProvider === "google" ? (
                <ActivityIndicator color={theme.colors.text} />
              ) : (
                <>
                  <Ionicons name="logo-google" size={16} color={theme.colors.text} />
                  <Text style={styles.googleButtonText}>Continuar con Google</Text>
                </>
              )}
            </Pressable>

            {!isSupabaseConfigured ? (
              <View style={styles.demoNote}>
                <Ionicons name="information-circle-outline" size={14} color={theme.colors.textMuted} />
                <Text style={styles.demoNoteText}>
                  Modo demo activo. Configura las variables de entorno de Supabase para OAuth real.
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  gradient: {
    flex: 1,
  },
  container: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: 22,
    paddingBottom: 36,
    paddingTop: 28,
  },
  header: {
    marginTop: 24,
    gap: 14,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  brandIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: theme.colors.accent + "15",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: theme.colors.accent + "30",
  },
  brand: {
    fontSize: 48,
    fontFamily: "SpaceGrotesk_700Bold",
    letterSpacing: -1.5,
    color: theme.colors.text,
  },
  headline: {
    fontSize: 28,
    fontFamily: "SpaceGrotesk_700Bold",
    color: theme.colors.text,
    lineHeight: 34,
    maxWidth: 300,
  },
  subheadline: {
    fontSize: 15,
    fontFamily: "SpaceGrotesk_500Medium",
    color: theme.colors.textMuted,
    lineHeight: 22,
    maxWidth: 320,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xxl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 20,
    gap: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  cardTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontFamily: "SpaceGrotesk_700Bold",
  },
  cardSubtitle: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontFamily: "SpaceGrotesk_500Medium",
    lineHeight: 19,
  },
  appleButton: {
    height: 54,
    borderRadius: theme.radius.pill,
    backgroundColor: "#1A1A1A",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
  },
  appleButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: "SpaceGrotesk_700Bold",
  },
  googleButton: {
    height: 54,
    borderRadius: theme.radius.pill,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
  },
  googleButtonText: {
    color: theme.colors.text,
    fontSize: 15,
    fontFamily: "SpaceGrotesk_700Bold",
  },
  buttonPressed: {
    opacity: 0.7,
  },
  demoNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.md,
    padding: 10,
  },
  demoNoteText: {
    flex: 1,
    color: theme.colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: "SpaceGrotesk_400Regular",
  },
});
