import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  ALERT_CATEGORIES,
  CATEGORY_ICONS,
  CATEGORY_LABELS,
  INFO_DISCLAIMER,
} from "../lib/alerty/constants";
import { useAlertyStore } from "../lib/alerty/store";
import { consumeAuthNext } from "../lib/alerty/session";
import { useAlertyTheme } from "../lib/useAlertyTheme";
import type { AlertCategory } from "../lib/alerty/types";

/**
 * Primer paso de una cuenta nueva: elegir qué categorías ver. Aplica al mapa,
 * Pulsos, Videos, Avisos y notificaciones. El SOS no se puede apagar.
 */
export default function OnboardingScreen() {
  const theme = useAlertyTheme();
  const styles = createStyles(theme);
  const router = useRouter();
  const completeCategoryOnboarding = useAlertyStore((s) => s.completeCategoryOnboarding);
  const [selected, setSelected] = useState<AlertCategory[]>([...ALERT_CATEGORIES]);
  const [saving, setSaving] = useState(false);

  const toggle = (category: AlertCategory) => {
    if (category === "sos") return;
    setSelected((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category],
    );
  };

  const finish = async () => {
    if (saving) return;
    setSaving(true);
    await completeCategoryOnboarding(selected);
    router.replace((consumeAuthNext() ?? "/(tabs)") as any);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.eyebrow}>BIENVENIDO A PULSO</Text>
        <Text style={styles.title}>¿Qué quieres ver?</Text>
        <Text style={styles.subtitle}>
          Elige las categorías para tu mapa, Pulsos, Videos, Avisos y notificaciones. Puedes
          cambiarlas cuando quieras en Ajustes.
        </Text>

        <View style={styles.grid}>
          {ALERT_CATEGORIES.map((category) => {
            const on = selected.includes(category);
            const locked = category === "sos";
            return (
              <Pressable
                key={category}
                style={[styles.pill, on && styles.pillOn]}
                onPress={() => toggle(category)}
                disabled={locked}
                accessibilityLabel={
                  locked
                    ? "SOS siempre activo"
                    : `${CATEGORY_LABELS[category]} ${on ? "activa" : "apagada"}`
                }
              >
                <Ionicons
                  name={(locked ? "lock-closed" : CATEGORY_ICONS[category]) as any}
                  size={14}
                  color={on ? "#FFFFFF" : theme.colors.textMuted}
                />
                <Text style={[styles.pillText, on && styles.pillTextOn]}>
                  {CATEGORY_LABELS[category]}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.note}>El SOS siempre te llega: es la emergencia de alguien cerca.</Text>
        <Text style={styles.note}>{INFO_DISCLAIMER}</Text>

        <Pressable
          style={[styles.cta, saving && styles.ctaSaving]}
          onPress={() => void finish()}
          disabled={saving}
          accessibilityLabel="Guardar categorías y continuar"
        >
          <Text style={styles.ctaText}>{saving ? "Guardando…" : "Continuar"}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    container: {
      padding: 24,
      gap: 14,
    },
    eyebrow: {
      fontSize: 11,
      letterSpacing: 1.4,
      color: theme.colors.accent,
      fontFamily: theme.fonts.heading,
    },
    title: {
      fontSize: 28,
      color: theme.colors.text,
      fontFamily: theme.fonts.heading,
    },
    subtitle: {
      fontSize: 14,
      lineHeight: 20,
      color: theme.colors.textMuted,
      fontFamily: theme.fonts.body,
    },
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginTop: 6,
    },
    pill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    pillOn: {
      backgroundColor: theme.colors.accent,
      borderColor: theme.colors.accent,
    },
    pillText: {
      fontSize: 13,
      color: theme.colors.text,
      fontFamily: theme.fonts.body,
    },
    pillTextOn: {
      color: "#FFFFFF",
      fontFamily: theme.fonts.heading,
    },
    note: {
      fontSize: 12,
      lineHeight: 17,
      color: theme.colors.textMuted,
      fontFamily: theme.fonts.body,
    },
    cta: {
      marginTop: 10,
      backgroundColor: theme.colors.accent,
      borderRadius: 14,
      paddingVertical: 15,
      alignItems: "center",
    },
    ctaSaving: {
      opacity: 0.6,
    },
    ctaText: {
      color: "#FFFFFF",
      fontSize: 15,
      fontFamily: theme.fonts.heading,
    },
  });
