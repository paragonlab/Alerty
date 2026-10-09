import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getActiveCityName } from "../lib/alerty/city";
import { displayTitle } from "../lib/alerty/displayTitle";
import { CATEGORY_LABELS } from "../lib/alerty/constants";
import { shareAlertPulse, shareAlertToWhatsApp } from "../lib/alerty/share";
import type { AlertItem } from "../lib/alerty/types";
import { useAlertyTheme } from "../lib/useAlertyTheme";

type Props = {
  alert: AlertItem;
  /** compact = solo icono; full = Compartir + WhatsApp */
  variant?: "compact" | "full";
};

export function SharePulseButton({ alert, variant = "compact" }: Props) {
  const theme = useAlertyTheme();
  const [busy, setBusy] = useState(false);
  const title = displayTitle(
    alert.title,
    CATEGORY_LABELS[alert.category] ?? alert.category,
  );

  const payload = {
    title,
    neighborhood: alert.neighborhood,
    alertId: alert.id,
    category: alert.category,
    status: alert.status,
    cityName: getActiveCityName(),
  };

  const onShare = async () => {
    setBusy(true);
    try {
      await shareAlertPulse(payload);
    } finally {
      setBusy(false);
    }
  };

  const onWhatsApp = async () => {
    setBusy(true);
    try {
      await shareAlertToWhatsApp(payload);
    } finally {
      setBusy(false);
    }
  };

  if (variant === "compact") {
    return (
      <Pressable
        onPress={onShare}
        hitSlop={10}
        accessibilityLabel="Compartir pulso"
        style={({ pressed }) => [{ opacity: pressed || busy ? 0.6 : 1 }]}
      >
        {busy ? (
          <ActivityIndicator size="small" color={theme.colors.textMuted} />
        ) : (
          <Ionicons name="share-outline" size={20} color={theme.colors.text} />
        )}
      </Pressable>
    );
  }

  return (
    <View style={styles.row}>
      <Pressable
        style={[styles.btn, { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.border }]}
        onPress={onShare}
        disabled={busy}
      >
        <Ionicons name="share-outline" size={16} color={theme.colors.text} />
        <Text style={[styles.btnText, { color: theme.colors.text }]}>Compartir</Text>
      </Pressable>
      <Pressable
        style={[styles.btn, styles.wa, { borderColor: "#25D366" }]}
        onPress={onWhatsApp}
        disabled={busy}
      >
        <Ionicons name="logo-whatsapp" size={16} color="#25D366" />
        <Text style={[styles.btnText, { color: "#128C7E" }]}>WhatsApp</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  wa: { backgroundColor: "rgba(37,211,102,0.1)" },
  btnText: { fontSize: 13, fontFamily: "SpaceGrotesk_500Medium" },
});
