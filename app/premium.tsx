import { useRouter } from "expo-router";
import { View, Text, StyleSheet, Pressable, ScrollView, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAlertyTheme } from "../lib/useAlertyTheme";
import { useAlertyStore } from "../lib/alerty/store";
import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function PremiumScreen() {
  const router = useRouter();
  const theme = useAlertyTheme();
  const styles = createStyles(theme);
  const { currentUser } = useAlertyStore();
  const [loading, setLoading] = useState(false);

  const isAlreadyPremium = currentUser.isPremium;

  const handleSubscribe = async () => {
    if (isAlreadyPremium) return;
    
    setLoading(true);
    try {
      // Simulación de pasarela de pago (ej: invocación a RevenueCat o Stripe SDK)
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Actualizamos directamente en Supabase
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { error } = await supabase
          .from("users")
          .update({ is_premium: true })
          .eq("id", session.user.id);
          
        if (error) throw error;
        
        // Recargar el perfil para actualizar Zustand
        await useAlertyStore.getState().loadUserProfile();
        
        Alert.alert("¡Felicidades!", "Ahora eres usuario de Alerty Plus. 🎉", [
          { text: "Continuar", onPress: () => router.back() }
        ]);
      }
    } catch (e: any) {
      Alert.alert("Error", "No se pudo procesar el pago: " + e.message);
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
            <View style={styles.activePlanCard}>
              <Ionicons name="checkmark-circle" size={24} color={theme.colors.success} />
              <Text style={[styles.priceText, { color: theme.colors.success }]}>
                Ya eres Alerty Plus
              </Text>
            </View>
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
                  <Text style={styles.subscribeText}>Mejorar por $4.99/mes</Text>
                  <Text style={styles.cancelText}>Cancela cuando quieras</Text>
                </>
              )}
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
