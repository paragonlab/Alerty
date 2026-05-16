import { useLocalSearchParams, useRouter } from "expo-router";
import { View, Text, StyleSheet, Pressable, ScrollView, Alert, ActivityIndicator, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAlertyTheme } from "../lib/useAlertyTheme";
import { useAlertyStore } from "../lib/alerty/store";
import { useEffect, useState } from "react";
import * as WebBrowser from "expo-web-browser";
import {
  getOfferings,
  hasActivePlus,
  identifyUser,
  isRevenueCatConfigured,
  purchasePlus,
  restorePurchases,
  type PurchasesPackage,
} from "../lib/revenuecat";
import { supabase } from "../lib/supabase";

export default function PremiumScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ status?: string }>();
  const theme = useAlertyTheme();
  const styles = createStyles(theme);
  const { currentUser } = useAlertyStore();
  const [loading, setLoading] = useState(false);
  const [pkg, setPkg] = useState<PurchasesPackage | null>(null);

  const isAlreadyPremium = currentUser.isPremium;

  // Stripe regresa a esta pantalla con ?status=success|cancel después del Checkout web
  useEffect(() => {
    if (!params.status) return;
    if (params.status === "success") {
      // El webhook actualiza is_premium de forma asíncrona. Sondeamos brevemente.
      let attempts = 0;
      const interval = setInterval(async () => {
        attempts++;
        await useAlertyStore.getState().loadUserProfile();
        const { currentUser: latest } = useAlertyStore.getState();
        if (latest.isPremium || attempts >= 6) {
          clearInterval(interval);
          if (latest.isPremium) {
            Alert.alert("¡Felicidades!", "Ahora eres usuario de Alerty Plus. 🎉");
          } else {
            Alert.alert(
              "Pago recibido",
              "Estamos confirmando tu suscripción. Refresca en unos segundos.",
            );
          }
        }
      }, 1500);
      return () => clearInterval(interval);
    }
    if (params.status === "cancel") {
      Alert.alert("Pago cancelado", "No se completó tu suscripción.");
    }
  }, [params.status]);

  useEffect(() => {
    if (!currentUser.id || currentUser.id === "local-user") return;
    let cancelled = false;
    (async () => {
      try {
        await identifyUser(currentUser.id);
        const packages = await getOfferings();
        if (!cancelled && packages.length) setPkg(packages[0]);
      } catch {
        // silencioso: el botón mostrará un mensaje si no hay package
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentUser.id]);

  const handleSubscribe = async () => {
    if (isAlreadyPremium) return;

    if (!isRevenueCatConfigured) {
      Alert.alert(
        "Pagos no disponibles",
        Platform.OS === "web"
          ? "Configura la edge function stripe-checkout-plus para habilitar pagos."
          : "Configura EXPO_PUBLIC_REVENUECAT_IOS_KEY / EXPO_PUBLIC_REVENUECAT_ANDROID_KEY.",
      );
      return;
    }

    if (!pkg) {
      Alert.alert("Error", "No hay planes disponibles. Intenta de nuevo más tarde.");
      return;
    }

    setLoading(true);
    try {
      const { customerInfo, cancelled } = await purchasePlus(pkg);
      if (cancelled) return;

      // En mobile, RevenueCat ya marcó la compra como exitosa.
      // El webhook actualizará users.is_premium en Supabase de forma asíncrona.
      // Refrescamos el perfil tras un breve delay para reflejar el cambio.
      if (Platform.OS !== "web") {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        await useAlertyStore.getState().loadUserProfile();
        Alert.alert("¡Felicidades!", "Ahora eres usuario de Alerty Plus. 🎉", [
          { text: "Continuar", onPress: () => router.back() },
        ]);
      }
      // En web no llegamos aquí — purchasePlus redirige fuera de la app.
      void customerInfo;
    } catch (e: any) {
      Alert.alert("Error", "No se pudo procesar el pago: " + (e?.message ?? "desconocido"));
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    setLoading(true);
    try {
      const info = await restorePurchases();
      if (info && hasActivePlus(info)) {
        await useAlertyStore.getState().loadUserProfile();
        Alert.alert("Listo", "Tu suscripción Plus se restauró correctamente.");
      } else {
        Alert.alert("Sin compras", "No encontramos una suscripción activa para restaurar.");
      }
    } catch (e: any) {
      Alert.alert("Error", "No se pudo restaurar: " + (e?.message ?? "desconocido"));
    } finally {
      setLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-customer-portal", {
        method: "POST",
      });
      if (error) throw error;
      const url = (data as any)?.url as string | undefined;
      if (!url) throw new Error("No se obtuvo URL del portal");

      if (Platform.OS === "web") {
        if (typeof window !== "undefined") window.location.href = url;
      } else {
        await WebBrowser.openBrowserAsync(url);
      }
    } catch (e: any) {
      Alert.alert("Error", "No se pudo abrir el portal: " + (e?.message ?? "desconocido"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.closeButton}>
          <Ionicons name="close" size={24} color={theme.colors.textMuted} />
        </Pressable>
      </View>
      
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.heroSection}>
          <Ionicons name="shield-checkmark" size={60} color={theme.colors.accent} />
          <Text style={styles.title}>Alerty <Text style={{ color: theme.colors.accent }}>Plus</Text></Text>
          <Text style={styles.subtitle}>Desbloquea la seguridad definitiva para ti y tu familia.</Text>
        </View>

        <View style={styles.featuresList}>
          <FeatureItem 
            icon="flame" 
            title="Mapa de Calor de Riesgos" 
            description="Visualiza áreas peligrosas según el histórico de incidentes." 
            theme={theme}
          />
          <FeatureItem 
            icon="chatbubbles" 
            title="Alertas por SMS Inmediatas" 
            description="Recibe alertas críticas incluso sin conexión a internet o datos móviles." 
            theme={theme}
          />
          <FeatureItem 
            icon="people" 
            title="Zonas Múltiples Seguras" 
            description="Agrega hasta 5 zonas para notificar a tu familia." 
            theme={theme}
          />
          <FeatureItem 
            icon="star" 
            title="Insignia de Confianza" 
            description="Tus reportes tienen mayor visibilidad instantánea." 
            theme={theme}
          />
        </View>

        <View style={styles.pricingSection}>
          {isAlreadyPremium ? (
            <>
              <View style={styles.activePlanCard}>
                <Ionicons name="checkmark-circle" size={24} color={theme.colors.success} />
                <Text style={[styles.priceText, { color: theme.colors.success }]}>
                  Ya eres Alerty Plus
                </Text>
              </View>
              {Platform.OS === "web" && (
                <Pressable
                  style={styles.manageButton}
                  onPress={handleManageSubscription}
                  disabled={loading}
                >
                  <Text style={styles.manageText}>Gestionar suscripción</Text>
                </Pressable>
              )}
            </>
          ) : (
            <Pressable
              style={[styles.subscribeButton, loading && { opacity: 0.7 }]}
              onPress={handleSubscribe}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={styles.subscribeText}>Mejorar por $99 MXN/mes</Text>
                  <Text style={styles.cancelText}>Cancela cuando quieras</Text>
                </>
              )}
            </Pressable>
          )}

          {Platform.OS !== "web" && !isAlreadyPremium && (
            <Pressable
              style={styles.restoreButton}
              onPress={handleRestore}
              disabled={loading}
            >
              <Text style={styles.restoreText}>Restaurar compras</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function FeatureItem({ icon, title, description, theme }: any) {
  const styles = createStyles(theme);
  return (
    <View style={styles.featureItem}>
      <View style={styles.featureIconWrap}>
        <Ionicons name={icon} size={22} color={theme.colors.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureDesc}>{description}</Text>
      </View>
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.surface,
  },
  header: {
    flexDirection: "row",
    justifyContent: "flex-end",
    padding: 16,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  container: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  heroSection: {
    alignItems: "center",
    marginTop: 10,
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontFamily: theme.fonts.heading,
    color: theme.colors.text,
    marginTop: 16,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: theme.fonts.body,
    color: theme.colors.textMuted,
    textAlign: "center",
    marginTop: 8,
    paddingHorizontal: 20,
  },
  featuresList: {
    gap: 24,
    marginBottom: 40,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  featureIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  featureTitle: {
    fontSize: 16,
    fontFamily: theme.fonts.heading,
    color: theme.colors.text,
    marginBottom: 4,
  },
  featureDesc: {
    fontSize: 13,
    fontFamily: theme.fonts.body,
    color: theme.colors.textMuted,
    lineHeight: 18,
  },
  pricingSection: {
    alignItems: "center",
    gap: 12,
  },
  manageButton: {
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceAlt,
  },
  manageText: {
    color: theme.colors.text,
    fontSize: 14,
    fontFamily: theme.fonts.heading,
  },
  restoreButton: {
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  restoreText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontFamily: theme.fonts.body,
    textDecorationLine: "underline",
  },
  subscribeButton: {
    backgroundColor: theme.colors.accent,
    width: "100%",
    paddingVertical: 16,
    borderRadius: theme.radius.xl,
    alignItems: "center",
    shadowColor: theme.colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  subscribeText: {
    color: "#fff",
    fontFamily: theme.fonts.heading,
    fontSize: 18,
  },
  cancelText: {
    color: "rgba(255,255,255,0.7)",
    fontFamily: theme.fonts.body,
    fontSize: 12,
    marginTop: 4,
  },
  activePlanCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: theme.colors.success + "22",
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.success + "50",
  },
  priceText: {
    fontFamily: theme.fonts.heading,
    fontSize: 16,
  }
});
