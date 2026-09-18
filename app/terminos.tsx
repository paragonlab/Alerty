import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAlertyStore } from "../lib/alerty/store";
import { consumeAuthNext } from "../lib/alerty/session";
import { useAlertyTheme } from "../lib/useAlertyTheme";
import { safeBack } from "../lib/alerty/nav";

const REGLAS = [
  {
    icon: "close-circle-outline" as const,
    title: "Tolerancia cero al contenido ofensivo",
    text: "Nada de insultos, acoso, amenazas, violencia gráfica, contenido sexual ni datos personales de terceros. Tampoco pulsos falsos para asustar o perjudicar a alguien.",
  },
  {
    icon: "flag-outline" as const,
    title: "Puedes reportar cualquier pulso",
    text: "Si algo te parece ofensivo o falso, repórtalo. Deja de verse para ti en ese momento.",
  },
  {
    icon: "person-remove-outline" as const,
    title: "Puedes bloquear a quien abusa",
    text: "Al bloquear una cuenta, sus pulsos desaparecen de tu mapa, de Pulsos y de Videos al instante.",
  },
  {
    icon: "time-outline" as const,
    title: "Revisamos en menos de 24 horas",
    text: "Quitamos el contenido que viola estas reglas y sacamos de Pulso a quien lo publicó.",
  },
  {
    icon: "information-circle-outline" as const,
    title: "Pulso informa, no es autoridad",
    text: "Lo que se publica aquí lo escriben vecinos. No sustituye al 911 ni a ninguna institución: confirma siempre por tu cuenta.",
  },
];

/**
 * Aceptación de términos con tolerancia cero. App Review 1.2 la exige para
 * cualquier app con contenido de usuarios; sin esto Apple no aprueba.
 */
export default function TerminosScreen() {
  const theme = useAlertyTheme();
  const styles = createStyles(theme);
  const router = useRouter();
  const acceptTerms = useAlertyStore((s) => s.acceptTerms);
  const termsAccepted = useAlertyStore((s) => s.termsAccepted);
  const [saving, setSaving] = useState(false);

  const accept = async () => {
    if (saving) return;
    setSaving(true);
    await acceptTerms();
    router.replace((consumeAuthNext() ?? "/(tabs)") as any);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Ionicons name="shield-checkmark" size={34} color={theme.colors.accent} />
          <Text style={styles.title}>Cómo nos tratamos en Pulso</Text>
          <Text style={styles.subtitle}>
            Pulso lo escriben vecinos. Para que sirva, hay reglas que no se negocian.
          </Text>
        </View>

        {REGLAS.map((regla) => (
          <View key={regla.title} style={styles.card}>
            <Ionicons name={regla.icon} size={20} color={theme.colors.accent} />
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{regla.title}</Text>
              <Text style={styles.cardText}>{regla.text}</Text>
            </View>
          </View>
        ))}

        <Text style={styles.legal}>
          Al continuar aceptas estas reglas y los términos de uso de Pulso. Si publicas
          contenido ofensivo o abusas de otras personas, tu cuenta se cierra sin aviso.
        </Text>

        {termsAccepted ? (
          <Pressable style={styles.secondary} onPress={() => safeBack(router)}>
            <Text style={styles.secondaryText}>Cerrar</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.accept} onPress={accept} disabled={saving}>
            <Text style={styles.acceptText}>{saving ? "Guardando…" : "Acepto y continúo"}</Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.colors.background },
    container: { padding: 20, paddingBottom: 40, gap: 12 },
    header: { alignItems: "center", gap: 8, marginBottom: 8 },
    title: {
      fontSize: 22,
      fontWeight: "700",
      color: theme.colors.text,
      textAlign: "center",
    },
    subtitle: {
      fontSize: 14,
      lineHeight: 20,
      color: theme.colors.textMuted,
      textAlign: "center",
    },
    card: {
      flexDirection: "row",
      gap: 12,
      padding: 14,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    cardTitle: { fontSize: 15, fontWeight: "700", color: theme.colors.text },
    cardText: { fontSize: 13, lineHeight: 19, color: theme.colors.textMuted, marginTop: 2 },
    legal: {
      fontSize: 12,
      lineHeight: 18,
      color: theme.colors.textMuted,
      marginTop: 4,
    },
    accept: {
      marginTop: 8,
      paddingVertical: 16,
      borderRadius: 999,
      alignItems: "center",
      backgroundColor: theme.colors.accent,
    },
    acceptText: { color: "#fff", fontSize: 16, fontWeight: "700" },
    secondary: {
      marginTop: 8,
      paddingVertical: 16,
      borderRadius: 999,
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    secondaryText: { color: theme.colors.text, fontSize: 15, fontWeight: "600" },
  });
