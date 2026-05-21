// Tarjeta de resultado: muestra qué tan peligrosa es una zona consultada
// (por dirección buscada o por un punto tocado en el mapa).
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAlertyTheme } from "../lib/useAlertyTheme";
import { CATEGORY_LABELS } from "../lib/alerty/constants";
import { RISK_LABEL, RISK_RADIUS_KM, riskColor, type RiskAssessment, type RiskLevel } from "../lib/alerty/risk";

const ICON: Record<RiskLevel, keyof typeof Ionicons.glyphMap> = {
  tranquila: "shield-checkmark",
  moderada: "alert-circle",
  alta: "warning",
  critica: "warning",
};

const RADIUS_M = Math.round(RISK_RADIUS_KM * 1000);

export function ZoneRiskCard({
  assessment,
  label,
  onClose,
}: {
  assessment: RiskAssessment;
  label: string;
  onClose: () => void;
}) {
  const theme = useAlertyTheme();
  const styles = createStyles(theme);
  const color = riskColor(assessment.level, theme.colors);

  return (
    <View style={[styles.card, { borderColor: color }]}>
      <View style={styles.headerRow}>
        <View style={[styles.iconWrap, { backgroundColor: color }]}>
          <Ionicons name={ICON[assessment.level]} size={18} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.level, { color }]}>{RISK_LABEL[assessment.level]}</Text>
          <Text style={styles.place} numberOfLines={1}>{label}</Text>
        </View>
        <Pressable onPress={onClose} hitSlop={10} style={styles.close}>
          <Ionicons name="close" size={18} color={theme.colors.textMuted} />
        </Pressable>
      </View>

      {assessment.count === 0 ? (
        <Text style={styles.empty}>
          Sin reportes recientes en un radio de {RADIUS_M} m. Mantente atento de todos modos.
        </Text>
      ) : (
        <>
          <Text style={styles.summary}>
            {assessment.count} {assessment.count === 1 ? "incidente" : "incidentes"} en un radio de {RADIUS_M} m
          </Text>
          <View style={styles.chips}>
            {assessment.byCategory.map((c) => (
              <View key={c.category} style={styles.chip}>
                <Text style={styles.chipText}>
                  {CATEGORY_LABELS[c.category]} · {c.count}
                </Text>
              </View>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    card: {
      position: "absolute",
      left: 16,
      right: 16,
      bottom: 120,
      padding: 14,
      borderRadius: theme.radius.xl,
      backgroundColor: theme.colors.surface,
      borderWidth: 1.5,
      gap: 10,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 14,
      elevation: 10,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    iconWrap: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: "center",
      justifyContent: "center",
    },
    level: {
      fontSize: 15,
      fontFamily: theme.fonts.heading,
    },
    place: {
      fontSize: 12,
      fontFamily: theme.fonts.body,
      color: theme.colors.textMuted,
      marginTop: 1,
    },
    close: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: theme.colors.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
    },
    summary: {
      fontSize: 13,
      fontFamily: theme.fonts.body,
      color: theme.colors.text,
    },
    empty: {
      fontSize: 13,
      fontFamily: theme.fonts.body,
      color: theme.colors.textMuted,
      lineHeight: 18,
    },
    chips: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
    },
    chip: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    chipText: {
      fontSize: 11,
      fontFamily: theme.fonts.body,
      color: theme.colors.text,
    },
  });
