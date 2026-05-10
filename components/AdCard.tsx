import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAlertyTheme } from "../lib/useAlertyTheme";
import type { SponsoredZone } from "../lib/alerty/types";

export function AdCard({ zone, onPress }: { zone: SponsoredZone; onPress: () => void }) {
  const theme = useAlertyTheme();
  const styles = createStyles(theme);

  const isRefugio = zone.type === "refugio";

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.header}>
        <View style={[styles.badge, isRefugio ? styles.badgeRefugio : styles.badgeAnuncio]}>
          <Ionicons name={isRefugio ? "shield-checkmark" : "star"} size={14} color="#fff" />
          <Text style={styles.badgeText}>{isRefugio ? "Refugio Seguro" : "Patrocinado"}</Text>
        </View>
      </View>
      <Text style={styles.name}>{zone.name}</Text>
      <Text style={styles.description}>{zone.description}</Text>
      <View style={styles.footer}>
        <Text style={styles.footerText}>Toca para ver en el mapa</Text>
        <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} />
      </View>
    </Pressable>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.xl,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.accent + "40",
  },
  header: {
    flexDirection: "row",
    marginBottom: 8,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.radius.pill,
  },
  badgeRefugio: {
    backgroundColor: theme.colors.success,
  },
  badgeAnuncio: {
    backgroundColor: theme.colors.accent,
  },
  badgeText: {
    color: "#fff",
    fontSize: 12,
    fontFamily: theme.fonts.heading,
  },
  name: {
    fontSize: 16,
    fontFamily: theme.fonts.heading,
    color: theme.colors.text,
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    fontFamily: theme.fonts.body,
    color: theme.colors.textMuted,
    lineHeight: 20,
  },
  footer: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  footerText: {
    fontSize: 12,
    color: theme.colors.textMuted,
    fontFamily: theme.fonts.body,
  }
});
