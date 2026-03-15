import { useMemo, useState } from "react";
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
import { trackEvent } from "../../lib/analytics";
import { useTheme } from "../../lib/theme";
import type { Theme } from "../../lib/theme";
import { isSupabaseConfigured, supabase } from "../../lib/supabase";

type Provider = "apple" | "google";

export default function LoginScreen() {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
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
        Alert.alert("Login error", error.message);
      }
    } catch (error) {
      void trackEvent({ event_type: "auth_oauth_failed", metadata: { provider } });
      Alert.alert("Login error", "No fue posible iniciar sesión.");
    } finally {
      setLoadingProvider(null);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        colors={
          theme.mode === "dark"
            ? ["#10151C", "#0B0F14", "#0B0F14"]
            : ["#FFF1F2", "#FFE3E6", "#FFF8F9"]
        }
        style={styles.gradient}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.brand}>Alerty</Text>
            <Text style={styles.headline}>Seguridad comunitaria en tiempo real.</Text>
            <Text style={styles.subheadline}>
              Reporta, verifica y comparte alertas críticas en Culiacán para salvar vidas y
              movernos mejor.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Entra con tu cuenta</Text>
            <Text style={styles.cardSubtitle}>
              Los reportes verificados ganan más visibilidad en el mapa.
            </Text>
            <Pressable
              style={styles.primaryButton}
              onPress={() => handleSocialLogin("apple")}
              disabled={Boolean(loadingProvider)}
            >
              {loadingProvider === "apple" ? (
                <ActivityIndicator color={theme.colors.surface} />
              ) : (
                <Text style={styles.primaryButtonText}>Continuar con Apple</Text>
              )}
            </Pressable>

            <Pressable
              style={styles.secondaryButton}
              onPress={() => handleSocialLogin("google")}
              disabled={Boolean(loadingProvider)}
            >
              {loadingProvider === "google" ? (
                <ActivityIndicator color={theme.colors.text} />
              ) : (
                <Text style={styles.secondaryButtonText}>Continuar con Google</Text>
              )}
            </Pressable>

            {!isSupabaseConfigured ? (
              <Text style={styles.demoNote}>
                Modo demo activo: configura `EXPO_PUBLIC_SUPABASE_URL` y
                `EXPO_PUBLIC_SUPABASE_ANON_KEY` para OAuth real.
              </Text>
            ) : null}
          </View>
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
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
    paddingBottom: 32,
    paddingTop: 24,
  },
  header: {
    marginTop: 32,
    gap: 10,
  },
  brand: {
    fontSize: 54,
    fontFamily: theme.fonts.heading,
    letterSpacing: -1.2,
    color: theme.colors.text,
  },
  headline: {
    fontSize: 24,
    fontFamily: theme.fonts.heading,
    color: theme.colors.text,
    lineHeight: 30,
    maxWidth: 320,
  },
  subheadline: {
    fontSize: 15,
    fontFamily: theme.fonts.body,
    color: theme.colors.textMuted,
    lineHeight: 22,
    maxWidth: 320,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xxl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 18,
    gap: 12,
    ...theme.effects.glassCard,
  },
  cardTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontFamily: theme.fonts.heading,
  },
  cardSubtitle: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontFamily: theme.fonts.body,
  },
  primaryButton: {
    height: 52,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: theme.colors.surface,
    fontSize: 15,
    fontFamily: theme.fonts.heading,
  },
  secondaryButton: {
    height: 52,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    color: theme.colors.text,
    fontSize: 15,
    fontFamily: theme.fonts.heading,
  },
  demoNote: {
    color: theme.colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },
  });
