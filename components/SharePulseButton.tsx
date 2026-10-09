import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getActiveCityName } from "../lib/alerty/city";
import { cleanShareTitle } from "../lib/alerty/displayTitle";
import { CATEGORY_LABELS } from "../lib/alerty/constants";
import { shareAlertPulse, shareAlertToWhatsApp } from "../lib/alerty/share";
import type { AlertItem, CommunityPost } from "../lib/alerty/types";
import { useAlertyTheme } from "../lib/useAlertyTheme";

type AlertProps = {
  alert: AlertItem;
  post?: never;
  variant?: "compact" | "full";
};

type PostProps = {
  post: CommunityPost;
  alert?: never;
  variant?: "compact" | "full";
};

type Props = AlertProps | PostProps;

export function SharePulseButton(props: Props) {
  const theme = useAlertyTheme();
  const [busy, setBusy] = useState(false);
  const variant = props.variant ?? "compact";

  const payload = props.alert
    ? {
        title: cleanShareTitle(
          props.alert.title,
          CATEGORY_LABELS[props.alert.category] ?? props.alert.category,
          80,
        ),
        neighborhood: props.alert.neighborhood,
        alertId: props.alert.id,
        category: props.alert.category,
        status: props.alert.status,
        cityName: getActiveCityName(),
        kind: "alert" as const,
      }
    : {
        title: cleanShareTitle(
          props.post.text,
          props.post.categoryGuess
            ? (CATEGORY_LABELS as Record<string, string>)[props.post.categoryGuess]
            : "Aviso",
          80,
        ),
        neighborhood: props.post.placeLabel,
        alertId: props.post.id,
        category: props.post.categoryGuess ?? "otro",
        cityName: getActiveCityName(),
        kind: "community" as const,
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
      await shareAlertToWhatsApp({ ...payload, alertId: payload.alertId });
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
